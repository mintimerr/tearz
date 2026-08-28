import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/** 4 кадра hero-sheet (прозрачный фон) + мягкое Mario-покачивание. */
const FRAMES = [
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../../assets/images/tearz-mario/tearz-globe-spin-frame-0.png'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../../assets/images/tearz-mario/tearz-globe-spin-frame-1.png'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../../assets/images/tearz-mario/tearz-globe-spin-frame-2.png'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../../assets/images/tearz-mario/tearz-globe-spin-frame-3.png'),
] as const;

const FRAME_MS = 300;
const BOB_MS = 920;
const SWAY_MS = 1240;
const TILT_MS = 1560;

type Props = {
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function TearzGlobeSpin({ size = 280, style }: Props) {
  const [frame, setFrame] = useState(0);
  const bob = useRef(new Animated.Value(0)).current;
  const sway = useRef(new Animated.Value(0)).current;
  const tilt = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let f = 0;
    const id = setInterval(() => {
      f = (f + 1) % FRAMES.length;
      setFrame(f);
    }, FRAME_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const makeLoop = (value: Animated.Value, duration: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 1,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );

    const loops = [makeLoop(bob, BOB_MS), makeLoop(sway, SWAY_MS), makeLoop(tilt, TILT_MS)];
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [bob, sway, tilt]);

  const u = size / 280;
  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -7 * u] });
  const translateX = sway.interpolate({ inputRange: [0, 1], outputRange: [-4 * u, 4 * u] });
  const rotate = tilt.interpolate({ inputRange: [0, 1], outputRange: ['-1.8deg', '1.8deg'] });
  const scale = bob.interpolate({ inputRange: [0, 1], outputRange: [1, 1.018] });

  return (
    <View style={[styles.wrap, { width: size, height: size }, style]}>
      <Animated.View
        style={{
          width: size,
          height: size,
          transform: [{ translateX }, { translateY }, { rotate }, { scale }],
        }}>
        <Image
          source={FRAMES[frame]}
          style={{ width: size, height: size }}
          contentFit="contain"
          transition={0}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
