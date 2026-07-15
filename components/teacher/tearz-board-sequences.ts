import type { ImageSource } from 'expo-image';

// eslint-disable-next-line @typescript-eslint/no-require-imports
export const TEARZ_BOARD_SPRITE_IDLE = require('@/assets/board-sprites/idle.png');

// —— Writing sequences (все кадры WebP → PNG) ——
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WA0 = require('@/assets/board-sprites/sequences/writing-a/f00.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WA1 = require('@/assets/board-sprites/sequences/writing-a/f01.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WA2 = require('@/assets/board-sprites/sequences/writing-a/f02.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WA3 = require('@/assets/board-sprites/sequences/writing-a/f03.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WA4 = require('@/assets/board-sprites/sequences/writing-a/f04.png');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const WB0 = require('@/assets/board-sprites/sequences/writing-b/f00.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WB1 = require('@/assets/board-sprites/sequences/writing-b/f01.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WB2 = require('@/assets/board-sprites/sequences/writing-b/f02.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WB3 = require('@/assets/board-sprites/sequences/writing-b/f03.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WB4 = require('@/assets/board-sprites/sequences/writing-b/f04.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WB5 = require('@/assets/board-sprites/sequences/writing-b/f05.png');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const WC0 = require('@/assets/board-sprites/sequences/writing-c/f00.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WC1 = require('@/assets/board-sprites/sequences/writing-c/f01.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WC2 = require('@/assets/board-sprites/sequences/writing-c/f02.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WC3 = require('@/assets/board-sprites/sequences/writing-c/f03.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WC4 = require('@/assets/board-sprites/sequences/writing-c/f04.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WC5 = require('@/assets/board-sprites/sequences/writing-c/f05.png');

// —— Erasing ——
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ER0 = require('@/assets/board-sprites/sequences/erasing/f00.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ER1 = require('@/assets/board-sprites/sequences/erasing/f01.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ER2 = require('@/assets/board-sprites/sequences/erasing/f02.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ER3 = require('@/assets/board-sprites/sequences/erasing/f03.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ER4 = require('@/assets/board-sprites/sequences/erasing/f04.png');

export const BOARD_WRITING_SEQUENCES: ImageSource[][] = [
  [WA0, WA1, WA2, WA3, WA4],
  [WB0, WB1, WB2, WB3, WB4, WB5],
  [WC0, WC1, WC2, WC3, WC4, WC5],
];

export const BOARD_ERASING_SEQUENCE: ImageSource[] = [ER0, ER1, ER2, ER3, ER4];

export function boardWritingSequence(variant: number): ImageSource[] {
  const n = BOARD_WRITING_SEQUENCES.length;
  const i = ((variant % n) + n) % n;
  return BOARD_WRITING_SEQUENCES[i];
}

/** @deprecated single-frame sprites */
export const TEARZ_BOARD_SPRITE_ERASE = ER2;
export const TEARZ_BOARD_SPRITE_STROKES = BOARD_WRITING_SEQUENCES.map((s) => s[Math.floor(s.length / 2)]!);
export function boardSpriteStrokeSource(variant: number): ImageSource {
  return boardWritingSequence(variant)[Math.floor(boardWritingSequence(variant).length / 2)]!;
}
export const TEARZ_BOARD_RIG_BODY = TEARZ_BOARD_SPRITE_IDLE;
export const TEARZ_BOARD_RIG_ARM_IDLE = TEARZ_BOARD_SPRITE_IDLE;
export const TEARZ_BOARD_RIG_ARM_ERASE = TEARZ_BOARD_SPRITE_ERASE;
export const TEARZ_BOARD_RIG_STROKES = TEARZ_BOARD_SPRITE_STROKES;
export const boardRigStrokeSource = boardSpriteStrokeSource;
