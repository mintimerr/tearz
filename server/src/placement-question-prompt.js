import crypto from 'node:crypto';

import {
  PLACEMENT_BRAIN_SUMMARY,
  performanceSummary,
  phaseLabel,
  probeGuidance,
  cefrBandFrom100,
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
      'Focus: 1–2 L2 sentences or dialogue. Ask meaning/implication. All 4 options = paraphrases of the same situation.',
    phrases: 'Focus: idiomatic reply or collocation in mini-dialogue (A: … / B: ___).',
    structure:
      'Focus: sentence order OR error correction. Order: 4 full clause sequences joined by " → ".',
  };
  return map[section] ?? map.grammar;
}

function languageSpecificRules(lang) {
  if (lang === 'chinese') {
    return `CHINESE: hanzi ONLY. Test particles, aspect, 把/被, measure words — in context.`;
  }
  if (lang === 'german') {
    return `GERMAN: case, verb position, Konjunktiv II, Perfekt/Präteritum — in context.`;
  }
  if (lang === 'french') {
    return `FRENCH: agreement, subjunctive, passé composé vs imparfait — in context.`;
  }
  if (lang === 'russian') {
    return `RUSSIAN: case endings, aspect, motion verbs — in context.`;
  }
  return `ENGLISH: tense, conditionals, modals, phrasal verbs — in context.`;
}

function buildAvoidBlock({ history, seenPrompts }) {
  const lines = [];
  for (const h of history.slice(-8)) {
    lines.push(`- [answered] ${h.prompt.slice(0, 120)}${h.questionId ? ` (${h.questionId})` : ''}`);
  }
  for (const p of (seenPrompts ?? []).slice(-12)) {
    if (!lines.some((l) => l.includes(p.slice(0, 40)))) {
      lines.push(`- [seen] ${p.slice(0, 120)}`);
    }
  }
  if (lines.length === 0) return '';
  return `\n\nALREADY USED — completely new scenario, lexeme, structure:\n${lines.join('\n')}`;
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

  return `${PLACEMENT_BRAIN_SUMMARY}

YOUR SUB-ROLE NOW: write exactly ONE multiple-choice item at the difficulty the adaptive engine requests.
You do NOT choose difficulty — the engine already decided: ${difficulty}/100 (${band}).
Return JSON only — no markdown.

TARGET LANGUAGE (L2): ${l2Label(lang)}
INSTRUCTION LANGUAGE: English only
SECTION: ${section} — ${sectionGuidance(section)}
TEST PHASE: ${phaseLabel(taskNumber)}
ADAPTIVE DIRECTIVE: ${probeGuidance(probe)}
${languageSpecificRules(lang)}

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
- Wrong = realistic learner errors (wrong tense/particle/case, near-synonym that fails).
- NEVER one obvious answer + nonsense distractors.
- NEVER lone negation trick (only one option with not/没/不).
- Comprehension: all 4 describe SAME scene; ONE matches; subtle differences only.

FORBIDDEN: isolated word translation, pinyin, true/false, copying ALREADY USED items.

Self-check: Would a teacher need to read carefully? Could a strong learner pick each wrong option?${buildAvoidBlock({ history, seenPrompts })}`;
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
    : 'First item — difficulty≈50/100.';

  return (
    `Item ${questionIndex + 1} of ${totalQuestions}.\n` +
    `${performanceSummary(history, ability)}\n` +
    `Next target difficulty: ${probe.targetDifficulty}/100 (${cefrBandFrom100(probe.targetDifficulty)}). Phase: ${probe.phase}. Mode: ${probe.mode}.\n` +
    `${lastLine}\n` +
    `Attempt ${attempt}. New scenario (work/travel/study/health/plans). Match difficulty ${probe.targetDifficulty}/100.`
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
  return `${PLACEMENT_BRAIN_SUMMARY}

Finalize placement after 15 items. Write summary in English.
Algorithm estimated_ability: ${ability}/100 → ${algorithmLevel}.
Be CONSERVATIVE: do not assign C1/C2 unless learner succeeded on high-difficulty items (68+/100).
Do NOT use percent-correct alone — weight by difficulty. Late boundary items matter most.
${lang === 'chinese' ? 'Include hskLevel if applicable.' : ''}

Answer log:
${lines}

Return JSON: {"level":"A1"|…|"C2","score":0-100,"summary":"…","strengths":["…"],"gaps":["…"]${lang === 'chinese' ? ',"hskLevel":"HSK…"' : ''}}`;
}
