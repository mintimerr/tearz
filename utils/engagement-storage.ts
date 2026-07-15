import AsyncStorage from '@react-native-async-storage/async-storage';

import type { EngagementState } from '@/types/engagement';
import { DEFAULT_ENGAGEMENT_STATE, EMPTY_DAILY_TASKS } from '@/types/engagement';
import { USER_SUFFIX, userDataKey } from '@/utils/user-data-storage';

export async function loadEngagementState(userId: string): Promise<EngagementState> {
  try {
    const raw = await AsyncStorage.getItem(userDataKey(userId, USER_SUFFIX.engagement));
    if (!raw) return { ...DEFAULT_ENGAGEMENT_STATE };
    const parsed = JSON.parse(raw) as Partial<EngagementState>;
    return {
      ...DEFAULT_ENGAGEMENT_STATE,
      ...parsed,
      bonusXp: typeof parsed.bonusXp === 'number' ? Math.max(0, parsed.bonusXp) : 0,
      claimedStreakMilestones: Array.isArray(parsed.claimedStreakMilestones)
        ? parsed.claimedStreakMilestones.filter((n) => typeof n === 'number')
        : [],
      streakFreezeAvailable: parsed.streakFreezeAvailable !== false,
      dailyTasks: {
        ...EMPTY_DAILY_TASKS,
        ...(parsed.dailyTasks ?? {}),
      },
      reengagement: {
        ...DEFAULT_ENGAGEMENT_STATE.reengagement,
        ...(parsed.reengagement ?? {}),
      },
    };
  } catch {
    return { ...DEFAULT_ENGAGEMENT_STATE };
  }
}

export async function saveEngagementState(userId: string, state: EngagementState): Promise<void> {
  await AsyncStorage.setItem(userDataKey(userId, USER_SUFFIX.engagement), JSON.stringify(state));
}
