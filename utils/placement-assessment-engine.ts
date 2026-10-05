/**
 * Client adapter: existing Placement API shapes ↔ PlacementOrchestrationService.
 * Onboarding UI unchanged; item selection / ability / CEFR / confidence via shared core.
 *
 * NOTE: `ability` 0–100 is a compatibility field for API/prefetch only.
 * It is NOT shown as "your level" or "percent knowledge" in the placement UI.
 * Source of truth remains AssessmentState.posterior / verifiedPlacementLevel.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CompanionChatApiLanguage } from '@/types/companion-chat-api';
import type {
  PlacementQuestion,
  PlacementStepRequestBody,
  PlacementStepSuccessBody,
} from '@/types/placement-api';
import {
  bankToScale100,
  clamp,
  conservativePlacementLevel,
  ensureCorrectChoiceInList,
  hskFromAbility,
  isWeakPlacementQuestion,
  shuffleChoices,
  stripPinyin,
} from '@/utils/placement-adaptive';
import { PLACEMENT_LOCAL_BANK, type LocalPlacementQuestion } from '@/utils/placement-local-questions';
import { pickAdaptiveQuestion } from '@/utils/placement-question-generator';

import {
  PlacementOrchestrationService,
  contentFromLegacyBankQuestion,
  createMemoryAnalyticsSink,
  recoverPlacementSession,
  type PlacementContentItem,
  type PlacementSessionSnapshot,
} from '@tearz/assessment/placement';
import { loadBundledContentBank } from '@tearz/assessment/banks';
import { getPlacementProductionFlags } from '@/utils/placement-production-flags';

/** Bump when content bank source changes so old local-bank sessions cannot resume. */
const SESSION_KEY_PREFIX = '@tearz/placement-session.v3:';
const serviceCache = new Map<string, PlacementOrchestrationService>();

function base64EncodeUtf8(str: string): string {
  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(unescape(encodeURIComponent(str)));
  }
  throw new Error('base64 encode unavailable');
}

function encodeAnswerKey(id: string, correctChoice: string) {
  const payload = JSON.stringify({ id, c: correctChoice });
  const b64 = base64EncodeUtf8(payload);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sanitizeLocal(
  q: LocalPlacementQuestion,
  lang: CompanionChatApiLanguage,
): LocalPlacementQuestion | null {
  let prompt = q.prompt;
  let choices = [...q.choices];
  let correctChoice = q.correctChoice;
  if (lang === 'chinese') {
    prompt = stripPinyin(prompt);
    choices = choices.map(stripPinyin);
    correctChoice = stripPinyin(correctChoice);
  }
  const merged = ensureCorrectChoiceInList({ ...q, prompt, choices, correctChoice });
  if (isWeakPlacementQuestion(merged.prompt, merged.choices, merged.kind)) {
    if (!merged.choices.includes(merged.correctChoice) || merged.choices.length < 4) return null;
  }
  return shuffleChoices(merged);
}

export function buildClientContentBank(
  lang: CompanionChatApiLanguage,
  opts?: { sessionSalt?: number; userEntropy?: number },
): PlacementContentItem[] {
  const flags = getPlacementProductionFlags();
  if (flags.contentBankSource === 'v1') {
    const bundled = loadBundledContentBank(lang, flags.bankVersion);
    if (bundled.length > 0) {
      // Light session salt shuffle of order only — IRT selection still picks by difficulty.
      const salt = (opts?.sessionSalt ?? 42) ^ (opts?.userEntropy ?? 0);
      return bundled
        .map((item, i) => ({ item, k: (Math.sin(salt * 0.001 + i * 12.9898) * 43758.5453) % 1 }))
        .sort((a, b) => a.k - b.k)
        .map((x) => x.item);
    }
    // Fail closed to empty only if pack missing — caller/mint handles; prefer not to silently use tiny legacy.
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[placement] v1 bank empty for', lang, '— falling back to legacy local');
    }
  }

  const local = PLACEMENT_LOCAL_BANK[lang] ?? PLACEMENT_LOCAL_BANK.english;
  const bank: PlacementContentItem[] = [];
  const seen = new Set<string>();

  for (const q of local) {
    const sanitized = sanitizeLocal(q, lang);
    if (!sanitized) continue;
    const item = contentFromLegacyBankQuestion(
      {
        ...sanitized,
        language: lang,
        difficulty: bankToScale100(sanitized.difficulty),
      },
      { difficultyAlready100: true, qualityGate: 'PASS' },
    );
    if (item && !seen.has(item.item.id)) {
      seen.add(item.item.id);
      bank.push(item);
    }
  }

  const salt = opts?.sessionSalt ?? 42;
  const entropy = opts?.userEntropy ?? 0;
  for (let i = 0; i < 48 && bank.length < 60; i += 1) {
    const targetBank = clamp(1 + (i % 25), 1, 25);
    const picked = pickAdaptiveQuestion({
      lang,
      questionIndex: i,
      history: [],
      targetDifficulty: targetBank,
      allowWeak: true,
      seenIds: [...seen],
      seenPrompts: [],
      seenContentKeys: [],
      sessionSalt: salt + i * 104729,
      userEntropy: entropy,
    });
    const sanitized = sanitizeLocal(picked, lang);
    if (!sanitized || seen.has(sanitized.id)) continue;
    const item = contentFromLegacyBankQuestion(
      {
        ...sanitized,
        language: lang,
        difficulty: bankToScale100(sanitized.difficulty),
      },
      { difficultyAlready100: true, qualityGate: 'PASS' },
    );
    if (!item) continue;
    seen.add(item.item.id);
    bank.push(item);
  }

  return bank;
}

