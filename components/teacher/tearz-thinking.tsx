import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

/** Позы Tearz в тренировке: думает + учится / пишет. */
export const TEARZ_DRILL_POSES: ImageSourcePropType[] = [
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../../assets/images/tearz-mario/drill-poses/01-thinking.png'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../../assets/images/tearz-mario/drill-poses/02-study-book.png'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../../assets/images/tearz-mario/drill-poses/03-writing-notes.png'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../../assets/images/tearz-mario/drill-poses/04-laptop-study.png'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../../assets/images/tearz-mario/drill-poses/05-flashcards.png'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../../assets/images/tearz-mario/drill-poses/06-chalkboard.png'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../../assets/images/tearz-mario/drill-poses/07-notebook-highlight.png'),
];

export function tearzDrillPoseIndex(sessionKey: string, taskIndex: number): number {
  const n = TEARZ_DRILL_POSES.length;
  if (n <= 0) return 0;
  let h = 2166136261;
  for (let i = 0; i < sessionKey.length; i += 1) {
    h ^= sessionKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h + taskIndex * 3) % n;
}

type Props = {
  /** Сторона квадрата персонажа в пикселях. */
  size?: number;
  style?: StyleProp<ViewStyle>;
  /** Индекс позы (0 = думающий). Если не задан — думающий. */
  poseIndex?: number;
  /** Показывать точки «думает» (только у thinking-позы). */
  thoughtDots?: boolean;
  /** Без покачивания — статичный спрайт (для тренировки). */
  still?: boolean;
};

/**
 * Tearz в тренировке — разные позы (думает / учится / пишет).
 */
export function TearzThinking({
  size = 160,
  style,
  poseIndex = 0,
  thoughtDots,
  still = false,
}: Props) {
  const bob = useRef(new Animated.Value(0)).current;
  const sway = useRef(new Animated.Value(0)).current;
  const d0 = useRef(new Animated.Value(0.15)).current;
  const d1 = useRef(new Animated.Value(0.15)).current;
  const d2 = useRef(new Animated.Value(0.15)).current;

  const safeIndex =
    ((poseIndex % TEARZ_DRILL_POSES.length) + TEARZ_DRILL_POSES.length) % TEARZ_DRILL_POSES.length;
  const source = TEARZ_DRILL_POSES[safeIndex] ?? TEARZ_DRILL_POSES[0];
  const showDots = !still && (thoughtDots ?? safeIndex === 0);

  useEffect(() => {
    if (still) return;

    const loops: Animated.CompositeAnimation[] = [];

    const tim = (v: Animated.Value, to: number, dur: number) =>
      Animated.timing(v, {
        toValue: to,
        duration: dur,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      });
    const yoyo = (v: Animated.Value, dur: number) =>
      Animated.loop(Animated.sequence([tim(v, 1, dur), tim(v, 0, dur)]));

    const bobL = yoyo(bob, 2200);
    const swayL = yoyo(sway, 3000);
    bobL.start();
    swayL.start();
    loops.push(bobL, swayL);

    if (showDots) {
      const dotCycle = Animated.loop(
        Animated.sequence([
          Animated.stagger(260, [tim(d0, 1, 260), tim(d1, 1, 260), tim(d2, 1, 260)]),
          Animated.delay(520),
          Animated.parallel([tim(d0, 0.15, 260), tim(d1, 0.15, 260), tim(d2, 0.15, 260)]),
          Animated.delay(360),
        ]),
      );
      dotCycle.start();
      loops.push(dotCycle);
    }

    return () => loops.forEach((l) => l.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDots, still]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const rotate = sway.interpolate({ inputRange: [0, 1], outputRange: ['-2.2deg', '2.2deg'] });

  const u = size / 160;

  const animatedImageStyle = useMemo(
    () => ({ width: size, height: size, transform: [{ translateY }, { rotate }] }),
    [rotate, size, translateY],
  );

  if (still) {
    return (
      <View style={[{ width: size, height: size }, style]} pointerEvents="none">
        <Image source={source} resizeMode="contain" style={{ width: size, height: size }} />
      </View>
    );
  }

  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="none">
      <Animated.Image source={source} resizeMode="contain" style={animatedImageStyle} />
      {showDots ? (
        <>
          <Animated.View
            style={[
              styles.dot,
              {
                width: 7 * u,
                height: 7 * u,
                borderRadius: 3.5 * u,
                top: 48 * u,
                right: 44 * u,
                opacity: d0,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              {
                width: 9 * u,
                height: 9 * u,
                borderRadius: 4.5 * u,
                top: 34 * u,
                right: 30 * u,
                opacity: d1,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              {
                width: 12 * u,
                height: 12 * u,
                borderRadius: 6 * u,
                top: 18 * u,
                right: 12 * u,
                opacity: d2,
              },
            ]}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { position: 'absolute', backgroundColor: '#46C6DC' },
});
