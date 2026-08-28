import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PixelRatio, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/** 4 кадра hero-sheet (прозрачный фон) — без rotate/scale, чтобы пиксели не мылись. */
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

const SOURCE_PX = 1024;
const FRAME_MS = 300;
const BOB_MS = 920;
const SWAY_MS = 1240;

/** Логический размер ≈ 1:1 с исходником на Retina (1024 / pixelRatio). */
export function globeSpinDisplaySize(maxLogical = 360): number {
  const native = Math.round(SOURCE_PX / PixelRatio.get());
  return Math.min(maxLogical, native);
}

type Props = {
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function TearzGlobeSpin({ size, style }: Props) {
  const crispSize = useMemo(() => size ?? globeSpinDisplaySize(), [size]);
  const [frame, setFrame] = useState(0);
  const bob = useRef(new Animated.Value(0)).current;
  const sway = useRef(new Animated.Value(0)).current;

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

    const loops = [makeLoop(bob, BOB_MS), makeLoop(sway, SWAY_MS)];
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [bob, sway]);

  const u = crispSize / 280;
  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -Math.round(6 * u)] });
  const translateX = sway.interpolate({ inputRange: [0, 1], outputRange: [-Math.round(3 * u), Math.round(3 * u)] });

  return (
    <View style={[styles.wrap, { width: crispSize, height: crispSize }, style]}>
      <Animated.View
        style={{
          width: crispSize,
          height: crispSize,
          transform: [{ translateX }, { translateY }],
        }}>
        <Image
          source={FRAMES[frame]}
          style={{ width: crispSize, height: crispSize }}
          contentFit="fill"
          transition={0}
          cachePolicy="memory-disk"
          allowDownscaling={false}
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
