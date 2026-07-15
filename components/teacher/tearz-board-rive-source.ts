/**
 * Rive Tearz у доски — BoardMachine из RiveMCP (flipbook Idle/Writing/Erasing).
 * Triggers: stroke, erase, look, focus, idle.
 * Работает только в dev-build (не Expo Go).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const RIVE_BOARD_MODULE = require('../../assets/rive/tearz-board.riv');

export const RIVE_BOARD_URL: string | null = null;

/** false = кастомный BoardMachine готов. */
export const RIVE_BOARD_LEGACY_BOOTSTRAP = false;

/**
 * Native Rive OFF: product path = calm presence mascot + ink/haptics.
 * `.riv` stays in assets for a future animator Tearz — not for fake writing.
 */
export const RIVE_BOARD_USE_NATIVE = false;

export const RIVE_BOARD_ARTBOARD = 'TearzBoard';

export const RIVE_BOARD_STATE_MACHINE = 'BoardMachine';

export const RIVE_BOARD_TRIGGER = {
  stroke: 'stroke',
  erase: 'erase',
  look: 'look',
  focus: 'focus',
  idle: 'idle',
} as const;

export const RIVE_BOARD_INPUT = {
  gazeX: 'gazeX',
  gazeY: 'gazeY',
} as const;
