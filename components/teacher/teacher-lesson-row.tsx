import { Ionicons } from '@expo/vector-icons';
import { memo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { APP_THEME } from '@/constants/theme';
import { TEACHER_MUTED, TEACHER_MUTED_SOFT, TEACHER_TITLE } from '@/components/teacher/teacher-tokens';

type Props = {
  title: string;
  meta: string;
  accentColor: string;
  onPress: () => void;
  showSeparator?: boolean;
};

export const TeacherLessonRow = memo(function TeacherLessonRow({
  title,
  meta,
  onPress,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.975, friction: 8, tension: 320, useNativeDriver: true }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, friction: 6, tension: 240, useNativeDriver: true }).start();

  return (
    <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} accessibilityRole="button">
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <View style={styles.iconTile}>
          <Ionicons name="book" size={18} color={APP_THEME.color.brandBright} />
        </View>
        <View style={styles.main}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={TEACHER_MUTED_SOFT} />
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 13,
    paddingHorizontal: 13,
    borderRadius: APP_THEME.radius.xl,
    backgroundColor: APP_THEME.color.elevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.border,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
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
    gap: 3,
  },
  title: {
    fontSize: 16.5,
    fontWeight: '600',
    letterSpacing: -0.35,
    lineHeight: 21,
    color: TEACHER_TITLE,
  },
  meta: {
    fontSize: 13,
    letterSpacing: -0.12,
    color: TEACHER_MUTED,
  },
});
