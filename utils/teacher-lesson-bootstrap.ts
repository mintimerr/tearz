import type { CompanionMsg } from '@/types/companion-message';

type Bootstrap = { chatId: string; messages: CompanionMsg[] };

let pending: Bootstrap | null = null;

export function setTeacherLessonBootstrap(chatId: string, messages: CompanionMsg[]) {
  pending = { chatId, messages };
}

export function takeTeacherLessonBootstrap(chatId: string): CompanionMsg[] | null {
  if (!pending || pending.chatId !== chatId) return null;
  const messages = pending.messages;
  pending = null;
  return messages;
}
