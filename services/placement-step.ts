import type { PlacementStepRequestBody, PlacementStepSuccessBody } from '@/types/placement-api';
import { postPlacementStep } from '@/services/placement-api';
import { warmCompanionApi } from '@/utils/companion-api-fetch';
import {
  mintNextLocalPlacementQuestion,
  runLocalPlacementStep,
} from '@/utils/placement-local-engine';
import { difficultyToScale100 } from '@/utils/placement-adaptive';
import { normalizePlacementPrompt, questionContentKey } from '@/utils/placement-seen';

/**
 * Prefer AI, but never strand the UI on a dead Render/TLS hang.
 * Give cold Render enough time to mint — local bank is emergency only.
 */
const START_BUDGET_MS = 28_000;
const STEP_BUDGET_MS = 35_000;
const PREFETCH_WAIT_MS = 12_000;
const WARM_SLICE_MS = 6_000;

type PrefetchSlot = {
  key: string;
  promise: Promise<PlacementStepSuccessBody | null>;
};

let prefetchSlot: PrefetchSlot | null = null;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function bodyKey(body: PlacementStepRequestBody): string {
  return JSON.stringify(body);
}

export function warmPlacementApi(): void {
  void warmCompanionApi(3, { pingTimeoutMs: 8_000 });
}

export function prefetchPlacementStep(body: PlacementStepRequestBody): void {
  const key = bodyKey(body);
  if (prefetchSlot?.key === key) return;
  prefetchSlot = {
    key,
    promise: (async () => {
      await Promise.race([
        warmCompanionApi(2, { pingTimeoutMs: 8_000 }),
        sleep(WARM_SLICE_MS),
      ]);
      try {
        return await postPlacementStep(body, {
          timeoutMs: STEP_BUDGET_MS,
          retries: 1,
          skipWarm: true,
        });
      } catch {
        return null;
      }
    })(),
  };
}

export function clearPlacementPrefetch(): void {
  prefetchSlot = null;
}

function isDuplicateQuestion(
  body: PlacementStepRequestBody,
  res: PlacementStepSuccessBody,
): boolean {
  if (res.done) return false;
  const last = body.lastQuestion;
  if (
    last &&
    (normalizePlacementPrompt(res.question.prompt) === normalizePlacementPrompt(last.prompt) ||
      res.question.id === last.id)
  ) {
    return true;
  }
  const seenPrompts = new Set((body.seenPrompts ?? []).map(normalizePlacementPrompt));
  const seenIds = new Set(body.seenQuestionIds ?? []);
  const seenKeys = new Set(body.seenContentKeys ?? []);
  if (seenPrompts.has(normalizePlacementPrompt(res.question.prompt)) || seenIds.has(res.question.id)) {
    return true;
  }
  return seenKeys.has(questionContentKey(res.question));
}

async function fetchRemoteStep(
  body: PlacementStepRequestBody,
  budgetMs: number,
): Promise<PlacementStepSuccessBody | null> {
  const deadline = Date.now() + budgetMs;
  await Promise.race([
    warmCompanionApi(2, { pingTimeoutMs: Math.min(8_000, budgetMs) }),
    sleep(Math.min(WARM_SLICE_MS, budgetMs)),
  ]);

  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    if (remaining < 800) break;
    try {
      return await postPlacementStep(body, {
        timeoutMs: remaining,
        retries: 1,
        skipWarm: true,
      });
    } catch {
      if (Date.now() >= deadline) break;
      await sleep(350);
    }
  }
  return null;
}

function ensureFreshLocal(body: PlacementStepRequestBody): PlacementStepSuccessBody {
  let working = {
    ...body,
    // Force a brand-new local stream so emergency fallback never clones a prior test.
    sessionSalt: (body.sessionSalt ?? Date.now()) ^ (Date.now() & 0xffffff) ^ 0xa5a5a5a5,
    userEntropy: (body.userEntropy ?? 1) ^ Date.now() ^ Math.floor(Math.random() * 0xffffffff),
  };
  let res = runLocalPlacementStep(working);
  if (res.done) return res;
  const scoredCorrect = res.correct;
  const scoredAbility = res.ability;
  for (let i = 0; i < 12 && isDuplicateQuestion(working, res); i += 1) {
    working = {
      ...working,
      sessionSalt: (working.sessionSalt ?? Date.now()) + 10_007 * (i + 1) + Date.now(),
      userEntropy: (working.userEntropy ?? 0) ^ (0x9e3779b9 * (i + 1)),
      seenQuestionIds: [...(working.seenQuestionIds ?? []), res.question.id],
      seenPrompts: [...(working.seenPrompts ?? []), res.question.prompt],
      seenContentKeys: [
        ...(working.seenContentKeys ?? []),
        questionContentKey(res.question),
      ],
    };
    const reminted = mintNextLocalPlacementQuestion(working);
    if (reminted.done) return reminted;
    res = { ...reminted, correct: scoredCorrect, ability: scoredAbility };
  }
  return res;
}

