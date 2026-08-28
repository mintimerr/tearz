import { Ionicons } from '@expo/vector-icons';
import { useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LongPressWordText } from '@/components/long-press-word-text';
import { GAME_THEME } from '@/constants/game-theme';
import { APP_THEME } from '@/constants/theme';
import { useTranslation } from '@/contexts/locale-context';
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
  variant?: 'default' | 'game';
  /** Вместо текста секции «Практика» — кнопки мини/Plus тренировки. */
  practiceActions?: ReactNode;
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

const PRACTICE_SECTION = /практика|practice|练习/i;

function BodyLine({
  line,
  messageId,
  keyId,
  textStyle,
  game,
}: {
  line: TeacherBodyLine;
  messageId: string;
  keyId: string;
  textStyle: object;
  game?: boolean;
}) {
  if (line.kind === 'dialogue') {
    return (
      <View style={styles.dialogueRow}>
        <Text style={[styles.dialogueSpeaker, game && styles.dialogueSpeakerGame]} numberOfLines={1}>
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
      <View style={[styles.phraseCard, game && styles.phraseCardGame]}>
        <LongPressWordText
          text={line.text}
          style={[textStyle, styles.phraseText, game && styles.phraseTextGame]}
          animKey={`${messageId}-${keyId}`}
        />
      </View>
    );
  }

  if (line.kind === 'bullet') {
    return (
      <View style={styles.bulletRow}>
        <View style={[styles.bulletDot, game && styles.bulletDotGame]} />
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
  variant = 'default',
  practiceActions,
}: {
  title: string;
  body: string;
  messageId: string;
  index: number;
  textStyle: object;
  variant?: 'default' | 'game';
  practiceActions?: ReactNode;
}) {
  const game = variant === 'game';
  const label = formatTeacherSectionLabel(title);
  const icon = SECTION_IONICON[getTeacherSectionIcon(title)];
  const isPractice = PRACTICE_SECTION.test(title.trim());
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
        <View style={[styles.headerIcon, game && styles.headerIconGame]}>
          <Ionicons name={icon} size={13} color={game ? GAME_THEME.color.ink : APP_THEME.color.brandBright} />
        </View>
        <Text style={[styles.label, game && styles.labelGame]}>{label}</Text>
      </View>
      {isPractice && practiceActions ? (
        <View style={styles.practiceSlot}>{practiceActions}</View>
      ) : (
        <View style={styles.bodyWrap}>
          {lines.map((line, i) => (
            <BodyLine
              key={`${index}-${i}`}
              line={line}
              messageId={messageId}
              keyId={`${index}-${i}`}
              textStyle={textStyle}
              game={game}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export function TeacherMessageBody({ text, messageId, textStyle, variant = 'default', practiceActions }: Props) {
  const { t } = useTranslation();
  const blocks = useMemo(() => parseTeacherMessageBlocks(text), [text]);
  const game = variant === 'game';

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
          variant={variant}
          practiceActions={practiceActions}
        />
      ))}
      {practiceActions && !blocks.some((b) => PRACTICE_SECTION.test(b.title.trim())) ? (
        <View style={styles.practiceFallback}>
          <View style={styles.headerRow}>
            <View style={[styles.headerIcon, game && styles.headerIconGame]}>
              <Ionicons name="barbell-outline" size={13} color={GAME_THEME.color.ink} />
            </View>
            <Text style={[styles.label, game && styles.labelGame]}>{t('teacher.drill.practiceLabel')}</Text>
          </View>
          <View style={styles.practiceSlot}>{practiceActions}</View>
        </View>
      ) : null}
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
  headerIconGame: {
    borderRadius: 4,
    backgroundColor: GAME_THEME.color.paperWarm,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: APP_THEME.color.muted,
  },
  labelGame: {
    fontWeight: '900',
    letterSpacing: 1.1,
    color: GAME_THEME.color.ink,
  },
  practiceSlot: {
    marginTop: 2,
  },
  practiceFallback: {
    marginTop: 18,
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
  phraseCardGame: {
    borderRadius: 4,
    backgroundColor: '#F0F8FF',
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    borderLeftWidth: 4,
    borderLeftColor: GAME_THEME.color.sky,
  },
  phraseText: {
    fontSize: 16.5,
    lineHeight: 24,
    fontWeight: '600',
    color: APP_THEME.color.text,
  },
  phraseTextGame: {
    color: GAME_THEME.color.ink,
    fontWeight: '700',
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
  bulletDotGame: {
    width: 6,
    height: 6,
    borderRadius: 1,
    backgroundColor: GAME_THEME.color.ink,
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
  dialogueSpeakerGame: {
    color: GAME_THEME.color.ink,
    fontWeight: '800',
  },
  dialogueText: {
    flex: 1,
  },
});
