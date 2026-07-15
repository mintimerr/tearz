import type { ImageSource } from 'expo-image';

import type { BoardScene } from '@/hooks/use-board-performance';
import type { BoardInputKind, BoardInputMode } from '@/hooks/use-board-input-sync';
import type { BoardPoseKey } from './tearz-board-performance-spec';

// eslint-disable-next-line @typescript-eslint/no-require-imports
export const TEARZ_BOARD_POSE_IDLE = require('@/assets/board-concept/tearz-teacher-bold-cutout.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const TEARZ_BOARD_POSE_INVITE = require('@/assets/board-concept/tearz-teacher-cover-eyes-point-board.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const TEARZ_BOARD_POSE_FOCUS = require('@/assets/board-concept/tearz-teacher-bold-eyes-point.png');
// Референс только для Kling — не показывать в приложении.
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const TEARZ_BOARD_KLING_WRITE_REF = require('@/assets/board-concept/tearz-teacher-write-back-ref.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const TEARZ_BOARD_KLING_WRITE_REF_V2 = require('@/assets/board-concept/tearz-teacher-kling-write-ref-v2.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const TEARZ_BOARD_POSE_WRITE_BACK = require('@/assets/board-concept/tearz-teacher-kling-write-ref-v2.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const TEARZ_BOARD_POSE_WRITE_IDLE = require('@/assets/board-concept/tearz-board-write-idle.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const TEARZ_BOARD_POSE_WRITE = require('@/assets/board-concept/tearz-teacher-bold-only.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const TEARZ_BOARD_POSE_ERASE = require('@/assets/board-concept/tearz-teacher-peek-close.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const TEARZ_BOARD_POSE_ATTACH = require('@/assets/mascot-poses/tearz-pose-thinking.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const TEARZ_BOARD_POSE_READY = require('@/assets/board-concept/tearz-teacher-sassy-point-back.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const TEARZ_BOARD_POSE_CHAT_EXIT = require('@/assets/mascot-poses/tearz-pose-listening.png');

const POSE_BY_KEY: Record<BoardPoseKey, ImageSource> = {
  idle: TEARZ_BOARD_POSE_IDLE,
  invite: TEARZ_BOARD_POSE_INVITE,
  focus: TEARZ_BOARD_POSE_FOCUS,
  write: TEARZ_BOARD_POSE_WRITE,
  erase: TEARZ_BOARD_POSE_ERASE,
  attach: TEARZ_BOARD_POSE_ATTACH,
  ready: TEARZ_BOARD_POSE_READY,
  chat_exit: TEARZ_BOARD_POSE_CHAT_EXIT,
};

export function boardPoseForKey(key: BoardPoseKey): ImageSource {
  return POSE_BY_KEY[key];
}

/** Поза по UX-сцене (приоритет над mode). */
export function boardPoseForScene(scene: BoardScene, mode: BoardInputMode): ImageSource {
  if (scene === 'invite') return boardPoseForKey('idle');
  if (scene === 'attach') return boardPoseForKey('attach');
  if (scene === 'ready') return boardPoseForKey('ready');
  if (scene === 'chat') return boardPoseForKey('chat_exit');
  if (scene === 'focus') return boardPoseForKey('idle');
  if (scene === 'compose' && mode === 'erasing') return boardPoseForKey('erase');
  if (scene === 'compose') return TEARZ_BOARD_POSE_WRITE_BACK;
  if (scene === 'idle') return boardPoseForKey('idle');
  return boardPoseForKey('idle');
}

/** @deprecated Используй boardPoseForScene */
export function boardPoseForMode(mode: BoardInputMode): ImageSource {
  if (mode === 'writing') return boardPoseForKey('write');
  if (mode === 'erasing') return boardPoseForKey('erase');
  return boardPoseForKey('idle');
}

/** Короткий flash, пока нет WebP-клипа. */
export function boardPulsePose(kind: BoardInputKind): ImageSource | null {
  if (kind === 'delete') return boardPoseForKey('erase');
  return null;
}
