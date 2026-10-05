import type { ImageSource } from 'expo-image';

import { TEARZ_MARIO } from '@/components/game/tearz-mario-source';

/** Хедер чата — прежний idle Tearz. */
export const TEARZ_BOARD_CHAT_AVATAR_IDLE: ImageSource = TEARZ_MARIO.idle;

/** В рамке у пузыря — фото-аватар. */
export const TEARZ_BOARD_CHAT_AVATAR_PHOTO: ImageSource = require('../../assets/images/tearz-mario/tearz-mario-avatar-photo-sprite.png');

export type TearzBoardChatAvatarVariant = 'idle' | 'photo';

/** Хедер: весь спрайт с ногами в 36×36. */
export const TEARZ_BOARD_CHAT_AVATAR_IDLE_SCALE = 0.82;
export const TEARZ_BOARD_CHAT_AVATAR_IDLE_OFFSET_Y = 0;

/** Рамка у пузыря: крупнее, прижат к низу. */
export const TEARZ_BOARD_CHAT_AVATAR_PHOTO_SCALE = 1.18;
export const TEARZ_BOARD_CHAT_AVATAR_PHOTO_OFFSET_Y = 0;
export const TEARZ_BOARD_CHAT_AVATAR_PHOTO_OFFSET_BOTTOM = -2;
