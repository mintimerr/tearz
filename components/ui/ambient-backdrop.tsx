import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { APP_THEME } from '@/constants/theme';

type Props = {
  /** Общая сила свечения (0–1+). */
  intensity?: number;
};

/**
 * Атмосферный фон: лёгкая глубина у верхнего края, мягкое фирменное сияние за
 * маскотом и плавная виньетка. Многоступенчатые градиенты — без дешёвых пятен.
 */
export function AmbientBackdrop({ intensity = 1 }: Props) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="ambBase" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="34%" stopColor="#F7F8FC" />
            <Stop offset="100%" stopColor={APP_THEME.color.bg} />
          </LinearGradient>

          <RadialGradient id="ambHalo" cx="50%" cy="30%" r="72%">
            <Stop offset="0%" stopColor={APP_THEME.color.brand} stopOpacity={0.14 * intensity} />
            <Stop offset="26%" stopColor={APP_THEME.color.brand} stopOpacity={0.07 * intensity} />
            <Stop offset="52%" stopColor={APP_THEME.color.brand} stopOpacity={0.02 * intensity} />
            <Stop offset="100%" stopColor={APP_THEME.color.brand} stopOpacity={0} />
          </RadialGradient>

          <RadialGradient id="ambCyan" cx="72%" cy="60%" r="58%">
            <Stop offset="0%" stopColor={APP_THEME.color.brandBright} stopOpacity={0.06 * intensity} />
            <Stop offset="55%" stopColor={APP_THEME.color.brandBright} stopOpacity={0.012 * intensity} />
            <Stop offset="100%" stopColor={APP_THEME.color.brandBright} stopOpacity={0} />
          </RadialGradient>

          <RadialGradient id="ambVignette" cx="50%" cy="40%" r="80%">
            <Stop offset="48%" stopColor="#000000" stopOpacity={0} />
            <Stop offset="82%" stopColor="#000000" stopOpacity={0.04} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0.08} />
          </RadialGradient>
        </Defs>

        <Rect x="0" y="0" width="100%" height="100%" fill="url(#ambBase)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#ambHalo)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#ambCyan)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#ambVignette)" />
      </Svg>
    </View>
  );
}
