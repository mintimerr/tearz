import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GAME_THEME } from '@/constants/game-theme';

type Props = {
  onPress: () => void;
  tone?: 'dark' | 'light';
  style?: StyleProp<ViewStyle>;
};

/** Кружок с тремя полосками — история диалогов с преподом (как в ChatGPT). */
export function GameTeacherChatsButton({ onPress, tone = 'dark', style }: Props) {
  const insets = useSafeAreaInsets();
  const light = tone === 'light';

  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      hitSlop={10}
      style={({ pressed }) => [
        styles.btn,
        light && styles.btnLight,
        { top: insets.top + 8 },
        pressed && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Чаты с преподавателем">
      <View style={styles.bars} pointerEvents="none">
        <View style={[styles.bar, styles.barLong, light && styles.barLight]} />
        <View style={[styles.bar, styles.barMid, light && styles.barLight]} />
        <View style={[styles.bar, styles.barShort, light && styles.barLight]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    right: 12,
    zIndex: 80,
    elevation: 80,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(12, 8, 18, 0.72)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 248, 231, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLight: {
    // День / ATM: как на аркаде — тёмный кружок, без белой рамки
    backgroundColor: 'rgba(12, 8, 18, 0.72)',
    borderColor: 'rgba(255, 248, 231, 0.7)',
    borderWidth: 1.5,
  },
  bars: {
    width: 16,
    gap: 3,
    alignItems: 'flex-start',
  },
  bar: {
    height: 1.5,
    borderRadius: 1,
    backgroundColor: GAME_THEME.color.cream,
  },
  barLight: {
    backgroundColor: GAME_THEME.color.cream,
  },
  barLong: { width: 16 },
  barMid: { width: 12 },
  barShort: { width: 9 },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
});
