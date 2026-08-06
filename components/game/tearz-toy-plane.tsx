import { useEffect } from 'react';
import {
  Image,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/**
 * Один spritesheet, clip + translateX.
 * Корпус без лопастей; винт только в кадрах листа.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SHEET = require('../../assets/images/tearz-mario/tearz-plane-sheet-clean.png');

const FRAME_W = 420;
const FRAME_H = 212;
const FRAME_COUNT = 12;
const FRAME_MS = 20;

export const TEARZ_PLANE_ASPECT = FRAME_W / FRAME_H;

type Props = {
  width?: number;
  style?: StyleProp<ViewStyle>;
  spinning?: boolean;
};

export function TearzToyPlane({ width = 236, style, spinning = true }: Props) {
  const height = width / TEARZ_PLANE_ASPECT;
  const clock = useSharedValue(0);

  useEffect(() => {
    if (!spinning) {
      clock.value = 0;
      return;
    }
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(FRAME_COUNT, {
        duration: FRAME_COUNT * FRAME_MS,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, [clock, spinning]);

  const sheetStyle = useAnimatedStyle(() => {
    const i = Math.floor(clock.value) % FRAME_COUNT;
    return {
      transform: [{ translateX: -i * width }],
    };
  });

  return (
    <View
      style={[{ width, height, overflow: 'hidden' }, style]}
      pointerEvents="none"
      collapsable={false}>
      <Animated.View style={[{ width: width * FRAME_COUNT, height }, sheetStyle]}>
        <Image
          source={SHEET}
          style={{ width: width * FRAME_COUNT, height }}
          resizeMode="stretch"
          fadeDuration={0}
        />
      </Animated.View>
    </View>
  );
}
