import type { BoardScene, BoardGaze } from '@/hooks/use-board-performance';
import type { BoardInputKind } from '@/hooks/use-board-input-sync';

/** Слот WebP из tearz-board-hero-source.ts */
export type BoardWebpSlot = 'hero' | 'write' | 'erase' | null;

export type BoardPoseKey =
  | 'idle'
  | 'invite'
  | 'focus'
  | 'write'
  | 'erase'
  | 'attach'
  | 'ready'
  | 'chat_exit';

export type BoardGesture = 'none' | 'type' | 'delete' | 'nod' | 'lean_in' | 'look_up' | 'wave_off';

/**
 * Полная таблица: UX-сцена → взгляд → поза → жест → тайминг.
 * Режиссёр (useBoardPerformance) выбирает сцену; исполнитель читает этот spec.
 */
export type BoardPerformanceCue = {
  scene: BoardScene;
  /** Что делает пользователь */
  trigger: string;
  gaze: BoardGaze;
  heldPose: BoardPoseKey;
  /** Дискретный жест на событие (буква, delete, открытие +) */
  gesture: BoardGesture;
  gestureMs: number;
  /** Сколько держать «рабочую» позу после события */
  holdMs: number;
  webpSlot: BoardWebpSlot;
  /** Промпт для Kling / 3D-рендера */
  klingPrompt: string;
  /** Куда положить файл после скрипта */
  assetHint: string;
};

