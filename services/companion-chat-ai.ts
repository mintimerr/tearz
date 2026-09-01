import type {
  CompanionChatApiLanguage,
  CompanionChatErrorBody,
  CompanionChatRequestBody,
  CompanionChatSuccessBody,
  CompanionProfileRequestBody,
  CompanionProfileSuccessBody,
  GeneratedCompanionProfile,
  TeacherExerciseCheckRequestBody,
  TeacherExerciseCheckSuccessBody,
  TeacherChatRequestBody,
  TeacherChatSuccessBody,
  TeacherExerciseRequestBody,
  TeacherExerciseSetRequestBody,
  TeacherExerciseSetSuccessBody,
  TeacherExerciseSuccessBody,
  TeacherDrillFollowUp,
  TeacherDrillFollowUpRequestBody,
  TeacherDrillFollowUpSuccessBody,
  TeacherNextTopicRecommendation,
  TeacherVocabExamplesRequestBody,
  TeacherVocabExamplesSuccessBody,
} from '@/types/companion-chat-api';
import { normalizeTeacherExerciseSet } from '@/utils/teacher-exercise-normalize';
import { normalizeTeacherVocabExamples } from '@/utils/teacher-vocab-examples-normalize';
import { buildLocalDrillFollowUp, normalizeLearnerRepeatPrompt } from '@/utils/teacher-drill-followup';
import { defaultOpeningForLang, defaultStatusBio } from '@/utils/companion-ai-fallback-profile';

import { postCompanionApiJson, warmCompanionApi } from '@/utils/companion-api-fetch';

async function postCompanionChatJson(path: string, body: unknown): Promise<Response> {
  return postCompanionApiJson(path, body, { timeoutMs: 120_000, retries: 3 });
}

export { warmCompanionApi };

export async function postCompanionChatReply(body: CompanionChatRequestBody): Promise<string> {
  const res = await postCompanionChatJson('/api/chat', body);
  const raw = await res.text();
  let json: unknown;
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(raw.slice(0, 200) || `HTTP ${res.status}`);
  }
  if (!res.ok) {
    const err = json as Partial<CompanionChatErrorBody>;
    throw new Error(err.error || `Ошибка сервера (${res.status})`);
  }
  const ok = json as Partial<CompanionChatSuccessBody>;
  if (typeof ok.reply !== 'string' || !ok.reply.trim()) {
    throw new Error('Пустой ответ от сервера');
  }
  return ok.reply.trim();
}

/** POST /api/teacher-chat — ответ AI-преподавателя (модель на сервере, по умолчанию gpt-4.1-mini) */
export async function postTeacherChatReply(body: TeacherChatRequestBody): Promise<string> {
  const res = await postCompanionChatJson('/api/teacher-chat', body);
  const raw = await res.text();
  let json: unknown;
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(raw.slice(0, 200) || `HTTP ${res.status}`);
  }
  if (!res.ok) {
    const err = json as Partial<CompanionChatErrorBody>;
    throw new Error(err.error || `Ошибка сервера (${res.status})`);
  }
  const ok = json as Partial<TeacherChatSuccessBody>;
  if (typeof ok.reply !== 'string' || !ok.reply.trim()) {
    throw new Error('Пустой ответ от сервера');
  }
  return ok.reply.trim();
}

/** POST /api/teacher-exercise — генерация практики по конкретному объяснению преподавателя */
export async function postTeacherExercise(body: TeacherExerciseRequestBody): Promise<string> {
  const res = await postCompanionApiJson('/api/teacher-exercise', body);
  const raw = await res.text();
  let json: unknown;
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(raw.slice(0, 200) || `HTTP ${res.status}`);
  }
  if (!res.ok) {
    const err = json as Partial<CompanionChatErrorBody>;
    throw new Error(err.error || `Ошибка сервера (${res.status})`);
  }
  const ok = json as Partial<TeacherExerciseSuccessBody>;
  if (typeof ok.exercise !== 'string' || !ok.exercise.trim()) {
    throw new Error('Пустое задание от сервера');
  }
  return ok.exercise.trim();
}

function normalizeNextTopic(raw: unknown): TeacherNextTopicRecommendation | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const next = (raw as { nextTopic?: unknown }).nextTopic;
  if (!next || typeof next !== 'object') return undefined;
  const title = asTrimmedString((next as { title?: unknown }).title, 160);
  if (!title) return undefined;
  return {
    title,
    reason: asTrimmedString((next as { reason?: unknown }).reason, 400),
    connection: asTrimmedString((next as { connection?: unknown }).connection, 400),
  };
}

