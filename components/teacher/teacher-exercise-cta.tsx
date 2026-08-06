import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text } from 'react-native';

import { GAME_THEME } from '@/constants/game-theme';
import { MINI_DRILL_TASK_COUNT } from '@/constants/teacher-drill';

type Props = {
  loading?: boolean;
  disabled?: boolean;
  exhausted?: boolean;
  refreshesLeft?: number;
  isRepeat?: boolean;
  onPress: () => void;
};

export function TeacherExerciseCta({
  loading,
  disabled,
  exhausted,
  refreshesLeft,
  isRepeat,
  onPress,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const inactive = disabled || loading || exhausted;
  const filled = !inactive;

  useEffect(() => {
    if (loading) scale.setValue(1);
  }, [loading, scale]);

  const pressIn = () => {
    if (inactive) return;
    Animated.spring(scale, {
      toValue: 0.97,
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

  const tint = filled ? GAME_THEME.color.ink : 'rgba(26,26,26,0.42)';

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel="Мини-тренировка по этому объяснению"
      accessibilityState={{ disabled: inactive, busy: loading }}>
      <Animated.View
        style={[
          styles.shell,
          filled ? styles.shellFilled : styles.shellMuted,
          { transform: [{ scale }] },
        ]}>
        {loading ? (
          <ActivityIndicator size="small" color={tint} style={styles.spinner} />
        ) : (
          <Ionicons name="barbell" size={14} color={tint} />
        )}
        <Text style={[styles.label, { color: tint }]}>
          {loading ? 'Готовлю…' : exhausted ? 'Лимит' : `Мини · ${MINI_DRILL_TASK_COUNT}`}
        </Text>
        {!loading && !exhausted && isRepeat && typeof refreshesLeft === 'number' ? (
          <Text style={[styles.refresh, { color: tint }]}>↻{refreshesLeft}</Text>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 13,
    borderRadius: GAME_THEME.radius.button,
  },
  shellFilled: {
    backgroundColor: GAME_THEME.color.paperWarm,
    borderWidth: 3,
    borderColor: GAME_THEME.color.ink,
    borderBottomWidth: 5,
    borderBottomColor: GAME_THEME.color.goldLip,
    minHeight: 40,
    paddingHorizontal: 16,
  },
  shellMuted: {
    backgroundColor: GAME_THEME.color.creamSoft,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    opacity: 0.72,
  },
  spinner: {
    transform: [{ scale: 0.82 }],
  },
  label: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  refresh: {
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 1,
  },
});
