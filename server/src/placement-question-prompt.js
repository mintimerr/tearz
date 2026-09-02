import crypto from 'node:crypto';

function l2Label(lang) {
  if (lang === 'chinese') return 'Chinese (汉字 only — no pinyin)';
  if (lang === 'german') return 'German';
  if (lang === 'french') return 'French';
  if (lang === 'russian') return 'Russian';
  return 'English';
}

function cefrBand(difficulty) {
  if (difficulty <= 6) return 'A1–A2';
  if (difficulty <= 12) return 'A2–B1';
  if (difficulty <= 18) return 'B1–B2';
  if (difficulty <= 22) return 'B2–C1';
  return 'C1–C2';
}

function probeGuidance(mode, difficulty) {
  if (mode === 'probe_up') {
    return (
      'PROBE UP: the learner is doing well. Test the CEILING — subtle grammar, aspect, register, ' +
      'or inference. Distractors must be mistakes a strong B1/B2 learner would still make.'
    );
  }
  if (mode === 'probe_down') {
    return (
      'PROBE DOWN: the learner struggled. Step back one notch but stay in-context. ' +
      'Still use plausible distractors — do NOT make the correct answer obvious.'
    );
  }
  if (mode === 'baseline') {
    return 'BASELINE: first calibrated item. Mid-level contextual grammar or comprehension — not trivial vocabulary.';
  }
  return 'CONFIRM: verify the current estimate with one discriminating item at target difficulty.';
}

function sectionGuidance(section, lang) {
  const map = {
    grammar:
      'Focus: verb form, case, mood, aspect, agreement, preposition, or particle IN a full sentence. ' +
      'Blank or underline ONE slot only.',
    comprehension:
      'Focus: short L2 passage (1–2 sentences) or dialogue line. Ask meaning, implication, or speaker intent. ' +
      'All 4 options = paraphrases of the same situation.',
    phrases:
      'Focus: idiomatic reply, collocation, or fixed expression in a mini-dialogue (A: … / B: ___).',
    structure:
      'Focus: sentence order OR error correction. For order: 4 complete orderings of 3–4 clauses joined by " → ".',
  };
  return map[section] ?? map.grammar;
}

function languageSpecificRules(lang) {
  if (lang === 'chinese') {
    return `
CHINESE RULES (mandatory):
- Hanzi ONLY in prompt and choices. Zero pinyin, zero romanization, zero tone marks.
- Test particles (了/过/着), aspect, complement, measure word, 把/被, conjunctions — in context.
- Comprehension options in English OR Chinese — but if Chinese, hanzi only.
- Distractors = wrong particle, wrong aspect, wrong word order fragment — NOT random unrelated words.`;
  }
  if (lang === 'german') {
    return `
GERMAN RULES:
- Test case (Akk/Dat/Gen), verb position, separable verbs, Konjunktiv II, Perfekt vs Präteritum — in context.
- All 4 choices must be valid-looking German words/forms; wrong = case/tense/order mistake.`;
  }
  if (lang === 'french') {
    return `
FRENCH RULES:
- Test agreement, subjunctive trigger, passé composé vs imparfait, pronoun order, preposition — in context.
- Include elisions/apostrophes naturally (l', j', d').`;
  }
  if (lang === 'russian') {
    return `
RUSSIAN RULES:
- Test case endings, aspect (perfective/imperfective), motion verbs, preposition+case — in context.
- All choices must be Cyrillic and grammatically shaped like real forms.`;
  }
  return `
ENGLISH RULES:
- Test tense, conditionals, modals, prepositions, phrasal verbs, relative clauses — in context.
- For comprehension, options may be English paraphrases.`;
}

function buildAvoidBlock({ history, seenPrompts, seenContentKeys }) {
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
  return `\n\nALREADY USED — generate something completely different (new scenario, new lexeme, new structure):\n${lines.join('\n')}`;
}

function performanceSummary(history) {
  if (!history.length) return 'No answers yet.';
  const recent = history.slice(-4);
  const correct = recent.filter((h) => h.correct).length;
  const avgDiff = Math.round(recent.reduce((s, h) => s + h.difficulty, 0) / recent.length);
  return `Last ${recent.length} items: ${correct}/${recent.length} correct, avg difficulty ${avgDiff}/25.`;
}

