import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { APP_THEME } from '@/constants/theme';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const FORGE = require('../../assets/images/tearz-forge.webp');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FINALE = require('../../assets/images/tearz-forge-final.png');

/** Пропорции ассета (scripts/crop-forge-frames.py). */
const ASPECT = 400 / 274;

/** Длительность клипа (assets/video/tearz-forge-source.mp4). */
const FORGE_MS = 5040;

const AnimatedExpoImage = Animated.createAnimatedComponent(ExpoImage);

/** Kling-анимация Tearz: один раз → финальный кадр. */
export function WelcomeLetterForge() {
  const [ready, setReady] = useState(0);
  const fade = useSharedValue(1);

  useEffect(() => {
    if (ready < 2) return;
    const id = setTimeout(() => {
      fade.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
    }, FORGE_MS);
    return () => clearTimeout(id);
  }, [fade, ready]);

  const animStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const onReady = () => setReady((n) => n + 1);

  return (
    <View style={styles.stage} pointerEvents="none">
      <View style={styles.box}>
        <ExpoImage
          source={FINALE}
          onLoad={onReady}
          contentFit="contain"
          transition={0}
          style={styles.layer}
        />
        <AnimatedExpoImage
          source={FORGE}
          onLoad={onReady}
          contentFit="contain"
          transition={0}
          autoplay={ready >= 2}
          style={[styles.layer, animStyle]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
    backgroundColor: APP_THEME.color.bg,
  },
  box: {
    width: '100%',
    maxWidth: 320,
    flexShrink: 1,
    alignSelf: 'center',
    aspectRatio: ASPECT,
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
});
