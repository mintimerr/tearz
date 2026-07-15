import { Image as ExpoImage } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { BoardPerformance } from '@/hooks/use-board-performance';
import { TEARZ_BOARD_ERASE_WEBP, TEARZ_BOARD_WRITE_WEBP } from './tearz-board-hero-source';
import { TEARZ_BOARD_POSE_ERASE, TEARZ_BOARD_POSE_FOCUS } from './tearz-board-poses';

const ENTER_MS = 420;
const ENTER_EASING = Easing.bezier(0.22, 1, 0.36, 1);
const PULSE_MS = 160;

type Props = {
  performance: BoardPerformance;
  width: number;
  height: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Tearz на белой поверхности доски при зуме — WebP из Kling, без PNG с мини-доской.
 */
export function BoardTearzWriteMorph({ performance, width, height, style }: Props) {
  const perf = performance;
  const enter = useSharedValue(0);
  const gazeX = useSharedValue(0.32);
  const pulse = useSharedValue(0);
  const eraseFlash = useSharedValue(0);

  const isErasing = perf.scene === 'compose' && perf.mode === 'erasing';
  const showWriter = perf.scene === 'compose' && (perf.hasDraft || perf.mode === 'writing' || isErasing);

  useEffect(() => {
    enter.value = withTiming(showWriter ? 1 : 0, { duration: ENTER_MS, easing: ENTER_EASING });
  }, [enter, showWriter]);

  useEffect(() => {
    gazeX.value = withSpring(perf.gaze.boardProgress, { damping: 20, stiffness: 260 });
  }, [gazeX, perf.gaze.boardProgress, perf.pulse]);

  useEffect(() => {
    if (perf.scene !== 'compose' || perf.kind !== 'type') return;
    pulse.value = 1;
    pulse.value = withTiming(0, { duration: PULSE_MS, easing: Easing.out(Easing.quad) });
  }, [perf.kind, perf.pulse, perf.scene, pulse]);

  useEffect(() => {
    if (perf.scene !== 'compose' || perf.kind !== 'delete') return;
    eraseFlash.value = 1;
    eraseFlash.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.quad) });
  }, [eraseFlash, perf.kind, perf.pulse, perf.scene]);

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: enter.value * (1 - eraseFlash.value * 0.12),
    transform: [
      { translateX: interpolate(gazeX.value, [0, 1], [width * 0.04, -width * 0.08]) },
      { translateY: interpolate(enter.value, [0, 1], [height * 0.08, 0]) },
      { scale: (0.92 + enter.value * 0.08) * (1 + pulse.value * 0.04) },
    ],
  }));

  const eraseStyle = useAnimatedStyle(() => ({
    opacity: eraseFlash.value,
    transform: [{ scale: 0.94 + eraseFlash.value * 0.06 }],
  }));

  const writeSource = TEARZ_BOARD_WRITE_WEBP ?? TEARZ_BOARD_POSE_FOCUS;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.root, { width, height }, style, wrapStyle]}>
      {TEARZ_BOARD_WRITE_WEBP ? (
        <ExpoImage
          key={`board-write-${perf.pulse}`}
          source={writeSource}
          contentFit="contain"
          contentPosition="bottom right"
          cachePolicy="memory-disk"
          autoplay
          transition={0}
          style={styles.fill}
        />
      ) : (
        <ExpoImage
          source={TEARZ_BOARD_POSE_FOCUS}
          contentFit="contain"
          contentPosition="bottom right"
          cachePolicy="memory-disk"
          style={styles.fill}
        />
      )}

      {TEARZ_BOARD_ERASE_WEBP && isErasing ? (
        <Animated.View style={[styles.eraseLayer, eraseStyle]}>
          <ExpoImage
            key={`board-erase-${perf.pulse}`}
            source={TEARZ_BOARD_ERASE_WEBP}
            contentFit="contain"
            contentPosition="bottom right"
            autoplay
            transition={0}
            style={styles.fill}
          />
        </Animated.View>
      ) : isErasing ? (
        <Animated.View style={[styles.eraseLayer, eraseStyle]}>
          <ExpoImage
            source={TEARZ_BOARD_POSE_ERASE}
            contentFit="contain"
            contentPosition="bottom right"
            style={styles.fill}
          />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'visible',
    backgroundColor: 'transparent',
  },
  fill: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  eraseLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
});
