import AsyncStorage from '@react-native-async-storage/async-storage';

/** Префикс ключей данных, привязанных к `AuthUser.id`. */
const USER_ROOT = '@tearz/u';

export const AUTH_ACCOUNTS_KEY = '@tearz/auth_accounts_v1';

export const USER_SUFFIX = {
  companionChats: 'companion.chats.v1',
  companionThreads: 'companion.threads.v1',
  companionFavs: 'companion.favorites.v1',
  teacherFlag: 'teacher.has_lesson',
  teacherLessons: 'teacher.recent_lessons',
  teacherGoal: 'teacher.goal.v1',
  profileStats: 'profile.lifetime_stats',
  profileAvatar: 'profile.avatar_uri',
  profileLangs: 'profile.activity_langs',
  vocabulary: 'vocabulary.entries.v1',
  vocabularyFolders: 'vocabulary.folders.v1',
  lexiconHarvest: 'lexicon.harvest.v1',
  engagement: 'engagement.v1',
} as const;

/** Старые глобальные ключи (до привязки к аккаунту) — только для одноразовой миграции. */
const LEGACY_KEYS = [
  'tearz.companion.chats.v1',
  'tearz.companion.threads.v1',
  'tearz.companion.favorites.v1',
  '@tearz/teacher_has_lesson',
  '@tearz/teacher_recent_lessons',
  '@tearz/lifetime-study-stats',
  '@tearz/profile-avatar-uri',
  '@tearz/study-langs-activity',
] as const;

export function userDataKey(userId: string, suffix: string) {
  return `${USER_ROOT}/${userId}/${suffix}`;
}

export type StoredAccount = {
  user: {
    id: string;
    email: string;
    displayName: string;
    nativeLanguage: 'ru' | 'zh' | 'en';
    createdAt: number;
  };
  password: string;
};

export type AccountsRegistry = Record<string, StoredAccount>;

export async function loadAccountsRegistry(): Promise<AccountsRegistry> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_ACCOUNTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as AccountsRegistry;
  } catch {
    return {};
  }
}

export async function saveAccountsRegistry(registry: AccountsRegistry) {
  await AsyncStorage.setItem(AUTH_ACCOUNTS_KEY, JSON.stringify(registry));
}

/** Пустое состояние для нового аккаунта — без демо-чатов и уроков. */
export async function initEmptyUserData(userId: string) {
  await AsyncStorage.multiSet([
    [userDataKey(userId, USER_SUFFIX.companionChats), '[]'],
    [userDataKey(userId, USER_SUFFIX.companionThreads), '{}'],
    [userDataKey(userId, USER_SUFFIX.companionFavs), '[]'],
    [userDataKey(userId, USER_SUFFIX.teacherFlag), '0'],
    [userDataKey(userId, USER_SUFFIX.teacherLessons), '[]'],
    [userDataKey(userId, USER_SUFFIX.profileStats), JSON.stringify({ correct: 0, wrong: 0 })],
    [userDataKey(userId, USER_SUFFIX.profileLangs), '[]'],
    [userDataKey(userId, USER_SUFFIX.vocabulary), '[]'],
    [userDataKey(userId, USER_SUFFIX.vocabularyFolders), '[]'],
    [
      userDataKey(userId, USER_SUFFIX.engagement),
      JSON.stringify({
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
        notificationPermission: 'undetermined',
        permissionPromptShown: false,
        permissionFailureModalShown: false,
        reengagement: { phase: 'active', lastNudgeScheduledFor: null, finalMessageSentAt: null },
      }),
    ],
  ]);
  await AsyncStorage.removeItem(userDataKey(userId, USER_SUFFIX.profileAvatar));
}

/** Удаляем глобальные данные, чтобы новый пользователь не видел чужой кэш. */
export async function clearLegacyGlobalData() {
  await AsyncStorage.multiRemove([...LEGACY_KEYS]);
}

/** Одноразово переносит старые глобальные данные в аккаунт (для обновления с прошлых сборок). */
export async function migrateLegacyDataToUser(userId: string) {
  const userChatsKey = userDataKey(userId, USER_SUFFIX.companionChats);
  const existing = await AsyncStorage.getItem(userChatsKey);
  if (existing != null) return;

  const pairs: [string, string][] = [];
  const legacyMap: [string, string][] = [
    ['tearz.companion.chats.v1', USER_SUFFIX.companionChats],
    ['tearz.companion.threads.v1', USER_SUFFIX.companionThreads],
    ['tearz.companion.favorites.v1', USER_SUFFIX.companionFavs],
    ['@tearz/teacher_has_lesson', USER_SUFFIX.teacherFlag],
    ['@tearz/teacher_recent_lessons', USER_SUFFIX.teacherLessons],
    ['@tearz/lifetime-study-stats', USER_SUFFIX.profileStats],
    ['@tearz/profile-avatar-uri', USER_SUFFIX.profileAvatar],
    ['@tearz/study-langs-activity', USER_SUFFIX.profileLangs],
  ];

  for (const [legacy, suffix] of legacyMap) {
    const value = await AsyncStorage.getItem(legacy);
    if (value != null) {
      pairs.push([userDataKey(userId, suffix), value]);
    }
  }

  if (pairs.length > 0) {
    await AsyncStorage.multiSet(pairs);
  }
  await clearLegacyGlobalData();
}
