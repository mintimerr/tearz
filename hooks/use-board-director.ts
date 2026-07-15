import { useEffect, useMemo, useRef, useState } from 'react';

import { TEARZ_BOARD_WRITE_STROKE_COUNT } from '@/components/teacher/tearz-board-hero-source';
import type { BoardPerformance, BoardScene } from '@/hooks/use-board-performance';

/** Режимы режиссёра. */
export type BoardDirectorMode =
  | 'idle'
  | 'focus'
  | 'writing'
  | 'look'
  | 'stroke'
  | 'erase';

/** Дискретный trigger для Rive — один pulse → одно движение. */
export type BoardRiveTrigger = 'stroke' | 'erase' | 'look' | 'focus' | null;

export type BoardDirectorEngine = 'rive' | 'rig' | 'fallback';

export type BoardDirectorCue = {
  engine: BoardDirectorEngine;
  mode: BoardDirectorMode;
  scene: BoardScene;
  focusActive: boolean;
  pulse: number;
  /** Rive: какой trigger вызвать на этом pulse. */
  riveTrigger: BoardRiveTrigger;
  strokeOverlay: boolean;
  strokeVariant: number;
  eraseOverlay: boolean;
  gazeBoard: number;
  gazeLine: number;
  tapEnergy: number;
  cameraKick: boolean;
};

const STROKE_CLIP_GAP_MS = 180;
const STROKE_CLIP_MS = 210;
const ERASE_CLIP_MS = 280;
const TAP_DECAY_MS = 110;

function gazeForPerf(perf: BoardPerformance) {
  if (perf.kind === 'type' || perf.kind === 'delete') {
    return {
      board: perf.actionBoardProgress,
      line: perf.actionLineProgress,
    };
  }
  return {
    board: perf.boardProgress,
    line: perf.lineProgress,
  };
}

type Options = {
  engine?: BoardDirectorEngine;
};

/**
 * Режиссёр Tearz у доски.
 * - `rive` / `rig`: каждый pulse → одно движение (игровой контроль).
 * - `fallback`: WebP-оверлеи с debounce (legacy / Expo Go).
 */
