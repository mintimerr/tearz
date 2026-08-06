import { Image as ExpoImage } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { TEARZ_MARIO } from '@/components/game/tearz-mario-source';
import type { BoardDirectorCue } from '@/hooks/use-board-director';

type Props = {
  width: number;
  height: number;
  director: BoardDirectorCue;
};

/** Fallback у доски — Mario pixel Tearz, спокойное дыхание. */
export function TearzBoardFallback({ width, height }: Props) {
  const breathe = useSharedValue(0);

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

  const motion = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(breathe.value, [0, 1], [0, -3]) },
      { scale: 1 + breathe.value * 0.012 },
    ],
  }));

  return (
    <Animated.View pointerEvents="none" style={[{ width, height }, motion]}>
      <ExpoImage
        source={TEARZ_MARIO.idle}
        contentFit="contain"
        contentPosition="bottom right"
        cachePolicy="memory-disk"
        style={styles.fill}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
});
