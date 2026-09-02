/** Computer-adaptive placement logic — Tearz diagnostic brain (0–100 scale). */

export const PLACEMENT_TOTAL = 15;
export const START_ABILITY = 50;
export const FIRST_TASK_DIFFICULTY = 50;

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

/** Bank scale 1–25 → internal 0–100. Values already ≤100 pass through. */
export function difficultyToScale100(d: number): number {
  if (d <= 25) return clamp(Math.round(((d - 1) / 24) * 100), 0, 100);
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
 * difficulty — 0–100 или 1–25 (нормализуется автоматически).
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
    if (delta >= 10 && delta <= 20) change = 7;
    else if (delta > 20) change = 8;
    else if (delta < -10) change = 1.5;
    else if (delta < -5) change = 2;
    else change = 4;
    if (successStreak >= 2) change += 1;
    if (successStreak >= 3) change += 2;
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
  } else if (successStreak >= 3) {
    explorationAdjustment = 10;
  } else if (successStreak >= 2) {
    explorationAdjustment = 6;
  } else if (failureStreak >= 3) {
    explorationAdjustment = -10;
  } else if (failureStreak >= 2) {
    explorationAdjustment = -6;
  } else if (last.correct) {
    explorationAdjustment = 5;
  } else {
    explorationAdjustment = -5;
  }

  const maxStep = phase === 'explore' ? 12 : phase === 'narrow' ? 7 : 5;
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
    if (hasOneStandoutParaphrase(trimmed)) return true;
    if (hasThrowawayDistractors(trimmed, kind)) return true;
    if (hasLoneNegationTrap(trimmed, kind)) return true;
    if (hasUnrelatedDistractors(prompt, trimmed, kind)) return true;
  }

  return false;
}

export function shuffleChoices<T extends { choices: string[]; correctChoice: string }>(q: T): T {
  const tagged = q.choices.map((choice) => ({
    choice,
    correct: choice === q.correctChoice,
  }));
  for (let i = tagged.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [tagged[i], tagged[j]] = [tagged[j], tagged[i]];
  }
  return {
    ...q,
    choices: tagged.map((t) => t.choice),
    correctChoice: tagged.find((t) => t.correct)?.choice ?? q.correctChoice,
  };
}

export function stripPinyin(text: string) {
  return text
    .replace(/\([^)]*[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüa-z\s]{2,}[^)]*\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
