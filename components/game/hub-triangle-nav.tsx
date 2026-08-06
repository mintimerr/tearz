import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { GAME_THEME } from '@/constants/game-theme';
import { useTranslation } from '@/contexts/locale-context';

type ModeId = 'start' | 'cards' | 'dialogs' | 'profile';

type Props = {
  onPress: (id: ModeId) => void;
};

const { gold: GOLD, goldLip: GOLD_LIP, ink: INK } = GAME_THEME.color;

/**
 * Жёлтый play-старт по центру + три золотые иконки режимов без подписей.
 */
export function HubTriangleNav({ onPress }: Props) {
  const { t } = useTranslation();

  const modes: {
    id: Exclude<ModeId, 'start'>;
    icon: keyof typeof Ionicons.glyphMap;
    a11y: string;
  }[] = [
    { id: 'cards', icon: 'albums', a11y: t('hub.cards') },
    { id: 'dialogs', icon: 'chatbubbles', a11y: t('hub.dialogs') },
    { id: 'profile', icon: 'person', a11y: t('hub.profile') },
  ];

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Pressable
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onPress('start');
        }}
        style={({ pressed }) => [styles.start, pressed && styles.btnPressed]}
        accessibilityRole="button"
        accessibilityLabel={t('hub.start')}
        hitSlop={8}>
        <View style={styles.startFace} pointerEvents="none">
          <Ionicons name="play" size={44} color={INK} style={styles.playIcon} />
        </View>
      </Pressable>

      <View style={styles.modes} pointerEvents="box-none">
        {modes.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onPress(m.id);
            }}
            style={({ pressed }) => [styles.mode, pressed && styles.btnPressed]}
            accessibilityRole="button"
            accessibilityLabel={m.a11y}
            hitSlop={10}>
            <Ionicons name={m.icon} size={28} color={INK} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const START = 112;
const MODE = 64;

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: 20,
  },
  start: {
    width: START,
    height: START,
    borderRadius: START / 2,
    backgroundColor: GOLD,
    borderWidth: 4,
    borderColor: INK,
    borderBottomWidth: 8,
    borderBottomColor: GOLD_LIP,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  startFace: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    marginLeft: 6,
  },
  modes: {
    flexDirection: 'row',
    gap: 18,
  },
  mode: {
    width: MODE,
    height: MODE,
    borderRadius: MODE / 2,
    backgroundColor: GOLD,
    borderWidth: 3,
    borderColor: INK,
    borderBottomWidth: 6,
    borderBottomColor: GOLD_LIP,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    transform: [{ translateY: 2 }],
    opacity: 0.92,
  },
});
