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
  abilityToLevel,
  computeNextProbe,
  difficultyToScale100,
  hskFromAbility,
  isWeakPlacementQuestion,
  shuffleChoices,
  stripPinyin,
  updateAbility,
} from '@/utils/placement-adaptive';
import { pickAdaptiveQuestion } from '@/utils/placement-question-generator';
import { buildSeenQuestionKeys, isQuestionAlreadySeen } from '@/utils/placement-seen';
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

function sanitizeQuestion(q: LocalPlacementQuestion, lang: CompanionChatApiLanguage): LocalPlacementQuestion | null {
  let prompt = q.prompt;
  let choices = [...q.choices];
  let correctChoice = q.correctChoice;
  if (lang === 'chinese') {
    prompt = stripPinyin(prompt);
    choices = choices.map(stripPinyin);
    correctChoice = stripPinyin(correctChoice);
  }
  const merged = { ...q, prompt, choices, correctChoice };
  if (isWeakPlacementQuestion(prompt, choices, q.kind)) return null;
  return shuffleChoices(merged);
}

function toPublicQuestion(q: LocalPlacementQuestion): PlacementQuestion {
  return {
    id: q.id,
    kind: q.kind,
    instruction: q.instruction,
    prompt: q.prompt,
    choices: q.choices,
    difficulty: difficultyToScale100(q.difficulty),
    section: q.section,
  };
}

/** Fallback-шаг placement-теста (когда API недоступен). */
export function runLocalPlacementStep(body: PlacementStepRequestBody): PlacementStepSuccessBody {
  const lang = (body.language ?? 'english') as CompanionChatApiLanguage;
  let ability = Number.isFinite(body.ability) ? clamp(body.ability!, 0, 100) : START_ABILITY;
  let history: PlacementHistoryItem[] = Array.isArray(body.history) ? [...body.history] : [];
  let questionIndex = Number.isFinite(body.questionIndex) ? Math.max(0, body.questionIndex!) : 0;
  let lastCorrect: boolean | null = null;

  if (body.action === 'start') {
    ability = START_ABILITY;
    history = [];
    questionIndex = 0;
    lastCorrect = null;
  } else if (body.action === 'answer') {
    const key = decodeAnswerKey(body.answerKey);
    const lastDifficulty =
      body.lastQuestion?.difficulty ??
      (history.length ? history[history.length - 1].difficulty : FIRST_TASK_DIFFICULTY);
    const lastSection =
      body.lastQuestion?.section ??
      SECTIONS[Math.max(0, questionIndex - 1) % SECTIONS.length];
    const lastPrompt = body.lastQuestion?.prompt?.slice(0, 200) ?? '';
    const lastQuestionId = body.lastQuestion?.id;
    const timedOut = body.timedOut === true;
    const correct =
      !timedOut &&
      Boolean(key && body.answer) &&
      normalizeChoice(body.answer!) === normalizeChoice(key.correctChoice);
    lastCorrect = correct;

    const alreadyLogged = history.some(
      (h) => h.prompt === lastPrompt || (lastQuestionId && h.questionId === lastQuestionId),
    );
    if (!alreadyLogged && lastPrompt) {
      history.push({
        section: lastSection,
        difficulty: lastDifficulty,
        correct,
        prompt: lastPrompt,
        questionId: lastQuestionId,
        choices: body.lastQuestion?.choices,
      });
    }
    ability = updateAbility(ability, lastDifficulty, correct, history);
    questionIndex = history.length;

    if (questionIndex >= PLACEMENT_TOTAL) {
      const level = abilityToLevel(ability);
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
  }

  const probe = computeNextProbe(ability, history, questionIndex);
  const seenExtra = buildSeenQuestionKeys(history);
  for (const id of body.seenQuestionIds ?? []) seenExtra.ids.add(id);
  for (const prompt of body.seenPrompts ?? []) seenExtra.prompts.add(prompt);
  for (const key of body.seenContentKeys ?? []) seenExtra.contents.add(key);

  const pickNext = (allowWeak: boolean) =>
    pickAdaptiveQuestion({
      lang,
      questionIndex,
      history,
      targetDifficulty: probe.targetBankDifficulty,
      allowWeak,
      seenIds: [...seenExtra.ids],
      seenPrompts: [...seenExtra.prompts],
      seenContentKeys: [...seenExtra.contents],
      sessionSalt: body.sessionSalt ?? Date.now(),
    });

  let picked: LocalPlacementQuestion;
  try {
    picked = pickNext(false);
  } catch {
    picked = pickNext(true);
  }

  let sanitized = sanitizeQuestion(picked, lang);
  if (!sanitized || isQuestionAlreadySeen(sanitized, seenExtra)) {
    try {
      picked = pickAdaptiveQuestion({
        lang,
        questionIndex,
        history,
        targetDifficulty: clamp(probe.targetBankDifficulty - 1, 1, 25),
        allowWeak: true,
        seenIds: [...seenExtra.ids],
        seenPrompts: [...seenExtra.prompts],
        seenContentKeys: [...seenExtra.contents],
        sessionSalt: body.sessionSalt ?? Date.now(),
      });
    } catch {
      picked = pickNext(true);
    }
    sanitized = sanitizeQuestion(picked, lang) ?? shuffleChoices(picked);
  }

  if (isQuestionAlreadySeen(sanitized, seenExtra)) {
    throw new Error('Could not pick a fresh placement question');
  }

  return {
    done: false,
    correct: lastCorrect,
    ability,
    questionIndex: questionIndex + 1,
    totalQuestions: PLACEMENT_TOTAL,
    question: toPublicQuestion(sanitized),
    answerKey: encodeAnswerKey(sanitized.id, sanitized.correctChoice),
  };
}
