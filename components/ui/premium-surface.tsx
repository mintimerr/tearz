import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { APP_THEME } from '@/constants/theme';

type PremiumSurfaceVariant = 'glass' | 'card' | 'elevated' | 'accent' | 'grouped';

type Props = {
  children?: ReactNode;
  variant?: PremiumSurfaceVariant;
  style?: StyleProp<ViewStyle>;
};

export function PremiumSurface({ children, variant = 'card', style }: Props) {
  return <View style={[styles.base, styles[variant], style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  glass: {
    backgroundColor: APP_THEME.color.glass,
  },
  card: {
    backgroundColor: APP_THEME.color.elevated,
    borderRadius: APP_THEME.radius.lg,
  },
  elevated: {
    backgroundColor: APP_THEME.color.elevated,
    borderRadius: APP_THEME.radius.lg,
  },
  grouped: {
    backgroundColor: APP_THEME.color.elevated,
    borderRadius: APP_THEME.radius.lg,
  },
  accent: {
    backgroundColor: APP_THEME.color.accentSoft,
    borderRadius: APP_THEME.radius.lg,
  },
});
