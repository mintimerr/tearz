import { StyleSheet } from 'react-native';

import { APP_THEME } from '@/constants/theme';

/** Shared chat typography & bubble tokens — companion + teacher */
export const CHAT_MSG = {
  body: {
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: -0.41,
    fontWeight: '400' as const,
  },
  incomingColor: 'rgba(0, 0, 0, 0.92)',
  outgoingColor: 'rgba(0, 0, 0, 0.92)',
  meta: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500' as const,
    letterSpacing: 0.02,
    color: APP_THEME.color.mutedFaint,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500' as const,
    letterSpacing: 0.04,
    color: APP_THEME.color.mutedSoft,
  },
  bubble: {
    outgoingBg: 'rgba(0, 0, 0, 0.06)',
    outgoingBorder: 'rgba(0, 0, 0, 0.04)',
    incomingSubtleBg: 'rgba(0, 0, 0, 0.04)',
    incomingSubtleBorder: 'rgba(0, 0, 0, 0.03)',
    radius: 20,
    padV: 10,
    padH: 14,
    maxWidth: '82%' as const,
    plainMaxWidth: '92%' as const,
  },
  threadGap: 14,
} as const;

export const chatBubbleHairline = StyleSheet.hairlineWidth;