function normalizeDrillFollowUp(
  raw: unknown,
  ui: 'ru' | 'en' | 'zh' = 'ru',
): TeacherDrillFollowUp | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const follow = (raw as { followUp?: unknown }).followUp ?? raw;
  if (!follow || typeof follow !== 'object') return undefined;
  const actionRaw = (follow as { action?: unknown }).action;
  const action =
    actionRaw === 'repeat_same' || actionRaw === 'review_gaps' || actionRaw === 'advance'
      ? actionRaw
      : 'review_gaps';
  const title = asTrimmedString((follow as { title?: unknown }).title, 160);
  if (!title) return undefined;
  const focusAreasRaw = (follow as { focusAreas?: unknown }).focusAreas;
  const focusAreas = Array.isArray(focusAreasRaw)
    ? focusAreasRaw
        .map((line) => asTrimmedString(line, 120))
        .filter(Boolean)
        .slice(0, 4)
    : undefined;
  const repeatPromptRaw = asTrimmedString((follow as { repeatPrompt?: unknown }).repeatPrompt, 600);
  const repeatPrompt =
    action === 'repeat_same' || action === 'review_gaps'
      ? normalizeLearnerRepeatPrompt(repeatPromptRaw || undefined, action, ui, focusAreas, title)
      : repeatPromptRaw || undefined;
  return {
    action,
    title,
    reason: asTrimmedString((follow as { reason?: unknown }).reason, 500),
    connection: asTrimmedString((follow as { connection?: unknown }).connection, 400) || undefined,
    repeatPrompt: repeatPrompt || undefined,
    ...(focusAreas && focusAreas.length > 0 ? { focusAreas } : {}),
  };
}

/** POST /api/teacher-exercise-set — 5 заданий по объяснению преподавателя */
export async function postTeacherExerciseSet(
  body: TeacherExerciseSetRequestBody,
): Promise<TeacherExerciseSetSuccessBody> {
  const res = await postCompanionChatJson('/api/teacher-exercise-set', body);
  const raw = await res.text();
  let json: unknown;
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(raw.slice(0, 200) || `HTTP ${res.status}`);
  }
  if (!res.ok) {
    const err = json as Partial<CompanionChatErrorBody>;
    if (res.status === 404) {
      throw new Error(
        __DEV__
          ? 'Сервер не поддерживает мини-тренировку. Перезапустите backend: cd server && npm start'
          : 'Функция временно недоступна. Обновите приложение или попробуйте позже.',
      );
    }
    throw new Error(err.error || `Ошибка сервера (${res.status})`);
  }
  const exercises = normalizeTeacherExerciseSet(json);
  if (exercises.length < 3) {
    throw new Error('Сервер вернул слишком мало заданий');
  }
  const nextTopic = normalizeNextTopic(json);
  return { exercises, ...(nextTopic ? { nextTopic } : {}) };
}

/** POST /api/teacher-vocab-examples — карточки слов с ~5 предложениями употребления */
export async function postTeacherVocabExamples(
  body: TeacherVocabExamplesRequestBody,
): Promise<TeacherVocabExamplesSuccessBody> {
  const res = await postCompanionChatJson('/api/teacher-vocab-examples', body);
  const raw = await res.text();
  let json: unknown;
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(raw.slice(0, 200) || `HTTP ${res.status}`);
  }
  if (!res.ok) {
    const err = json as Partial<CompanionChatErrorBody>;
    throw new Error(err.error || `Ошибка сервера (${res.status})`);
  }
  const words = normalizeTeacherVocabExamples(json);
  if (words.length === 0) {
    throw new Error('Не удалось собрать примеры');
  }
  return { words };
}

