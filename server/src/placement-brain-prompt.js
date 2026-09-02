/** Краткий контекст диагностического «мозга» Tearz для промптов генерации и оценки. */

export const PLACEMENT_BRAIN_SUMMARY = `You are part of Tearz adaptive placement — a 15-item diagnostic test with NO prior user data.
Goal: find the difficulty boundary where the learner goes from stable correct answers to unstable/incorrect — NOT maximize correct count.
Internal ability scale 0–100 (hidden from user). CEFR: 0–16 A1, 17–33 A2, 34–50 B1, 51–67 B2, 68–84 C1, 85–100 C2.
Cold start ability=50 (neutral hypothesis only). First item difficulty≈50.
Tasks 1–5: EXPLORATION (larger difficulty steps, find range). Tasks 6–10: NARROW (±3–7). Tasks 11–15: CONFIRM (±5 around estimate).
One correct MCQ answer may be guessing (4 options ≈25% random) — never jump difficulty wildly after one correct.
Wrong answer on much harder item = weak down signal. Wrong on much easier item = strong down signal.
Correct on much harder item = strong up signal. Correct on very easy item = minimal up signal.
Do NOT score by raw percent correct — weight by item difficulty. Late items near the boundary matter most.
Never show ability, confidence, CEFR, or difficulty to the user during the test.`;

export function phaseLabel(taskNumber) {
  if (taskNumber <= 5) return 'EXPLORATION (tasks 1–5: find approximate range)';
  if (taskNumber <= 10) return 'NARROWING (tasks 6–10: shrink range)';
  return 'CONFIRMATION (tasks 11–15: verify boundary ±5)';
}

export function cefrBandFrom100(d100) {
  if (d100 <= 16) return 'A1';
  if (d100 <= 33) return 'A2';
  if (d100 <= 50) return 'B1';
  if (d100 <= 67) return 'B2';
  if (d100 <= 84) return 'C1';
  return 'C2';
}

export function probeGuidance(probe) {
  const { mode, phase, targetDifficulty } = probe;
  const band = cefrBandFrom100(targetDifficulty);
  if (mode === 'baseline') {
    return `BASELINE item #1: difficulty≈${targetDifficulty}/100 (${band}). Calibrate initial direction only.`;
  }
  if (mode === 'probe_up') {
    return `PROBE UP (${phase}): learner coping — test CEILING near ${targetDifficulty}/100 (${band}). Discriminating grammar/inference.`;
  }
  if (mode === 'probe_down') {
    return `PROBE DOWN (${phase}): learner struggling — step back toward ${targetDifficulty}/100 (${band}) but keep plausible distractors.`;
  }
  if (mode === 'explore') {
    return `EXPLORING (${phase}): quickly locate ability range — target ${targetDifficulty}/100 (${band}).`;
  }
  return `CONFIRM (${phase}): verify boundary around ${targetDifficulty}/100 (${band}) — subtle discrimination.`;
}

export function performanceSummary(history, ability) {
  if (!history.length) return `Cold start. estimated_ability=${ability}/100. No answers yet.`;
  const recent = history.slice(-5);
  const correct = recent.filter((h) => h.correct).length;
  const diffs = recent.map((h) => h.difficulty);
  const avgDiff = Math.round(diffs.reduce((s, d) => s + d, 0) / diffs.length);
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].correct) streak += 1;
    else break;
  }
  let failStreak = 0;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (!history[i].correct) failStreak += 1;
    else break;
  }
  return (
    `estimated_ability=${ability}/100. Last ${recent.length}: ${correct}/${recent.length} correct, ` +
    `avg difficulty ${avgDiff}/100, success_streak=${streak}, failure_streak=${failStreak}.`
  );
}
