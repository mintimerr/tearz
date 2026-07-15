import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';

import { boardInkProgress, estimateBoardInkCursor } from '@/utils/board-ink-cursor';

export type BoardInputKind = 'idle' | 'type' | 'delete';
export type BoardInputMode = 'idle' | 'writing' | 'erasing';

export type BoardInputSync = {
  pulse: number;
  kind: BoardInputKind;
  /** Удерживается между нажатиями — «пишет» или «стирает». */
  mode: BoardInputMode;
  cursorIndex: number;
  cursorX: number;
  cursorY: number;
  /** Точка действия на доске — куда пишет / что стирает. */
  actionX: number;
  actionY: number;
  boardProgress: number;
  lineProgress: number;
  actionBoardProgress: number;
  actionLineProgress: number;
};

type Options = {
  writeW: number;
  writeH: number;
  lineHeight: number;
  fontSize?: number;
  active: boolean;
  haptics?: boolean;
};

const INITIAL: BoardInputSync = {
  pulse: 0,
  kind: 'idle',
  mode: 'idle',
  cursorIndex: 0,
  cursorX: 0,
  cursorY: 0,
  actionX: 0,
  actionY: 0,
  boardProgress: 0,
  lineProgress: 0,
  actionBoardProgress: 0,
  actionLineProgress: 0,
};

const WRITE_HOLD_MS = 900;
const ERASE_HOLD_MS = 850;

function inkPoint(text: string, index: number, writeW: number, writeH: number, lineHeight: number, fontSize: number) {
  const { x, y } = estimateBoardInkCursor(text, index, writeW, lineHeight, fontSize);
  return {
    cursorIndex: index,
    cursorX: x,
    cursorY: y,
    actionX: x,
    actionY: y,
    boardProgress: boardInkProgress(x, writeW),
    lineProgress: writeH > 0 ? Math.min(1, Math.max(0, y / writeH)) : 0,
    actionBoardProgress: boardInkProgress(x, writeW),
    actionLineProgress: writeH > 0 ? Math.min(1, Math.max(0, y / writeH)) : 0,
  };
}

function mergeAction(point: ReturnType<typeof inkPoint>, action: ReturnType<typeof inkPoint>) {
  return {
    ...point,
    actionX: action.actionX,
    actionY: action.actionY,
    actionBoardProgress: action.actionBoardProgress,
    actionLineProgress: action.actionLineProgress,
  };
}

function firstDeletedIndex(prev: string, next: string) {
  const max = Math.max(prev.length, next.length);
  for (let i = 0; i < max; i++) {
    if (prev[i] !== next[i]) return i;
  }
  return Math.max(0, prev.length - 1);
}

export function useBoardInputSync({
  writeW,
  writeH,
  lineHeight,
  fontSize = 28,
  active,
  haptics = true,
}: Options) {
  const [sync, setSync] = useState<BoardInputSync>(INITIAL);
  const draftRef = useRef('');
  const modeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleModeIdle = useCallback((delay: number) => {
    if (modeTimerRef.current) clearTimeout(modeTimerRef.current);
    modeTimerRef.current = setTimeout(() => {
      setSync((s) => (s.mode === 'idle' ? s : { ...s, mode: 'idle', kind: 'idle' }));
    }, delay);
  }, []);

  useEffect(
    () => () => {
      if (modeTimerRef.current) clearTimeout(modeTimerRef.current);
    },
    [],
  );

  const applyDraftChange = useCallback(
    (next: string, selectionStart = next.length) => {
      const prev = draftRef.current;
      draftRef.current = next;

      const cursor = Math.min(Math.max(0, selectionStart), next.length);

      if (!active) {
        setSync((s) => ({
          ...s,
          kind: 'idle',
          mode: 'idle',
          ...inkPoint(next, cursor, writeW, writeH, lineHeight, fontSize),
        }));
        return;
      }

      let kind: BoardInputKind = 'idle';
      let mode: BoardInputMode = 'idle';
      let actionIndex = cursor;

      if (next.length > prev.length) {
        kind = 'type';
        mode = 'writing';
        actionIndex = Math.max(0, cursor - 1);
        if (haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        scheduleModeIdle(WRITE_HOLD_MS);
      } else if (next.length < prev.length) {
        kind = 'delete';
        mode = 'erasing';
        actionIndex = firstDeletedIndex(prev, next);
        if (haptics) void Haptics.selectionAsync();
        scheduleModeIdle(ERASE_HOLD_MS);
      } else if (next.length > 0) {
        mode = 'writing';
        scheduleModeIdle(WRITE_HOLD_MS);
      }

      const point = inkPoint(next, cursor, writeW, writeH, lineHeight, fontSize);
      const action = inkPoint(next, actionIndex, writeW, writeH, lineHeight, fontSize);

      setSync((s) => ({
        pulse: kind === 'idle' ? s.pulse : s.pulse + 1,
        kind,
        mode,
        ...mergeAction(point, action),
      }));
    },
    [active, fontSize, haptics, lineHeight, scheduleModeIdle, writeH, writeW],
  );

  /** Тап / перенос курсора без изменения текста — Tearz смотрит на новую точку. */
  const applySelectionChange = useCallback(
    (text: string, selectionStart = text.length) => {
      const cursor = Math.min(Math.max(0, selectionStart), text.length);
      draftRef.current = text;

      const point = inkPoint(text, cursor, writeW, writeH, lineHeight, fontSize);

      if (!active) {
        setSync((s) => ({
          ...s,
          kind: 'idle',
          mode: 'idle',
          ...point,
        }));
        return;
      }

      const mode: BoardInputMode = text.length > 0 ? 'writing' : 'idle';
      if (text.length > 0) scheduleModeIdle(WRITE_HOLD_MS);

      setSync((s) => ({
        pulse: s.pulse + 1,
        kind: 'idle',
        mode,
        ...point,
      }));
    },
    [active, fontSize, lineHeight, scheduleModeIdle, writeH, writeW],
  );

  const resetSync = useCallback(() => {
    draftRef.current = '';
    if (modeTimerRef.current) clearTimeout(modeTimerRef.current);
    setSync(INITIAL);
  }, []);

  return { sync, applyDraftChange, applySelectionChange, resetSync, draftRef };
}