/** POST /api/teacher-exercise-check — проверка ответа ученика на задание */
export async function postTeacherExerciseCheck(
  body: TeacherExerciseCheckRequestBody,
): Promise<TeacherExerciseCheckSuccessBody> {
  const res = await postCompanionApiJson('/api/teacher-exercise-check', body, {
    timeoutMs: 60_000,
    retries: 2,
  });
  const raw = await res.text();
  let json: unknown;
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(raw.slice(0, 200) || `HTTP ${res.status}`);
  }
  if (!res.ok) {
    const err = json as Partial<CompanionChatErrorBody>;
    throw new Error(err.error || `Ошибка сервера (${res.status})`);
  }
  if (!isRecord(json)) {
    throw new Error('Неверный ответ проверки');
  }
  return {
    correct: Boolean(json.correct),
    title: asTrimmedString(json.title, 120) || (json.correct ? 'Вы молодец' : 'Почти получилось'),
    feedback: asTrimmedString(json.feedback, 1200) || 'Ответ проверен.',
    idealAnswer: asTrimmedString(json.idealAnswer, 800) || undefined,
  };
}

/** POST /api/teacher-drill-followup — что делать после тренировки с учётом ошибок */
export async function postTeacherDrillFollowUp(
  body: TeacherDrillFollowUpRequestBody,
): Promise<TeacherDrillFollowUpSuccessBody> {
  try {
    const res = await postCompanionChatJson('/api/teacher-drill-followup', body);
    const raw = await res.text();
    let json: unknown;
    try {
      json = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error(raw.slice(0, 200) || `HTTP ${res.status}`);
    }
    if (!res.ok) {
      const err = json as Partial<CompanionChatErrorBody>;
      throw new Error(err.error || `Ошибка сервера (${res.status})`);
    }
    const ui = body.uiLanguage === 'en' || body.uiLanguage === 'zh' ? body.uiLanguage : 'ru';
    const followUp = normalizeDrillFollowUp(json, ui);
    if (followUp) return { followUp };
  } catch {
    // fall through to local heuristic
  }

  const sessionMistakes = body.sessionMistakes ?? [];
  const ui = body.uiLanguage === 'en' || body.uiLanguage === 'zh' ? body.uiLanguage : 'ru';
  return {
    followUp: buildLocalDrillFollowUp(
      body.correct,
      body.total,
      sessionMistakes,
      body.nextTopic,
      ui,
    ),
  };
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function asTrimmedString(x: unknown, max: number): string {
  if (typeof x !== 'string') return '';
  return x.trim().slice(0, max);
}

/** POST /api/companion-profile — случайный профиль под язык практики */
export async function postCompanionProfile(body: CompanionProfileRequestBody): Promise<GeneratedCompanionProfile> {
  const res = await postCompanionApiJson('/api/companion-profile', body);
  const raw = await res.text();
  let json: unknown;
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(raw.slice(0, 200) || `HTTP ${res.status}`);
  }
  if (!res.ok) {
    const err = json as Partial<CompanionChatErrorBody>;
    throw new Error(err.error || `Ошибка сервера (${res.status})`);
  }
  if (!isRecord(json)) {
    throw new Error('Неверный ответ профиля');
  }
  const name = asTrimmedString(json.name, 80) || 'Alex';
  const city = asTrimmedString(json.city, 80) || 'London';
  const bio = asTrimmedString(json.bio, 800) || defaultStatusBio(body.language);
  const letterRaw = asTrimmedString(json.letter, 4) || name.slice(0, 1);
  const letter = letterRaw ? letterRaw.slice(0, 1) : 'A';
  const colorRaw = asTrimmedString(json.color, 12);
  const color = /^#[0-9A-Fa-f]{6}$/.test(colorRaw) ? colorRaw : '#3A3A52';
  const persona = asTrimmedString(json.persona, 6000) || (() => {
    const langWord =
      body.language === 'chinese'
        ? 'Chinese'
        : body.language === 'german'
          ? 'German'
          : body.language === 'french'
            ? 'French'
            : body.language === 'russian'
              ? 'Russian'
              : 'English';
    return `You are ${name}, a regular person in ${city}. You only read and write comfortably in ${langWord}. Other languages you basically don't get — ask people to repeat in ${langWord}. Not a tutor. Natural DMs.`;
  })();
  const openingLine = asTrimmedString(json.openingLine, 400) || defaultOpeningForLang(body.language);
  let age = typeof json.age === 'number' && Number.isFinite(json.age) ? Math.round(json.age) : 28;
  if (age < 18) age = 18;
  if (age > 80) age = 80;

  const out: CompanionProfileSuccessBody = {
    name,
    age,
    city,
    bio,
    letter,
    color,
    persona,
    openingLine,
  };
  return out;
}

export type { CompanionChatApiLanguage };
