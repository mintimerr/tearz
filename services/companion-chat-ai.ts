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
  TeacherNextTopicRecommendation,
} from '@/types/companion-chat-api';
import { normalizeTeacherExerciseSet } from '@/utils/teacher-exercise-normalize';
import { defaultOpeningForLang, defaultStatusBio } from '@/utils/companion-ai-fallback-profile';

import { companionApiRequestHeaders, getCompanionChatApiBaseUrl, SERVER_UNREACHABLE_HINT } from '@/utils/companion-api-config';

async function postCompanionChatJson(path: string, body: unknown): Promise<Response> {
  const url = `${getCompanionChatApiBaseUrl()}${path}`;
  try {
    return await fetch(url, {
      method: 'POST',
      headers: companionApiRequestHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(`Не удалось подключиться к серверу. ${SERVER_UNREACHABLE_HINT}`);
  }
}

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
  const base = getCompanionChatApiBaseUrl();
  const url = `${base}/api/teacher-exercise`;
  const res = await fetch(url, {
    method: 'POST',
    headers: companionApiRequestHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
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

/** POST /api/teacher-exercise-check — проверка ответа ученика на задание */
export async function postTeacherExerciseCheck(
  body: TeacherExerciseCheckRequestBody,
): Promise<TeacherExerciseCheckSuccessBody> {
  const base = getCompanionChatApiBaseUrl();
  const url = `${base}/api/teacher-exercise-check`;
  const res = await fetch(url, {
    method: 'POST',
    headers: companionApiRequestHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
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

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function asTrimmedString(x: unknown, max: number): string {
  if (typeof x !== 'string') return '';
  return x.trim().slice(0, max);
}

/** POST /api/companion-profile — случайный профиль под язык практики */
export async function postCompanionProfile(body: CompanionProfileRequestBody): Promise<GeneratedCompanionProfile> {
  const base = getCompanionChatApiBaseUrl();
  const url = `${base}/api/companion-profile`;
  const res = await fetch(url, {
    method: 'POST',
    headers: companionApiRequestHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
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
    const langWord = body.language === 'chinese' ? 'Chinese' : body.language === 'russian' ? 'Russian' : 'English';
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
