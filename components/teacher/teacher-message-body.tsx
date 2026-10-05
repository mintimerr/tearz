import { Ionicons } from '@expo/vector-icons';
import { memo, useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LongPressWordText } from '@/components/long-press-word-text';
import { SpotlightAnchor } from '@/components/onboarding/tearz-spotlight';
import { GAME_THEME } from '@/constants/game-theme';
import { APP_THEME } from '@/constants/theme';
import { useTranslation } from '@/contexts/locale-context';
import {
  cleanTeacherInline,
  formatTeacherSectionLabel,
  getTeacherSectionIcon,
  isDialogueTitle,
  isPhraseTitle,
  isVocabularyTitle,
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
  /** Первый визит: подсветить текст, где слово можно выделить. */
  wordCoach?: boolean;
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
  if (line.kind === 'vocab') {
    return (
      <View style={[styles.vocabChip, game && styles.vocabChipGame]}>
        <View style={[styles.vocabAccent, game && styles.vocabAccentGame]} />
        <View style={styles.vocabChipBody}>
          <LongPressWordText
            text={line.word}
            style={[textStyle, styles.vocabWord, game && styles.vocabWordGame]}
            animKey={`${messageId}-${keyId}-w`}
          />
          <View style={[styles.glossPill, game && styles.glossPillGame]}>
            <Text style={[styles.vocabGloss, game && styles.vocabGlossGame]} numberOfLines={3}>
              {line.gloss}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (line.kind === 'dialogue') {
    return (
      <View style={[styles.dialogueRow, game && styles.dialogueRowGame]}>
        <View style={[styles.dialogueBadge, game && styles.dialogueBadgeGame]}>
          <Text style={[styles.dialogueSpeaker, game && styles.dialogueSpeakerGame]} numberOfLines={1}>
            {line.speaker}
          </Text>
        </View>
        <View style={styles.dialogueText}>
          <LongPressWordText
            text={line.text}
            style={[textStyle, styles.bodyText, game && styles.bodyTextGame]}
            animKey={`${messageId}-${keyId}`}
          />
        </View>
      </View>
    );
  }

  if (line.kind === 'phrase') {
    return (
      <View style={[styles.phraseCard, game && styles.phraseCardGame]}>
        <View style={[styles.phraseAccent, game && styles.phraseAccentGame]} />
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
      <View style={[styles.bulletRow, game && styles.bulletRowGame]}>
        <View style={[styles.bulletMark, game && styles.bulletMarkGame]} />
        <View style={styles.bulletTextWrap}>
          <LongPressWordText
            text={line.text}
            style={[textStyle, styles.bodyText, game && styles.bodyTextGame]}
            animKey={`${messageId}-${keyId}`}
          />
        </View>
      </View>
    );
  }

  return (
    <LongPressWordText
      text={line.text}
      style={[textStyle, styles.bodyText, game && styles.bodyTextGame]}
      animKey={`${messageId}-${keyId}`}
    />
  );
}

function SectionTitleBar({
  label,
  icon,
  game,
  embedded,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  game?: boolean;
  /** Внутри окна — sky-полоса. Снаружи (практика) — компактный ярлык. */
  embedded?: boolean;
}) {
  if (!embedded) {
    return (
      <View style={styles.headerRow}>
        <View style={[styles.headerIcon, game && styles.headerIconGame]}>
          <Ionicons name={icon} size={13} color={game ? GAME_THEME.color.ink : APP_THEME.color.brandBright} />
        </View>
        <Text style={[styles.headerLabel, game && styles.headerLabelGame]}>{label}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.titleBar, game && styles.titleBarGame]}>
      <View style={[styles.titleIcon, game && styles.titleIconGame]}>
        <Ionicons name={icon} size={game ? 14 : 13} color={game ? GAME_THEME.color.cream : APP_THEME.color.brandBright} />
      </View>
      <Text style={[styles.titleLabel, game && styles.titleLabelGame]}>{label}</Text>
    </View>
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
  spotlightLine,
}: {
  title: string;
  body: string;
  messageId: string;
  index: number;
  textStyle: object;
  variant?: 'default' | 'game';
  practiceActions?: ReactNode;
  spotlightLine?: string;
}) {
  const game = variant === 'game';
  const isLead = !title.trim();
  const label = isLead ? '' : formatTeacherSectionLabel(title);
  const iconName = isLead ? null : SECTION_IONICON[getTeacherSectionIcon(title)];
  const isPractice = !isLead && PRACTICE_SECTION.test(title.trim());
  const isVocab = !isLead && isVocabularyTitle(title);
  const isPhraseSec = isLead || isPhraseTitle(title);
  const isDialogue = !isLead && isDialogueTitle(title);
  const lines = useMemo(
    () =>
      parseTeacherBlockLines(body, {
        dialogue: isDialogue,
        phrase: isPhraseSec,
        vocabulary: isVocab,
      }),
    [body, isDialogue, isPhraseSec, isVocab],
  );

  const linesBody = (
    <View style={[styles.bodyWrap, isVocab && styles.vocabStack, isDialogue && styles.dialogueStack]}>
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
  );
  const shownBody = spotlightLine ? (
    <SpotlightAnchor
      tipId="coachWords2"
      line={spotlightLine}
      style={styles.spot}>
      {linesBody}
    </SpotlightAnchor>
  ) : (
    linesBody
  );

  // Практика — заголовок снаружи, кнопки уже «тяжёлые».
  if (isPractice) {
    return (
      <View style={index > 0 ? styles.section : undefined}>
        {iconName ? <SectionTitleBar label={label} icon={iconName} game={game} /> : null}
        <View style={styles.practiceSlot}>{practiceActions}</View>
      </View>
    );
  }

  // Фраза / lead — отдельные quote-plates без оконной рамки.
  if (isPhraseSec) {
    return <View style={index > 0 ? styles.section : undefined}>{shownBody}</View>;
  }

  // Лексика / диалог / теория — игровое окно с title bar.
  return (
    <View style={index > 0 ? styles.section : undefined}>
      <View style={[styles.window, game && styles.windowGame]}>
        {iconName ? <SectionTitleBar label={label} icon={iconName} game={game} embedded /> : null}
        <View style={[styles.windowBody, game && styles.windowBodyGame, isVocab && styles.windowBodyVocab]}>
          {shownBody}
        </View>
      </View>
    </View>
  );
}

export const TeacherMessageBody = memo(function TeacherMessageBody({
  text,
  messageId,
  textStyle,
  variant = 'default',
  practiceActions,
  wordCoach = false,
}: Props) {
  const { t } = useTranslation();
  const blocks = useMemo(() => parseTeacherMessageBlocks(text), [text]);
  const game = variant === 'game';
  const wordLine = t('onboarding.spotWords');

  if (!blocks) {
    const plain = (
      <LongPressWordText
        text={cleanTeacherInline(text)}
        style={[textStyle, styles.bodyText, game && styles.bodyTextGame]}
        animKey={messageId}
      />
    );
    const withCoach = !wordCoach ? (
      plain
    ) : (
      <SpotlightAnchor tipId="coachWords2" line={wordLine} style={styles.spot}>
        {plain}
      </SpotlightAnchor>
    );
    if (!practiceActions) return withCoach;
    return (
      <View style={styles.wrap}>
        {withCoach}
        <View style={styles.practiceFallback}>
          <SectionTitleBar label={t('teacher.drill.practiceLabel')} icon="barbell-outline" game={game} />
          <View style={styles.practiceSlot}>{practiceActions}</View>
        </View>
      </View>
    );
  }

  const wordIndex = wordCoach
    ? blocks.findIndex((b) => !PRACTICE_SECTION.test(b.title.trim()) && b.body.trim().length > 0)
    : -1;

  const tree = (
    <View style={styles.wrap}>
      {blocks.map((block, index) => (
        <TeacherSection
          key={`${block.title || 'lead'}-${index}`}
          title={block.title}
          body={block.body}
          messageId={messageId}
          index={index}
          textStyle={textStyle}
          variant={variant}
          practiceActions={practiceActions}
          spotlightLine={index === wordIndex ? wordLine : undefined}
        />
      ))}
      {practiceActions && !blocks.some((b) => PRACTICE_SECTION.test(b.title.trim())) ? (
        <View style={styles.practiceFallback}>
          <SectionTitleBar label={t('teacher.drill.practiceLabel')} icon="barbell-outline" game={game} />
          <View style={styles.practiceSlot}>{practiceActions}</View>
        </View>
      ) : null}
    </View>
  );

  if (wordCoach && wordIndex < 0) {
    return (
      <SpotlightAnchor tipId="coachWords2" line={wordLine} style={styles.spot}>
        {tree}
      </SpotlightAnchor>
    );
  }
  return tree;
});

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    width: '100%',
  },
  spot: {
    alignSelf: 'stretch',
  },
  section: {
    marginTop: 14,
  },
  practiceSlot: {
    marginTop: 8,
  },
  practiceFallback: {
    marginTop: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 2,
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
    borderRadius: 5,
    backgroundColor: GAME_THEME.color.paperWarm,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: APP_THEME.color.muted,
  },
  headerLabelGame: {
    fontWeight: '900',
    letterSpacing: 1.15,
    color: GAME_THEME.color.ink,
  },

  /** Окно секции — как SNES dialog / drill well. */
  window: {
    borderRadius: APP_THEME.radius.lg,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(26,26,26,0.1)',
    overflow: 'hidden',
  },
  windowGame: {
    borderRadius: 8,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 3,
    borderColor: GAME_THEME.color.ink,
    borderBottomWidth: 5,
    borderBottomColor: GAME_THEME.color.goldLip,
  },
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: APP_THEME.color.brandSoft,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(26,26,26,0.08)',
  },
  titleBarGame: {
    backgroundColor: GAME_THEME.color.sky,
    borderBottomWidth: 3,
    borderBottomColor: GAME_THEME.color.ink,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  titleIcon: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  titleIconGame: {
    borderRadius: 5,
    backgroundColor: 'rgba(26,26,26,0.18)',
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  titleLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: APP_THEME.color.muted,
  },
  titleLabelGame: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: GAME_THEME.color.cream,
  },
  windowBody: {
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  windowBodyGame: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: GAME_THEME.color.paper,
  },
  windowBodyVocab: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },

  bodyWrap: {
    alignSelf: 'stretch',
    width: '100%',
    gap: 8,
  },
  vocabStack: {
    gap: 7,
  },
  dialogueStack: {
    gap: 10,
  },
  bodyText: {
    lineHeight: 25,
  },
  bodyTextGame: {
    fontWeight: '700',
    color: GAME_THEME.color.ink,
    letterSpacing: -0.2,
  },

  /** Карточка слова — bevel chip. */
  vocabChip: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: APP_THEME.radius.md,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(26,26,26,0.1)',
    paddingLeft: 14,
    paddingRight: 12,
    paddingVertical: 10,
  },
  vocabChipGame: {
    borderRadius: 7,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2.5,
    borderColor: GAME_THEME.color.ink,
    borderBottomWidth: 4,
    borderBottomColor: GAME_THEME.color.goldLip,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 10,
  },
  vocabAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: APP_THEME.color.brandBright,
  },
  vocabAccentGame: {
    width: 5,
    backgroundColor: GAME_THEME.color.sky,
  },
  vocabChipBody: {
    gap: 6,
  },
  vocabWord: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: APP_THEME.color.text,
    letterSpacing: -0.25,
  },
  vocabWordGame: {
    fontSize: 16.5,
    lineHeight: 22,
    fontWeight: '900',
    color: GAME_THEME.color.ink,
    letterSpacing: -0.3,
  },
  glossPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: APP_THEME.color.brandSoft,
  },
  glossPillGame: {
    borderRadius: 6,
    backgroundColor: GAME_THEME.color.paperWarm,
    borderWidth: 1.5,
    borderColor: GAME_THEME.color.ink,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  vocabGloss: {
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '600',
    color: APP_THEME.color.muted,
  },
  vocabGlossGame: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 0.15,
    color: GAME_THEME.color.ink,
  },

  phraseCard: {
    position: 'relative',
    overflow: 'hidden',
    paddingVertical: 12,
    paddingHorizontal: 14,
    paddingLeft: 16,
    borderRadius: APP_THEME.radius.md,
    backgroundColor: 'rgba(10, 132, 255, 0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(100, 210, 255, 0.18)',
  },
  phraseCardGame: {
    borderRadius: 8,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 3,
    borderColor: GAME_THEME.color.ink,
    borderBottomWidth: 5,
    borderBottomColor: GAME_THEME.color.goldLip,
    paddingLeft: 16,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  phraseAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: APP_THEME.color.brandBright,
  },
  phraseAccentGame: {
    width: 5,
    backgroundColor: GAME_THEME.color.sky,
  },
  phraseText: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
    color: APP_THEME.color.text,
  },
  phraseTextGame: {
    fontSize: 17.5,
    lineHeight: 24,
    color: GAME_THEME.color.ink,
    fontWeight: '800',
    letterSpacing: -0.3,
  },

  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bulletRowGame: {
    gap: 2,
  },
  bulletMark: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: APP_THEME.color.mutedSoft,
    marginTop: 10,
    marginRight: 11,
  },
  bulletMarkGame: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: GAME_THEME.color.sky,
    borderWidth: 1.5,
    borderColor: GAME_THEME.color.ink,
    marginTop: 8,
    marginRight: 10,
  },
  bulletTextWrap: {
    flex: 1,
  },

  dialogueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  dialogueRowGame: {
    gap: 9,
  },
  dialogueBadge: {
    minWidth: 52,
    maxWidth: 64,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: APP_THEME.color.brandSoft,
    alignItems: 'center',
    marginTop: 2,
  },
  dialogueBadgeGame: {
    borderRadius: 5,
    backgroundColor: GAME_THEME.color.sky,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    borderBottomWidth: 3,
    borderBottomColor: GAME_THEME.color.goldLip,
    paddingVertical: 3,
  },
  dialogueSpeaker: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: -0.1,
    color: APP_THEME.color.brandBright,
  },
  dialogueSpeakerGame: {
    color: GAME_THEME.color.cream,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  dialogueText: {
    flex: 1,
  },
});
