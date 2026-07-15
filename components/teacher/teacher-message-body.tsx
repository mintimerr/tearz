import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LongPressWordText } from '@/components/long-press-word-text';
import { APP_THEME } from '@/constants/theme';
import {
  cleanTeacherInline,
  formatTeacherSectionLabel,
  getTeacherSectionIcon,
  isDialogueTitle,
  isPhraseTitle,
  parseTeacherBlockLines,
  parseTeacherMessageBlocks,
  type TeacherBodyLine,
  type TeacherSectionIcon,
} from '@/utils/teacher-message-sections';

type Props = {
  text: string;
  messageId: string;
  textStyle: object;
};

const SECTION_IONICON: Record<TeacherSectionIcon, keyof typeof Ionicons.glyphMap> = {
  bulb: 'bulb-outline',
  language: 'language-outline',
  people: 'people-outline',
  barbell: 'barbell-outline',
  list: 'list-outline',
  'checkmark-done': 'checkmark-done-outline',
  book: 'book-outline',
  sparkles: 'sparkles-outline',
};

function BodyLine({
  line,
  messageId,
  keyId,
  textStyle,
}: {
  line: TeacherBodyLine;
  messageId: string;
  keyId: string;
  textStyle: object;
}) {
  if (line.kind === 'dialogue') {
    return (
      <View style={styles.dialogueRow}>
        <Text style={styles.dialogueSpeaker} numberOfLines={1}>
          {line.speaker}
        </Text>
        <View style={styles.dialogueText}>
          <LongPressWordText
            text={line.text}
            style={[textStyle, styles.bodyText]}
            animKey={`${messageId}-${keyId}`}
          />
        </View>
      </View>
    );
  }

  if (line.kind === 'phrase') {
    return (
      <View style={styles.phraseCard}>
        <LongPressWordText
          text={line.text}
          style={[textStyle, styles.phraseText]}
          animKey={`${messageId}-${keyId}`}
        />
      </View>
    );
  }

  if (line.kind === 'bullet') {
    return (
      <View style={styles.bulletRow}>
        <View style={styles.bulletDot} />
        <View style={styles.bulletTextWrap}>
          <LongPressWordText
            text={line.text}
            style={[textStyle, styles.bodyText]}
            animKey={`${messageId}-${keyId}`}
          />
        </View>
      </View>
    );
  }

  return (
    <LongPressWordText
      text={line.text}
      style={[textStyle, styles.bodyText]}
      animKey={`${messageId}-${keyId}`}
    />
  );
}

function TeacherSection({
  title,
  body,
  messageId,
  index,
  textStyle,
}: {
  title: string;
  body: string;
  messageId: string;
  index: number;
  textStyle: object;
}) {
  const label = formatTeacherSectionLabel(title);
  const icon = SECTION_IONICON[getTeacherSectionIcon(title)];
  const lines = useMemo(
    () =>
      parseTeacherBlockLines(body, {
        dialogue: isDialogueTitle(title),
        phrase: isPhraseTitle(title),
      }),
    [body, title],
  );

  return (
    <View style={index > 0 ? styles.section : undefined}>
      <View style={styles.headerRow}>
        <View style={styles.headerIcon}>
          <Ionicons name={icon} size={13} color={APP_THEME.color.brandBright} />
        </View>
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={styles.bodyWrap}>
        {lines.map((line, i) => (
          <BodyLine
            key={`${index}-${i}`}
            line={line}
            messageId={messageId}
            keyId={`${index}-${i}`}
            textStyle={textStyle}
          />
        ))}
      </View>
    </View>
  );
}

export function TeacherMessageBody({ text, messageId, textStyle }: Props) {
  const blocks = useMemo(() => parseTeacherMessageBlocks(text), [text]);

  if (!blocks) {
    return (
      <LongPressWordText
        text={cleanTeacherInline(text)}
        style={[textStyle, styles.bodyText]}
        animKey={messageId}
      />
    );
  }

  return (
    <View style={styles.wrap}>
      {blocks.map((block, index) => (
        <TeacherSection
          key={`${block.title}-${index}`}
          title={block.title}
          body={block.body}
          messageId={messageId}
          index={index}
          textStyle={textStyle}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    width: '100%',
  },
  section: {
    marginTop: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 10,
  },
  headerIcon: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_THEME.color.brandSoft,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: APP_THEME.color.muted,
  },
  bodyWrap: {
    alignSelf: 'stretch',
    width: '100%',
    gap: 8,
  },
  bodyText: {
    lineHeight: 25,
  },
  phraseCard: {
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: APP_THEME.radius.md,
    backgroundColor: 'rgba(10, 132, 255, 0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(100, 210, 255, 0.18)',
  },
  phraseText: {
    fontSize: 16.5,
    lineHeight: 24,
    fontWeight: '600',
    color: APP_THEME.color.text,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: APP_THEME.color.mutedSoft,
    marginTop: 10,
    marginRight: 11,
  },
  bulletTextWrap: {
    flex: 1,
  },
  dialogueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  dialogueSpeaker: {
    minWidth: 62,
    maxWidth: 62,
    fontSize: 13,
    lineHeight: 25,
    fontWeight: '600',
    letterSpacing: -0.1,
    color: APP_THEME.color.brandBright,
    marginRight: 10,
  },
  dialogueText: {
    flex: 1,
  },
});
