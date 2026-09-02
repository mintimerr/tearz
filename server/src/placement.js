import {
  PLACEMENT_TOTAL,
  START_ABILITY,
  abilityToLevel,
  computeNextProbe,
  difficultyFromAbility,
  isWeakPlacementQuestion,
  shuffleChoices,
  stripPinyin,
  updateAbility,
} from './placement-adaptive.js';

const SECTIONS = ['grammar', 'comprehension', 'phrases', 'structure'];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function encodeAnswerKey(id, correctChoice) {
  return Buffer.from(JSON.stringify({ id, c: correctChoice }), 'utf8').toString('base64url');
}

function decodeAnswerKey(token) {
  if (typeof token !== 'string' || !token.trim()) return null;
  try {
    const parsed = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed.id !== 'string' || typeof parsed.c !== 'string') return null;
    return { id: parsed.id, correctChoice: parsed.c };
  } catch {
    return null;
  }
}

function normalizeChoice(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

import {
  buildPlacementQuestionSystemPrompt,
  buildPlacementQuestionUserPrompt,
} from './placement-question-prompt.js';

function buildPlacementResultPrompt(lang, ui, ability, history) {
  const m = ui;
  const lines = history
    .map(
      (h, i) =>
        `${i + 1}. [${h.section} d${h.difficulty}] ${h.prompt} → ${h.correct ? 'correct' : 'wrong'}`,
    )
    .join('\n');
  const extra =
    lang === 'chinese'
      ? '\nAlso return "hskLevel" like "HSK3" if applicable.'
      : '';
  const maxLevel = abilityToLevel(ability);
  return (
    `You are a certified language examiner. Based on adaptive placement answers, assign CEFR level.\n` +
    `Target language: ${l2Label(lang)}. Write summary in English.\n` +
    `Return JSON only:\n` +
    `{"level":"A1"|"A2"|"B1"|"B2"|"C1"|"C2","score":0-100,"summary":"2 sentences in English","strengths":["…"],"gaps":["…"]${lang === 'chinese' ? ',"hskLevel":"HSK…"' : ''}}\n` +
    `Ability estimate from algorithm: ${ability}/100. Algorithm ceiling: ${maxLevel}.\n` +
    `Be conservative — failed hard probes mean the learner is BELOW that level.\n` +
    `Do NOT assign C1/C2 unless they succeeded on high-difficulty grammar items.\n\n` +
    `Answer log:\n${lines}${extra}`
  );
}

function normalizePlacementQuestion(raw, fallbackDifficulty, lang) {
  if (!raw || typeof raw !== 'object') return null;
  const id =
    typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim().slice(0, 32) : `q-${Date.now()}`;
  const kind =
    raw.kind === 'choose_translation' ||
    raw.kind === 'select_missing_word' ||
    raw.kind === 'true_false' ||
    raw.kind === 'multiple_choice' ||
    raw.kind === 'grammar_form' ||
    raw.kind === 'sentence_order' ||
    raw.kind === 'error_correction'
      ? raw.kind
      : 'multiple_choice';
  let instruction =
    typeof raw.instruction === 'string' ? raw.instruction.trim().slice(0, 160) : 'Choose the answer';
  let prompt = typeof raw.prompt === 'string' ? raw.prompt.trim().slice(0, 320) : '';
  let choices = Array.isArray(raw.choices)
    ? raw.choices
        .filter((c) => typeof c === 'string' && c.trim())
        .map((c) => c.trim().slice(0, 160))
        .slice(0, 4)
    : [];
  let correctChoice =
    typeof raw.correctChoice === 'string' ? raw.correctChoice.trim().slice(0, 160) : '';
  const difficulty = Number.isFinite(Number(raw.difficulty))
    ? clamp(Number(raw.difficulty), 1, 25)
    : fallbackDifficulty;
  const section = SECTIONS.includes(raw.section) ? raw.section : 'grammar';

  if (lang === 'chinese') {
    prompt = stripPinyin(prompt);
    choices = choices.map(stripPinyin);
    correctChoice = stripPinyin(correctChoice);
  }

  if (!prompt || choices.length < 4 || !correctChoice) return null;
  if (!choices.includes(correctChoice)) choices[0] = correctChoice;
  if (isWeakPlacementQuestion(prompt, choices, kind)) return null;

  const normalized = shuffleChoices({
    id,
    kind,
    instruction,
    prompt,
    choices,
    correctChoice,
    difficulty,
    section,
  });

  return normalized;
}

async function callOpenAiJson({ apiKey, model, system, user, maxTokens = 900, temperature = 0.45 }) {
  const models = [model, 'gpt-5.6-terra', 'gpt-4.1', 'o3-mini'];
  let lastErr = null;
  for (const m of models) {
    try {
      return await callOpenAiJsonOnce({ apiKey, model: m, system, user, maxTokens, temperature });
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : '';
      if (!/model|does not exist|not found|invalid/i.test(msg)) throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Model request failed');
}

async function callOpenAiJsonOnce({ apiKey, model, system, user, maxTokens = 900, temperature = 0.45 }) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  });
  const raw = await res.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error('Invalid model response');
  }
  if (!res.ok) {
    const errMsg =
      typeof data?.error?.message === 'string'
        ? data.error.message
        : `OpenAI HTTP ${res.status}`;
    throw new Error(errMsg);
  }
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Empty model response');
  }
  return JSON.parse(content.trim());
}

