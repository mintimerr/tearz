import type { CompanionChatHistoryItem } from '@/types/companion-chat-api';
import type { CompanionMsg } from '@/types/companion-message';
import { isFileMsg, isImageMsg } from '@/types/companion-message';

function historyTextForMessage(m: CompanionMsg): string {
  if (isImageMsg(m)) {
    const caption = m.text.trim();
    if (caption && caption !== '📷 Фото') {
      return `[Photo] ${caption}`;
    }
    return '[User sent a photo]';
  }
  if (isFileMsg(m)) {
    const caption = m.text.trim();
    const label = m.fileName?.trim() || 'file';
    if (caption && !caption.startsWith('📎')) {
      return `[File: ${label}] ${caption}`;
    }
    return `[User sent a file: ${label}]`;
  }
  return m.text.trim();
}

/** Преобразует локальные пузырьки в историю для API (без последнего сообщения пользователя — оно уходит в `message`). */
export function messagesToCompanionApiHistory(messages: CompanionMsg[]): CompanionChatHistoryItem[] {
  return messages
    .map((m) => {
      const content = historyTextForMessage(m);
      if (!content) return null;
      return {
        role: m.from === 'me' ? ('user' as const) : ('assistant' as const),
        content,
      };
    })
    .filter((item): item is CompanionChatHistoryItem => item !== null);
}
