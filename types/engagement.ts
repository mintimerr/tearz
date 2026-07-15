export type NotificationPermissionStatus = 'undetermined' | 'granted' | 'denied';

export type ReengagementPhase =
  | 'active'
  | 'stopped_inactive'
  | 'final_sent';

/** Три ежедневных задания: чат-практика, мини-тренировка, слова. */
export type DailyTasks = {
  lesson: boolean;
  drill: boolean;
  vocab: boolean;
};

export const EMPTY_DAILY_TASKS: DailyTasks = { lesson: false, drill: false, vocab: false };

/** XP, заработанный в конкретный день (для недельного графика активности). */
export type DailyXpEntry = {
  /** Локальная дата YYYY-MM-DD. */
  date: string;
  xp: number;
};

/** Сколько дней истории XP храним (хватает на недельный график с запасом). */
export const XP_HISTORY_MAX_DAYS = 21;

export type EngagementState = {
  /** Последняя активность, засчитываемая для streak и nudge (ms epoch). */
  lastQualifyingActivityAt: number | null;
  /** Последнее сообщение пользователя (ms epoch). */
  lastMessageSentAt: number | null;
  lastAppForegroundAt: number | null;
  dailyStreak: number;
  longestStreak: number;
  lastStreakDate: string | null;
  /** Накопленный бонусный XP (streak, drill, milestones). */
  bonusXp: number;
  /** Дата последней выдачи ежедневного XP за streak. */
  lastStreakXpDate: string | null;
  /** Milestone-дни, за которые уже выдали бонус (3, 7, 30). */
  claimedStreakMilestones: number[];
  /** Заморозка streak — 1 раз в неделю, спасает пропущенный день. */
  streakFreezeAvailable: boolean;
  streakFreezeWeekKey: string | null;
  /** Дата (YYYY-MM-DD), к которой относятся дневные задания. */
  dailyDate: string | null;
  /** Выполненные сегодня ежедневные задания. */
  dailyTasks: DailyTasks;
  /** Бонус за выполнение всех заданий дня уже выдан сегодня. */
  dailyGoalClaimed: boolean;
  /** История заработанного XP по дням (для графика активности). */
  xpHistory: DailyXpEntry[];
  notificationPermission: NotificationPermissionStatus;
  permissionPromptShown: boolean;
  permissionFailureModalShown: boolean;
  reengagement: {
    phase: ReengagementPhase;
    lastNudgeScheduledFor: number | null;
    finalMessageSentAt: number | null;
  };
};

export const DEFAULT_ENGAGEMENT_STATE: EngagementState = {
  lastQualifyingActivityAt: null,
  lastMessageSentAt: null,
  lastAppForegroundAt: null,
  dailyStreak: 0,
  longestStreak: 0,
  lastStreakDate: null,
  bonusXp: 0,
  lastStreakXpDate: null,
  claimedStreakMilestones: [],
  streakFreezeAvailable: true,
  streakFreezeWeekKey: null,
  dailyDate: null,
  dailyTasks: { ...EMPTY_DAILY_TASKS },
  dailyGoalClaimed: false,
  xpHistory: [],
  notificationPermission: 'undetermined',
  permissionPromptShown: false,
  permissionFailureModalShown: false,
  reengagement: {
    phase: 'active',
    lastNudgeScheduledFor: null,
    finalMessageSentAt: null,
  },
};

export type QualifyingActivityKind = 'message' | 'vocab_session' | 'teacher_drill';

export type RecordActivityParams = {
  kind: QualifyingActivityKind;
  at?: number;
  messagePreview?: string;
  chatName?: string;
  lessonTopic?: string;
  streakDays?: number;
  /** Для teacher_drill — число правильных ответов (variable XP). */
  drillCorrect?: number;
};
