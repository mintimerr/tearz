import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { GAME_THEME } from '@/constants/game-theme';
import { FULL_WORKOUT_TASK_COUNT } from '@/constants/teacher-drill';

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
        <View style={styles.seal}>
          <Ionicons name="diamond" size={10} color={GAME_THEME.color.ink} />
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
    borderRadius: GAME_THEME.radius.button,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: GAME_THEME.border.thin,
    borderColor: GAME_THEME.color.ink,
    borderBottomWidth: 4,
    borderBottomColor: GAME_THEME.color.goldLip,
  },
  shellDisabled: {
    opacity: 0.42,
  },
  seal: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GAME_THEME.color.paperWarm,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  copy: {
    gap: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: GAME_THEME.color.ink,
  },
  count: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.1,
    color: 'rgba(26,26,26,0.55)',
  },
});
