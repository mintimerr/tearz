/** Computer-adaptive placement logic — Tearz diagnostic brain (0–100 scale). */

import { isTrivialParaphraseChoice } from '@/utils/placement-seen';

export const PLACEMENT_TOTAL = 15;
/** Новый пользователь без опыта: низкий A1, не середина A2. */
export const START_ABILITY = 8;
export const FIRST_TASK_DIFFICULTY = 8;

export type PlacementProbeMode =
  | 'baseline'
  | 'explore'
  | 'probe_up'
  | 'probe_down'
  | 'confirm';

export type PlacementPhase = 'explore' | 'narrow' | 'confirm';

export type PlacementHistorySlice = {
  section: string;
  difficulty: number;
  correct: boolean;
  prompt: string;
};

export type PlacementProbe = {
  /** Target difficulty on 0–100 scale (for API / AI prompts). */
  targetDifficulty: number;
  /** Target difficulty on 1–25 bank scale (for local question pool). */
  targetBankDifficulty: number;
  mode: PlacementProbeMode;
  phase: PlacementPhase;
};

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Bank scale 1–25 → internal 0–100. Call once, when a local template is published. */
export function bankToScale100(bank: number): number {
  return clamp(Math.round(((bank - 1) / 24) * 100), 0, 100);
}

/** Difficulty already on the 0–100 scale. Do not reinterpret 1–25 as the old bank. */
export function difficultyToScale100(d: number): number {
  return clamp(Math.round(d), 0, 100);
}

/** Internal 0–100 → bank scale 1–25. */
export function scale100ToBank(d100: number): number {
  return clamp(Math.round((d100 / 100) * 24 + 1), 1, 25);
}

export function abilityToLevel(ability: number): string {
  const a = clamp(ability, 0, 100);
  if (a <= 16) return 'A1';
  if (a <= 33) return 'A2';
  if (a <= 50) return 'B1';
  if (a <= 67) return 'B2';
  if (a <= 84) return 'C1';
  return 'C2';
}

export function cefrBandFromAbility(ability: number): string {
  return abilityToLevel(ability);
}

export function cefrBandFromDifficulty100(d100: number): string {
  return abilityToLevel(d100);
}

function streaks(history: PlacementHistorySlice[]) {
  let successStreak = 0;
  let failureStreak = 0;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].correct) {
      successStreak += 1;
      if (failureStreak > 0) break;
    } else {
      failureStreak += 1;
      if (successStreak > 0) break;
    }
  }
  return { successStreak, failureStreak };
}

function isAlternatingPattern(history: PlacementHistorySlice[]): boolean {
  const recent = history.slice(-5);
  if (recent.length < 4) return false;
  let flips = 0;
  for (let i = 1; i < recent.length; i += 1) {
    if (recent[i].correct !== recent[i - 1].correct) flips += 1;
  }
  return flips >= 3;
}

function phaseForTask(taskNumber: number): PlacementPhase {
  if (taskNumber <= 5) return 'explore';
  if (taskNumber <= 10) return 'narrow';
  return 'confirm';
}

/**
 * Обновление estimated_ability после ответа.
 * difficulty — уже шкала 0–100.
 */
export function updateAbility(
  ability: number,
  difficulty: number,
  correct: boolean,
  history: PlacementHistorySlice[] = [],
): number {
  const d = difficultyToScale100(difficulty);
  const delta = d - ability;
  const { successStreak, failureStreak } = streaks(history);

  let change: number;
  if (correct) {
    if (delta > 20) change = 5;
    else if (delta >= 10) change = 4;
    else if (delta < -15) change = 0;
    else if (delta < -5) change = 1;
    else change = 3;
    // First items: a correct answer above the estimate is real evidence, move toward it.
    if (history.length <= 5 && delta >= 8) change = Math.max(change, 8);
    // Streak bonus only when the item is at/above ability — not for trivial wins.
    if (delta >= -5) {
      if (successStreak >= 2) change += 1;
      if (successStreak >= 3) change += 1;
    }
  } else {
    if (delta <= -10 && delta >= -20) change = -8;
    else if (delta < -20) change = -3;
    else if (delta > 10) change = -2;
    else change = -5;
    if (failureStreak >= 2) change -= 2;
    if (failureStreak >= 3) change -= 3;
  }

  return clamp(Math.round(ability + change), 0, 100);
}

