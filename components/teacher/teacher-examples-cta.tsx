import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { GAME_THEME } from '@/constants/game-theme';
import { useTranslation } from '@/contexts/locale-context';

type Props = {
  count?: number;
  disabled?: boolean;
  onPress: () => void;
};

export function TeacherExamplesCta({ count, disabled, onPress }: Props) {
  const { t } = useTranslation();

  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={t('teacher.examples.ctaA11y')}
      style={({ pressed }) => [
        styles.btn,
        disabled && styles.btnDisabled,
        pressed && !disabled && styles.btnPressed,
      ]}>
      <View style={styles.row}>
        <Ionicons name="library-outline" size={16} color={GAME_THEME.color.ink} />
        <Text style={styles.label}>{t('teacher.examples.ctaLabel')}</Text>
        {typeof count === 'number' && count > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{count}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GAME_THEME.color.sky,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    borderBottomWidth: 4,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  btnPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: GAME_THEME.color.ink,
  },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: GAME_THEME.color.ink,
    fontVariant: ['tabular-nums'],
  },
});
