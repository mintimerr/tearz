import { useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { APP_THEME } from '@/constants/theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Главная CTA на auth — светлая плашка на тёмном фоне, не «фиолетовая таблетка» */
export function AuthPrimaryButton({ label, onPress, disabled, style }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => {
        if (disabled) return;
        Animated.spring(scale, { toValue: 0.985, useNativeDriver: true, friction: 8 }).start();
      }}
      onPressOut={() => {
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 7 }).start();
      }}
      accessibilityRole="button"
      style={[styles.wrap, style]}>
      <Animated.View
        style={[styles.btn, disabled && styles.btnDisabled, { transform: [{ scale }] }]}>
        <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  btn: {
    minHeight: 54,
    borderRadius: APP_THEME.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F4F5',
    paddingHorizontal: APP_THEME.space.xxl,
    overflow: 'hidden',
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.2,
          shadowRadius: 14,
        }
      : { elevation: 4 }),
  },
  btnDisabled: {
    backgroundColor: APP_THEME.color.surfaceStrong,
    shadowOpacity: 0,
    elevation: 0,
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.32,
    color: '#09090B',
  },
  labelDisabled: {
    color: APP_THEME.color.mutedSoft,
  },
});
