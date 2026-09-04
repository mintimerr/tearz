import crypto from 'node:crypto';

import {
  PLACEMENT_BRAIN_SUMMARY,
  performanceSummary,
  phaseLabel,
  probeGuidance,
  cefrBandFrom100,
  bandContentContract,
} from './placement-brain-prompt.js';

function l2Label(lang) {
  if (lang === 'chinese') return 'Chinese (汉字 only — no pinyin)';
  if (lang === 'german') return 'German';
  if (lang === 'french') return 'French';
  if (lang === 'russian') return 'Russian';
  return 'English';
}

function sectionGuidance(section) {
  const map = {
    grammar:
      'Focus: verb form, case, mood, aspect, agreement, preposition, or particle IN a full sentence. ONE blank.',
    comprehension:
      'Focus: 1–2 L2 sentences or dialogue. Ask meaning/implication. All 4 options = true paraphrases of the SAME situation — NOT word-order scrambles of the stem, NOT one synonym swap.',
    phrases: 'Focus: idiomatic reply or collocation in mini-dialogue (A: … / B: ___).',
    structure:
      'Focus: sentence order OR error correction. Order: 4 full clause sequences joined by " → ".',
  };
  return map[section] ?? map.grammar;
}

function languageSpecificRules(lang) {
  if (lang === 'chinese') {
    return `CHINESE: hanzi ONLY. Particles, aspect, 把/被, measure words — always in a full situation.`;
  }
  if (lang === 'german') {
    return `GERMAN: case, verb position, Konjunktiv II, Passiv, Perfekt/Präteritum — always match the TARGET BAND. A2≠C1.`;
  }
  if (lang === 'french') {
    return `FRENCH: agreement, subjunctive, passé composé vs imparfait — match the TARGET BAND.`;
  }
  if (lang === 'russian') {
    return `RUSSIAN: case endings, aspect, motion verbs — match the TARGET BAND.`;
  }
  return `ENGLISH: tense, conditionals, modals, phrasal verbs — match the TARGET BAND.`;
}

