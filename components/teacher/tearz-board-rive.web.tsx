import type { BoardDirectorCue } from '@/hooks/use-board-director';

import { TearzBoardRig } from './tearz-board-rig';

type Props = {
  width: number;
  height: number;
  director: BoardDirectorCue;
};

export const RIVE_BOARD_ACTIVE = false;

/** Web: sprite-rig вместо native Rive board. */
export function TearzBoardRive({ width, height, director }: Props) {
  return <TearzBoardRig width={width} height={height} director={director} />;
}
