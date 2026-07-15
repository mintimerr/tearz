import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { APP_THEME } from '@/constants/theme';

type Props = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Цвет мягкого свечения/тени. */
  glow?: string;
  /** Интенсивность тени (0–1). */
  glowStrength?: number;
  radius?: number;
  /** Подсветка верхней кромки (стеклянный «highlight»). */
  topHighlight?: boolean;
  borderColor?: string;
  backgroundColor?: string;
};

/**
 * Премиальная карточка: глубина (тень-свечение) + тонкая верхняя подсветка кромки.
 * Даёт ощущение «материала», а не плоского прямоугольника.
 */
export function GlowCard({
  children,
  style,
  glow = APP_THEME.color.brandGlow,
  glowStrength = 0.5,
  radius = APP_THEME.radius.xl,
  topHighlight = true,
  borderColor = APP_THEME.color.border,
  backgroundColor = APP_THEME.color.elevated,
}: Props) {
  return (
    <View
      style={[
        styles.shell,
        {
          borderRadius: radius,
          backgroundColor,
          borderColor,
          ...Platform.select({
            ios: {
              shadowColor: glow,
              shadowOpacity: glowStrength,
              shadowRadius: 22,
              shadowOffset: { width: 0, height: 10 },
            },
            android: { elevation: Math.round(glowStrength * 14) },
            default: {},
          }),
        },
        style,
      ]}>
      {topHighlight ? <View style={[styles.topEdge, { borderTopLeftRadius: radius, borderTopRightRadius: radius }]} pointerEvents="none" /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  topEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
});
