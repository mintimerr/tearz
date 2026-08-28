import * as Haptics from 'expo-haptics';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import type { NativeLanguage } from '@/contexts/auth-context';
import { useAuth } from '@/contexts/auth-context';
import {
  COIN_REWARDS,
  TEARZ_UNLOCK_BY_ACTIVITY,
  coinsForActivity,
} from '@/constants/reward-rules';
import { STARTER_TEARZ_ID } from '@/constants/tearz-collection';
import { PLUS_DAY_COIN_COST, PLUS_DAY_MS } from '@/types/lexicon';
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
  coinsOnlyRewardCopy,
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
  coins: number;
  ownedTearzIds: string[];
  /** Локальный Tearz Plus (монеты / день). */
  hasPlusAccess: boolean;
  plusExpiresAt: number | null;
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
  claimStarterPack: () => void;
  grantCoins: (amount: number) => void;
  spendCoinsForPlusDay: () => boolean;
  unlockTearz: (tearzId: string) => boolean;
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
    messageCoinsToday: 0,
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

      return {
        totalXp,
        next,
        reward: { xp: totalXp, title, subtitle, streak: streak.dailyStreak },
      };
    },
    [],
  );

  const ensurePushPermissionOnce = useCallback(async (next: EngagementState): Promise<EngagementState> => {
    if (Platform.OS === 'web' || next.permissionPromptShown) return next;
    if (next.notificationPermission === 'granted') return next;
    if (!next.lastMessageSentAt) return next;

    const result = await requestNotificationPermission();
    return {
      ...next,
      permissionPromptShown: true,
      notificationPermission: result,
    };
  }, []);

  const syncInactivityState = useCallback(
    async (current: EngagementState) => {
      if (current.lastMessageSentAt == null) return current;
      if (daysSince(current.lastMessageSentAt) < 7) return current;
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
      if (current.notificationPermission !== 'granted' || !current.lastMessageSentAt) {
        return current;
      }

      const { nudgeAt, finalAt } = await scheduleReengagementSeries({
        lastMessageSentAt: current.lastMessageSentAt,
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
          ...(params.kind === 'message'
            ? {
                reengagement: {
                  ...current.reengagement,
                  phase: 'active' as const,
                  finalMessageSentAt: null,
                },
              }
            : {}),
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

        /** Монеты по reward-rules + Tearz unlock (один раз). */
        let coinGain = coinsForActivity(params.kind, { drillCorrect: params.drillCorrect });
        if (params.kind === 'message') {
          if (current.messageCoinsToday >= COIN_REWARDS.messageMaxPerDay) {
            coinGain = 0;
          } else {
            current = {
              ...current,
              messageCoinsToday: current.messageCoinsToday + 1,
            };
          }
        }
        if (coinGain > 0) {
          current = { ...current, coins: current.coins + coinGain };
        }
        const tearzGain = TEARZ_UNLOCK_BY_ACTIVITY[params.kind];
        if (tearzGain && !current.ownedTearzIds.includes(tearzGain)) {
          current = { ...current, ownedTearzIds: [...current.ownedTearzIds, tearzGain] };
        }

        if (params.kind === 'message') {
          await cancelReengagementNotifications();
          current = await ensurePushPermissionOnce(current);
        }
        await persist(current);
        setState(current);

        const xp = buildActivityXp(current, streak, params, language);
        if (xp.totalXp > 0) {
          current = xp.next;
        }

        let rewardCoins = coinGain;
        let reward = xp.reward;
        if (completedAllNow) {
          rewardCoins += COIN_REWARDS.dailyGoal;
          current = {
            ...current,
            dailyGoalClaimed: true,
            bonusXp: current.bonusXp + DAILY_GOAL_BONUS_XP,
            coins: current.coins + COIN_REWARDS.dailyGoal,
          };
          reward = {
            ...dailyGoalRewardCopy(language),
            coins: rewardCoins,
            streak: current.dailyStreak,
          };
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (reward) {
          reward = {
            ...reward,
            coins: rewardCoins,
            streak: current.dailyStreak,
          };
        } else if (rewardCoins > 0) {
          reward = coinsOnlyRewardCopy(language, params.kind, rewardCoins, current.dailyStreak);
        }

        if (xp.totalXp > 0 || completedAllNow) {
          await persist(current);
          setState(current);
        }
        if (reward) showXpReward(reward);

        if (params.kind === 'message') {
          await planPushSeries(current, language, {
            messagePreview: params.messagePreview,
            chatName: params.chatName,
            lessonTopic: params.lessonTopic,
          });
        }
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

    if (granted && next.lastMessageSentAt) {
      next = await planPushSeries(next, user?.nativeLanguage ?? 'ru');
      setState(next);
    }

    return granted;
  }, [persist, planPushSeries, user?.nativeLanguage]);

  const claimStarterPack = useCallback(() => {
    if (!user?.id || !isAuthenticated) return;
    const current = stateRef.current;
    if (current.starterPackClaimed) return;

    const owned = current.ownedTearzIds.includes(STARTER_TEARZ_ID)
      ? current.ownedTearzIds
      : [...current.ownedTearzIds, STARTER_TEARZ_ID];
    const starterCoins = COIN_REWARDS.starter;

    const next: EngagementState = {
      ...current,
      starterPackClaimed: true,
      coins: current.coins + starterCoins,
      ownedTearzIds: owned,
    };
    stateRef.current = next;
    setState(next);
    void persist(next);
    // Reward-баннер временно скрыт — стартовый пак начисляем без оверлея
  }, [isAuthenticated, persist, user?.id]);

  const grantCoins = useCallback(
    (amount: number) => {
      if (!user?.id || !isAuthenticated || amount <= 0) return;
      const next: EngagementState = {
        ...stateRef.current,
        coins: stateRef.current.coins + Math.floor(amount),
      };
      stateRef.current = next;
      setState(next);
      void persist(next);
    },
    [isAuthenticated, persist, user?.id],
  );

  const spendCoinsForPlusDay = useCallback((): boolean => {
    if (!user?.id || !isAuthenticated) return false;
    const current = stateRef.current;
    if (current.coins < PLUS_DAY_COIN_COST) return false;
    const now = Date.now();
    const base =
      typeof current.plusExpiresAt === 'number' && current.plusExpiresAt > now
        ? current.plusExpiresAt
        : now;
    const next: EngagementState = {
      ...current,
      coins: current.coins - PLUS_DAY_COIN_COST,
      plusExpiresAt: base + PLUS_DAY_MS,
    };
    stateRef.current = next;
    setState(next);
    void persist(next);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    return true;
  }, [isAuthenticated, persist, user?.id]);

  const unlockTearz = useCallback(
    (tearzId: string): boolean => {
      if (!user?.id || !isAuthenticated || !tearzId) return false;
      const current = stateRef.current;
      if (current.ownedTearzIds.includes(tearzId)) return false;
      const next: EngagementState = {
        ...current,
        ownedTearzIds: [...current.ownedTearzIds, tearzId],
      };
      stateRef.current = next;
      setState(next);
      void persist(next);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    },
    [isAuthenticated, persist, user?.id],
  );

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

        const after = stateRef.current;
        if (
          after.reengagement.phase === 'active' &&
          after.lastMessageSentAt != null &&
          after.notificationPermission === 'granted' &&
          daysSince(after.lastMessageSentAt) < 7
        ) {
          await planPushSeries(after, user?.nativeLanguage ?? 'ru');
        }
      })();
    };

    onForeground();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') onForeground();
    });
    return () => sub.remove();
  }, [hydrated, persist, planPushSeries, syncInactivityState, user?.id, user?.nativeLanguage]);

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
      coins: state.coins,
      ownedTearzIds: state.ownedTearzIds,
      hasPlusAccess: typeof state.plusExpiresAt === 'number' && state.plusExpiresAt > Date.now(),
      plusExpiresAt: state.plusExpiresAt ?? null,
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
      claimStarterPack,
      grantCoins,
      spendCoinsForPlusDay,
      unlockTearz,
    }),
    [
      claimStarterPack,
      dailyDoneCount,
      dailyTasks,
      dismissXpReward,
      grantCoins,
      hydrated,
      recordActivity,
      requestNotifications,
      spendCoinsForPlusDay,
      state.bonusXp,
      state.coins,
      state.dailyStreak,
      state.longestStreak,
      state.ownedTearzIds,
      state.plusExpiresAt,
      state.streakFreezeAvailable,
      streakExtendedToday,
      unlockTearz,
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
