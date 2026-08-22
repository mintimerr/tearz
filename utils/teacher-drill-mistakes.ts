import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = '@tearz/u/';
const STORAGE_SUFFIX = '/teacher.drillMistakes.v1';

const MAX_MISTAKES = 60;
const MAX_CHECK_TEXT_LEN = 220;
const MAX_ANSWER_LEN = 400;
const MAX_FEEDBACK_LEN = 400;

export type TeacherDrillMistakeItem = {
  kind: string;
  checkText: string;
  learnerAnswer: string;
  idealAnswer?: string;
  feedback?: string;
};

export type TeacherDrillMistakeRecord = TeacherDrillMistakeItem & {
  id: string;
  lessonTopic?: string;
  language?: string;
  recordedAt: number;
};

export type TeacherDrillMistakeSummary = TeacherDrillMistakeItem & {
  lessonTopic?: string;
};

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}${STORAGE_SUFFIX}`;
}

function trimField(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function normalizeRecord(raw: unknown): TeacherDrillMistakeRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Partial<TeacherDrillMistakeRecord>;
  const checkText = trimField(row.checkText, MAX_CHECK_TEXT_LEN);
  const learnerAnswer = trimField(row.learnerAnswer, MAX_ANSWER_LEN);
  if (!checkText || !learnerAnswer) return null;
  const id =
    typeof row.id === 'string' && row.id.trim()
      ? row.id.trim().slice(0, 64)
      : `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    kind: trimField(row.kind, 48) || 'unknown',
    checkText,
    learnerAnswer,
    idealAnswer: trimField(row.idealAnswer, MAX_ANSWER_LEN) || undefined,
    feedback: trimField(row.feedback, MAX_FEEDBACK_LEN) || undefined,
    lessonTopic: trimField(row.lessonTopic, 160) || undefined,
    language: trimField(row.language, 24) || undefined,
    recordedAt:
      typeof row.recordedAt === 'number' && Number.isFinite(row.recordedAt)
        ? row.recordedAt
        : Date.now(),
  };
}

export async function loadDrillMistakes(userId: string): Promise<TeacherDrillMistakeRecord[]> {
  if (!userId) return [];
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeRecord)
      .filter((row): row is TeacherDrillMistakeRecord => row !== null)
      .slice(-MAX_MISTAKES);
  } catch {
    return [];
  }
}

export async function saveDrillMistakes(
  userId: string,
  mistakes: TeacherDrillMistakeRecord[],
): Promise<void> {
  if (!userId) return;
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(mistakes.slice(-MAX_MISTAKES)));
}

export function recordDrillMistakes(
  existing: TeacherDrillMistakeRecord[],
  sessionMistakes: TeacherDrillMistakeItem[],
  meta?: { lessonTopic?: string; language?: string },
): TeacherDrillMistakeRecord[] {
  if (sessionMistakes.length === 0) return existing;
  const now = Date.now();
  const appended = sessionMistakes.map((mistake, index) => ({
    id: `m-${now}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    kind: mistake.kind,
    checkText: mistake.checkText.trim().slice(0, MAX_CHECK_TEXT_LEN),
    learnerAnswer: mistake.learnerAnswer.trim().slice(0, MAX_ANSWER_LEN),
    idealAnswer: mistake.idealAnswer?.trim().slice(0, MAX_ANSWER_LEN) || undefined,
    feedback: mistake.feedback?.trim().slice(0, MAX_FEEDBACK_LEN) || undefined,
    lessonTopic: meta?.lessonTopic?.trim().slice(0, 160) || undefined,
    language: meta?.language?.trim().slice(0, 24) || undefined,
    recordedAt: now + index,
  }));
  return [...existing, ...appended].slice(-MAX_MISTAKES);
}

/** Последние ошибки для API — новые первыми. */
export function getMistakeSummariesForApi(
  mistakes: TeacherDrillMistakeRecord[],
  limit = 12,
): TeacherDrillMistakeSummary[] {
  return [...mistakes]
    .sort((a, b) => b.recordedAt - a.recordedAt)
    .slice(0, limit)
    .map(({ kind, checkText, learnerAnswer, idealAnswer, feedback, lessonTopic }) => ({
      kind,
      checkText,
      learnerAnswer,
      idealAnswer,
      feedback,
      lessonTopic,
    }));
}
