import { TEARZ_INVITE_BASE } from '@/constants/viral';

/** Ссылка на приложение; с ref — приглашение в друзья / по твоему профилю */
export function buildTearzInviteUrl(userId?: string | null): string {
  if (userId) {
    return `${TEARZ_INVITE_BASE}/join?ref=${encodeURIComponent(userId)}`;
  }
  return `${TEARZ_INVITE_BASE}/join`;
}

export function formatInviteUrlDisplay(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

export function buildProgressSharePayload(headline: string, inviteLine: string, inviteUrl: string) {
  return `${headline}\n\n${inviteLine}\n${inviteUrl}`;
}