function normalizeSeenPrompt(prompt) {
  return String(prompt || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function buildAvoidBlock({ history, seenPrompts }) {
  const lines = [];
  const seen = new Set();
  for (const h of history) {
    const key = normalizeSeenPrompt(h.prompt).slice(0, 160);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    lines.push(
      `- [answered] ${(h.prompt || '').slice(0, 160)}${h.questionId ? ` (${h.questionId})` : ''}`,
    );
  }
  for (const p of seenPrompts ?? []) {
    const key = normalizeSeenPrompt(p).slice(0, 160);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    lines.push(`- [seen] ${String(p).slice(0, 160)}`);
  }
  if (lines.length === 0) return '';
  const capped = lines.slice(-80);
  return `\n\nHARD UNIQUENESS RULE: Invent a brand-new item NOW. Never reuse bank templates, stock textbook drills, or the same wording/names/places/scenarios as below. Every prompt must feel freshly written for this learner.\nALREADY USED (do not copy):\n${capped.join('\n')}`;
}

/** System prompt: item content + difficulty calibration from adaptive brain. */
export function buildPlacementQuestionSystemPrompt({
  lang,
  ability,
  history,
  section,
  probe,
  seenPrompts,
}) {
  const difficulty = probe.targetDifficulty;
  const band = cefrBandFrom100(difficulty);
  const taskNumber = history.length + 1;
  const bandContract = bandContentContract(lang, band);

  return `${PLACEMENT_BRAIN_SUMMARY}

YOUR SUB-ROLE NOW: write exactly ONE multiple-choice item at the difficulty the adaptive engine requests.
You do NOT choose the numeric difficulty — the engine already decided: ${difficulty}/100 (${band}).
You DO choose linguistic demand: the stem MUST be authentic ${band} content.
Invent the item from scratch — never pull from a fixed item bank or recycle textbook stock drills.
Return JSON only — no markdown.

TARGET LANGUAGE (L2): ${l2Label(lang)}
INSTRUCTION LANGUAGE: English only
SECTION: ${section} — ${sectionGuidance(section)}
TEST PHASE: ${phaseLabel(taskNumber)}
ADAPTIVE DIRECTIVE: ${probeGuidance(probe)}
${languageSpecificRules(lang)}

BAND CONTENT CONTRACT for ${band} (${difficulty}/100):
${bandContract}
If this band is B2/C1/C2, it is a HARD FAILURE to produce A1/A2 classroom drills (e.g. German "geht/fahren", English "went/goes", Chinese HSK1 是/有 blanks) even if you set "difficulty": ${difficulty}.

OUTPUT SCHEMA:
{
  "id": "q-${crypto.randomUUID().slice(0, 8)}",
  "kind": "select_missing_word"|"grammar_form"|"multiple_choice"|"sentence_order"|"error_correction",
  "instruction": "≤12 words English",
  "prompt": "stem mostly in L2",
  "choices": ["A","B","C","D"],
  "correctChoice": "exact match from choices",
  "difficulty": ${difficulty},
  "section": "${section}"
}

DISTRACTOR RULES (critical):
- All 4 options equally professional: similar length (±30%), same register, same grammar frame.
- Wrong = realistic learner errors at THIS band (wrong tense/particle/case, near-synonym that fails).
- NEVER one obvious answer + nonsense distractors ("canceled forever", "never started").
- NEVER lone negation trick (only one option with not/没/不).
- Comprehension: all 4 describe SAME scene; ONE matches; subtle differences only.
- Comprehension FORBIDDEN: correct choice = word-order scramble / light synonym of the stem.

FORBIDDEN: isolated word translation, pinyin, true/false, copying ALREADY USED items.
CRITICAL: Never produce the same prompt text (or a near-paraphrase) as any ALREADY USED item.

Self-check before return:
1) Would a teacher rate this stem as ${band}, not easier?
2) Could a careful ${band} learner still miss it for a good reason?
3) Are distractors serious, not joke extremes?${buildAvoidBlock({ history, seenPrompts })}`;
}

export function buildPlacementQuestionUserPrompt({
  questionIndex,
  totalQuestions,
  probe,
  history,
  ability,
  attempt,
}) {
  const last = history.length ? history[history.length - 1] : null;
  const lastLine = last
    ? `Previous (${last.correct ? 'CORRECT' : 'INCORRECT'}, difficulty ${last.difficulty}/100): "${last.prompt.slice(0, 100)}"`
    : 'First item — difficulty≈30/100 (honest A2 calibration).';
  const band = cefrBandFrom100(probe.targetDifficulty);

  return (
    `Item ${questionIndex + 1} of ${totalQuestions}.\n` +
    `${performanceSummary(history, ability)}\n` +
    `Next target difficulty: ${probe.targetDifficulty}/100 (${band}). Phase: ${probe.phase}. Mode: ${probe.mode}.\n` +
    `${lastLine}\n` +
    `Attempt ${attempt}. Freshness nonce: ${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}.\n` +
    `Invent a brand-new scenario RIGHT NOW (work/travel/study/health/plans/family).\n` +
    `Match BOTH the number ${probe.targetDifficulty}/100 AND authentic ${band} linguistic demand. Do not fake a high band with easy content.`
  );
}

/** Final level prompt — conservative CEFR from adaptive ability + answer log. */
export function buildPlacementResultBrainPrompt(lang, ability, history) {
  const lines = history
    .map(
      (h, i) =>
        `${i + 1}. [d${h.difficulty}/100 ${cefrBandFrom100(h.difficulty)}] ${h.prompt.slice(0, 80)} → ${h.correct ? 'correct' : 'incorrect'}`,
    )
    .join('\n');
  const algorithmLevel = cefrBandFrom100(ability);
  const hardCorrect = history.filter((h) => h.correct && h.difficulty >= 68).length;
  const upperMidCorrect = history.filter((h) => h.correct && h.difficulty >= 51).length;
  const midCorrect = history.filter((h) => h.correct && h.difficulty >= 34).length;
  const easyOnlyWins =
    history.filter((h) => h.correct && h.difficulty < 34).length >= 8 && hardCorrect === 0;

  return `${PLACEMENT_BRAIN_SUMMARY}

Finalize placement after 15 items. Write summary in English.
Algorithm estimated_ability: ${ability}/100 → ${algorithmLevel}.
Hard(68+) corrects: ${hardCorrect}. Upper-mid(51+) corrects: ${upperMidCorrect}. Mid(34+) corrects: ${midCorrect}.

HARD CAPS (apply even if ability number is high):
- C2 only if hardCorrect ≥ 3 AND late items support it.
- C1 only if hardCorrect ≥ 2.
- If hardCorrect < 1 and upperMidCorrect < 2 → at most B1.
- If midCorrect < 2 → at most A2.
- If the log shows mostly easy wins (easyOnly=${easyOnlyWins ? 'yes' : 'no'}) → do NOT assign B2+.
Be CONSERVATIVE: when unsure between two levels, pick the LOWER one.
Do NOT use percent-correct alone — weight by difficulty. Late boundary items matter most.
${lang === 'chinese' ? 'Include hskLevel if applicable (aligned with CEFR conservatism).' : ''}

Answer log:
${lines}

Return JSON: {"level":"A1"|…|"C2","score":0-100,"summary":"…","strengths":["…"],"gaps":["…"]${lang === 'chinese' ? ',"hskLevel":"HSK…"' : ''}}`;
}
