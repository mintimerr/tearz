import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { CHAT_MSG } from '@/constants/chat-message';
import { GAME_THEME } from '@/constants/game-theme';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
};

/** Входящее сообщение — белая панель с ink-обводкой. */
export function CompanionIncomingBubble({ children, style, compact }: Props) {
  return (
    <View style={[styles.shell, style]}>
      <View style={[styles.body, compact && styles.bodyCompact]}>
        {children}
      </View>
    </View>
  );
}

const RADIUS = 16;

const styles = StyleSheet.create({
  shell: {
    maxWidth: CHAT_MSG.bubble.maxWidth,
    borderRadius: RADIUS,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    borderBottomWidth: 4,
    borderBottomColor: GAME_THEME.color.ink,
    backgroundColor: GAME_THEME.color.paper,
    ...Platform.select({
      ios: {
        shadowColor: GAME_THEME.color.ink,
        shadowOpacity: 0.22,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 3 },
      },
      android: {
        elevation: 3,
      },
      default: {},
    }),
  },
  body: {
    borderRadius: RADIUS - 2,
    overflow: 'hidden',
    paddingVertical: 12,
    paddingHorizontal: 15,
    gap: 2,
  },
  bodyCompact: {
    paddingVertical: 9,
    paddingHorizontal: 13,
  },
});
