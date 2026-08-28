import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import { GAME_THEME } from '@/constants/game-theme';

type Props = {
  label?: string;
  children?: ReactNode;
  onPress: () => void;
  onPressIn?: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  haptic?: 'light' | 'medium';
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const SIZES = {
  sm: { minH: 40, padH: 14, padV: 8, font: 13, border: 2, lip: 4 },
  md: { minH: 48, padH: 18, padV: 10, font: 15, border: 3, lip: 5 },
  lg: { minH: 56, padH: 22, padV: 12, font: 17, border: 3, lip: 6 },
} as const;

/** 3D gold press-кнопка — общий CTA режимов / paywall / тренировок. */
export function GameGoldButton({
  label,
  children,
  onPress,
  onPressIn,
  disabled,
  size = 'md',
  haptic = 'medium',
  accessibilityLabel,
  style,
}: Props) {
  const s = SIZES[size];

  return (
    <Pressable
      disabled={disabled}
      delayPressIn={0}
      onPress={() => {
        void Haptics.impactAsync(
          haptic === 'light'
            ? Haptics.ImpactFeedbackStyle.Light
            : Haptics.ImpactFeedbackStyle.Medium,
        );
        onPress();
      }}
      onPressIn={onPressIn}
      hitSlop={8}
      style={({ pressed }) => [
        styles.btn,
        {
          minHeight: s.minH,
          paddingHorizontal: s.padH,
          paddingVertical: s.padV,
          borderWidth: s.border,
          borderBottomWidth: pressed ? s.border : s.lip,
        },
        pressed && styles.btnPressed,
        disabled && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}>
      <View style={styles.face}>
        {children ?? (
          <Text style={[styles.label, { fontSize: s.font }]} numberOfLines={1}>
            {label}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: GAME_THEME.color.gold,
    borderColor: GAME_THEME.color.ink,
    borderBottomColor: GAME_THEME.color.goldLip,
    borderRadius: GAME_THEME.radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    transform: [{ translateY: 3 }],
  },
  face: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '900',
    color: GAME_THEME.color.ink,
    letterSpacing: 0.3,
  },
  disabled: {
    opacity: 0.45,
  },
});
