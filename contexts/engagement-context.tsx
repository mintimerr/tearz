import * as Haptics from 'expo-haptics';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import type { NativeLanguage } from '@/contexts/auth-context';
import { useAuth } from '@/contexts/auth-context';
import type { DailyTasks, EngagementState, RecordActivityParams } from '@/types/engagement';
import { DEFAULT_ENGAGEMENT_STATE, EMPTY_DAILY_TASKS } from '@/types/engagement';
import {
  cancelReengagementNotifications,
  configureNotificationHandler,
  getNotificationPermissionStatus,
  requestNotificationPermission,
  scheduleReengagementSeries,
} from '@/services/engagement-notifications';
import {
  applyDailyStreak,
  daysSince,
  isoWeekKey,
  localDateKey,
  MS_24H,
} from '@/utils/daily-streak';
import { loadEngagementState, saveEngagementState } from '@/utils/engagement-storage';
import {
  computeDrillXp,
  dailyGoalRewardCopy,
  dailyStreakXp,
  drillXpRewardCopy,
  milestoneXpForStreak,
  streakXpRewardCopy,
  DAILY_GOAL_BONUS_XP,
  DAILY_GOAL_TASK_COUNT,
  type XpRewardPayload,
} from '@/utils/streak-xp';

type EngagementContextValue = {
  hydrated: boolean;
  dailyStreak: number;
  longestStreak: number;
  bonusXp: number;
  streakFreezeAvailable: boolean;
  streakExtendedToday: boolean;
  xpReward: XpRewardPayload | null;
  dismissXpReward: () => void;
  dailyTasks: DailyTasks;
  dailyDoneCount: number;
  dailyGoalTarget: number;
  dailyGoalComplete: boolean;
  recordActivity: (params: RecordActivityParams) => void;
  requestNotifications: () => Promise<boolean>;
};

const DAILY_TASK_KEYS: (keyof DailyTasks)[] = ['lesson', 'drill', 'vocab'];

function taskKeyForActivity(kind: RecordActivityParams['kind']): keyof DailyTasks {
  if (kind === 'teacher_drill') return 'drill';
  if (kind === 'vocab_session') return 'vocab';
  return 'lesson';
}

function rollDailyTasks(state: EngagementState, now = new Date()): EngagementState {
  const today = localDateKey(now);
  if (state.dailyDate === today) return state;
  return {
    ...state,
    dailyDate: today,
    dailyTasks: { ...EMPTY_DAILY_TASKS },
    dailyGoalClaimed: false,
  };
}

function countDailyTasks(tasks: DailyTasks): number {
  return DAILY_TASK_KEYS.reduce((n, k) => n + (tasks[k] ? 1 : 0), 0);
}

const EngagementContext = createContext<EngagementContextValue | null>(null);

function refreshWeeklyFreeze(state: EngagementState, now = new Date()): EngagementState {
  const week = isoWeekKey(now);
  if (state.streakFreezeWeekKey === week) return state;
  return {
    ...state,
    streakFreezeWeekKey: week,
    streakFreezeAvailable: true,
  };
}

