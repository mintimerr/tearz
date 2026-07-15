import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { CHAT_MSG } from '@/constants/chat-message';
import { APP_THEME } from '@/constants/theme';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
};

/** Входящее сообщение собеседника — тонкий контур, глубина без «пластика». */
export function CompanionIncomingBubble({ children, style, compact }: Props) {
  return (
    <View style={[styles.shell, style]}>
      <View style={[styles.body, compact && styles.bodyCompact]}>
        <View style={styles.highlight} pointerEvents="none" />
        {children}
      </View>
    </View>
  );
}

const RADIUS = APP_THEME.radius.xl;

const styles = StyleSheet.create({
  shell: {
    maxWidth: CHAT_MSG.bubble.maxWidth,
    borderRadius: RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.borderStrong,
    backgroundColor: APP_THEME.color.accentSoft,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOpacity: 0.14,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: {
        elevation: 2,
      },
      default: {},
    }),
  },
  body: {
    borderRadius: RADIUS - StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingVertical: 11,
    paddingHorizontal: 15,
    gap: 2,
  },
  bodyCompact: {
    paddingVertical: 9,
    paddingHorizontal: 13,
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: StyleSheet.hairlineWidth,
    backgroundColor: APP_THEME.color.borderStrong,
  },
});
