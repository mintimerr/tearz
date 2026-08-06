import type { ImageSource } from 'expo-image';

/**
 * Мульти-кадровые листы Tearz (SNES / Mario-style).
 * Кадры идут слева направо, равной ширины. Фон — прозрачный.
 */
export const TEARZ_MARIO_SHEETS = {
  run: {
    source: require('../../assets/images/tearz-mario/tearz-mario-run-cycle-v2.png') as ImageSource,
    frames: 4,
    sheetW: 1536,
    sheetH: 1024,
  },
  idle: {
    source: require('../../assets/images/tearz-mario/tearz-mario-idle-cycle-v2.png') as ImageSource,
    frames: 3,
    sheetW: 1536,
    sheetH: 1024,
  },
  /** Профиль вправо: задумчивая ходьба, книга в руках */
  bookWalk: {
    source: require('../../assets/images/tearz-mario/tearz-mario-book-profile-walk-v4.png') as ImageSource,
    frames: 4,
    sheetW: 1696,
    sheetH: 424,
  },
} as const;

export type TearzMarioSheetId = keyof typeof TEARZ_MARIO_SHEETS;

/** Одиночные позы (без цикла) — jump / fly / props. */
export { TEARZ_MARIO, isHubNightNow, type TearzMarioPose } from '@/components/game/tearz-mario-source';
