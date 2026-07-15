import { useCallback, useEffect, useRef, useState } from 'react';

import type { BoardDirectorCue } from '@/hooks/use-board-director';
import { boardWritingSequence } from '@/components/teacher/tearz-board-sequences';

/**
 * Зеркало Rive BoardMachine в коде.
 * States: idle | writing | erasing | look | focus
 * Triggers: stroke | erase | look | focus (из director.mode / pulse)
 */
export type BoardMachineState = 'idle' | 'writing' | 'erasing' | 'look' | 'focus';

/** Тайминги как в scripts/board-animation-game-spec.md */
export const BOARD_MACHINE_MS = {
  writing: 200,
  erasing: 260,
  look: 180,
  focus: 300,
} as const;

export type BoardMachinePlayback = {
  state: BoardMachineState;
  /** Индекс кадра в активной sequence (writing/erasing). */
  frame: number;
  /** Активна ли покадровая sequence. */
  playing: boolean;
  variant: number;
  gazeX: number;
  gazeY: number;
};

export function useBoardStateMachine(director: BoardDirectorCue): BoardMachinePlayback {
  const [state, setState] = useState<BoardMachineState>('idle');
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPulse = useRef(-1);

  const stop = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    setPlaying(false);
  }, []);

  const playSequence = useCallback(
    (next: 'writing' | 'erasing', frameCount: number, durationMs: number) => {
      stop();
      setState(next);
      setFrame(0);
      setPlaying(true);
      if (frameCount <= 1) {
        setTimeout(() => {
          setPlaying(false);
          setState('idle');
        }, durationMs);
        return;
      }
      const step = durationMs / (frameCount - 1);
      let i = 0;
      timer.current = setInterval(() => {
        i += 1;
        if (i >= frameCount) {
          stop();
          setState('idle');
          setFrame(0);
          return;
        }
        setFrame(i);
      }, step);
    },
    [stop],
  );

  useEffect(() => {
    if (director.focusActive) {
      stop();
      setState('focus');
      setFrame(0);
      setPlaying(false);
      return;
    }
    if (state === 'focus' && !director.focusActive) {
      setState('idle');
    }
  }, [director.focusActive, state, stop]);

  useEffect(() => {
    if (director.pulse === lastPulse.current) return;
    lastPulse.current = director.pulse;

    if (director.mode === 'stroke') {
      const count = boardWritingSequence(director.strokeVariant).length;
      playSequence('writing', count, BOARD_MACHINE_MS.writing);
      return;
    }

    if (director.mode === 'erase') {
      playSequence('erasing', 5, BOARD_MACHINE_MS.erasing);
      return;
    }

    if (director.mode === 'look') {
      stop();
      setState('look');
      setPlaying(false);
      const t = setTimeout(() => setState('idle'), BOARD_MACHINE_MS.look);
      return () => clearTimeout(t);
    }

    if (director.mode === 'focus') {
      stop();
      setState('focus');
      setPlaying(false);
    }
  }, [
    director.mode,
    director.pulse,
    director.strokeVariant,
    playSequence,
    stop,
  ]);

  useEffect(() => () => stop(), [stop]);

  return {
    state,
    frame,
    playing,
    variant: director.strokeVariant,
    gazeX: director.gazeBoard,
    gazeY: director.gazeLine,
  };
}
