import type { ImageSource } from 'expo-image';

import { TEARZ_MARIO } from '@/components/game/tearz-mario-source';

/**
 * Аватар чата учителя — Mario / SNES pixel Tearz.
 * Фото/Kling 3D сюда не подключать.
 */
export const TEARZ_BOARD_CHAT_AVATAR: ImageSource = TEARZ_MARIO.idle;

export const TEARZ_BOARD_CHAT_AVATAR_SCALE = 1.08;
export const TEARZ_BOARD_CHAT_AVATAR_OFFSET_Y = 1;