function shadowLegacy(answers: Array<{ correct: boolean; difficulty100: number }>): string {
  let ability = 8;
  const history: Array<{ difficulty: number; correct: boolean; section: string; prompt: string }> =
    [];
  for (const a of answers) {
    history.push({
      difficulty: a.difficulty100,
      correct: a.correct,
      section: 'grammar',
      prompt: 'x',
    });
    const delta = a.difficulty100 - ability;
    const change = a.correct ? Math.max(2, 8 + delta * 0.15) : -Math.max(2, 6 - delta * 0.1);
    ability = clamp(Math.round(ability + change), 0, 100);
  }
  return conservativePlacementLevel(ability, history);
}

function toContinue(step: {
  correct?: boolean | null;
  ability: number;
  questionIndex: number;
  totalQuestions: number;
  question: {
    id: string;
    kind: string;
    instruction: string;
    prompt: string;
    choices: string[];
    difficulty: number;
    section: string;
  };
  answerKey: string;
}): Extract<PlacementStepSuccessBody, { done: false }> {
  return {
    done: false,
    correct: step.correct,
    ability: step.ability,
    questionIndex: step.questionIndex,
    totalQuestions: step.totalQuestions,
    question: step.question as PlacementQuestion,
    answerKey: step.answerKey,
  };
}

function toDone(
  step: {
    ability: number;
    sessionId?: string;
    result: {
      level: string;
      score: number;
      summary: string;
      strengths: string[];
      gaps: string[];
      hskLevel?: string;
      statisticalEstimate?: string;
      theta?: number;
      thetaCredibleInterval?: { lower: number; upper: number };
      confidence?: number;
      confidenceLabel?: string;
      levelProbabilities?: Record<string, number>;
      skillProfile?: unknown;
      verification?: unknown;
      versions?: {
        assessmentEngineVersion: string;
        orchestratorVersion: string;
        cefrMapVersion: string;
        itemQualityVersion: string;
        placementVersion: string;
      };
    };
    record?: {
      assessmentEngineVersion?: string;
      orchestratorVersion?: string;
      cefrMapVersion?: string;
      itemQualityVersion?: string;
      placementVersion?: string;
      sessionId?: string;
      assessmentSessionId?: string;
      statisticalEstimate?: string;
      theta?: number;
      thetaCredibleInterval?: { lower: number; upper: number };
      confidence?: number;
      confidenceLabel?: string;
      levelProbabilities?: Record<string, number>;
      skillProfile?: unknown;
      verification?: unknown;
    };
  },
  lang: CompanionChatApiLanguage,
): Extract<PlacementStepSuccessBody, { done: true }> {
  const versions = step.result.versions;
  const sessionId = step.sessionId ?? step.record?.assessmentSessionId ?? step.record?.sessionId;
  return {
    done: true,
    ability: step.ability,
    result: {
      level: step.result.level,
      score: step.result.score,
      summary: step.result.summary,
      strengths: step.result.strengths,
      gaps: step.result.gaps,
      hskLevel:
        lang === 'chinese' ? step.result.hskLevel ?? hskFromAbility(step.ability) : undefined,
      statisticalEstimate: step.result.statisticalEstimate ?? step.record?.statisticalEstimate,
      theta: step.result.theta ?? step.record?.theta,
      thetaCredibleInterval:
        step.result.thetaCredibleInterval ?? step.record?.thetaCredibleInterval,
      confidence: step.result.confidence ?? step.record?.confidence,
      confidenceLabel: step.result.confidenceLabel ?? step.record?.confidenceLabel,
      levelProbabilities: step.result.levelProbabilities ?? step.record?.levelProbabilities,
      skillProfile: step.result.skillProfile ?? step.record?.skillProfile,
      verification: step.result.verification ?? step.record?.verification,
      assessmentEngineVersion:
        versions?.assessmentEngineVersion ?? step.record?.assessmentEngineVersion,
      orchestratorVersion: versions?.orchestratorVersion ?? step.record?.orchestratorVersion,
      cefrMapVersion: versions?.cefrMapVersion ?? step.record?.cefrMapVersion,
      itemQualityVersion: versions?.itemQualityVersion ?? step.record?.itemQualityVersion,
      placementVersion: versions?.placementVersion ?? step.record?.placementVersion,
      sessionId,
      assessmentSessionId: sessionId,
    },
  };
}

