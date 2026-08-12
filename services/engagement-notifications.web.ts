/** Web stub — пуши в браузере не поднимаем. */
export const REENGAGEMENT_NUDGE_ID = 'tearz-reengagement-24h';
export const REENGAGEMENT_FINAL_ID = 'tearz-reengagement-final';

export function configureNotificationHandler() {}

export async function ensureAndroidChannel() {}

export async function getNotificationPermissionStatus() {
  return 'denied' as const;
}

export async function requestNotificationPermission() {
  return false;
}

export async function cancelReengagementNotifications() {}

export async function scheduleReengagementNudge() {
  return null;
}

export async function scheduleFinalReengagementNotice() {
  return null;
}

export async function scheduleReengagementSeries() {
  return { nudgeAt: null, finalAt: null };
}
