import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { APP_THEME } from '@/constants/theme';
import { TEACHER_MUTED, TEACHER_TITLE } from '@/components/teacher/teacher-tokens';
import type { TeacherHomeSuggestion } from '@/constants/teacher-suggestions';

type Props = {
  suggestions: readonly TeacherHomeSuggestion[];
  onPick: (prompt: string) => void;
};

function ThemeRow({
  item,
  onPress,
  last,
}: {
  item: TeacherHomeSuggestion;
  onPress: () => void;
  last: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.985, friction: 8, tension: 320, useNativeDriver: true }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, friction: 6, tension: 240, useNativeDriver: true }).start();

  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      onPressIn={pressIn}
      onPressOut={pressOut}
      accessibilityRole="button"
      accessibilityLabel={item.prompt}>
      <Animated.View style={[styles.row, !last && styles.rowDivider, { transform: [{ scale }] }]}>
        <View style={styles.iconChip}>
          <Ionicons name={item.icon} size={17} color={APP_THEME.color.brandBright} />
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Ionicons name="chevron-forward" size={17} color={APP_THEME.color.mutedSoft} />
      </Animated.View>
    </Pressable>
  );
}

/** «Сегодняшние темы» — список тем-ситуаций в одном сгруппированном контейнере. */
export function TeacherTodayThemes({ suggestions, onPick }: Props) {
  return (
    <View style={styles.group}>
      {suggestions.map((item, i) => (
        <ThemeRow
          key={item.id}
          item={item}
          last={i === suggestions.length - 1}
          onPress={() => onPick(item.prompt)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    borderRadius: APP_THEME.radius.xl,
    backgroundColor: APP_THEME.color.elevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: APP_THEME.color.border,
  },
  iconChip: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: APP_THEME.color.brandSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.brandBorder,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: 15.5,
    fontWeight: '600',
    letterSpacing: -0.25,
    color: TEACHER_TITLE,
  },
});
