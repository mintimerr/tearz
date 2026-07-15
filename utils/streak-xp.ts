import type { NativeLanguage } from '@/contexts/auth-context';

/** XP за ежедневный streak: растёт с каждым днём, потолок 150. */
export function dailyStreakXp(streakDay: number): number {
  if (streakDay < 1) return 0;
  return Math.min(150, 20 + (streakDay - 1) * 5);
}

/** Сколько ежедневных заданий в дневной цели. */
export const DAILY_GOAL_TASK_COUNT = 3;

/** Бонус XP за выполнение всех заданий дня. */
export const DAILY_GOAL_BONUS_XP = 40;

export function dailyGoalRewardCopy(lang: NativeLanguage): XpRewardPayload {
  if (lang === 'en') {
    return { xp: DAILY_GOAL_BONUS_XP, title: 'Daily goal complete', subtitle: 'All 3 tasks done today' };
  }
  if (lang === 'zh') {
    return { xp: DAILY_GOAL_BONUS_XP, title: '今日目标达成', subtitle: '完成了今天全部 3 项任务' };
  }
  return { xp: DAILY_GOAL_BONUS_XP, title: 'Цель дня выполнена', subtitle: 'Все 3 задания на сегодня' };
}

export const STREAK_MILESTONES = [3, 7, 30] as const;

export type StreakMilestone = (typeof STREAK_MILESTONES)[number];

export const STREAK_MILESTONE_XP: Record<StreakMilestone, number> = {
  3: 50,
  7: 120,
  30: 400,
};

export function milestoneXpForStreak(streakDay: number): { milestone: StreakMilestone; xp: number } | null {
  for (const m of STREAK_MILESTONES) {
    if (streakDay === m) {
      return { milestone: m, xp: STREAK_MILESTONE_XP[m] };
    }
  }
  return null;
}

export type DrillXpResult = {
  base: number;
  bonus: number;
  total: number;
  isLucky: boolean;
};

/** Базовый XP за drill + случайный бонус (~25%) для «дофаминового» сюрприза. */
export function computeDrillXp(correct: number): DrillXpResult {
  if (correct <= 0) return { base: 0, bonus: 0, total: 0, isLucky: false };
  const base = correct * 10;
  const isLucky = Math.random() < 0.25;
  const bonus = isLucky ? Math.floor(base * (0.45 + Math.random() * 0.55)) : 0;
  return { base, bonus, total: base + bonus, isLucky };
}

export type XpRewardPayload = {
  xp: number;
  title: string;
  subtitle: string;
};

export function streakXpRewardCopy(params: {
  lang: NativeLanguage;
  streak: number;
  extended: boolean;
  isNew: boolean;
  freezeConsumed: boolean;
  dailyXp: number;
  milestoneXp: number;
  milestoneDay?: number;
}): XpRewardPayload {
  const total = params.dailyXp + params.milestoneXp;
  const { lang, streak, extended, isNew, freezeConsumed, milestoneDay, milestoneXp, dailyXp } = params;

  if (lang === 'en') {
    const title = milestoneDay
      ? `${milestoneDay}-day streak!`
      : extended
        ? `🔥 ${streak} days in a row`
        : isNew
          ? 'Streak started'
          : `Day ${streak} done`;
    const parts: string[] = [];
    if (dailyXp > 0) parts.push(`${dailyXp} daily`);
    if (milestoneXp > 0) parts.push(`${milestoneXp} milestone`);
    let subtitle = parts.length ? parts.join(' + ') : 'Bonus XP';
    if (freezeConsumed) subtitle += ' · freeze saved your streak';
    return { xp: total, title, subtitle };
  }

  if (lang === 'zh') {
    const title = milestoneDay
      ? `连续 ${milestoneDay} 天！`
      : extended
        ? `🔥 连续 ${streak} 天`
        : isNew
          ? '开始连续打卡'
          : `第 ${streak} 天完成`;
    const parts: string[] = [];
    if (dailyXp > 0) parts.push(`每日 ${dailyXp}`);
    if (milestoneXp > 0) parts.push(`里程碑 ${milestoneXp}`);
    let subtitle = parts.length ? parts.join(' + ') : '奖励经验';
    if (freezeConsumed) subtitle += ' · 冻结保住了连续';
    return { xp: total, title, subtitle };
  }

  const title = milestoneDay
    ? `${milestoneDay} дней подряд!`
    : extended
      ? `🔥 ${streak} дн. подряд`
      : isNew
        ? 'Серия началась'
        : `День ${streak} в серии`;
  const parts: string[] = [];
  if (dailyXp > 0) parts.push(`${dailyXp} за день`);
  if (milestoneXp > 0) parts.push(`${milestoneXp} бонус`);
  let subtitle = parts.length ? parts.join(' + ') : 'Бонусный опыт';
  if (freezeConsumed) subtitle += ' · заморозка спасла серию';
  return { xp: total, title, subtitle };
}

export function drillXpRewardCopy(
  lang: NativeLanguage,
  result: DrillXpResult,
  correct: number,
): XpRewardPayload {
  if (lang === 'en') {
    return {
      xp: result.total,
      title: correct > 1 ? `${correct} tasks in a row` : 'Drill complete',
      subtitle: result.isLucky ? `Lucky bonus +${result.bonus} XP!` : 'Added to your profile',
    };
  }
  if (lang === 'zh') {
    return {
      xp: result.total,
      title: correct > 1 ? `连对 ${correct} 题` : '练习完成',
      subtitle: result.isLucky ? `幸运加成 +${result.bonus} XP！` : '已计入个人资料',
    };
  }
  return {
    xp: result.total,
    title: correct > 1 ? `Стрик ${correct} задания` : 'Тренировка пройдена',
    subtitle: result.isLucky ? `Счастливый бонус +${result.bonus} XP!` : 'Опыт зачислен в профиль',
  };
}
