import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GAME_THEME } from '@/constants/game-theme';

type Props = {
  href?: Href;
  onPress?: () => void;
  variant?: 'absolute' | 'inline';
  tone?: 'dark' | 'light';
  label?: string;
  style?: StyleProp<ViewStyle>;
};

/** Стрелка назад в игровом chrome. */
export function GameBackButton({
  href = '/hub',
  onPress,
  variant = 'absolute',
  tone = 'dark',
  label = 'Назад в главное меню',
  style,
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inline = variant === 'inline';
  const light = tone === 'light';

  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        if (onPress) {
          onPress();
          return;
        }
        router.replace(href);
      }}
      hitSlop={10}
      style={({ pressed }) => [
        styles.btn,
        inline ? styles.btnInline : styles.btnAbsolute,
        light && !inline && styles.btnAbsoluteLight,
        !inline && { top: insets.top + 8 },
        pressed && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Ionicons
        name="chevron-back"
        size={inline ? 20 : 22}
        color={inline ? GAME_THEME.color.ink : GAME_THEME.color.cream}
        style={styles.icon}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnAbsolute: {
    position: 'absolute',
    left: 12,
    zIndex: 80,
    elevation: 80,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(12, 8, 18, 0.55)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 248, 231, 0.55)',
  },
  btnAbsoluteLight: {
    // День / ATM: те же тёмные кружки, что на аркаде — без белой заливки
    backgroundColor: 'rgba(12, 8, 18, 0.55)',
    borderColor: 'rgba(255, 248, 231, 0.55)',
    borderWidth: 1.5,
  },
  btnInline: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
  icon: {
    marginLeft: -1,
  },
});
