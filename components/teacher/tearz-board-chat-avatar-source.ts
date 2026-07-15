import type { ImageSource } from 'expo-image';

/**
 * Аватар чата — Tearz с обложки (bold-cutout), torso-up:
 * руки сложены, ухмылка, смотрит в камеру.
 *
 * Пересборка из референса обложки — см. scripts/crop-board-chat-avatar.py
 * (fallback-кроп из tearz-emote-displeased, если нужен 1:1 модель без генерации).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const TEARZ_BOARD_CHAT_AVATAR: ImageSource = require('@/assets/images/tearz-board-chat-avatar.png');

export const TEARZ_BOARD_CHAT_AVATAR_SCALE = 1;
export const TEARZ_BOARD_CHAT_AVATAR_OFFSET_Y = 0;
