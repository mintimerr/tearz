import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import type { BoardInputKind } from '@/hooks/use-board-input-sync';

const MARKER = '#152238';

type Props = {
  pulse: number;
  kind: BoardInputKind;
  x: number;
  y: number;
};

function useDotStyle(sv: SharedValue<number>, ox: number, oy: number) {
  return useAnimatedStyle(() => ({
    opacity: sv.value * 0.85,
    transform: [
      { translateX: ox * sv.value },
      { translateY: oy * sv.value },
      { scale: 0.35 + sv.value * 1.15 },
    ],
  }));
}

/** Сок маркера у курсора — главная реакция на ввод (вместо fake-анимации Tearz). */
export function BoardInkJuice({ pulse, kind, x, y }: Props) {
  const burst = useSharedValue(0);
  const dotA = useSharedValue(0);
  const dotB = useSharedValue(0);
  const dotC = useSharedValue(0);
  const dotD = useSharedValue(0);

  useEffect(() => {
    if (pulse <= 0) return;

    if (kind === 'type') {
      burst.value = withSequence(
        withTiming(1, { duration: 50, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 220, easing: Easing.in(Easing.quad) }),
      );
      dotA.value = withSequence(withTiming(1, { duration: 60 }), withTiming(0, { duration: 240 }));
      dotB.value = withDelay(
        16,
        withSequence(withTiming(1, { duration: 70 }), withTiming(0, { duration: 220 })),
      );
      dotC.value = withDelay(
        28,
        withSequence(withTiming(1, { duration: 80 }), withTiming(0, { duration: 200 })),
      );
      dotD.value = withDelay(
        40,
        withSequence(withTiming(1, { duration: 70 }), withTiming(0, { duration: 210 })),
      );
      return;
    }

    if (kind === 'delete') {
      burst.value = withSequence(withTiming(0.85, { duration: 40 }), withTiming(0, { duration: 180 }));
      dotA.value = withSequence(withTiming(1, { duration: 50 }), withTiming(0, { duration: 180 }));
      dotB.value = withDelay(
        12,
        withSequence(withTiming(1, { duration: 55 }), withTiming(0, { duration: 170 })),
      );
    }
  }, [burst, dotA, dotB, dotC, dotD, kind, pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: burst.value * 0.65,
    transform: [{ scale: 0.3 + burst.value * 1.35 }],
  }));

  const dashStyle = useAnimatedStyle(() => ({
    opacity: burst.value * 0.9,
    transform: [
      { scaleX: 0.4 + burst.value * 1.6 },
      { scaleY: 0.5 + burst.value * 0.5 },
    ],
  }));

  const styleA = useDotStyle(dotA, -12, -7);
  const styleB = useDotStyle(dotB, 10, -9);
  const styleC = useDotStyle(dotC, 5, 8);
  const styleD = useDotStyle(dotD, -6, 5);

  return (
    <View pointerEvents="none" style={[styles.root, { left: x - 14, top: y + 4 }]}>
      <Animated.View style={[styles.ring, ringStyle]} />
      <Animated.View style={[styles.dash, dashStyle]} />
      <Animated.View style={[styles.dot, styleA]} />
      <Animated.View style={[styles.dot, styles.dotSm, styleB]} />
      <Animated.View style={[styles.dot, styles.dotSm, styleC]} />
      <Animated.View style={[styles.dot, styles.dotTiny, styleD]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    width: 36,
    height: 36,
    zIndex: 15,
  },
  ring: {
    position: 'absolute',
    left: 6,
    top: 6,
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: MARKER,
    backgroundColor: 'rgba(21, 34, 56, 0.08)',
  },
  dash: {
    position: 'absolute',
    left: 8,
    top: 15,
    width: 18,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: MARKER,
  },
  dot: {
    position: 'absolute',
    left: 14,
    top: 14,
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: MARKER,
    opacity: 0.4,
  },
  dotSm: {
    width: 3.5,
    height: 3.5,
  },
  dotTiny: {
    width: 2.5,
    height: 2.5,
  },
});
