import { Image as ExpoImage } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { TEARZ_MARIO } from '@/components/game/tearz-mario-source';
import type { BoardPerformance } from '@/hooks/use-board-performance';
import { useBoardDirector } from '@/hooks/use-board-director';
import { RIVE_BOARD_ACTIVE, TearzBoardRive } from './tearz-board-rive';
import { RIVE_BOARD_USE_NATIVE } from './tearz-board-rive-source';
import { TearzBoardFallback } from './tearz-board-fallback';
import { TearzBoardRig } from './tearz-board-rig';

type Props = {
  width: number;
  height: number;
  performance: BoardPerformance;
  /** board — у рамы доски при зуме; hero — справа в покое. */
  variant?: 'hero' | 'board';
};

function marioPoseForPerf(perf: BoardPerformance) {
  if (perf.kind === 'type') return TEARZ_MARIO.book;
  if (perf.kind === 'delete') return TEARZ_MARIO.build;
  if (perf.scene === 'focus' || perf.mode === 'writing') return TEARZ_MARIO.phone;
  if (perf.scene === 'invite') return TEARZ_MARIO.jump;
  return TEARZ_MARIO.idle;
}

export function TearzBoardPerformer({
  width,
  height,
  performance,
  variant = 'hero',
}: Props) {
  const perf = performance;
  const atBoard =
    variant === 'board' && perf.zoomed && (perf.scene === 'compose' || perf.scene === 'focus');

  const useRive = atBoard && RIVE_BOARD_ACTIVE && RIVE_BOARD_USE_NATIVE;
  const useRig = atBoard && !useRive;

  const director = useBoardDirector(perf, atBoard, {
    engine: useRive ? 'rive' : useRig ? 'rig' : 'fallback',
  });

  if (useRive) {
    return <TearzBoardRive width={width} height={height} director={director} />;
  }

  if (useRig) {
    return <TearzBoardRig width={width} height={height} director={director} />;
  }

  if (atBoard) {
    return <TearzBoardFallback width={width} height={height} director={director} />;
  }

  const source = marioPoseForPerf(perf);

  return (
    <View style={{ width, height }} pointerEvents="none">
      <ExpoImage
        source={source}
        contentFit="contain"
        contentPosition={variant === 'board' ? 'bottom right' : 'bottom center'}
        cachePolicy="memory-disk"
        priority="high"
        transition={0}
        style={styles.fill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    width: '100%',
    height: '100%',
  },
});
