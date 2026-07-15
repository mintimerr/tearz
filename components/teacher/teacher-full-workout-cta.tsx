import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { APP_THEME } from '@/constants/theme';
import { FULL_WORKOUT_TASK_COUNT } from '@/constants/teacher-drill';

const PLUS = {
  core: '#0A84FF',
  bright: '#64D2FF',
  muted: 'rgba(100, 210, 255, 0.95)',
  soft: 'rgba(10, 132, 255, 0.12)',
  border: 'rgba(100, 210, 255, 0.28)',
} as const;

type Props = {
  disabled?: boolean;
  onPress: () => void;
};

export function TeacherFullWorkoutCta({ disabled, onPress }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    if (disabled) return;
    Animated.spring(scale, {
      toValue: 0.965,
      friction: 8,
      tension: 340,
      useNativeDriver: true,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 7,
      tension: 260,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Plus тренировка, ${FULL_WORKOUT_TASK_COUNT} заданий, доступно с подпиской`}>
      <Animated.View
        style={[styles.shell, disabled && styles.shellDisabled, { transform: [{ scale }] }]}>
        <View style={styles.iconWrap}>
          <Ionicons name="diamond" size={10} color={PLUS.core} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.label}>Plus</Text>
          <Text style={styles.count}>{FULL_WORKOUT_TASK_COUNT} заданий</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: APP_THEME.radius.pill,
    backgroundColor: APP_THEME.color.bgSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PLUS.border,
  },
  shellDisabled: {
    opacity: 0.42,
  },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PLUS.soft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PLUS.border,
  },
  copy: {
    gap: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.45,
    color: PLUS.muted,
  },
  count: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.1,
    color: APP_THEME.color.mutedSoft,
  },
});
