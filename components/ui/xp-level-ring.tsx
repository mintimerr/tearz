import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { APP_THEME } from '@/constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  /** Прогресс внутри текущего уровня (0–1). */
  progress: number;
  level: number;
  size?: number;
  stroke?: number;
  levelLabel?: string;
};

/** Кольцо уровня с фирменным градиентом и плавным заполнением. */
export function XpLevelRing({
  progress,
  level,
  size = 92,
  stroke = 7,
  levelLabel = 'LVL',
}: Props) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: clamped,
      duration: 1100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [anim, clamped]);

  const offset = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="xpRingGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={APP_THEME.color.brand} />
            <Stop offset="100%" stopColor={APP_THEME.color.brandBright} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={APP_THEME.color.elevatedSoft}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#xpRingGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={styles.levelNum}>{level}</Text>
        <Text style={styles.levelLabel}>{levelLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelNum: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: APP_THEME.color.text,
  },
  levelLabel: {
    marginTop: -2,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: APP_THEME.color.brandBright,
  },
});
