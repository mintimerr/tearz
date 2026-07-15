/** База ссылок приглашения (лендинг / universal link). */
export const TEARZ_INVITE_BASE = 'https://tearz.app';

/** @deprecated используйте buildTearzInviteUrl */
export const TEARZ_INVITE_URL = `${TEARZ_INVITE_BASE}/join`;

export function buildVocabShareUrl(shareId: string): string {
  return `${TEARZ_INVITE_BASE}/vocab/${encodeURIComponent(shareId)}`;
}
