import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { APP_THEME } from '@/constants/theme';
import { TEACHER_MUTED, TEACHER_TITLE } from '@/components/teacher/teacher-tokens';

type Props = {
  title: string;
  meta: string;
  cta: string;
  onPress: () => void;
};

/** Карточка «продолжить» — заметный возврат к последнему уроку. */
export function TeacherContinueCard({ title, meta, cta, onPress }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.98, friction: 8, tension: 320, useNativeDriver: true }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, friction: 6, tension: 240, useNativeDriver: true }).start();

  return (
    <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} accessibilityRole="button">
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <View style={styles.iconTile}>
          <Ionicons name="play" size={18} color={APP_THEME.color.brandBright} />
        </View>
        <View style={styles.main}>
          <Text style={styles.cta}>{cta}</Text>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={APP_THEME.color.mutedSoft} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 14,
    borderRadius: APP_THEME.radius.xl,
    backgroundColor: APP_THEME.color.elevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.border,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: APP_THEME.color.brandSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.brandBorder,
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  cta: {
    ...APP_THEME.type.micro,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: APP_THEME.color.brandBright,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: TEACHER_TITLE,
  },
  meta: {
    fontSize: 13,
    letterSpacing: -0.1,
    color: TEACHER_MUTED,
  },
});
