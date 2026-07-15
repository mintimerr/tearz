import type { ImageSource } from 'expo-image';

/**
 * Анимация Tearz у доски — WebP из Kling (прозрачный фон).
 *
 * Сгенерировать в Kling → импорт:
 *   ./scripts/import-board-kling-pack.sh ~/Downloads/kling-write-a.mp4 ...
 *
 * Промпты: scripts/kling-board-prompts.md
 */
export const TEARZ_BOARD_HERO_WEBP: ImageSource | null = null;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const WRITE_A = require('@/assets/images/tearz-board-write-a.webp');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WRITE_B = require('@/assets/images/tearz-board-write-b.webp');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WRITE_C = require('@/assets/images/tearz-board-write-c.webp');

/** Три варианта удара — director выбирает случайный (не подряд одинаковый). */
export const TEARZ_BOARD_WRITE_STROKES: ImageSource[] = [WRITE_A, WRITE_B, WRITE_C];

/** @deprecated Используй boardWriteStrokeSource */
export const TEARZ_BOARD_WRITE_WEBP = WRITE_A;

export function boardWriteStrokeSource(variant: number): ImageSource | null {
  if (!TEARZ_BOARD_WRITE_STROKES.length) return null;
  const i = ((variant % TEARZ_BOARD_WRITE_STROKES.length) + TEARZ_BOARD_WRITE_STROKES.length) % TEARZ_BOARD_WRITE_STROKES.length;
  return TEARZ_BOARD_WRITE_STROKES[i];
}

export const TEARZ_BOARD_WRITE_STROKE_COUNT = TEARZ_BOARD_WRITE_STROKES.length;

/** Положи erase.mp4 → ./scripts/import-board-kling-pack.sh */
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const TEARZ_BOARD_ERASE_WEBP = require('@/assets/images/tearz-board-erase.webp');

// eslint-disable-next-line @typescript-eslint/no-require-imports
export { TEARZ_BOARD_POSE_IDLE } from './tearz-board-poses';
