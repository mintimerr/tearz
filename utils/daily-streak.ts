/** Локальная дата YYYY-MM-DD для streak по календарю устройства. */
export function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function yesterdayDateKey(now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  return localDateKey(d);
}

export function dayBeforeYesterdayKey(now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - 2);
  return localDateKey(d);
}

/** ISO-неделя для еженедельной заморозки streak. */
export function isoWeekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export type StreakUpdate = {
  dailyStreak: number;
  longestStreak: number;
  lastStreakDate: string;
  extended: boolean;
  isNew: boolean;
  broken: boolean;
  freezeConsumed: boolean;
};

export function applyDailyStreak(
  current: {
    dailyStreak: number;
    longestStreak: number;
    lastStreakDate: string | null;
    streakFreezeAvailable?: boolean;
  },
  now = new Date(),
): StreakUpdate {
  const today = localDateKey(now);

  if (current.lastStreakDate === today) {
    return {
      dailyStreak: Math.max(current.dailyStreak, 1),
      longestStreak: current.longestStreak,
      lastStreakDate: today,
      extended: false,
      isNew: false,
      broken: false,
      freezeConsumed: false,
    };
  }

  const yesterday = yesterdayDateKey(now);

  if (current.lastStreakDate === yesterday && current.dailyStreak > 0) {
    const dailyStreak = current.dailyStreak + 1;
    return {
      dailyStreak,
      longestStreak: Math.max(current.longestStreak, dailyStreak),
      lastStreakDate: today,
      extended: true,
      isNew: false,
      broken: false,
      freezeConsumed: false,
    };
  }

  const dayBeforeYesterday = dayBeforeYesterdayKey(now);
  if (
    current.lastStreakDate === dayBeforeYesterday &&
    current.dailyStreak > 0 &&
    current.streakFreezeAvailable
  ) {
    const dailyStreak = current.dailyStreak + 1;
    return {
      dailyStreak,
      longestStreak: Math.max(current.longestStreak, dailyStreak),
      lastStreakDate: today,
      extended: true,
      isNew: false,
      broken: false,
      freezeConsumed: true,
    };
  }

  const wasBroken = current.dailyStreak > 0 && current.lastStreakDate != null;
  return {
    dailyStreak: 1,
    longestStreak: Math.max(current.longestStreak, 1),
    lastStreakDate: today,
    extended: false,
    isNew: current.lastStreakDate == null,
    broken: wasBroken,
    freezeConsumed: false,
  };
}

export const MS_24H = 24 * 60 * 60 * 1000;
export const MS_7D = 7 * MS_24H;

export function daysSince(ts: number | null, now = Date.now()): number {
  if (ts == null) return Infinity;
  return (now - ts) / MS_24H;
}
