/** @typedef {{ section: string; difficulty: number; correct: boolean; prompt: string }} PlacementHistorySlice */

export const PLACEMENT_TOTAL = 15;
/** Start in mid-A2 so C1 needs sustained success on truly hard items. */
export const START_ABILITY = 30;
export const FIRST_TASK_DIFFICULTY = 30;

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function difficultyToScale100(d) {
  if (d <= 25) return clamp(Math.round(((d - 1) / 24) * 100), 0, 100);
  return clamp(Math.round(d), 0, 100);
}

export function scale100ToBank(d100) {
  return clamp(Math.round((d100 / 100) * 24 + 1), 1, 25);
}

export function abilityToLevel(ability) {
  const a = clamp(ability, 0, 100);
  if (a <= 16) return 'A1';
  if (a <= 33) return 'A2';
  if (a <= 50) return 'B1';
  if (a <= 67) return 'B2';
  if (a <= 84) return 'C1';
  return 'C2';
}

function streaks(history) {
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

function isAlternatingPattern(history) {
  const recent = history.slice(-5);
  if (recent.length < 4) return false;
  let flips = 0;
  for (let i = 1; i < recent.length; i += 1) {
    if (recent[i].correct !== recent[i - 1].correct) flips += 1;
  }
  return flips >= 3;
}

function phaseForTask(taskNumber) {
  if (taskNumber <= 5) return 'explore';
  if (taskNumber <= 10) return 'narrow';
  return 'confirm';
}

export function updateAbility(ability, difficulty, correct, history = []) {
  const d = difficultyToScale100(difficulty);
  const delta = d - ability;
  const { successStreak, failureStreak } = streaks(history);

  let change;
  if (correct) {
    if (delta > 20) change = 5;
    else if (delta >= 10) change = 4;
    else if (delta < -15) change = 0;
    else if (delta < -5) change = 1;
    else change = 3;
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

/** Cap CEFR by hard-item evidence — mirrors client conservativePlacementLevel. */
export function conservativePlacementLevel(ability, history = []) {
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

  const rank = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };
  const setMax = (max) => {
    if ((rank[level] || 0) > (rank[max] || 0)) level = max;
  };

  if (hardCorrect < 3) setMax('C1');
  if (hardCorrect < 2) setMax('B2');
  if (upperMidCorrect < 2 && hardCorrect < 1) setMax('B1');
  if (midCorrect < 2 && upperMidCorrect < 1) setMax('A2');
  if (history.filter((h) => h.correct).length < 3) setMax('A2');

  return level;
}

export function difficultyFromAbility(ability) {
  return scale100ToBank(ability);
}

export function computeNextProbe(ability, history, questionIndex) {
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

  const maxStep = phase === 'explore' ? 8 : phase === 'narrow' ? 6 : 4;
  explorationAdjustment = clamp(explorationAdjustment, -maxStep, maxStep);

  let next = clamp(Math.round(ability + explorationAdjustment), 0, 100);

  if (phase === 'confirm') {
    next = clamp(Math.round(ability + clamp(explorationAdjustment, -5, 5)), 0, 100);
  }

  if (Math.abs(next - lastD) < 2 && phase !== 'confirm') {
    next = clamp(next + (last.correct ? 4 : -4), 0, 100);
  }

  let mode = 'confirm';
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

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function hasOneStandoutParaphrase(choices) {
  const counts = choices.map(wordCount).sort((a, b) => b - a);
  if (counts[0] >= 8 && counts[1] <= 5 && counts[2] <= 5) return true;
  if (counts[0] >= counts[3] * 2.5 && counts[3] <= 4) return true;
  return false;
}

function hasThrowawayDistractors(choices, kind) {
  if (kind !== 'multiple_choice' && kind !== 'choose_translation') return false;
  const short = choices.filter((c) => wordCount(c) <= 4).length;
  const long = choices.filter((c) => wordCount(c) >= 8).length;
  return short >= 2 && long === 1;
}

function hasLoneNegationTrap(choices, kind) {
  if (kind !== 'multiple_choice') return false;
  const neg = /\b(not|never|no|n't|without|didn't|wasn't|haven't|cannot)\b|没|不|未|无|从未/i;
  const negCount = choices.filter((c) => neg.test(c)).length;
  return negCount === 1;
}

function hasUnrelatedDistractors(prompt, choices, kind) {
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

export function isWeakPlacementQuestion(prompt, choices, kind) {
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

export function ensureCorrectChoiceInList(q) {
  const choices = q.choices.map((c) => String(c).trim()).filter(Boolean);
  let correctChoice = String(q.correctChoice ?? '').trim();
  if (!choices.includes(correctChoice)) {
    const match = choices.find((c) => c.toLowerCase() === correctChoice.toLowerCase());
    if (match) correctChoice = match;
    else if (choices.length > 0) {
      choices[0] = correctChoice || choices[0];
      correctChoice = choices[0];
    }
  }
  while (choices.length < 4) choices.push(`${correctChoice}…`);
  return { ...q, choices: choices.slice(0, 4), correctChoice };
}

export function shuffleChoices(q) {
  const fixed = ensureCorrectChoiceInList(q);
  const tagged = fixed.choices.map((choice) => ({
    choice,
    correct: choice === fixed.correctChoice,
  }));
  for (let i = tagged.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [tagged[i], tagged[j]] = [tagged[j], tagged[i]];
  }
  return {
    ...fixed,
    choices: tagged.map((t) => t.choice),
    correctChoice: tagged.find((t) => t.correct)?.choice ?? fixed.correctChoice,
  };
}

export function stripPinyin(text) {
  return String(text)
    .replace(/\([^)]*[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüa-z\s]{2,}[^)]*\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
