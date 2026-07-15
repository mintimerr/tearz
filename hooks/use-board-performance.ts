import { useMemo } from 'react';

import { useBoardInputSync, type BoardInputSync } from '@/hooks/use-board-input-sync';

/** Сцена UX — что пользователь делает на экране прямо сейчас. */
export type BoardScene =
  | 'invite'
  | 'idle'
  | 'focus'
  | 'compose'
  | 'attach'
  | 'ready'
  | 'chat';

export type BoardGaze = {
  boardProgress: number;
  lineProgress: number;
};

export type BoardPerformance = BoardInputSync & {
  scene: BoardScene;
  hasDraft: boolean;
  canSend: boolean;
  zoomed: boolean;
  attachOpen: boolean;
  gaze: BoardGaze;
};

type Options = {
  writeW: number;
  writeH: number;
  lineHeight: number;
  fontSize?: number;
  draft: string;
  canSend: boolean;
  zoomed: boolean;
  attachOpen: boolean;
  chatOpen: boolean;
  chatLayer: boolean;
};

function deriveScene({
  zoomed,
  chatOpen,
  chatLayer,
  attachOpen,
  draft,
  canSend,
  sync,
}: {
  zoomed: boolean;
  chatOpen: boolean;
  chatLayer: boolean;
  attachOpen: boolean;
  draft: string;
  canSend: boolean;
  sync: BoardInputSync;
}): BoardScene {
  if (chatOpen || chatLayer) return 'chat';
  if (attachOpen) return 'attach';
  if (!zoomed) return draft.trim().length > 0 ? 'idle' : 'invite';
  if (sync.mode === 'writing' || sync.mode === 'erasing' || draft.trim().length > 0) return 'compose';
  return 'focus';
}

/** Куда Tearz смотрит / тянется в зависимости от сцены и курсора. */
export function resolveBoardGaze(scene: BoardScene, sync: BoardInputSync): BoardGaze {
  switch (scene) {
    case 'invite':
      return { boardProgress: 0.28, lineProgress: 0.18 };
    case 'idle':
      return { boardProgress: 0.34, lineProgress: 0.22 };
    case 'focus':
      return { boardProgress: 0.32, lineProgress: 0.16 };
    case 'compose':
    case 'ready':
      if (sync.kind === 'type' || sync.kind === 'delete') {
        return {
          boardProgress: sync.actionBoardProgress,
          lineProgress: sync.actionLineProgress,
        };
      }
      return { boardProgress: sync.boardProgress, lineProgress: sync.lineProgress };
    case 'attach':
      return { boardProgress: 0.48, lineProgress: 0.04 };
    case 'chat':
      return { boardProgress: 0.42, lineProgress: 0.26 };
    default:
      return { boardProgress: 0.4, lineProgress: 0.2 };
  }
}

export function useBoardPerformance({
  writeW,
  writeH,
  lineHeight,
  fontSize = 28,
  draft,
  canSend,
  zoomed,
  attachOpen,
  chatOpen,
  chatLayer,
}: Options) {
  const inputActive = zoomed && !chatOpen && !chatLayer;

  const { sync, applyDraftChange, applySelectionChange, resetSync, draftRef } = useBoardInputSync({
    writeW,
    writeH,
    lineHeight,
    fontSize,
    active: inputActive,
  });

  const performance = useMemo<BoardPerformance>(() => {
    const scene = deriveScene({
      zoomed,
      chatOpen,
      chatLayer,
      attachOpen,
      draft,
      canSend,
      sync,
    });

    return {
      ...sync,
      scene,
      hasDraft: draft.trim().length > 0,
      canSend,
      zoomed,
      attachOpen,
      gaze: resolveBoardGaze(scene, sync),
    };
  }, [attachOpen, canSend, chatLayer, chatOpen, draft, sync, zoomed]);

  return {
    performance,
    applyDraftChange,
    applySelectionChange,
    resetSync,
    draftRef,
  };
}
