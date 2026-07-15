import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { APP_THEME } from '@/constants/theme';
import { useTranslation } from '@/contexts/locale-context';
import { useEngagement } from '@/contexts/engagement-context';

type Props = {
  onPress?: () => void;
  compact?: boolean;
};

export function StreakChip({ onPress, compact }: Props) {
  const { dailyStreak } = useEngagement();
  const { t } = useTranslation();

  if (dailyStreak < 1) return null;

  const label = compact
    ? String(dailyStreak)
    : t('engagement.streakDays', { count: dailyStreak });

  const content = (
    <>
      <Ionicons name="flame" size={compact ? 14 : 16} color={APP_THEME.color.success} />
      <Text style={[styles.text, compact && styles.textCompact]}>{label}</Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.chip, compact && styles.chipCompact, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t('engagement.streakA11y', { count: dailyStreak })}>
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.chip, compact && styles.chipCompact]}>{content}</View>;
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: APP_THEME.radius.pill,
    backgroundColor: APP_THEME.color.successSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(52, 199, 89, 0.35)',
  },
  chipCompact: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  text: {
    ...APP_THEME.type.label,
    fontWeight: '700',
    color: APP_THEME.color.success,
    letterSpacing: -0.15,
  },
  textCompact: {
    fontSize: 13,
  },
  pressed: {
    opacity: 0.88,
  },
});