/** Поток: покой → тап → зум → письмо → + → отправка → чат */
export const BOARD_PERFORMANCE_CUES: BoardPerformanceCue[] = [
  {
    scene: 'invite',
    trigger: 'Доска в покое, пусто, виден idleTapHint',
    gaze: { boardProgress: 0.28, lineProgress: 0.18 },
    heldPose: 'invite',
    gesture: 'nod',
    gestureMs: 1800,
    holdMs: 0,
    webpSlot: 'hero',
    klingPrompt:
      '3D cyan round mascot Tearz teacher at whiteboard, relaxed idle, subtle breathing, occasional blink, slight head tilt toward board, inviting expression, full body, white background, camera locked, loop-friendly 4s',
    assetHint: 'tearz-board-teacher.webp ← make-board-teacher-webp.sh',
  },
  {
    scene: 'idle',
    trigger: 'Свернули зум, на доске уже есть текст',
    gaze: { boardProgress: 0.34, lineProgress: 0.22 },
    heldPose: 'idle',
    gesture: 'none',
    gestureMs: 0,
    holdMs: 0,
    webpSlot: 'hero',
    klingPrompt:
      'Same Tearz mascot, arms relaxed, glancing at written text on board, proud small smile, minimal motion, loop 3s',
    assetHint: 'можно тот же hero WebP с меньшей амплитудой',
  },
  {
    scene: 'focus',
    trigger: 'Тап по доске → зум, поле пустое, клавиатура открылась',
    gaze: { boardProgress: 0.32, lineProgress: 0.16 },
    heldPose: 'focus',
    gesture: 'lean_in',
    gestureMs: 780,
    holdMs: 0,
    webpSlot: null,
    klingPrompt:
      'Tearz leans toward empty whiteboard, expectant eyes, pencil ready in hand, anticipation, no writing yet, 0.8s one-shot',
    assetHint: 'PNG tearz-teacher-bold-eyes-point.png (временно)',
  },
  {
    scene: 'compose',
    trigger: 'Пользователь печатает букву',
    gaze: { boardProgress: 0, lineProgress: 0 },
    heldPose: 'write',
    gesture: 'type',
    gestureMs: 200,
    holdMs: 900,
    webpSlot: 'write',
    klingPrompt:
      'Tearz rear view, back to camera, orange marker scribbling on whiteboard, arm stroke left-to-right, body bounce, face not visible, white background, 0.25s one-shot',
    assetHint: 'tearz-teacher-write-back-ref.png → tearz-board-write.webp',
  },
  {
    scene: 'compose',
    trigger: 'Пользователь тапает в текст (курсор без новой буквы)',
    gaze: { boardProgress: 0, lineProgress: 0 },
    heldPose: 'write',
    gesture: 'none',
    gestureMs: 0,
    holdMs: 900,
    webpSlot: null,
    klingPrompt: 'Tearz eyes track horizontally along board to new cursor point, head turn only, 0.3s',
    assetHint: 'процедурный gaze в коде (уже есть)',
  },
  {
    scene: 'compose',
    trigger: 'Backspace / стирание',
    gaze: { boardProgress: 0, lineProgress: 0 },
    heldPose: 'erase',
    gesture: 'delete',
    gestureMs: 250,
    holdMs: 850,
    webpSlot: 'erase',
    klingPrompt:
      'Tearz erasing whiteboard with eraser, single wipe left-to-right at deletion point, cartoon snap, 0.25s one-shot',
    assetHint: 'tearz-board-erase.webp ← make-board-activity-webp.sh erase',
  },
  {
    scene: 'attach',
    trigger: 'Нажали «+», открылась галерея вложений',
    gaze: { boardProgress: 0.48, lineProgress: 0.04 },
    heldPose: 'attach',
    gesture: 'look_up',
    gestureMs: 320,
    holdMs: 0,
    webpSlot: null,
    klingPrompt:
      'Tearz looks up from board toward camera/top of frame, curious, one hand still near board, 0.4s',
    assetHint: 'PNG tearz-pose-thinking.png или отдельный WebP',
  },
  {
    scene: 'ready',
    trigger: 'Есть текст, пауза в наборе, кнопка ↑ активна',
    gaze: { boardProgress: 0, lineProgress: 0 },
    heldPose: 'ready',
    gesture: 'none',
    gestureMs: 0,
    holdMs: 0,
    webpSlot: null,
    klingPrompt:
      'Tearz satisfied, small nod, marker lowered slightly, glancing at completed question on board, 0.5s hold pose',
    assetHint: 'PNG tearz-teacher-sassy-point-back.png',
  },
  {
    scene: 'ready',
    trigger: 'Нажали ↑ отправить',
    gaze: { boardProgress: 0.38, lineProgress: 0.24 },
    heldPose: 'ready',
    gesture: 'lean_in',
    gestureMs: 420,
    holdMs: 0,
    webpSlot: null,
    klingPrompt:
      'Tearz quick approving gesture toward board then toward user, “let’s go” energy, 0.4s before camera zoom to chat',
    assetHint: 'опциональный WebP submit (пока процедурный lean)',
  },
  {
    scene: 'chat',
    trigger: 'Камера въехала в доску, открылся чат',
    gaze: { boardProgress: 0.42, lineProgress: 0.26 },
    heldPose: 'chat_exit',
    gesture: 'wave_off',
    gestureMs: 920,
    holdMs: 0,
    webpSlot: null,
    klingPrompt:
      'Tearz steps back from board, fades to side, friendly wave, making room for chat UI, 0.9s one-shot',
    assetHint: 'tearz-board-chat-avatar + decorFade в composer',
  },
];

export function boardCueForScene(scene: BoardScene, kind: BoardInputKind = 'idle'): BoardPerformanceCue {
  if (scene === 'compose' && kind === 'delete') {
    return BOARD_PERFORMANCE_CUES.find((c) => c.scene === 'compose' && c.gesture === 'delete')!;
  }
  if (scene === 'compose' && kind === 'type') {
    return BOARD_PERFORMANCE_CUES.find((c) => c.scene === 'compose' && c.gesture === 'type')!;
  }
  return BOARD_PERFORMANCE_CUES.find((c) => c.scene === scene && c.gesture !== 'type' && c.gesture !== 'delete')!;
}

export const BOARD_HOLD_MS = {
  write: 900,
  erase: 850,
} as const;