export function registerPlacementRoutes(app, deps) {
  const {
    getApiKey,
    placementModelForDifficulty,
    PLACEMENT_SCORE_MODEL,
    normalizeUiLanguage,
    uiLangMeta,
  } = deps;

  app.post('/api/placement/step', async (req, res) => {
    const apiKey = getApiKey();
    if (!apiKey) {
      return res.status(500).json({ error: 'Server misconfiguration: OPENAI_API_KEY is not set' });
    }

    const {
      action,
      language,
      uiLanguage,
      ability: abilityRaw,
      history: historyRaw,
      answer,
      answerKey,
      questionIndex: indexRaw,
      lastQuestion: lastQuestionRaw,
    } = req.body ?? {};

    const lang =
      language === 'english' ||
      language === 'chinese' ||
      language === 'russian' ||
      language === 'german' ||
      language === 'french'
        ? language
        : 'english';
    const ui = normalizeUiLanguage(uiLanguage);
    const m = uiLangMeta(ui);

    const history = Array.isArray(historyRaw)
      ? historyRaw
          .filter((h) => h && typeof h === 'object')
          .map((h) => ({
            section: typeof h.section === 'string' ? h.section : 'vocabulary',
            difficulty: Number(h.difficulty) || 12,
            correct: Boolean(h.correct),
            prompt: typeof h.prompt === 'string' ? h.prompt.slice(0, 200) : '',
            questionId: typeof h.questionId === 'string' ? h.questionId.slice(0, 32) : undefined,
            choices: Array.isArray(h.choices)
              ? h.choices.filter((c) => typeof c === 'string').map((c) => c.slice(0, 160)).slice(0, 4)
              : undefined,
          }))
          .slice(0, 12)
      : [];

    const seenIds = Array.isArray(req.body?.seenQuestionIds)
      ? req.body.seenQuestionIds.filter((id) => typeof id === 'string').slice(0, 200)
      : [];
    const seenPrompts = Array.isArray(req.body?.seenPrompts)
      ? req.body.seenPrompts.filter((p) => typeof p === 'string').slice(0, 200)
      : [];
    const seenContentKeys = Array.isArray(req.body?.seenContentKeys)
      ? req.body.seenContentKeys.filter((k) => typeof k === 'string').slice(0, 200)
      : [];

    let ability =
      Number.isFinite(Number(abilityRaw)) ? clamp(Number(abilityRaw), 5, 98) : START_ABILITY;
    let questionIndex =
      Number.isFinite(Number(indexRaw)) ? Math.max(0, Math.min(PLACEMENT_TOTAL, Number(indexRaw))) : 0;
    let lastCorrect = null;

    try {
      if (action === 'start') {
        ability = START_ABILITY;
        questionIndex = 0;
        history.length = 0;
      } else if (action === 'answer') {
        const key = decodeAnswerKey(answerKey);
        const lastDifficulty =
          lastQuestionRaw && Number.isFinite(Number(lastQuestionRaw.difficulty))
            ? Number(lastQuestionRaw.difficulty)
            : history.length
              ? history[history.length - 1].difficulty
              : difficultyFromAbility(ability);
        const lastSection =
          lastQuestionRaw && typeof lastQuestionRaw.section === 'string'
            ? lastQuestionRaw.section
            : SECTIONS[Math.max(0, questionIndex - 1) % SECTIONS.length];
        const lastPrompt =
          lastQuestionRaw && typeof lastQuestionRaw.prompt === 'string'
            ? lastQuestionRaw.prompt.slice(0, 200)
            : '';
        const lastQuestionId =
          lastQuestionRaw && typeof lastQuestionRaw.id === 'string'
            ? lastQuestionRaw.id.slice(0, 32)
            : undefined;
        let correct = false;
        const timedOut = req.body?.timedOut === true;
        if (!timedOut && key && typeof answer === 'string') {
          correct = normalizeChoice(answer) === normalizeChoice(key.correctChoice);
        }
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
            choices: Array.isArray(lastQuestionRaw?.choices)
              ? lastQuestionRaw.choices.filter((c) => typeof c === 'string').slice(0, 4)
              : undefined,
          });
        }
        ability = updateAbility(ability, lastDifficulty, correct);
        questionIndex = history.length;

        if (questionIndex >= PLACEMENT_TOTAL) {
          const parsed = await callOpenAiJson({
            apiKey,
            model: PLACEMENT_SCORE_MODEL,
            system: buildPlacementResultPrompt(lang, m, ability, history),
            user: 'Finalize placement level.',
            maxTokens: 600,
            temperature: 0.2,
          });
          const level =
            typeof parsed.level === 'string' && /^A1|A2|B1|B2|C1|C2$/i.test(parsed.level)
              ? parsed.level.toUpperCase()
              : abilityToLevel(ability);
          const algorithmLevel = abilityToLevel(ability);
          const levelRank = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };
          const finalLevel =
            levelRank[level] > levelRank[algorithmLevel] ? algorithmLevel : level;
          const score = Number.isFinite(Number(parsed.score))
            ? clamp(Number(parsed.score), 5, 98)
            : ability;
          return res.json({
            done: true,
            ability,
            correct,
            result: {
              level: finalLevel,
              score,
              summary: typeof parsed.summary === 'string' ? parsed.summary.trim().slice(0, 400) : '',
              strengths: Array.isArray(parsed.strengths)
                ? parsed.strengths.filter((s) => typeof s === 'string').slice(0, 4)
                : [],
              gaps: Array.isArray(parsed.gaps)
                ? parsed.gaps.filter((s) => typeof s === 'string').slice(0, 4)
                : [],
              hskLevel:
                lang === 'chinese' && typeof parsed.hskLevel === 'string'
                  ? parsed.hskLevel.trim().slice(0, 12)
                  : undefined,
            },
          });
        }
      } else if (action !== 'start') {
        return res.status(400).json({ error: 'action must be start or answer' });
      }

      const section = SECTIONS[questionIndex % SECTIONS.length];
      const probe = computeNextProbe(ability, history, questionIndex);
      const targetDifficulty = probe.targetDifficulty;
      const model = placementModelForDifficulty(targetDifficulty);

      let question = null;
      for (let attempt = 0; attempt < 5 && !question; attempt += 1) {
        const parsed = await callOpenAiJson({
          apiKey,
          model: attempt === 0 ? model : PLACEMENT_SCORE_MODEL,
          system: buildPlacementQuestionSystemPrompt({
            lang,
            ability,
            history,
            section,
            probe,
            seenPrompts,
            seenContentKeys,
          }),
          user: buildPlacementQuestionUserPrompt({
            questionIndex,
            totalQuestions: PLACEMENT_TOTAL,
            probe,
            history,
            attempt: attempt + 1,
          }),
          maxTokens: 1100,
          temperature: 0.35 + attempt * 0.07,
        });
        const candidate = normalizePlacementQuestion(parsed, targetDifficulty, lang);
        if (!candidate) continue;
        const seenAll = new Set([
          ...history.map((h) => h.prompt),
          ...seenPrompts,
          ...history.map((h) => h.questionId).filter(Boolean),
          ...seenIds,
        ]);
        const contentKey = `${candidate.prompt}::${[...candidate.choices].sort().join('|')}`;
        const contentSeen = new Set([
          ...history
            .filter((h) => h.prompt && Array.isArray(h.choices))
            .map((h) => `${h.prompt}::${[...h.choices].sort().join('|')}`),
          ...seenContentKeys,
        ]);
        if (seenAll.has(candidate.prompt) || seenAll.has(candidate.id) || contentSeen.has(contentKey)) {
          continue;
        }
        question = candidate;
      }

      if (!question) {
        return res.status(502).json({ error: 'Could not generate placement question' });
      }

      const token = encodeAnswerKey(question.id, question.correctChoice);
      const { correctChoice: _c, ...publicQuestion } = question;

      return res.json({
        done: false,
        correct: lastCorrect,
        ability,
        questionIndex: questionIndex + 1,
        totalQuestions: PLACEMENT_TOTAL,
        question: publicQuestion,
        answerKey: token,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Network error';
      return res.status(502).json({ error: msg });
    }
  });
}
