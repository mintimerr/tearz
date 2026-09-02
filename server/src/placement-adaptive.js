/** @typedef {{ section: string; difficulty: number; correct: boolean; prompt: string }} PlacementHistorySlice */

export const PLACEMENT_TOTAL = 10;
export const START_ABILITY = 42;

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function difficultyFromAbility(ability) {
  return clamp(Math.round((ability / 100) * 22) + 2, 1, 25);
}

export function abilityToLevel(ability) {
  if (ability < 15) return 'A1';
  if (ability < 28) return 'A2';
  if (ability < 42) return 'B1';
  if (ability < 58) return 'B2';
  if (ability < 75) return 'C1';
  return 'C2';
}

function recentCorrectStreak(history) {
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (!history[i].correct) break;
    streak += 1;
  }
  return streak;
}

export function computeNextProbe(ability, history, questionIndex) {
  if (history.length === 0) {
    return { targetDifficulty: 11, mode: 'baseline' };
  }

  const last = history[history.length - 1];
  const streak = recentCorrectStreak(history);
  const estimate = difficultyFromAbility(ability);

  if (last.correct && streak >= 2) {
    return {
      targetDifficulty: clamp(Math.max(last.difficulty + 3, estimate + 2), 1, 25),
      mode: 'probe_up',
    };
  }

  if (!last.correct && last.difficulty >= estimate) {
    return {
      targetDifficulty: clamp(last.difficulty - 4, 1, 25),
      mode: 'probe_down',
    };
  }

  if (last.correct && questionIndex % 3 === 2) {
    return {
      targetDifficulty: clamp(estimate + 2, 1, 25),
      mode: 'probe_up',
    };
  }

  return { targetDifficulty: estimate, mode: 'confirm' };
}

export function updateAbility(ability, difficulty, correct) {
  const relative = difficulty / 25;
  if (correct) {
    const easy = relative < ability / 110;
    const gain = easy ? 2 + Math.round(difficulty * 0.15) : 5 + Math.round(difficulty * 0.45);
    return clamp(ability + gain, 5, 96);
  }
  const hard = relative >= ability / 110;
  const loss = hard ? 7 + Math.round(difficulty * 0.5) : 4 + Math.round(difficulty * 0.25);
  return clamp(ability - loss, 5, 96);
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

  const unrelated = relevance.filter((r) => r === 0).length;
  return unrelated >= 2;
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

export function shuffleChoices(q) {
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

export function stripPinyin(text) {
  return String(text)
    .replace(/\([^)]*[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüa-z\s]{2,}[^)]*\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
