import { useRef, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  type GestureResponderEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { APP_THEME } from '@/constants/theme';

type PremiumButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type PremiumButtonSize = 'sm' | 'md' | 'lg' | 'icon';

type Props = {
  children?: ReactNode;
  label?: string;
  variant?: PremiumButtonVariant;
  size?: PremiumButtonSize;
  disabled?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
};

export function PremiumButton({
  children,
  label,
  variant = 'secondary',
  size = 'md',
  disabled,
  onPress,
  style,
  textStyle,
  accessibilityLabel,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    if (disabled) return;
    Animated.spring(scale, {
      toValue: APP_THEME.motion.pressScaleDeep,
      friction: 8,
      tension: 320,
      useNativeDriver: true,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 7,
      tension: 240,
      useNativeDriver: true,
    }).start();
  };

  const flat = StyleSheet.flatten(style) as ViewStyle | undefined;
  const stretch =
    flat?.width === '100%' || flat?.alignSelf === 'stretch' || (flat as { flex?: number })?.flex === 1;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[stretch && styles.pressableStretch, style]}>
      <Animated.View
        style={[
          styles.base,
          styles[variant],
          styles[size],
          stretch && styles.stretch,
          disabled && styles.disabled,
          { transform: [{ scale }] },
        ]}>
        {children ?? (
          <Text style={[styles.label, variant === 'primary' && styles.labelPrimary, textStyle]}>{label}</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressableStretch: {
    alignSelf: 'stretch',
  },
  stretch: {
    width: '100%',
  },
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  sm: {
    minHeight: 34,
    paddingHorizontal: APP_THEME.space.md,
    borderRadius: APP_THEME.radius.pill,
  },
  md: {
    minHeight: 44,
    paddingHorizontal: APP_THEME.space.lg,
    borderRadius: APP_THEME.radius.pill,
  },
  lg: {
    minHeight: 50,
    paddingHorizontal: APP_THEME.space.xl,
    borderRadius: APP_THEME.radius.pill,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  primary: {
    backgroundColor: APP_THEME.color.text,
  },
  secondary: {
    backgroundColor: APP_THEME.color.elevated,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: APP_THEME.color.dangerSoft,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    ...APP_THEME.type.caption,
    fontWeight: '600',
    color: APP_THEME.color.textSoft,
  },
  labelPrimary: {
    color: APP_THEME.color.bg,
    fontWeight: '600',
  },
});
