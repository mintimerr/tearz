import { Image as ExpoImage } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import type { BoardPerformance } from '@/hooks/use-board-performance';
import { useBoardDirector } from '@/hooks/use-board-director';
import { TEARZ_BOARD_HERO_WEBP, TEARZ_BOARD_ERASE_WEBP } from './tearz-board-hero-source';
import { boardPoseForScene, boardPulsePose } from './tearz-board-poses';
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

export function TearzBoardPerformer({
  width,
  height,
  performance,
  variant = 'hero',
}: Props) {
  const perf = performance;
  const atBoard =
    variant === 'board' && perf.zoomed && (perf.scene === 'compose' || perf.scene === 'focus');

  /** Presence mascot (option 3). Native Rive flipbook stays gated off. */
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

  const sceneMode = perf.scene === 'compose' ? perf.mode : 'idle';
  const scenePose = boardPoseForScene(perf.scene, sceneMode);
  const baseSource = TEARZ_BOARD_HERO_WEBP ?? scenePose;

  const eraseWebp =
    perf.scene === 'compose' && perf.kind === 'delete' && TEARZ_BOARD_ERASE_WEBP
      ? TEARZ_BOARD_ERASE_WEBP
      : null;
  const pulsePose = perf.scene === 'compose' ? boardPulsePose(perf.kind) : null;

  return (
    <View style={{ width, height }} pointerEvents="none">
      <ExpoImage
        source={baseSource}
        contentFit="contain"
        contentPosition={variant === 'board' ? 'bottom right' : 'bottom center'}
        cachePolicy="memory-disk"
        priority="high"
        autoplay={!!TEARZ_BOARD_HERO_WEBP && perf.scene === 'invite'}
        style={styles.fill}
      />

      {eraseWebp ? (
        <ExpoImage
          key={`erase-${perf.pulse}`}
          source={eraseWebp}
          contentFit="contain"
          autoplay
          transition={0}
          style={[styles.fill, styles.overlay]}
        />
      ) : pulsePose ? (
        <ExpoImage
          source={pulsePose}
          contentFit="contain"
          cachePolicy="memory-disk"
          style={[styles.fill, styles.overlay]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
});
