import type { CompanionChatApiLanguage } from '@/types/companion-chat-api';

/** Active L2 for the current lesson/drill — used by long-press translate. */
let activeStudyLanguage: CompanionChatApiLanguage | null = null;

export function setActiveStudyLanguage(lang: CompanionChatApiLanguage | null) {
  activeStudyLanguage = lang;
}

export function getActiveStudyLanguage(): CompanionChatApiLanguage | null {
  return activeStudyLanguage;
}