export function EngagementProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<EngagementState>(DEFAULT_ENGAGEMENT_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [streakExtendedToday, setStreakExtendedToday] = useState(false);
  const [xpReward, setXpReward] = useState<XpRewardPayload | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    configureNotificationHandler();
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setState(DEFAULT_ENGAGEMENT_STATE);
      setHydrated(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      const loaded = refreshWeeklyFreeze(await loadEngagementState(user.id));
      const permission = await getNotificationPermissionStatus();
      if (cancelled) return;
      setState({ ...loaded, notificationPermission: permission });
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const persist = useCallback(
    async (next: EngagementState) => {
      if (!user?.id) return;
      await saveEngagementState(user.id, next);
    },
    [user?.id],
  );

  const dismissXpReward = useCallback(() => setXpReward(null), []);

  const showXpReward = useCallback((payload: XpRewardPayload) => {
    setXpReward(payload);
  }, []);

  const buildActivityXp = useCallback(
    (current: EngagementState, streak: ReturnType<typeof applyDailyStreak>, params: RecordActivityParams, lang: NativeLanguage) => {
      const today = localDateKey();
      let dailyXp = 0;
      let milestoneXp = 0;
      let milestoneDay: number | undefined;

      if (current.lastStreakXpDate !== today) {
        dailyXp = dailyStreakXp(streak.dailyStreak);
      }

      const milestone = milestoneXpForStreak(streak.dailyStreak);
      if (milestone && !current.claimedStreakMilestones.includes(milestone.milestone)) {
        milestoneXp = milestone.xp;
        milestoneDay = milestone.milestone;
      }

      let drillXp = 0;
      let drillLucky = false;
      let drillBonus = 0;
      if (params.kind === 'teacher_drill' && (params.drillCorrect ?? 0) > 0) {
        const drill = computeDrillXp(params.drillCorrect!);
        drillXp = drill.total;
        drillLucky = drill.isLucky;
        drillBonus = drill.bonus;
      }

      const totalXp = dailyXp + milestoneXp + drillXp;
      if (totalXp <= 0) return { totalXp: 0, next: current, reward: null as XpRewardPayload | null };

      let title: string;
      let subtitle: string;

      if (params.kind === 'teacher_drill' && drillXp > 0) {
        const drillCopy = drillXpRewardCopy(
          lang,
          { base: drillXp - drillBonus, bonus: drillBonus, total: drillXp, isLucky: drillLucky },
          params.drillCorrect!,
        );
        title = drillCopy.title;
        const parts: string[] = [];
        if (dailyXp > 0) parts.push(lang === 'en' ? `${dailyXp} streak` : lang === 'zh' ? `连续 ${dailyXp}` : `${dailyXp} серия`);
        if (milestoneXp > 0) parts.push(lang === 'en' ? `${milestoneXp} milestone` : lang === 'zh' ? `里程碑 ${milestoneXp}` : `${milestoneXp} бонус`);
        parts.push(`${drillXp} drill`);
        subtitle = parts.join(' + ');
        if (drillLucky) subtitle += lang === 'en' ? ' · lucky!' : lang === 'zh' ? ' · 幸运！' : ' · удача!';
      } else {
        const streakCopy = streakXpRewardCopy({
          lang,
          streak: streak.dailyStreak,
          extended: streak.extended,
          isNew: streak.isNew,
          freezeConsumed: streak.freezeConsumed,
          dailyXp,
          milestoneXp,
          milestoneDay,
        });
        title = streakCopy.title;
        subtitle = streakCopy.subtitle;
      }

      const next: EngagementState = {
        ...current,
        bonusXp: current.bonusXp + totalXp,
        lastStreakXpDate: dailyXp > 0 || milestoneXp > 0 ? today : current.lastStreakXpDate,
        claimedStreakMilestones: milestoneDay
          ? [...current.claimedStreakMilestones, milestoneDay]
          : current.claimedStreakMilestones,
      };

      return { totalXp, next, reward: { xp: totalXp, title, subtitle } };
    },
    [],
  );

  const ensurePushPermissionOnce = useCallback(async (next: EngagementState): Promise<EngagementState> => {
    if (Platform.OS === 'web' || next.permissionPromptShown) return next;
    if (next.notificationPermission === 'granted') return next;
    if (next.dailyStreak < 1) return next;

    const result = await requestNotificationPermission();
    return {
      ...next,
      permissionPromptShown: true,
      notificationPermission: result,
    };
  }, []);

  const syncInactivityState = useCallback(
    async (current: EngagementState) => {
      if (daysSince(current.lastQualifyingActivityAt) < 7) return current;
      if (current.reengagement.phase === 'final_sent' || current.reengagement.phase === 'stopped_inactive') {
        return current;
      }

      await cancelReengagementNotifications();

      const next: EngagementState = {
        ...current,
        reengagement: {
          ...current.reengagement,
          phase: 'final_sent',
          lastNudgeScheduledFor: null,
          finalMessageSentAt: current.reengagement.finalMessageSentAt ?? Date.now(),
        },
      };
      await persist(next);
      setState(next);
      return next;
    },
    [persist],
  );

  const planPushSeries = useCallback(
    async (
      current: EngagementState,
      language: NativeLanguage,
      meta?: { messagePreview?: string; chatName?: string; lessonTopic?: string },
    ) => {
      if (current.reengagement.phase === 'final_sent' || current.reengagement.phase === 'stopped_inactive') {
        return current;
      }
      if (current.notificationPermission !== 'granted' || !current.lastQualifyingActivityAt) {
        return current;
      }

      const { nudgeAt, finalAt } = await scheduleReengagementSeries({
        lastActivityAt: current.lastQualifyingActivityAt,
        language,
        streakDays: current.dailyStreak,
        lastMessagePreview: meta?.messagePreview,
        chatName: meta?.chatName,
        lessonTopic: meta?.lessonTopic,
      });

      if (!nudgeAt && !finalAt) return current;

      const next = {
        ...current,
        reengagement: {
          ...current.reengagement,
          phase: 'active' as const,
          lastNudgeScheduledFor: nudgeAt,
          finalMessageSentAt: null,
        },
      };
      await persist(next);
      setState(next);
      return next;
    },
    [persist],
  );

  const recordActivity = useCallback(
    (params: RecordActivityParams) => {
      if (!user?.id || !isAuthenticated) return;
      const at = params.at ?? Date.now();
      const language = user.nativeLanguage;

      void (async () => {
        let current = refreshWeeklyFreeze({ ...stateRef.current }, new Date(at));
        const streak = applyDailyStreak(current, new Date(at));
        current = {
          ...current,
          dailyStreak: streak.dailyStreak,
          longestStreak: streak.longestStreak,
          lastStreakDate: streak.lastStreakDate,
          streakFreezeAvailable: streak.freezeConsumed ? false : current.streakFreezeAvailable,
          lastQualifyingActivityAt: at,
          lastMessageSentAt: params.kind === 'message' ? at : current.lastMessageSentAt,
          reengagement: {
            ...current.reengagement,
            phase: 'active',
            finalMessageSentAt: null,
          },
        };

        if (streak.extended || streak.isNew) {
          setStreakExtendedToday(true);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (streak.broken) {
          setStreakExtendedToday(false);
        } else {
          setStreakExtendedToday(false);
        }

        current = rollDailyTasks(current, new Date(at));
        const taskKey = taskKeyForActivity(params.kind);
        const completedAllNow =
          !current.dailyGoalClaimed &&
          DAILY_TASK_KEYS.every((k) => (k === taskKey ? true : current.dailyTasks[k]));
        current = { ...current, dailyTasks: { ...current.dailyTasks, [taskKey]: true } };

        await cancelReengagementNotifications();
        current = await ensurePushPermissionOnce(current);
        await persist(current);
        setState(current);

        const xp = buildActivityXp(current, streak, params, language);
        if (xp.totalXp > 0) {
          current = xp.next;
        }

        let reward = xp.reward;
        if (completedAllNow) {
          current = {
            ...current,
            dailyGoalClaimed: true,
            bonusXp: current.bonusXp + DAILY_GOAL_BONUS_XP,
          };
          reward = dailyGoalRewardCopy(language);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        if (xp.totalXp > 0 || completedAllNow) {
          await persist(current);
          setState(current);
          if (reward) showXpReward(reward);
        }

        await planPushSeries(current, language, {
          messagePreview: params.messagePreview,
          chatName: params.chatName,
        });
      })();
    },
    [buildActivityXp, ensurePushPermissionOnce, isAuthenticated, persist, planPushSeries, showXpReward, user?.id, user?.nativeLanguage],
  );

  const requestNotifications = useCallback(async (): Promise<boolean> => {
    const result = await requestNotificationPermission();
    const granted = result === 'granted';
    const perm = granted ? 'granted' : 'denied';
    let next = { ...stateRef.current, notificationPermission: perm as EngagementState['notificationPermission'], permissionPromptShown: true };
    await persist(next);
    setState(next);

    if (granted && next.lastQualifyingActivityAt) {
      next = await planPushSeries(next, user?.nativeLanguage ?? 'ru');
      setState(next);
    }

    return granted;
  }, [persist, planPushSeries, user?.nativeLanguage]);

  useEffect(() => {
    if (!user?.id || !hydrated) return;

    const onForeground = () => {
      const now = Date.now();
      setState((s) => {
        const next = rollDailyTasks(
          refreshWeeklyFreeze({ ...s, lastAppForegroundAt: now }, new Date(now)),
          new Date(now),
        );
        void persist(next);
        return next;
      });

      void (async () => {
        const permission = await getNotificationPermissionStatus();
        let current = refreshWeeklyFreeze(
          { ...stateRef.current, notificationPermission: permission, lastAppForegroundAt: now },
          new Date(now),
        );

        if (permission !== current.notificationPermission) {
          await persist(current);
          setState(current);
        }

        await syncInactivityState(current);
      })();
    };

    onForeground();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') onForeground();
    });
    return () => sub.remove();
  }, [hydrated, persist, syncInactivityState, user?.id]);

  const todayKey = localDateKey();
  const dailyTasks: DailyTasks =
    state.dailyDate === todayKey ? state.dailyTasks : EMPTY_DAILY_TASKS;
  const dailyDoneCount = countDailyTasks(dailyTasks);

  const value = useMemo(
    () => ({
      hydrated,
      dailyStreak: state.dailyStreak,
      longestStreak: state.longestStreak,
      bonusXp: state.bonusXp,
      streakFreezeAvailable: state.streakFreezeAvailable,
      streakExtendedToday,
      xpReward,
      dismissXpReward,
      dailyTasks,
      dailyDoneCount,
      dailyGoalTarget: DAILY_GOAL_TASK_COUNT,
      dailyGoalComplete: dailyDoneCount >= DAILY_GOAL_TASK_COUNT,
      recordActivity,
      requestNotifications,
    }),
    [
      dailyDoneCount,
      dailyTasks,
      dismissXpReward,
      hydrated,
      recordActivity,
      requestNotifications,
      state.bonusXp,
      state.dailyStreak,
      state.longestStreak,
      state.streakFreezeAvailable,
      streakExtendedToday,
      xpReward,
    ],
  );

  return <EngagementContext.Provider value={value}>{children}</EngagementContext.Provider>;
}

export function useEngagement() {
  const ctx = useContext(EngagementContext);
  if (!ctx) throw new Error('useEngagement must be used within EngagementProvider');
  return ctx;
}
