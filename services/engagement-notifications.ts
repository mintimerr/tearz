import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { NativeLanguage } from '@/contexts/auth-context';
import {
  fetchEngagementNotificationCopy,
  type EngagementNotificationKind,
} from '@/services/engagement-notification-ai';
import { MS_24H } from '@/utils/daily-streak';

export const REENGAGEMENT_NUDGE_ID = 'tearz-reengagement-24h';
export const REENGAGEMENT_FINAL_ID = 'tearz-reengagement-final';

const MS_7D = 7 * MS_24H;

let handlerConfigured = false;

export function configureNotificationHandler() {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('tearz-engagement', {
    name: 'Напоминания о практике',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 120, 80, 120],
    lightColor: '#FFFFFF',
  });
}

export async function getNotificationPermissionStatus(): Promise<'undetermined' | 'granted' | 'denied'> {
  if (Platform.OS === 'web') return 'denied';
  configureNotificationHandler();
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return 'granted';
  }
  if (settings.canAskAgain === false) return 'denied';
  if (settings.status === 'denied') return 'denied';
  return 'undetermined';
}

/** Только системный диалог iOS/Android. */
export async function requestNotificationPermission(): Promise<'granted' | 'denied'> {
  if (Platform.OS === 'web') return 'denied';
  configureNotificationHandler();
  await ensureAndroidChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return 'granted';
  const next = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return next.granted ? 'granted' : 'denied';
}

export async function cancelReengagementNotifications() {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(REENGAGEMENT_NUDGE_ID).catch(() => {});
  await Notifications.cancelScheduledNotificationAsync(REENGAGEMENT_FINAL_ID).catch(() => {});
}

function buildDateTrigger(fireAt: number): Notifications.NotificationTriggerInput {
  const delayMs = fireAt - Date.now();
  if (delayMs >= MS_24H - 60_000) {
    return { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(fireAt) };
  }
  return {
    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
    seconds: Math.max(60, Math.ceil(delayMs / 1000)),
  };
}

async function schedulePush(params: {
  identifier: string;
  fireAt: number;
  title: string;
  body: string;
  kind: EngagementNotificationKind;
}): Promise<number | null> {
  if (Platform.OS === 'web') return null;
  const delayMs = params.fireAt - Date.now();
  if (delayMs < 60_000) return null;

  await ensureAndroidChannel();

  await Notifications.scheduleNotificationAsync({
    identifier: params.identifier,
    content: {
      title: params.title,
      body: params.body,
      sound: true,
      ...(Platform.OS === 'android' ? { channelId: 'tearz-engagement' } : {}),
      data: { kind: params.kind },
    },
    trigger: buildDateTrigger(params.fireAt),
  });

  return params.fireAt;
}

export async function scheduleReengagementNudge(params: {
  fireAt: number;
  language: NativeLanguage;
  streakDays: number;
  lastMessagePreview?: string;
  chatName?: string;
  lessonTopic?: string;
}): Promise<number | null> {
  const permission = await getNotificationPermissionStatus();
  if (permission !== 'granted') return null;

  await Notifications.cancelScheduledNotificationAsync(REENGAGEMENT_NUDGE_ID).catch(() => {});

  const copy = await fetchEngagementNotificationCopy({
    kind: 'reengagement',
    language: params.language,
    streakDays: params.streakDays,
    lastMessagePreview: params.lastMessagePreview,
    chatName: params.chatName,
    lessonTopic: params.lessonTopic,
  });

  return schedulePush({
    identifier: REENGAGEMENT_NUDGE_ID,
    fireAt: params.fireAt,
    title: copy.title,
    body: copy.body,
    kind: 'reengagement',
  });
}

export async function scheduleFinalReengagementNotice(params: {
  fireAt: number;
  language: NativeLanguage;
}): Promise<number | null> {
  const permission = await getNotificationPermissionStatus();
  if (permission !== 'granted') return null;

  await Notifications.cancelScheduledNotificationAsync(REENGAGEMENT_FINAL_ID).catch(() => {});

  const copy = await fetchEngagementNotificationCopy({
    kind: 'final',
    language: params.language,
    streakDays: 0,
  });

  return schedulePush({
    identifier: REENGAGEMENT_FINAL_ID,
    fireAt: params.fireAt,
    title: copy.title,
    body: copy.body,
    kind: 'final',
  });
}

/** Push 24ч + финальный push на 7-й день — только через ОС, без in-app UI. */
export async function scheduleReengagementSeries(params: {
  lastActivityAt: number;
  language: NativeLanguage;
  streakDays: number;
  lastMessagePreview?: string;
  chatName?: string;
  lessonTopic?: string;
}): Promise<{ nudgeAt: number | null; finalAt: number | null }> {
  if (Platform.OS === 'web') return { nudgeAt: null, finalAt: null };

  const permission = await getNotificationPermissionStatus();
  if (permission !== 'granted') return { nudgeAt: null, finalAt: null };

  await cancelReengagementNotifications();

  const nudgeAt = await scheduleReengagementNudge({
    fireAt: params.lastActivityAt + MS_24H,
    language: params.language,
    streakDays: params.streakDays,
    lastMessagePreview: params.lastMessagePreview,
    chatName: params.chatName,
    lessonTopic: params.lessonTopic,
  });

  const finalAt = await scheduleFinalReengagementNotice({
    fireAt: params.lastActivityAt + MS_7D,
    language: params.language,
  });

  return { nudgeAt, finalAt };
}
