import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const WORDMARK = require('../../assets/images/tearz-mario/tearz-wordmark.png');

/** Wordmark хаба: пиксельный title-screen логотип tearz. */
export function HubTearzWordmark() {
  const bob = useSharedValue(0);

  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [bob]);

  const motion = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value * -3 }],
  }));

  return (
    <Animated.View
      style={[styles.wrap, motion]}
      accessibilityRole="header"
      accessibilityLabel="tearz">
      <Image source={WORDMARK} style={styles.logo} contentFit="contain" transition={0} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 280,
    marginBottom: 4,
  },
  logo: {
    width: '100%',
    height: 72,
  },
});
