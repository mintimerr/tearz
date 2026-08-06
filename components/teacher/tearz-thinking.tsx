import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

// Mario-pixel Tearz (thinking / idle).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SRC = require('../../assets/images/tearz-mario/tearz-mario-idle-sprite.png');

type Props = {
  /** Сторона квадрата персонажа в пикселях. */
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * «Думающий Tearz» — Mario pixel sprite.
 */
export function TearzThinking({ size = 160, style }: Props) {
  const bob = useRef(new Animated.Value(0)).current;
  const sway = useRef(new Animated.Value(0)).current;
  const d0 = useRef(new Animated.Value(0.15)).current;
  const d1 = useRef(new Animated.Value(0.15)).current;
  const d2 = useRef(new Animated.Value(0.15)).current;

  useEffect(() => {
    const loops: Animated.CompositeAnimation[] = [];

    const tim = (v: Animated.Value, to: number, dur: number) =>
      Animated.timing(v, { toValue: to, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true });
    const yoyo = (v: Animated.Value, dur: number) =>
      Animated.loop(Animated.sequence([tim(v, 1, dur), tim(v, 0, dur)]));

    const bobL = yoyo(bob, 2200);
    const swayL = yoyo(sway, 3000);
    bobL.start();
    swayL.start();
    loops.push(bobL, swayL);

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

    return () => loops.forEach((l) => l.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const rotate = sway.interpolate({ inputRange: [0, 1], outputRange: ['-2.2deg', '2.2deg'] });

  const u = size / 160; // масштаб точек под размер

  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="none">
      <Animated.Image
        source={SRC}
        resizeMode="contain"
        style={{ width: size, height: size, transform: [{ translateY }, { rotate }] }}
      />
      <Animated.View
        style={[styles.dot, { width: 7 * u, height: 7 * u, borderRadius: 3.5 * u, top: 48 * u, right: 44 * u, opacity: d0 }]}
      />
      <Animated.View
        style={[styles.dot, { width: 9 * u, height: 9 * u, borderRadius: 4.5 * u, top: 34 * u, right: 30 * u, opacity: d1 }]}
      />
      <Animated.View
        style={[styles.dot, { width: 12 * u, height: 12 * u, borderRadius: 6 * u, top: 18 * u, right: 12 * u, opacity: d2 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { position: 'absolute', backgroundColor: '#46C6DC' },
});
