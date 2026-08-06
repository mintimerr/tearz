/**
 * Единые правила экономики Tearz (демо).
 * Все начисления монет / стрика / XP идут через эти константы.
 *
 * ─── МОНЕТЫ ─────────────────────────────────────────────
 * Старт (один раз):              +50
 * Сообщение учителю / урок:      +25  (макс. 3 раза в день)
 * Сессия карточек:               +30
 * Мини-тренировка:               +5 × правильных ответов
 * Цель дня (урок+слова+drill):   +50
 * Asteroids:                     по очкам сессии (grantCoins)
 *
 * ─── СТРИК ──────────────────────────────────────────────
 * +1 день за первую qualifying-активность дня
 *   (message | vocab_session | teacher_drill)
 * Пропуск дня → серия сбрасывается (или срабатывает freeze 1×/нед.)
 *
 * ─── XP ─────────────────────────────────────────────────
 * Ежедневный стрик:  20 + 5×(день−1), потолок 150 (1× в день)
 * Milestone 3 / 7 / 30 дней:  50 / 120 / 400 XP
 * Drill:  10 × правильных (+ lucky ~25%)
 * Цель дня:  +40 XP
 */

import type { QualifyingActivityKind } from '@/types/engagement';
import { STARTER_COINS } from '@/constants/tearz-collection';
import { DAILY_GOAL_BONUS_XP } from '@/utils/streak-xp';

/** Монеты за действия */
export const COIN_REWARDS = {
  starter: STARTER_COINS,
  /** Сообщение / урок из терминала */
  message: 25,
  /** Сколько раз в день можно получить монеты за message */
  messageMaxPerDay: 3,
  /** Законченная сессия карточек */
  vocabSession: 30,
  /** За каждый правильный ответ в drill */
  drillPerCorrect: 5,
  /** Бонус монет за все 3 дневных задания */
  dailyGoal: 50,
} as const;

/** Tearz, которые открываются за активность (один раз) */
export const TEARZ_UNLOCK_BY_ACTIVITY: Partial<Record<QualifyingActivityKind, string>> = {
  message: 'plaza',
  vocab_session: 'bookworm',
  teacher_drill: 'builder',
};

export const DAILY_GOAL_COIN_BONUS = COIN_REWARDS.dailyGoal;
export const DAILY_GOAL_XP_BONUS = DAILY_GOAL_BONUS_XP;

/** Короткие подписи для HUD / оверлея (ru) */
export const REWARD_LABELS_RU = {
  starter: 'Стартовый набор',
  message: 'Урок / ответ учителю',
  vocab_session: 'Сессия карточек',
  teacher_drill: 'Мини-тренировка',
  dailyGoal: 'Цель дня',
  streak: 'Серия дней',
} as const;

export function coinsForActivity(
  kind: QualifyingActivityKind,
  opts?: { drillCorrect?: number },
): number {
  if (kind === 'message') return COIN_REWARDS.message;
  if (kind === 'vocab_session') return COIN_REWARDS.vocabSession;
  if (kind === 'teacher_drill') {
    const n = Math.max(0, opts?.drillCorrect ?? 0);
    return n * COIN_REWARDS.drillPerCorrect;
  }
  return 0;
}
