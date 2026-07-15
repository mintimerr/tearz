import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  MINI_DRILL_MAX_LESSONS,
  MINI_DRILL_MAX_REFRESHES,
} from '@/constants/teacher-drill';

const STORAGE_PREFIX = 'teacher.miniDrill.v1:';

export { MINI_DRILL_MAX_LESSONS, MINI_DRILL_MAX_REFRESHES };

/** @deprecated use MINI_DRILL_MAX_LESSONS */
export const MINI_DRILL_MAX_QUESTIONS = MINI_DRILL_MAX_LESSONS;

const MAX_GENERATIONS_PER_MESSAGE = 1 + MINI_DRILL_MAX_REFRESHES;

export type MiniDrillUsage = {
  perMessage: Record<string, number>;
  /** Краткие тексты прошлых наборов — чтобы не повторять задания при обновлении. */
  priorSets: Record<string, string[][]>;
};

export type MiniDrillAccess = {
  allowed: boolean;
  reason?: string;
  generationsUsed: number;
  /** Сколько обновлений ещё можно для этого объяснения. */
  refreshesLeft: number;
  /** Сколько разных объяснений уже использовано в уроке. */
  questionsUsed: number;
  /** Сколько новых объяснений ещё можно (если это первый запуск для сообщения). */
  questionsLeft: number;
  isRepeat: boolean;
};

const MAX_PRIOR_SETS_PER_MESSAGE = 10;
const MAX_AVOID_TEXT_LEN = 220;

function emptyUsage(): MiniDrillUsage {
  return { perMessage: {}, priorSets: {} };
}

function normalizePriorSets(raw: unknown): Record<string, string[][]> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string[][]> = {};
  for (const [id, sets] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(sets)) continue;
    const normalized = sets
      .filter((set): set is string[] => Array.isArray(set))
      .map((set) =>
        set
          .filter((line): line is string => typeof line === 'string' && line.trim().length > 0)
          .map((line) => line.trim().slice(0, MAX_AVOID_TEXT_LEN)),
      )
      .filter((set) => set.length > 0)
      .slice(-MAX_PRIOR_SETS_PER_MESSAGE);
    if (normalized.length > 0) out[id] = normalized;
  }
  return out;
}

/** Тексты заданий из прошлых запусков для этого объяснения — отправляем модели как «не повторять». */
export function getPriorExerciseTexts(usage: MiniDrillUsage, messageId: string): string[] {
  const sets = usage.priorSets[messageId] ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const set of sets) {
    for (const line of set) {
      const key = line.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(line);
    }
  }
  return out;
}

function questionsUsedCount(usage: MiniDrillUsage): number {
  return Object.values(usage.perMessage).filter((n) => n > 0).length;
}

export function evaluateMiniDrillAccess(usage: MiniDrillUsage, messageId: string): MiniDrillAccess {
  const generationsUsed = usage.perMessage[messageId] ?? 0;
  const questionsUsed = questionsUsedCount(usage);
  const questionsLeft = Math.max(0, MINI_DRILL_MAX_LESSONS - questionsUsed);
  const remainingGenerations = Math.max(0, MAX_GENERATIONS_PER_MESSAGE - generationsUsed);
  const isRepeat = generationsUsed > 0;
  const refreshesLeft = isRepeat ? remainingGenerations : MINI_DRILL_MAX_REFRESHES;

  if (isRepeat) {
    if (generationsUsed >= MAX_GENERATIONS_PER_MESSAGE) {
      return {
        allowed: false,
        reason: `Для этого объяснения уже ${MINI_DRILL_MAX_REFRESHES} обновления — лимит исчерпан.`,
        generationsUsed,
        refreshesLeft: 0,
        questionsUsed,
        questionsLeft,
        isRepeat: true,
      };
    }
    return {
      allowed: true,
      generationsUsed,
      refreshesLeft,
      questionsUsed,
      questionsLeft,
      isRepeat: true,
    };
  }

  if (questionsUsed >= MINI_DRILL_MAX_LESSONS) {
    return {
      allowed: false,
      reason: `Можно пройти не больше ${MINI_DRILL_MAX_LESSONS} мини-тренировок — по разным вопросам в уроке.`,
      generationsUsed: 0,
      refreshesLeft: MINI_DRILL_MAX_REFRESHES,
      questionsUsed,
      questionsLeft: 0,
      isRepeat: false,
    };
  }

  return {
    allowed: true,
    generationsUsed: 0,
    refreshesLeft: MINI_DRILL_MAX_REFRESHES,
    questionsUsed,
    questionsLeft,
    isRepeat: false,
  };
}

export async function loadMiniDrillUsage(userId: string): Promise<MiniDrillUsage> {
  if (!userId) return emptyUsage();
  try {
    const raw = await AsyncStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) return emptyUsage();
    const parsed = JSON.parse(raw) as Partial<MiniDrillUsage>;
    if (!parsed || typeof parsed !== 'object' || !parsed.perMessage) return emptyUsage();
    const perMessage: Record<string, number> = {};
    for (const [id, count] of Object.entries(parsed.perMessage)) {
      if (typeof count === 'number' && count > 0) perMessage[id] = Math.min(count, MAX_GENERATIONS_PER_MESSAGE);
    }
    return { perMessage, priorSets: normalizePriorSets(parsed.priorSets) };
  } catch {
    return emptyUsage();
  }
}

export async function saveMiniDrillUsage(userId: string, usage: MiniDrillUsage): Promise<void> {
  if (!userId) return;
  await AsyncStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(usage));
}

export function recordMiniDrillGeneration(
  usage: MiniDrillUsage,
  messageId: string,
  exerciseCheckTexts: string[] = [],
): MiniDrillUsage {
  const next = usage.perMessage[messageId] ?? 0;
  const trimmedSet = exerciseCheckTexts
    .map((line) => line.trim().slice(0, MAX_AVOID_TEXT_LEN))
    .filter(Boolean);
  const priorForMessage = usage.priorSets[messageId] ?? [];
  const nextPriorForMessage =
    trimmedSet.length > 0
      ? [...priorForMessage, trimmedSet].slice(-MAX_PRIOR_SETS_PER_MESSAGE)
      : priorForMessage;

  return {
    perMessage: {
      ...usage.perMessage,
      [messageId]: Math.min(next + 1, MAX_GENERATIONS_PER_MESSAGE),
    },
    priorSets: {
      ...usage.priorSets,
      ...(nextPriorForMessage.length > 0 ? { [messageId]: nextPriorForMessage } : {}),
    },
  };
}
