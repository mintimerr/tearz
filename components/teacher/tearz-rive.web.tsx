import { Image } from 'expo-image';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useEffect, useRef } from 'react';

import { TEARZ_MARIO } from '@/components/game/tearz-mario-source';

type Props = {
  focused?: boolean;
  reactToFocus?: boolean;
  greeting?: string | null;
  style?: StyleProp<ViewStyle>;
};

/** Web: вместо native Rive — спрайт Tearz. */
export function TearzRive({ focused, reactToFocus, style }: Props) {
  const peek = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!reactToFocus) return;
    Animated.timing(peek, {
      toValue: focused ? 1 : 0,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [focused, reactToFocus, peek]);

  const translateX = peek.interpolate({ inputRange: [0, 1], outputRange: [0, 76] });
  const translateY = peek.interpolate({ inputRange: [0, 1], outputRange: [0, 58] });
  const scale = peek.interpolate({ inputRange: [0, 1], outputRange: [1, 0.8] });

  return (
    <View style={[styles.zone, style]} pointerEvents="none">
      <Animated.View style={[styles.riveWrap, { transform: [{ translateX }, { translateY }, { scale }] }]}>
        <Image source={TEARZ_MARIO.idle} style={styles.fill} contentFit="contain" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { overflow: 'hidden' },
  riveWrap: { flex: 1 },
  fill: { width: '100%', height: '100%' },
});