/** System prompt for the placement question generator. */
export function buildPlacementQuestionSystemPrompt({
  lang,
  ability,
  history,
  section,
  probe,
  seenPrompts,
  seenContentKeys,
}) {
  const difficulty = probe.targetDifficulty;
  const band = cefrBand(difficulty);

  return `You are a senior language examiner who designs computer-adaptive placement items (TOCFL / DELF / Goethe / TRKI style) for the Tearz app.

YOUR JOB: write exactly ONE multiple-choice item, then return JSON only — no markdown, no commentary.

TARGET LANGUAGE (L2): ${l2Label(lang)}
UI LANGUAGE: English (instruction field ONLY in English)
SECTION THIS TURN: ${section}
${sectionGuidance(section, lang)}

ADAPTIVE STATE:
- Probe mode: ${probe.mode} — ${probeGuidance(probe.mode, difficulty)}
- Target difficulty: ${difficulty}/25 (CEFR band ${band})
- Algorithm ability estimate: ${ability}/100
${languageSpecificRules(lang)}

QUESTION TYPES (pick the best fit for section + difficulty):
| kind | when to use |
| select_missing_word | sentence with ONE blank ___; 4 word/phrase options |
| grammar_form | same, but testing a short grammatical slot (particle, ending, auxiliary) |
| multiple_choice | 1–2 sentence L2 prompt; 4 meaning paraphrases (same event, subtle differences) |
| sentence_order | prompt lists shuffled clauses; each choice = full order "A → B → C → D" |
| error_correction | prompt shows a sentence with one wrong form; choices = four corrected versions |

OUTPUT SCHEMA (strict):
{
  "id": "q-${crypto.randomUUID().slice(0, 8)}",
  "kind": "select_missing_word"|"grammar_form"|"multiple_choice"|"sentence_order"|"error_correction",
  "instruction": "≤12 words, English, e.g. Choose the most natural reply.",
  "prompt": "stem mostly in L2; for dialogue use A: … / B: ___",
  "choices": ["…","…","…","…"],
  "correctChoice": "must exactly equal one of choices",
  "difficulty": ${difficulty},
  "section": "${section}"
}

DISTRACTOR ENGINEERING (this is what makes a good item):
1. All 4 options must look equally professional — similar length (±30%), same register, same grammar frame.
2. Wrong answers = realistic learner errors: wrong tense/aspect, wrong case/particle, partial meaning, near-synonym that fails collocation.
3. NEVER: one long detailed correct option + three short absurd ones.
4. NEVER: only one option fits grammatically while others are nonsense words.
5. NEVER: unrelated topics ("The weather is nice" as distractor for a work email question).
6. NEVER: lone negation trick (only one option contains "not/never/没/不").
7. For comprehension: ALL four options describe the SAME scene; exactly ONE matches the prompt; differences are subtle (time, cause, attitude, scope).
8. For blanks: ALL four must be the same part of speech and plausible in the sentence frame.

FORBIDDEN (instant fail — do not generate):
- Isolated word translation ("hello" → pick translation)
- Single-character prompts
- Pinyin or romanization in Chinese
- True/false
- Copying or lightly rephrasing an item from ALREADY USED list
- Generic filler ("I don't know", "Something else", "None of the above")

QUALITY SELF-CHECK before output:
□ Would a trained teacher need to read the prompt carefully to pick the answer?
□ Could a strong learner plausibly pick each wrong option?
□ Is the item unique vs ALREADY USED list?
□ Does difficulty match ${band}?

Return JSON object only.${buildAvoidBlock({ history, seenPrompts, seenContentKeys })}`;
}

/** User turn — concrete generation request with session context. */
export function buildPlacementQuestionUserPrompt({
  questionIndex,
  totalQuestions,
  probe,
  history,
  attempt,
}) {
  const last = history.length ? history[history.length - 1] : null;
  const lastLine = last
    ? `Previous item (${last.correct ? 'CORRECT' : 'WRONG'}, d${last.difficulty}): "${last.prompt.slice(0, 100)}"`
    : 'This is the first item of the session.';

  return (
    `Generate item ${questionIndex + 1} of ${totalQuestions}.\n` +
    `Probe: ${probe.mode}, target difficulty ${probe.targetDifficulty}/25.\n` +
    `${performanceSummary(history)}\n` +
    `${lastLine}\n` +
    `Attempt ${attempt} — produce a fresh, discriminating item that follows all distractor rules.\n` +
    `Use a NEW scenario (work, travel, study, health, plans, opinions — vary the topic).`
  );
}