async function persistSnapshot(language: string, snap: PlacementSessionSnapshot) {
  try {
    await AsyncStorage.setItem(`${SESSION_KEY_PREFIX}${language}`, JSON.stringify(snap));
  } catch {
    /* non-fatal */
  }
}

export async function loadPlacementSessionSnapshot(
  language: string,
): Promise<PlacementSessionSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(`${SESSION_KEY_PREFIX}${language}`);
    if (!raw) return null;
    // Known ids from the same bank we would resume with (legacy local for phase-1).
    const bank = buildClientContentBank(language as CompanionChatApiLanguage);
    const knownItemIds = new Set(bank.map((c) => c.item.id));
    // Minted ids from the saved session itself are also acceptable for resume.
    try {
      const peek = JSON.parse(raw) as {
        presentedItemIds?: string[];
        pendingItemId?: string | null;
      };
      for (const id of peek.presentedItemIds ?? []) knownItemIds.add(id);
      if (peek.pendingItemId) knownItemIds.add(peek.pendingItemId);
    } catch {
      /* recoverPlacementSession handles invalid JSON */
    }
    const recovered = recoverPlacementSession(raw, {
      language,
      knownItemIds,
      maxQuestions: 15,
    });
    if (!recovered.ok) {
      if (recovered.clearSession) {
        await clearPlacementSessionSnapshot(language);
      }
      return null;
    }
    return recovered.snapshot;
  } catch {
    return null;
  }
}

export async function clearPlacementSessionSnapshot(language: string) {
  try {
    await AsyncStorage.removeItem(`${SESSION_KEY_PREFIX}${language}`);
  } catch {
    /* ignore */
  }
}

function cacheKey(lang: string, salt?: number) {
  return `${lang}:${salt ?? 0}`;
}

function clearCachedService(lang: string) {
  for (const k of [...serviceCache.keys()]) {
    if (k.startsWith(`${lang}:`)) serviceCache.delete(k);
  }
}

