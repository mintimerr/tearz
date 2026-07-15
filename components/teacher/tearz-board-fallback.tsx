import { Image as ExpoImage } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { BoardDirectorCue } from '@/hooks/use-board-director';
import {
  TEARZ_BOARD_ERASE_WEBP,
  boardWriteStrokeSource,
} from './tearz-board-hero-source';
import { TEARZ_BOARD_POSE_ERASE, TEARZ_BOARD_POSE_WRITE_IDLE } from './tearz-board-poses';

const SPRING = { damping: 16, stiffness: 320, mass: 0.72 };

type Props = {
  width: number;
  height: number;
  director: BoardDirectorCue;
};

/** Фоллбэк без Rive (Expo Go) — PNG idle + редкий WebP-оверлей. */
export function TearzBoardFallback({ width, height, director }: Props) {
  const gazeX = useSharedValue(0.32);
  const gazeY = useSharedValue(0.2);
  const tap = useSharedValue(0);
  const breathe = useSharedValue(0);
  const eraseFlash = useSharedValue(0);

  useEffect(() => {
    gazeX.value = withSpring(director.gazeBoard, SPRING);
    gazeY.value = withSpring(director.gazeLine, { ...SPRING, stiffness: 260 });
  }, [director.gazeBoard, director.gazeLine, director.pulse, gazeX, gazeY]);

  useEffect(() => {
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [breathe]);

  useEffect(() => {
    if (director.tapEnergy < 0.5) return;
    tap.value = 1;
    tap.value = withTiming(0, { duration: 110, easing: Easing.out(Easing.cubic) });
  }, [director.pulse, director.tapEnergy, tap]);

  useEffect(() => {
    if (!director.eraseOverlay) return;
    eraseFlash.value = 1;
    eraseFlash.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) });
  }, [director.eraseOverlay, director.pulse, eraseFlash]);

  const motion = useAnimatedStyle(() => ({
    opacity: 1 - eraseFlash.value * 0.08,
    transform: [
      { translateX: interpolate(gazeX.value, [0, 1], [width * 0.05, -width * 0.13]) },
      { translateY: interpolate(gazeY.value, [0, 1], [height * 0.01, -height * 0.04]) },
      { scale: 1 + tap.value * 0.04 },
    ],
  }));

  const strokeSource = boardWriteStrokeSource(director.strokeVariant);

  return (
    <Animated.View pointerEvents="none" style={[{ width, height }, motion]}>
      <ExpoImage
        source={TEARZ_BOARD_POSE_WRITE_IDLE}
        contentFit="contain"
        contentPosition="bottom right"
        cachePolicy="memory-disk"
        style={styles.fill}
      />

      {director.strokeOverlay && strokeSource ? (
        <ExpoImage
          key={`stroke-${director.pulse}-${director.strokeVariant}`}
          source={strokeSource}
          contentFit="contain"
          contentPosition="bottom right"
          autoplay
          transition={0}
          style={[styles.fill, styles.overlay]}
        />
      ) : null}

      {director.eraseOverlay ? (
        <ExpoImage
          key={`erase-${director.pulse}`}
          source={TEARZ_BOARD_ERASE_WEBP ?? TEARZ_BOARD_POSE_ERASE}
          contentFit="contain"
          contentPosition="bottom right"
          autoplay={!!TEARZ_BOARD_ERASE_WEBP}
          style={[styles.fill, styles.overlay]}
        />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject },
});