export function useBoardDirector(
  perf: BoardPerformance,
  active: boolean,
  { engine = 'fallback' }: Options = {},
) {
  const lastPulse = useRef(0);
  const lastStrokeClipAt = useRef(0);
  const lastVariant = useRef(0);

  const [riveTrigger, setRiveTrigger] = useState<BoardRiveTrigger>(null);
  const [strokeOverlay, setStrokeOverlay] = useState(false);
  const [strokeVariant, setStrokeVariant] = useState(0);
  const [eraseOverlay, setEraseOverlay] = useState(false);
  const [tapEnergy, setTapEnergy] = useState(0);
  const [cameraKick, setCameraKick] = useState(false);
  const [mode, setMode] = useState<BoardDirectorMode>('idle');

  useEffect(() => {
    if (!active) {
      setRiveTrigger(null);
      setStrokeOverlay(false);
      setEraseOverlay(false);
      setTapEnergy(0);
      setMode('idle');
      return;
    }

    if (perf.pulse === lastPulse.current) return;
    lastPulse.current = perf.pulse;

    setTapEnergy(1);
    setCameraKick(perf.kind === 'type' || perf.kind === 'delete');
    const tapId = setTimeout(() => {
      setTapEnergy(0);
      setCameraKick(false);
    }, TAP_DECAY_MS);

    // —— Rive / Rig: один pulse = одно действие, без debounce ——
    if (engine === 'rive' || engine === 'rig') {
      setStrokeOverlay(false);
      setEraseOverlay(false);

      if (perf.kind === 'type') {
        let variant = Math.floor(Math.random() * Math.max(1, TEARZ_BOARD_WRITE_STROKE_COUNT));
        if (variant === lastVariant.current) {
          variant = (variant + 1) % Math.max(1, TEARZ_BOARD_WRITE_STROKE_COUNT);
        }
        lastVariant.current = variant;
        setStrokeVariant(variant);
        setMode('stroke');
        if (engine === 'rive') setRiveTrigger('stroke');
        const strokeReset = setTimeout(() => setMode('writing'), 230);
        return () => {
          clearTimeout(tapId);
          clearTimeout(strokeReset);
        };
      }

      if (perf.kind === 'delete') {
        setMode('erase');
        if (engine === 'rive') setRiveTrigger('erase');
        const eraseReset = setTimeout(() => setMode('writing'), 280);
        return () => {
          clearTimeout(tapId);
          clearTimeout(eraseReset);
        };
      }

      if (perf.scene === 'focus') {
        setMode('focus');
        if (engine === 'rive') setRiveTrigger('focus');
        return () => clearTimeout(tapId);
      }

      // Не шлём look на каждый idle pulse — только focus / stroke / erase
      setMode(perf.mode === 'writing' || perf.mode === 'erasing' ? 'writing' : 'idle');
      setRiveTrigger(null);
      return () => clearTimeout(tapId);
    }

    // —— Fallback: WebP с debounce ——
    setRiveTrigger(null);

    if (perf.kind === 'type') {
      setMode('stroke');
      setEraseOverlay(false);

      const now = Date.now();
      if (now - lastStrokeClipAt.current >= STROKE_CLIP_GAP_MS) {
        lastStrokeClipAt.current = now;
        let variant = Math.floor(Math.random() * Math.max(1, TEARZ_BOARD_WRITE_STROKE_COUNT));
        if (variant === lastVariant.current) {
          variant = (variant + 1) % Math.max(1, TEARZ_BOARD_WRITE_STROKE_COUNT);
        }
        lastVariant.current = variant;
        setStrokeVariant(variant);
        setStrokeOverlay(true);
        const strokeId = setTimeout(() => {
          setStrokeOverlay(false);
          setMode(perf.mode === 'writing' ? 'writing' : 'idle');
        }, STROKE_CLIP_MS);
        return () => {
          clearTimeout(tapId);
          clearTimeout(strokeId);
        };
      }

      setMode('writing');
      return () => clearTimeout(tapId);
    }

    if (perf.kind === 'delete') {
      setStrokeOverlay(false);
      setMode('erase');
      setEraseOverlay(true);
      const eraseId = setTimeout(() => {
        setEraseOverlay(false);
        setMode(perf.mode === 'erasing' ? 'writing' : 'idle');
      }, ERASE_CLIP_MS);
      return () => {
        clearTimeout(tapId);
        clearTimeout(eraseId);
      };
    }

    if (perf.scene === 'focus') {
      setMode('focus');
    } else if (perf.mode === 'writing') {
      setMode('look');
    } else {
      setMode('idle');
    }

    return () => clearTimeout(tapId);
  }, [
    active,
    engine,
    perf.kind,
    perf.mode,
    perf.pulse,
    perf.scene,
    perf.actionBoardProgress,
    perf.actionLineProgress,
    perf.boardProgress,
    perf.lineProgress,
  ]);

  const gaze = gazeForPerf(perf);

  return useMemo<BoardDirectorCue>(
    () => ({
      engine,
      mode,
      scene: perf.scene,
      focusActive: perf.scene === 'focus',
      pulse: perf.pulse,
      riveTrigger,
      strokeOverlay,
      strokeVariant,
      eraseOverlay,
      gazeBoard: gaze.board,
      gazeLine: gaze.line,
      tapEnergy,
      cameraKick,
    }),
    [
      cameraKick,
      engine,
      eraseOverlay,
      gaze.board,
      gaze.line,
      mode,
      perf.pulse,
      perf.scene,
      riveTrigger,
      strokeOverlay,
      strokeVariant,
      tapEnergy,
    ],
  );
}