/**
 * Cap CEFR by evidence: C1/C2 need real high-band correct answers.
 * Prevents local easy templates stamped as “hard” from printing C1.
 */
export function conservativePlacementLevel(
  ability: number,
  history: { difficulty: number; correct: boolean }[],
): string {
  let level = abilityToLevel(ability);
  const hardCorrect = history.filter(
    (h) => h.correct && difficultyToScale100(h.difficulty) >= 68,
  ).length;
  const upperMidCorrect = history.filter(
    (h) => h.correct && difficultyToScale100(h.difficulty) >= 51,
  ).length;
  const midCorrect = history.filter(
    (h) => h.correct && difficultyToScale100(h.difficulty) >= 34,
  ).length;

  const rank: Record<string, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };
  const setMax = (max: string) => {
    if ((rank[level] ?? 0) > (rank[max] ?? 0)) level = max;
  };

  if (hardCorrect < 3) setMax('C1');
  if (hardCorrect < 2) setMax('B2');
  if (upperMidCorrect < 2 && hardCorrect < 1) setMax('B1');
  if (midCorrect < 2 && upperMidCorrect < 1) setMax('A2');
  if (history.filter((h) => h.correct).length === 0) setMax('A1');
  else if (history.filter((h) => h.correct).length < 3) setMax('A2');

  return level;
}

/** @deprecated use scale100ToBank */
export function difficultyFromAbility(ability: number) {
  return scale100ToBank(ability);
}

export function computeNextProbe(
  ability: number,
  history: PlacementHistorySlice[],
  questionIndex: number,
): PlacementProbe {
  const taskNumber = questionIndex + 1;
  const phase = phaseForTask(taskNumber);

  if (history.length === 0) {
    return {
      targetDifficulty: FIRST_TASK_DIFFICULTY,
      targetBankDifficulty: scale100ToBank(FIRST_TASK_DIFFICULTY),
      mode: 'baseline',
      phase: 'explore',
    };
  }

  const { successStreak, failureStreak } = streaks(history);
  const last = history[history.length - 1];
  const lastD = difficultyToScale100(last.difficulty);
  const alternating = isAlternatingPattern(history);

  let explorationAdjustment = 0;
  if (alternating) {
    explorationAdjustment = taskNumber % 2 === 0 ? 2 : -2;
  } else if (successStreak >= 3 && phase === 'explore') {
    explorationAdjustment = 16;
  } else if (successStreak >= 2 && phase === 'explore') {
    explorationAdjustment = 12;
  } else if (successStreak >= 3) {
    explorationAdjustment = 6;
  } else if (successStreak >= 2) {
    explorationAdjustment = 4;
  } else if (failureStreak >= 3) {
    explorationAdjustment = -10;
  } else if (failureStreak >= 2) {
    explorationAdjustment = -6;
  } else if (last.correct) {
    explorationAdjustment = 3;
  } else {
    explorationAdjustment = -5;
  }

  const maxStep = phase === 'explore' ? 18 : phase === 'narrow' ? 6 : 4;
  explorationAdjustment = clamp(explorationAdjustment, -maxStep, maxStep);

  let next = clamp(Math.round(ability + explorationAdjustment), 0, 100);

  if (phase === 'confirm') {
    next = clamp(Math.round(ability + clamp(explorationAdjustment, -5, 5)), 0, 100);
  }

  if (Math.abs(next - lastD) < 2 && phase !== 'confirm') {
    next = clamp(next + (last.correct ? 4 : -4), 0, 100);
  }

  let mode: PlacementProbeMode = 'confirm';
  if (phase === 'explore' && history.length < 3) mode = 'explore';
  else if (explorationAdjustment >= 4) mode = 'probe_up';
  else if (explorationAdjustment <= -4) mode = 'probe_down';

  return {
    targetDifficulty: next,
    targetBankDifficulty: scale100ToBank(next),
    mode,
    phase,
  };
}

