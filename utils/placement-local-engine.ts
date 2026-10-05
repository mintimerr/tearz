import type { CompanionChatApiLanguage } from '@/types/companion-chat-api';
import type {
  PlacementHistoryItem,
  PlacementQuestion,
  PlacementStepRequestBody,
  PlacementStepSuccessBody,
} from '@/types/placement-api';

import {
  PLACEMENT_TOTAL,
  START_ABILITY,
  FIRST_TASK_DIFFICULTY,
  computeNextProbe,
  conservativePlacementLevel,
  bankToScale100,
  ensureCorrectChoiceInList,
  hskFromAbility,
  isWeakPlacementQuestion,
  shuffleChoices,
  stripPinyin,
  updateAbility,
} from '@/utils/placement-adaptive';
import { runAssessmentPlacementStep } from '@/utils/placement-assessment-engine';
import { pickAdaptiveQuestion } from '@/utils/placement-question-generator';
import {
  buildSeenQuestionKeys,
  isQuestionAlreadySeen,
  normalizePlacementPrompt,
  questionContentKey,
} from '@/utils/placement-seen';
import type { LocalPlacementQuestion } from '@/utils/placement-local-questions';

const SECTIONS = ['grammar', 'comprehension', 'phrases', 'structure'] as const;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeChoice(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function base64EncodeUtf8(str: string): string {
  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(unescape(encodeURIComponent(str)));
  }
  throw new Error('base64 encode unavailable');
}

function base64DecodeUtf8(b64: string): string {
  if (typeof globalThis.atob === 'function') {
    return decodeURIComponent(escape(globalThis.atob(b64)));
  }
  throw new Error('base64 decode unavailable');
}

function encodeAnswerKey(id: string, correctChoice: string) {
  const payload = JSON.stringify({ id, c: correctChoice });
  const b64 = base64EncodeUtf8(payload);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeAnswerKey(token: string | undefined) {
  if (!token?.trim()) return null;
  try {
    const padded = token.replace(/-/g, '+').replace(/_/g, '/');
    const json = base64DecodeUtf8(padded);
    const parsed = JSON.parse(json) as { id?: string; c?: string };
    if (!parsed?.id || !parsed?.c) return null;
    return { id: parsed.id, correctChoice: parsed.c };
  } catch {
    return null;
  }
}

function summaryForLevel(level: string) {
  const map: Record<string, string> = {
    A1: 'You know basic words and simple phrases — a solid starting point.',
    A2: 'You handle everyday topics and simple sentences well.',
    B1: 'You can manage most travel and daily situations independently.',
    B2: 'You understand main ideas on familiar and abstract topics.',
    C1: 'You use the language flexibly for work and study.',
    C2: 'You understand virtually everything with near-native precision.',
  };
  return map[level] ?? 'Your level has been estimated from this short test.';
}

function sanitizeQuestion(
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
    // Still usable if choices are valid MCQ with a keyed answer — keep after fix.
    if (!merged.choices.includes(merged.correctChoice) || merged.choices.length < 4) return null;
  }
  return shuffleChoices(merged);
}

function toPublicQuestion(q: LocalPlacementQuestion): PlacementQuestion {
  const fixed = ensureCorrectChoiceInList(q);
  return {
    id: fixed.id,
    kind: fixed.kind,
    instruction: fixed.instruction,
    prompt: fixed.prompt,
    choices: fixed.choices,
    difficulty: bankToScale100(fixed.difficulty),
    section: fixed.section,
  };
}

function sessionForbidden(history: PlacementHistoryItem[], lastPrompt?: string) {
  const prompts = new Set(history.map((h) => normalizePlacementPrompt(h.prompt)));
  if (lastPrompt) prompts.add(normalizePlacementPrompt(lastPrompt));
  return prompts;
}

/** Mint next item without scoring — used to replace accidental duplicates. */
export function mintNextLocalPlacementQuestion(
  body: PlacementStepRequestBody,
): PlacementStepSuccessBody {
  const lang = (body.language ?? 'english') as CompanionChatApiLanguage;
  const ability = Number.isFinite(body.ability) ? clamp(body.ability!, 0, 100) : START_ABILITY;
  const history: PlacementHistoryItem[] = Array.isArray(body.history) ? [...body.history] : [];
  const questionIndex = history.length;
  return finalizePickedQuestion(body, lang, ability, history, questionIndex, null);
}

