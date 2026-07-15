import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  children: ReactNode;
  /** Задержка появления (для каскада). */
  delay?: number;
  duration?: number;
  /** Сдвиг по Y на старте (px). */
  offsetY?: number;
  style?: StyleProp<ViewStyle>;
};

/** Плавное появление «fade + rise» — для каскадных входов секций/карточек. */
export function FadeInView({ children, delay = 0, duration = 460, offsetY = 14, style }: Props) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const run = Animated.timing(anim, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [anim, delay, duration]);

  return (
    <Animated.View
      style={[
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [offsetY, 0],
              }),
            },
          ],
        },
        style,
      ]}>
      {children}
    </Animated.View>
  );
}