export function hskFromAbility(ability: number) {
  if (ability <= 16) return 'HSK 1';
  if (ability <= 33) return 'HSK 2';
  if (ability <= 50) return 'HSK 3';
  if (ability <= 67) return 'HSK 4';
  if (ability <= 84) return 'HSK 5';
  return 'HSK 6';
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function hasOneStandoutParaphrase(choices: string[]) {
  const counts = choices.map(wordCount).sort((a, b) => b - a);
  if (counts[0] >= 8 && counts[1] <= 5 && counts[2] <= 5) return true;
  if (counts[0] >= counts[3] * 2.5 && counts[3] <= 4) return true;
  return false;
}

function hasThrowawayDistractors(choices: string[], kind: string) {
  if (kind !== 'multiple_choice' && kind !== 'choose_translation') return false;
  const short = choices.filter((c) => wordCount(c) <= 4).length;
  const long = choices.filter((c) => wordCount(c) >= 8).length;
  return short >= 2 && long === 1;
}

function hasLoneNegationTrap(choices: string[], kind: string) {
  if (kind !== 'multiple_choice') return false;
  const neg = /\b(not|never|no|n't|without|didn't|wasn't|haven't|cannot)\b|没|不|未|无|从未/i;
  const negCount = choices.filter((c) => neg.test(c)).length;
  return negCount === 1;
}

function hasUnrelatedDistractors(prompt: string, choices: string[], kind: string) {
  if (kind !== 'multiple_choice') return false;
  const promptWords = new Set(
    (prompt.toLowerCase().match(/[a-z\u4e00-\u9fff]{4,}/g) ?? []).slice(0, 12),
  );
  if (promptWords.size === 0) return false;

  const relevance = choices.map((choice) => {
    const choiceWords = choice.toLowerCase().match(/[a-z\u4e00-\u9fff]{4,}/g) ?? [];
    return choiceWords.filter((w) => promptWords.has(w)).length;
  });

  return relevance.filter((r) => r === 0).length >= 2;
}

export function isWeakPlacementQuestion(prompt: string, choices: string[], kind: string) {
  const trimmed = choices.map((c) => c.trim()).filter(Boolean);
  if (trimmed.length < 4) return true;

  const promptWords = prompt.trim().split(/\s+/).filter(Boolean);
  if (kind === 'choose_translation' && promptWords.length <= 2 && prompt.length < 24) return true;

  if (kind === 'multiple_choice' || kind === 'choose_translation') {
    if (trimmed.some((c) => isTrivialParaphraseChoice(prompt, c))) return true;
    if (hasOneStandoutParaphrase(trimmed)) return true;
    if (hasThrowawayDistractors(trimmed, kind)) return true;
    if (hasLoneNegationTrap(trimmed, kind)) return true;
    if (hasUnrelatedDistractors(prompt, trimmed, kind)) return true;
  }

  return false;
}

export function ensureCorrectChoiceInList<T extends { choices: string[]; correctChoice: string }>(
  q: T,
): T {
  const choices = q.choices.map((c) => c.trim()).filter(Boolean);
  let correctChoice = q.correctChoice.trim();
  if (!choices.includes(correctChoice)) {
    // Prefer exact case-insensitive match already in list.
    const match = choices.find((c) => c.toLowerCase() === correctChoice.toLowerCase());
    if (match) {
      correctChoice = match;
    } else if (choices.length > 0) {
      // Corrupt item — force first choice to be the keyed answer.
      choices[0] = correctChoice || choices[0];
      correctChoice = choices[0];
    }
  }
  while (choices.length < 4) choices.push(`${correctChoice}…`);
  return { ...q, choices: choices.slice(0, 4), correctChoice };
}

export function shuffleChoices<T extends { choices: string[]; correctChoice: string }>(q: T): T {
  const fixed = ensureCorrectChoiceInList(q);
  const tagged = fixed.choices.map((choice) => ({
    choice,
    correct: choice === fixed.correctChoice,
  }));
  for (let i = tagged.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [tagged[i], tagged[j]] = [tagged[j], tagged[i]];
  }
  const correct = tagged.find((t) => t.correct)?.choice ?? fixed.correctChoice;
  return {
    ...fixed,
    choices: tagged.map((t) => t.choice),
    correctChoice: correct,
  };
}

export function stripPinyin(text: string) {
  return text
    .replace(/\([^)]*[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüa-z\s]{2,}[^)]*\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
