/** Краткий контекст диагностического «мозга» Tearz для промптов генерации и оценки. */

export const PLACEMENT_BRAIN_SUMMARY = `You are part of Tearz adaptive placement — a 15-item diagnostic test with NO prior user data.
Goal: find the difficulty BOUNDARY where the learner goes from stable correct answers to unstable/incorrect — NOT maximize correct count, NOT flatter the learner.

Internal ability 0–100 (hidden). CEFR bands:
0–16 A1 | 17–33 A2 | 34–50 B1 | 51–67 B2 | 68–84 C1 | 85–100 C2.

Cold start ability≈30 (neutral A2 hypothesis — NOT B1/C1). First item difficulty≈30.
Tasks 1–5 EXPLORATION (find range). Tasks 6–10 NARROW. Tasks 11–15 CONFIRM near the estimate.

SCORING PRINCIPLES (engine + final judge):
- Weight by item difficulty. Raw % correct is NOT enough.
- Correct on a VERY EASY item (far below ability) ≈ almost no upward evidence.
- Correct on an ON-LEVEL or slightly harder item = normal upward evidence.
- Wrong on an EASY item = strong downward evidence.
- Wrong on a MUCH HARDER item = weak downward evidence (expected).
- One correct MCQ can be a 25% guess — never treat a single hit as proof of C1.
- C1/C2 require repeated success on items that are TRULY 68+/100 in linguistic demand — not easy stems with an inflated difficulty number.

ITEM INTEGRITY (critical for generation):
- The linguistic demand of the stem MUST match the requested CEFR band.
- NEVER write A1/A2 grammar (geht/fahren, basic present, obvious paraphrase) and stamp it as B2/C1.
- If you cannot invent a true high-band item, stay honest and write a mid-band item — the engine will adjust — but do NOT fake difficulty.

Never show ability, confidence, CEFR labels, or difficulty numbers to the learner during the test.`;

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

/** What “this band” must look like in the stem — prevents easy items labeled as C1. */
export function bandContentContract(lang, band) {
  const common = {
    A1: 'very short everyday stem; present/basic forms; transparent meaning; obvious distractors still grammatical.',
    A2: 'simple past/perfect or basic connectors; concrete situations; no nested clauses; paraphrase not a word scramble.',
    B1: 'connected narrative; common subordinate clauses; situational nuance; distractors = typical B1 mistakes.',
    B2: 'register/control; non-obvious connectors; implication; distractors almost as plausible as the key.',
    C1: 'flexible formal/academic wording; subtle inference; rare structures used naturally — NOT textbook A2 drills.',
    C2: 'near-native precision; dense nominalization / hedging / irony; only experts discriminate options.',
  };
  const byLang = {
    german: {
      A1: 'present conjugation, basic word order, simple Akkusativ — e.g. geht/fahren level.',
      A2: 'Perfekt vs Präsens, weil/dass, separable verbs in everyday frames.',
      B1: 'Präteritum/Perfekt mix, relative clauses (der/die/das), modal + perfect.',
      B2: 'Passiv, Konjunktiv II in real hypothetics, nominal style starting to appear.',
      C1: 'Konjunktiv II chains, extended Passiv, Partizipialattribute, nuanced connectors (angesichts, sofern) — NEVER geht/fahren blanks.',
      C2: 'dense Amts-/Wissenschaftsdeutsch, subtle Konjunktiv I/II reporting, fine register shifts.',
    },
    chinese: {
      A1: 'basic 是/有/在, simple SVO, common measure words.',
      A2: '了/过/着 in clear contexts, simple 把 optional intro.',
      B1: '把/被, complements, resultative, everyday discourse markers.',
      B2: 'complex 把/被, 得 complements, soft register shifts.',
      C1: 'written-style connectors, subtle aspect/modality, implication — not HSK1 blanks.',
      C2: 'dense written Chinese, classical residues, fine pragmatic contrast.',
    },
    french: {
      A1: 'présent, gender basics, simple questions.',
      A2: 'passé composé vs présent, basic pronouns.',
      B1: 'imparfait vs passé composé, relative qui/que.',
      B2: 'subjonctif present, concordance, nuanced connectors.',
      C1: 'subjonctif/conditionnel chains, formal register, subtle inference.',
      C2: 'literary/formal precision, rare moods, fine synonym contrast.',
    },
    english: {
      A1: 'be/have, present simple, basic word order.',
      A2: 'past simple/perfect intro, common phrasals lightly.',
      B1: 'conditionals 0–1, reported speech light, discourse markers.',
      B2: 'mixed conditionals intro, hedging, implication.',
      C1: 'nuance, inversion, advanced hedging, register — not “went/goes” blanks.',
      C2: 'near-native pragmatics, irony, dense academic wording.',
    },
    russian: {
      A1: 'nominative/basic endings, present tense.',
      A2: 'common cases in set frames, aspect intro.',
      B1: 'aspect pairs, motion verbs, subordinate clauses.',
      B2: 'participles intro, nuanced case governance.',
      C1: 'participle/деепричастие, bookish connectors, subtle aspect.',
      C2: 'dense written Russian, fine stylistic contrast.',
    },
  };
  const langMap = byLang[lang] || byLang.english;
  return langMap[band] || common[band] || common.B1;
}

export function probeGuidance(probe) {
  const { mode, phase, targetDifficulty } = probe;
  const band = cefrBandFrom100(targetDifficulty);
  if (mode === 'baseline') {
    return `BASELINE item #1: difficulty≈${targetDifficulty}/100 (${band}). Honest ${band} content only — calibrate direction.`;
  }
  if (mode === 'probe_up') {
    return `PROBE UP (${phase}): test CEILING near ${targetDifficulty}/100 (${band}). Content MUST be true ${band} demand.`;
  }
  if (mode === 'probe_down') {
    return `PROBE DOWN (${phase}): step back toward ${targetDifficulty}/100 (${band}) with honest ${band} stems and plausible distractors.`;
  }
  if (mode === 'explore') {
    return `EXPLORING (${phase}): locate range — target ${targetDifficulty}/100 (${band}) with matching content.`;
  }
  return `CONFIRM (${phase}): verify boundary around ${targetDifficulty}/100 (${band}) — subtle ${band} discrimination.`;
}

export function performanceSummary(history, ability) {
  if (!history.length) {
    return `Cold start. estimated_ability=${ability}/100 (${cefrBandFrom100(ability)}). No answers yet.`;
  }
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
  const hardHits = history.filter((h) => h.correct && h.difficulty >= 68).length;
  return (
    `estimated_ability=${ability}/100 (${cefrBandFrom100(ability)}). Last ${recent.length}: ${correct}/${recent.length} correct, ` +
    `avg difficulty ${avgDiff}/100, success_streak=${streak}, failure_streak=${failStreak}, ` +
    `lifetime hard(68+) corrects=${hardHits}.`
  );
}
