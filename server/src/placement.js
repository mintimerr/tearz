import crypto from 'node:crypto';

const PLACEMENT_TOTAL = 10;
const START_ABILITY = 45;
const SECTIONS = ['vocabulary', 'grammar', 'comprehension', 'phrases'];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function difficultyFromAbility(ability) {
  return clamp(Math.round((ability / 100) * 22) + 2, 1, 25);
}

function updateAbility(ability, difficulty, correct) {
  const delta = correct ? 4 + Math.round(difficulty * 0.55) : 5 + Math.round(difficulty * 0.5);
  return clamp(correct ? ability + delta : ability - delta, 5, 98);
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

function l2Label(lang) {
  if (lang === 'chinese') return 'Chinese (汉字)';
  if (lang === 'german') return 'German';
  if (lang === 'french') return 'French';
  if (lang === 'russian') return 'Russian';
  return 'English';
}

function buildPlacementQuestionPrompt(lang, ui, ability, history, section) {
  const difficulty = difficultyFromAbility(ability);
  const m = ui;
  const avoid =
    history.length > 0
      ? `\nAvoid repeating these prompts:\n${history
          .slice(-6)
          .map((h) => `- ${h.prompt}`)
          .join('\n')}`
      : '';
  const pinyinRule =
    lang === 'chinese'
      ? '\n- Chinese: include toned pinyin in prompt when showing hanzi.'
      : '';
  return (
    `You write ONE adaptive placement-test question for Tearz language app.\n` +
    `Target language (L2): ${l2Label(lang)}. UI language for instructions: ${m.explainLabel}.\n` +
    `Estimated learner ability (0–100): ${ability}. Question difficulty target: ${difficulty}/25.\n` +
    `Section focus: ${section}.\n` +
    `Return JSON only:\n` +
    `{"id":"q-${crypto.randomUUID().slice(0, 8)}","kind":"choose_translation"|"select_missing_word"|"true_false"|"multiple_choice","instruction":"short instruction in ${m.explainLabel}","prompt":"question stem in L2 or mixed","choices":["A","B","C","D"],"correctChoice":"exact match from choices","difficulty":${difficulty},"section":"${section}"}\n` +
    `Rules:\n` +
    `- Exactly 4 distinct choices; correctChoice must equal one choice exactly.\n` +
    `- Match difficulty ${difficulty}: low = single words / basic grammar; high = nuance, subjunctive, idioms.\n` +
    `- Instruction in ${m.explainLabel}; prompt mostly in L2.\n` +
    `- No markdown.${pinyinRule}${avoid}`
  );
}

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
  return (
    `You are a certified language examiner. Based on placement test answers, assign CEFR level.\n` +
    `Target language: ${l2Label(lang)}. Write summary in ${m.explainLabel}.\n` +
    `Return JSON only:\n` +
    `{"level":"A1"|"A2"|"B1"|"B2"|"C1"|"C2","score":0-100,"summary":"2 sentences in ${m.explainLabel}","strengths":["…"],"gaps":["…"]${lang === 'chinese' ? ',"hskLevel":"HSK…"' : ''}}\n` +
    `Ability estimate from algorithm: ${ability}/100.\n` +
    `Do NOT be generous — wrong answers on hard items mean lower level.\n\n` +
    `Answer log:\n${lines}${extra}`
  );
}

function normalizePlacementQuestion(raw, fallbackDifficulty) {
  if (!raw || typeof raw !== 'object') return null;
  const id =
    typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim().slice(0, 32) : `q-${Date.now()}`;
  const kind =
    raw.kind === 'choose_translation' ||
    raw.kind === 'select_missing_word' ||
    raw.kind === 'true_false' ||
    raw.kind === 'multiple_choice'
      ? raw.kind
      : 'choose_translation';
  const instruction =
    typeof raw.instruction === 'string' ? raw.instruction.trim().slice(0, 160) : 'Choose the answer';
  const prompt = typeof raw.prompt === 'string' ? raw.prompt.trim().slice(0, 280) : '';
  const choices = Array.isArray(raw.choices)
    ? raw.choices
        .filter((c) => typeof c === 'string' && c.trim())
        .map((c) => c.trim().slice(0, 120))
        .slice(0, 4)
    : [];
  const correctChoice =
    typeof raw.correctChoice === 'string' ? raw.correctChoice.trim().slice(0, 120) : '';
  const difficulty = Number.isFinite(Number(raw.difficulty))
    ? clamp(Number(raw.difficulty), 1, 25)
    : fallbackDifficulty;
  const section = SECTIONS.includes(raw.section) ? raw.section : 'vocabulary';
  if (!prompt || choices.length < 2 || !correctChoice) return null;
  if (!choices.includes(correctChoice)) choices[0] = correctChoice;
  return { id, kind, instruction, prompt, choices, correctChoice, difficulty, section };
}

function abilityToLevel(ability) {
  if (ability < 18) return 'A1';
  if (ability < 32) return 'A2';
  if (ability < 48) return 'B1';
  if (ability < 65) return 'B2';
  if (ability < 82) return 'C1';
  return 'C2';
}

async function callOpenAiJson({ apiKey, model, system, user, maxTokens = 900, temperature = 0.45 }) {
  const models = [model, 'gpt-4.1-mini', 'gpt-4.1', 'o3-mini'];
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
          }))
          .slice(0, 12)
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
        let correct = false;
        if (key && typeof answer === 'string') {
          correct = normalizeChoice(answer) === normalizeChoice(key.correctChoice);
        }
        lastCorrect = correct;
        history.push({
          section: lastSection,
          difficulty: lastDifficulty,
          correct,
          prompt: lastPrompt,
        });
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
          const score = Number.isFinite(Number(parsed.score))
            ? clamp(Number(parsed.score), 5, 98)
            : ability;
          return res.json({
            done: true,
            ability,
            correct,
            result: {
              level,
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
      const targetDifficulty = difficultyFromAbility(ability);
      const model = placementModelForDifficulty(targetDifficulty);

      let question = null;
      for (let attempt = 0; attempt < 2 && !question; attempt += 1) {
        const parsed = await callOpenAiJson({
          apiKey,
          model: attempt === 0 ? model : PLACEMENT_SCORE_MODEL,
          system: buildPlacementQuestionPrompt(lang, m, ability, history, section),
          user: `Generate question ${questionIndex + 1} of ${PLACEMENT_TOTAL}.`,
          maxTokens: 700,
          temperature: 0.5,
        });
        question = normalizePlacementQuestion(parsed, targetDifficulty);
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
