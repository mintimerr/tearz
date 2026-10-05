import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { CHAT_MSG } from '@/constants/chat-message';
import { GAME_THEME } from '@/constants/game-theme';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
};

/** Входящее сообщение собеседника — спокойный пузырь без тяжёлой тени. */
export function CompanionIncomingBubble({ children, style, compact }: Props) {
  return (
    <View style={[styles.shell, compact && styles.shellCompact, style]}>
      {children}
    </View>
  );
}

const RADIUS = 18;

const styles = StyleSheet.create({
  shell: {
    alignSelf: 'flex-start',
    maxWidth: CHAT_MSG.bubble.maxWidth,
    borderRadius: RADIUS,
    borderWidth: 1.5,
    borderColor: 'rgba(26,26,26,0.88)',
    backgroundColor: GAME_THEME.color.paper,
    paddingVertical: 11,
    paddingHorizontal: 14,
    gap: 2,
  },
  shellCompact: {
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
});
