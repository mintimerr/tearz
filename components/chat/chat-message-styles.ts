import { StyleSheet } from 'react-native';

import { CHAT_MSG, chatBubbleHairline } from '@/constants/chat-message';
import { APP_THEME } from '@/constants/theme';

const outgoingShell = {
  maxWidth: CHAT_MSG.bubble.maxWidth,
  paddingVertical: CHAT_MSG.bubble.padV,
  paddingHorizontal: CHAT_MSG.bubble.padH,
  borderRadius: CHAT_MSG.bubble.radius,
  backgroundColor: CHAT_MSG.bubble.outgoingBg,
  borderWidth: chatBubbleHairline,
  borderColor: CHAT_MSG.bubble.outgoingBorder,
};

const incomingSubtleShell = {
  maxWidth: CHAT_MSG.bubble.maxWidth,
  paddingVertical: CHAT_MSG.bubble.padV,
  paddingHorizontal: CHAT_MSG.bubble.padH,
  borderRadius: CHAT_MSG.bubble.radius,
  backgroundColor: CHAT_MSG.bubble.incomingSubtleBg,
  borderWidth: chatBubbleHairline,
  borderColor: CHAT_MSG.bubble.incomingSubtleBorder,
};

/** Companion chat message styles */
export const companionMessageStyles = StyleSheet.create({
  threadContent: {
    paddingHorizontal: 18,
    paddingBottom: 20,
    gap: CHAT_MSG.threadGap,
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
  incomingWrap: {
    alignSelf: 'stretch',
    alignItems: 'flex-start',
    paddingRight: 36,
  },
  incomingPlain: {
    maxWidth: CHAT_MSG.bubble.plainMaxWidth,
    paddingVertical: 3,
    paddingHorizontal: 2,
  },
  incomingBubble: incomingSubtleShell,
  incomingText: {
    ...CHAT_MSG.body,
    color: CHAT_MSG.incomingColor,
    letterSpacing: -0.38,
  },
  bubbleTimeIn: {
    ...CHAT_MSG.meta,
    marginTop: 7,
    marginLeft: 1,
  },
  outgoingWrap: {
    alignSelf: 'stretch',
    alignItems: 'flex-end',
    paddingLeft: 48,
  },
  outgoingBubble: outgoingShell,
  outgoingText: {
    ...CHAT_MSG.body,
    color: CHAT_MSG.outgoingColor,
  },
  outMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
    marginTop: 6,
    marginRight: 2,
  },
  bubbleTimeOut: CHAT_MSG.meta,
  readMark: {
    fontSize: 11,
    fontWeight: '600',
    color: APP_THEME.color.mutedFaint,
    letterSpacing: -0.5,
  },
  readMarkRead: {
    color: 'rgba(10, 132, 255, 0.85)',
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
    backgroundColor: APP_THEME.color.mutedSoft,
  },
});

/** Teacher chat message styles */
export const teacherMessageStyles = StyleSheet.create({
  threadContent: {
    paddingHorizontal: 18,
    paddingBottom: 20,
    gap: CHAT_MSG.threadGap,
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
