import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { GameGoldButton } from '@/components/game/game-gold-button';
import { GAME_THEME } from '@/constants/game-theme';
import { DRILL_TASK_COUNT } from '@/constants/teacher-drill';
import { useTranslation } from '@/contexts/locale-context';

type Props = {
  loading?: boolean;
  disabled?: boolean;
  exhausted?: boolean;
  refreshesLeft?: number;
  isRepeat?: boolean;
  onPress: () => void;
  onPressIn?: () => void;
  style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
};

export function TeacherExerciseCta({
  loading,
  disabled,
  exhausted,
  refreshesLeft,
  isRepeat,
  onPress,
  onPressIn,
  style,
}: Props) {
  const { t } = useTranslation();
  const inactive = disabled || loading;
  const showExhausted = exhausted && !loading;

  return (
    <GameGoldButton
      onPress={onPress}
      onPressIn={onPressIn}
      disabled={inactive}
      size="sm"
      haptic="light"
      accessibilityLabel={t('teacher.drill.ctaA11y')}
      style={[styles.btn, style]}>
      {loading ? (
        <ActivityIndicator size="small" color={GAME_THEME.color.ink} />
      ) : (
        <View style={styles.row}>
          <Ionicons name="barbell" size={16} color={GAME_THEME.color.ink} />
          <Text style={styles.label}>
            {showExhausted ? t('teacher.drill.ctaLimit') : t('teacher.drill.ctaLabel')}
          </Text>
          {!showExhausted ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{DRILL_TASK_COUNT}</Text>
            </View>
          ) : null}
          {!loading && !showExhausted && isRepeat && typeof refreshesLeft === 'number' ? (
            <Text style={styles.refresh}>↻{refreshesLeft}</Text>
          ) : null}
        </View>
      )}
    </GameGoldButton>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignSelf: 'stretch',
    width: '100%',
    minWidth: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: GAME_THEME.color.ink,
  },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: GAME_THEME.color.ink,
    fontVariant: ['tabular-nums'],
  },
  refresh: {
    fontSize: 11,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
    opacity: 0.72,
  },
});