/**
 * The API used to keep only 12 answers of a 15-question test, so the
 * counter stayed on question 14 forever. A healthy answer step returns
 * historyLength + 2 (the next 1-based item). Anything lower did not advance.
 */
function remoteQuestionTooHard(
  body: PlacementStepRequestBody,
  res: PlacementStepSuccessBody,
): boolean {
  if (res.done) return false;
  const local = runLocalPlacementStep(body);
  if (local.done) return false;
  return difficultyToScale100(res.question.difficulty) > local.question.difficulty + 12;
}

/**
 * The API used to keep only 12 answers of a 15-question test, so the
 * counter stayed on question 14 forever. A healthy answer step returns
 * historyLength + 2 (the next 1-based item). Anything lower did not advance.
 */
function remoteDidNotAdvance(
  body: PlacementStepRequestBody,
  res: PlacementStepSuccessBody,
): boolean {
  if (res.done || body.action !== 'answer') return false;
  const sent = Number.isFinite(body.questionIndex) ? Number(body.questionIndex) : 0;
  return res.questionIndex < sent + 2;
}

/** Prefer AI; if duplicate or the counter did not move, finish from the full local history. */
async function preferFreshAi(
  body: PlacementStepRequestBody,
  res: PlacementStepSuccessBody,
  budgetMs: number,
): Promise<PlacementStepSuccessBody> {
  if (res.done) return res;
  if (remoteDidNotAdvance(body, res) || remoteQuestionTooHard(body, res)) return ensureFreshLocal(body);
  if (!isDuplicateQuestion(body, res)) return res;

  const retryBody: PlacementStepRequestBody = {
    ...body,
    sessionSalt: (body.sessionSalt ?? Date.now()) + 4243 + Date.now(),
    seenQuestionIds: [...(body.seenQuestionIds ?? []), res.question.id],
    seenPrompts: [...(body.seenPrompts ?? []), res.question.prompt],
    seenContentKeys: [...(body.seenContentKeys ?? []), questionContentKey(res.question)],
  };
  const retry = await fetchRemoteStep(retryBody, Math.min(budgetMs, 6_000));
  if (retry && !isDuplicateQuestion(retryBody, retry)) return retry;
  return ensureFreshLocal(retryBody);
}

/** Старт — короткий шанс на AI, иначе локальный тест без зависания. */
export async function runPlacementStart(
  body: PlacementStepRequestBody,
): Promise<PlacementStepSuccessBody> {
  const remote = await fetchRemoteStep(body, START_BUDGET_MS);
  if (remote) return preferFreshAi(body, remote, START_BUDGET_MS);
  return ensureFreshLocal(body);
}

/**
 * Ответ / следующий шаг: prefetch AI или короткий wait API.
 * Локальные шаблоны — аварийный fallback без сети (и всегда с новым salt).
 */
export async function runPlacementStep(
  body: PlacementStepRequestBody,
): Promise<PlacementStepSuccessBody> {
  const key = bodyKey(body);
  if (prefetchSlot?.key === key) {
    const prefetched = await Promise.race([
      prefetchSlot.promise,
      sleep(PREFETCH_WAIT_MS).then(() => null),
    ]);
    prefetchSlot = null;
    if (prefetched) return preferFreshAi(body, prefetched, STEP_BUDGET_MS);
  }

  const remote = await fetchRemoteStep(body, STEP_BUDGET_MS);
  if (remote) return preferFreshAi(body, remote, STEP_BUDGET_MS);
  return ensureFreshLocal(body);
}