function finalizePickedQuestion(
  body: PlacementStepRequestBody,
  lang: CompanionChatApiLanguage,
  ability: number,
  history: PlacementHistoryItem[],
  questionIndex: number,
  lastCorrect: boolean | null,
): PlacementStepSuccessBody {
  const probe = computeNextProbe(ability, history, questionIndex);
  const seenExtra = buildSeenQuestionKeys(history);
  for (const id of body.seenQuestionIds ?? []) seenExtra.ids.add(id);
  for (const prompt of body.seenPrompts ?? []) seenExtra.prompts.add(normalizePlacementPrompt(prompt));
  for (const key of body.seenContentKeys ?? []) seenExtra.contents.add(key);
  if (body.lastQuestion?.prompt) {
    seenExtra.prompts.add(normalizePlacementPrompt(body.lastQuestion.prompt));
  }
  if (body.lastQuestion?.id) seenExtra.ids.add(body.lastQuestion.id);
  if (body.lastQuestion?.choices?.length) {
    seenExtra.contents.add(
      questionContentKey({
        prompt: body.lastQuestion.prompt,
        choices: body.lastQuestion.choices,
      }),
    );
  }

  const forbiddenPrompts = sessionForbidden(history, body.lastQuestion?.prompt);
  const baseSalt = (body.sessionSalt ?? Date.now()) + questionIndex * 7919;

  let sanitized: LocalPlacementQuestion | null = null;
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const picked = pickAdaptiveQuestion({
      lang,
      questionIndex,
      history,
      targetDifficulty: clamp(probe.targetBankDifficulty + (attempt % 5) - 2, 1, 25),
      allowWeak: attempt >= 12,
      seenIds: [...seenExtra.ids],
      seenPrompts: [...seenExtra.prompts],
      seenContentKeys: [...seenExtra.contents],
      sessionSalt: baseSalt + attempt * 104729,
      userEntropy: body.userEntropy ?? 0,
    });
    const next = sanitizeQuestion(picked, lang);
    if (!next) continue;
    if (forbiddenPrompts.has(normalizePlacementPrompt(next.prompt))) continue;
    if (isQuestionAlreadySeen(next, seenExtra)) continue;
    sanitized = next;
    break;
  }

  if (!sanitized) {
    const picked = pickAdaptiveQuestion({
      lang,
      questionIndex,
      history: [],
      targetDifficulty: probe.targetBankDifficulty,
      allowWeak: true,
      seenIds: [...seenExtra.ids],
      seenPrompts: [...seenExtra.prompts],
      seenContentKeys: [...seenExtra.contents],
      sessionSalt: baseSalt + 99991 + Date.now(),
      userEntropy: (body.userEntropy ?? 0) ^ 0x5bd1e995,
    });
    let forced = sanitizeQuestion(picked, lang) ?? ensureCorrectChoiceInList(shuffleChoices(picked));
    const repeated =
      isQuestionAlreadySeen(forced, seenExtra) ||
      forbiddenPrompts.has(normalizePlacementPrompt(forced.prompt));
    // Repeating the same stem used to freeze the counter (question 14 forever).
    // Close the test on the answers already given instead of looping.
    if (repeated && questionIndex >= 12) {
      const level = conservativePlacementLevel(ability, history);
      return {
        done: true,
        ability,
        result: {
          level,
          score: ability,
          summary: summaryForLevel(level),
          strengths: [],
          gaps: [],
          hskLevel: lang === 'chinese' ? hskFromAbility(ability) : undefined,
        },
      };
    }
    if (repeated) {
      const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
      forced = ensureCorrectChoiceInList({
        ...forced,
        id: `${forced.id}-${stamp}`,
      });
    }
    sanitized = forced;
  }

  const publicQ = toPublicQuestion(sanitized);
  return {
    done: false,
    correct: lastCorrect,
    ability,
    questionIndex: questionIndex + 1,
    totalQuestions: PLACEMENT_TOTAL,
    question: publicQ,
    answerKey: encodeAnswerKey(publicQ.id, sanitized.correctChoice),
  };
}

/** Fallback-шаг placement-теста (когда API недоступен).
 * Scoring / next-item / CEFR go through shared assessment orchestrator.
 */
export function runLocalPlacementStep(body: PlacementStepRequestBody): PlacementStepSuccessBody {
  return runAssessmentPlacementStep(body);
}
