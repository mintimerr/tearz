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

import type { BoardDirectorCue } from '@/hooks/use-board-director';
import { TEARZ_MARIO } from '@/components/game/tearz-mario-source';

type Props = {
  width: number;
  height: number;
  /** Director оставлен для API performer — не дёргаем позу на pulse. */
  director: BoardDirectorCue;
};

/**
 * Tearz у доски — Mario pixel presence.
 * Реакция на ввод: чернила + haptics, не fake-письмо.
 */
export function TearzBoardRig({ width, height }: Props) {
  const breath = useSharedValue(0);
  const blink = useSharedValue(1);

  useEffect(() => {
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [breath]);

  useEffect(() => {
    const tick = () => {
      blink.value = withSequence(
        withTiming(0.78, { duration: 70 }),
        withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) }),
      );
    };
    const first = setTimeout(tick, 2400);
    const id = setInterval(tick, 5200);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [blink]);

  const bodyStyle = useAnimatedStyle(() => ({
    opacity: blink.value,
    transform: [
      { translateY: interpolate(breath.value, [0, 1], [0, -2.5]) },
      { scale: 1 + breath.value * 0.01 },
    ],
  }));

  return (
    <Animated.View pointerEvents="none" style={[{ width, height }, bodyStyle]}>
      <ExpoImage
        source={TEARZ_MARIO.idle}
        contentFit="contain"
        contentPosition="bottom right"
        cachePolicy="memory-disk"
        priority="high"
        style={styles.fill}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    width: '100%',
    height: '100%',
  },
});
