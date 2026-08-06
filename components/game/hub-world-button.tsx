import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GAME_THEME } from '@/constants/game-theme';

type Props = {
  /** absolute — поверх экрана; inline — в хедере. */
  variant?: 'absolute' | 'inline';
  style?: StyleProp<ViewStyle>;
};

/** Возврат в игровой хаб с экранов режимов. */
export function HubWorldButton({ variant = 'inline', style }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      onPress={() => router.replace('/hub')}
      hitSlop={8}
      style={({ pressed }) => [
        styles.btn,
        variant === 'absolute' && { position: 'absolute', left: 14, top: insets.top + 8, zIndex: 40 },
        pressed && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Мир">
      <Ionicons name="planet-outline" size={16} color="#1A1A1A" />
      <Text style={styles.label}>Мир</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2,
    borderColor: '#1A1A1A',
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1A1A1A',
  },
});
