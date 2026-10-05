import { StyleSheet } from 'react-native';

import { CHAT_MSG } from '@/constants/chat-message';
import { GAME_THEME } from '@/constants/game-theme';
import { APP_THEME } from '@/constants/theme';

const outgoingShell = {
  alignSelf: 'flex-end' as const,
  maxWidth: CHAT_MSG.bubble.maxWidth,
  paddingVertical: CHAT_MSG.bubble.padV + 1,
  paddingHorizontal: CHAT_MSG.bubble.padH,
  borderRadius: 18,
  backgroundColor: GAME_THEME.color.paperWarm,
  borderWidth: 1.5,
  borderColor: 'rgba(26,26,26,0.88)',
};

const incomingSubtleShell = {
  maxWidth: CHAT_MSG.bubble.maxWidth,
  paddingVertical: CHAT_MSG.bubble.padV,
  paddingHorizontal: CHAT_MSG.bubble.padH,
  borderRadius: 18,
  backgroundColor: GAME_THEME.color.paper,
  borderWidth: 1.5,
  borderColor: 'rgba(26,26,26,0.88)',
};

/** Companion chat message styles */
export const companionMessageStyles = StyleSheet.create({
  threadContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 16,
  },
  threadTapDismiss: {
    flexGrow: 1,
    width: '100%',
    gap: 16,
  },
  dateWrap: {
    alignItems: 'center',
    marginVertical: 8,
  },
  dateChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: APP_THEME.radius.pill,
    backgroundColor: 'rgba(26,26,26,0.06)',
  },
  dateChipText: {
    ...CHAT_MSG.meta,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: 'rgba(26,26,26,0.45)',
  },
  incomingWrap: {
    alignSelf: 'stretch',
    alignItems: 'flex-start',
    paddingRight: 40,
  },
  incomingPlain: {
    maxWidth: CHAT_MSG.bubble.plainMaxWidth,
    paddingVertical: 3,
    paddingHorizontal: 2,
  },
  incomingBubble: incomingSubtleShell,
  incomingText: {
    ...CHAT_MSG.body,
    color: GAME_THEME.color.ink,
    letterSpacing: -0.2,
  },
  bubbleTimeIn: {
    ...CHAT_MSG.meta,
    marginTop: 6,
    marginLeft: 1,
    color: 'rgba(26,26,26,0.4)',
  },
  outgoingWrap: {
    alignSelf: 'stretch',
    alignItems: 'flex-end',
    paddingLeft: 48,
  },
  outgoingBubble: outgoingShell,
  outgoingText: {
    ...CHAT_MSG.body,
    color: GAME_THEME.color.ink,
  },
  outMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
    marginTop: 6,
    marginRight: 1,
  },
  bubbleTimeOut: {
    ...CHAT_MSG.meta,
    color: 'rgba(26,26,26,0.4)',
  },
  readMark: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.32)',
    letterSpacing: -0.5,
  },
  readMarkRead: {
    color: GAME_THEME.color.sky,
  },
  imageMsgBody: {
    gap: 6,
    maxWidth: CHAT_MSG.bubble.maxWidth,
  },
  imageCaptionIn: incomingSubtleShell,
  imageCaptionOut: {
    ...outgoingShell,
    alignSelf: 'flex-end',
  },
  typingPlain: {
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  typingCaption: {
    marginTop: 8,
    ...CHAT_MSG.meta,
    fontStyle: 'normal',
    color: 'rgba(26,26,26,0.5)',
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 8,
  },
  typingDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: GAME_THEME.color.ink,
  },
});

/** Teacher chat message styles */
export const teacherMessageStyles = StyleSheet.create({
  threadContent: {
    paddingHorizontal: 18,
    paddingBottom: 20,
    gap: CHAT_MSG.threadGap,
  },
  threadTapDismiss: {
    flexGrow: 1,
    width: '100%',
  },
  dateWrap: {
    alignItems: 'center',
    marginVertical: 12,
  },
  dateChip: {
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: APP_THEME.radius.pill,
    backgroundColor: APP_THEME.color.accentSoft,
  },
  dateChipText: {
    ...CHAT_MSG.meta,
    color: APP_THEME.color.mutedSoft,
  },
  teacherBlock: {
    alignSelf: 'stretch',
    alignItems: 'flex-start',
    paddingRight: 32,
  },
  teacherCard: {
    maxWidth: CHAT_MSG.bubble.plainMaxWidth,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  teacherActionsGap: {
    height: 72,
  },
  teacherActions: {
    minHeight: 36,
  },
  teacherLabel: {
    marginBottom: 6,
    ...CHAT_MSG.label,
  },
  teacherText: {
    ...CHAT_MSG.body,
    color: CHAT_MSG.incomingColor,
  },
  teacherTime: {
    ...CHAT_MSG.meta,
    marginTop: 10,
    marginLeft: 2,
  },
  studentWrap: {
    alignSelf: 'stretch',
    alignItems: 'flex-end',
    paddingLeft: 48,
  },
  studentCard: outgoingShell,
  studentText: {
    ...CHAT_MSG.body,
    color: CHAT_MSG.outgoingColor,
  },
  studentTime: {
    ...CHAT_MSG.meta,
    marginTop: 6,
    marginRight: 2,
    alignSelf: 'flex-end',
  },
  typingPlain: {
    maxWidth: CHAT_MSG.bubble.plainMaxWidth,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  typingCaption: {
    marginTop: 8,
    ...CHAT_MSG.meta,
    fontStyle: 'normal',
  },
  typingDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: APP_THEME.color.mutedSoft,
  },
  imageMsgBody: {
    gap: 6,
    maxWidth: CHAT_MSG.bubble.maxWidth,
  },
  imageCaptionIn: incomingSubtleShell,
  imageCaptionOut: {
    ...outgoingShell,
    alignSelf: 'flex-end',
  },
});