function createService(
  lang: CompanionChatApiLanguage,
  body: PlacementStepRequestBody,
  snap?: PlacementSessionSnapshot | null,
): PlacementOrchestrationService {
  let contentBank = buildClientContentBank(lang, {
    sessionSalt: body.sessionSalt,
    userEntropy: body.userEntropy,
  });
  // Prefer unused bank items across retakes — filter by lifetime/session avoid-list
  // instead of reminting (which freezes JS when the avoid-list is large).
  const avoidIds = new Set(body.seenQuestionIds ?? []);
  if (avoidIds.size > 0) {
    const fresh = contentBank.filter((c) => !avoidIds.has(c.item.id));
    // Keep enough headroom for a full 15-item run; only fall back if bank exhausted.
    if (fresh.length >= 20) contentBank = fresh;
  }
  const analytics = typeof __DEV__ !== 'undefined' && __DEV__ ? createMemoryAnalyticsSink() : undefined;
  const flags = getPlacementProductionFlags();

  const opts = {
    language: lang,
    contentBank,
    analytics: analytics?.sink,
    encodeAnswerKey,
    mintFallback: flags.allowProceduralMint
      ? (hint: {
          targetLevel: string;
          questionNumber: number;
        }) => {
          const d100 =
            hint.targetLevel === 'A1'
              ? 10
              : hint.targetLevel === 'A2'
                ? 25
                : hint.targetLevel === 'B1'
                  ? 42
                  : hint.targetLevel === 'B2'
                    ? 58
                    : hint.targetLevel === 'C1'
                      ? 75
                      : 90;
          const bankD = clamp(Math.round((d100 / 100) * 24 + 1), 1, 25);
          const picked = pickAdaptiveQuestion({
            lang,
            questionIndex: hint.questionNumber,
            history: [],
            targetDifficulty: bankD,
            allowWeak: true,
            seenIds: [],
            seenPrompts: [],
            seenContentKeys: [],
            sessionSalt: (body.sessionSalt ?? 1) + hint.questionNumber * 9973,
            userEntropy: body.userEntropy ?? 0,
          });
          const sanitized = sanitizeLocal(picked, lang);
          if (!sanitized) return null;
          return contentFromLegacyBankQuestion(
            {
              ...sanitized,
              id: `mint-${hint.questionNumber}-${sanitized.id}`,
              language: lang,
              difficulty: bankToScale100(sanitized.difficulty),
            },
            { difficultyAlready100: true, qualityGate: 'PASS' },
          );
        }
      : undefined,
    shadowLegacyFinalize:
      typeof __DEV__ !== 'undefined' && __DEV__
        ? ({ answers }: { answers: Array<{ correct: boolean; difficulty100: number }> }) =>
            shadowLegacy(answers)
        : undefined,
  };

  if (snap && snap.status === 'active') {
    return PlacementOrchestrationService.fromSnapshot(snap, opts);
  }
  return new PlacementOrchestrationService(opts);
}

/** Sync entry used by local fallback path. */
export function runAssessmentPlacementStep(body: PlacementStepRequestBody): PlacementStepSuccessBody {
  const lang = (body.language ?? 'english') as CompanionChatApiLanguage;
  const key = cacheKey(lang, body.sessionSalt);

  if (body.action === 'start') {
    clearCachedService(lang);
    const svc = createService(lang, body, null);
    serviceCache.set(key, svc);
    const step = svc.start();
    void persistSnapshot(lang, step.snapshot);
    return step.done ? toDone(step, lang) : toContinue(step);
  }

  if (body.action === 'answer') {
    let svc = serviceCache.get(key);
    if (!svc) {
      // Cold answer without cache — start a new session then apply history best-effort
      svc = createService(lang, body, null);
      svc.start();
      for (const h of body.history ?? []) {
        try {
          svc.answer({ correct: h.correct });
        } catch {
          break;
        }
      }
      serviceCache.set(key, svc);
    }
    const step = svc.answer({
      answer: body.answer,
      timedOut: body.timedOut === true,
      itemId: body.itemId ?? body.lastQuestion?.id,
    });
    void persistSnapshot(lang, step.snapshot);
    if (step.done) {
      clearCachedService(lang);
      // Keep completed snapshot until next start so PlacementRecord can be saved safely.
      if (typeof __DEV__ !== 'undefined' && __DEV__ && step.shadow) {
        console.log('[placement shadow]', step.shadow);
      }
      return toDone(step, lang);
    }
    return toContinue(step);
  }

  throw new Error('action must be start or answer');
}

export async function runAssessmentPlacementStepAsync(
  body: PlacementStepRequestBody,
): Promise<PlacementStepSuccessBody> {
  const lang = (body.language ?? 'english') as CompanionChatApiLanguage;
  const key = cacheKey(lang, body.sessionSalt);

  if (body.action === 'start') {
    await clearPlacementSessionSnapshot(lang);
    return runAssessmentPlacementStep(body);
  }

  let svc = serviceCache.get(key);
  if (!svc) {
    const snap = await loadPlacementSessionSnapshot(lang);
    if (snap?.status === 'active') {
      svc = createService(lang, body, snap);
      serviceCache.set(key, svc);
    } else {
      return runAssessmentPlacementStep({ ...body, action: 'start', history: [] });
    }
  }

  const step = svc.answer({
    answer: body.answer,
    timedOut: body.timedOut === true,
    itemId: body.itemId ?? body.lastQuestion?.id,
  });
  await persistSnapshot(lang, step.snapshot);
  if (step.done) {
    clearCachedService(lang);
    // Keep completed snapshot until next start — recovery rejects non-active on resume.
    if (typeof __DEV__ !== 'undefined' && __DEV__ && step.shadow) {
      console.log('[placement shadow]', step.shadow);
    }
    return toDone(step, lang);
  }
  return toContinue(step);
}
