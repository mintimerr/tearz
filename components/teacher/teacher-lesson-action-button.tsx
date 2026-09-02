import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { GameGoldButton } from '@/components/game/game-gold-button';
import { GAME_THEME } from '@/constants/game-theme';

type Props = {
  tone?: 'gold' | 'sky';
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
  onPressIn?: () => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
};

/** Пара кнопок под ответом учителя: иконка + подпись + мета. */
export function TeacherLessonActionButton({
  tone = 'gold',
  icon,
  title,
  subtitle,
  loading,
  disabled,
  onPress,
  onPressIn,
  accessibilityLabel,
  style,
}: Props) {
  const inactive = disabled || loading;

  return (
    <GameGoldButton
      onPress={onPress}
      onPressIn={onPressIn}
      disabled={inactive}
      tone={tone}
      haptic="light"
      accessibilityLabel={accessibilityLabel}
      style={[styles.btn, style]}>
      {loading ? (
        <ActivityIndicator size="small" color={GAME_THEME.color.ink} />
      ) : (
        <View style={styles.stack}>
          <Ionicons name={icon} size={20} color={GAME_THEME.color.ink} />
          <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      )}
    </GameGoldButton>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: '100%',
    alignSelf: 'stretch',
    minHeight: 56,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  stack: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    width: '100%',
  },
  title: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: GAME_THEME.color.ink,
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
    color: 'rgba(26,26,26,0.62)',
  },
});
