import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EXERCISE_KIND_META } from '@/components/teacher/teacher-exercise-kind-meta';
import { GAME_THEME } from '@/constants/game-theme';
import { useLocale, useTranslation } from '@/contexts/locale-context';
import type { TeacherExerciseKind } from '@/types/companion-chat-api';
import type { TeacherDrillMistakeRecord } from '@/utils/teacher-drill-mistakes';

type Props = {
  mistake: TeacherDrillMistakeRecord;
  /** Компактный превью без раскрытия (профиль). */
  compact?: boolean;
  defaultExpanded?: boolean;
};

const CORAL = '#FF6B5A';
const CORAL_SOFT = '#FFE8E4';
const MINT = '#2DBE6C';
const MINT_SOFT = '#E3F8EC';
const SKY_SOFT = '#E8F1FF';

function formatMistakeWhen(ts: number, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-GB' : 'ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

export function drillMistakeKindLabel(
  kind: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const meta = EXERCISE_KIND_META[kind as TeacherExerciseKind];
  if (meta) return t(meta.labelKey);
  return kind;
}

export function drillMistakeKindIcon(kind: string): keyof typeof Ionicons.glyphMap {
  const meta = EXERCISE_KIND_META[kind as TeacherExerciseKind];
  return meta?.icon ?? 'alert-circle-outline';
}

export function DrillMistakeCard({ mistake, compact = false, defaultExpanded = false }: Props) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const [expanded, setExpanded] = useState(defaultExpanded && !compact);

  const kindLabel = useMemo(() => drillMistakeKindLabel(mistake.kind, t), [mistake.kind, t]);
  const kindIcon = drillMistakeKindIcon(mistake.kind);
  const when = formatMistakeWhen(mistake.recordedAt, locale);
  const topic = mistake.lessonTopic?.trim() || t('profile.mistakesUnknownLesson');

  const header = (
    <View style={styles.topRow}>
      <View style={styles.kindPill}>
        <Ionicons name={kindIcon} size={13} color={GAME_THEME.color.cream} />
        <Text style={styles.kindText} numberOfLines={1}>
          {kindLabel}
        </Text>
      </View>
      <View style={styles.topRight}>
        <Text style={styles.when}>{when}</Text>
        {!compact ? (
          <View style={styles.chevronWrap}>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={GAME_THEME.color.ink}
            />
          </View>
        ) : null}
      </View>
    </View>
  );

  const body = (
    <>
      {header}
      <Text style={styles.topic} numberOfLines={expanded && !compact ? 3 : 1}>
        {topic}
      </Text>
      <View style={styles.promptPlate}>
        <Text style={styles.prompt} numberOfLines={expanded && !compact ? 6 : 2}>
          {mistake.checkText}
        </Text>
      </View>

      {!compact && expanded ? (
        <View style={styles.detailBlock}>
          <View style={styles.metaChips}>
            <View style={styles.metaChip}>
              <Text style={styles.metaChipLabel}>{t('profile.mistakesTaskType')}</Text>
              <Text style={styles.metaChipValue}>{kindLabel}</Text>
            </View>
            <View style={[styles.metaChip, styles.metaChipWide]}>
              <Text style={styles.metaChipLabel}>{t('profile.mistakesLesson')}</Text>
              <Text style={styles.metaChipValue} numberOfLines={2}>
                {topic}
              </Text>
            </View>
          </View>

          <View style={[styles.answerPlate, styles.answerPlateWrong]}>
            <View style={styles.answerPlateHead}>
              <Ionicons name="close-circle" size={14} color={CORAL} />
              <Text style={[styles.pairLabel, { color: CORAL }]}>
                {t('profile.mistakesYourAnswer')}
              </Text>
            </View>
            <Text style={styles.answerWrong}>{mistake.learnerAnswer}</Text>
          </View>

          {mistake.idealAnswer ? (
            <View style={[styles.answerPlate, styles.answerPlateIdeal]}>
              <View style={styles.answerPlateHead}>
                <Ionicons name="checkmark-circle" size={14} color={MINT} />
                <Text style={[styles.pairLabel, { color: MINT }]}>
                  {t('profile.mistakesIdeal')}
                </Text>
              </View>
              <Text style={styles.answerIdeal}>{mistake.idealAnswer}</Text>
            </View>
          ) : null}

          {mistake.feedback ? (
            <View style={styles.feedbackPlate}>
              <Text style={styles.pairLabel}>{t('profile.mistakesFeedback')}</Text>
              <Text style={styles.feedbackText}>{mistake.feedback}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={[styles.answerPlate, styles.answerPlateWrong, styles.answerPlateCompact]}>
          <View style={styles.answerPlateHead}>
            <Ionicons name="close-circle" size={14} color={CORAL} />
            <Text style={[styles.pairLabel, { color: CORAL }]}>
              {t('profile.mistakesYourAnswer')}
            </Text>
          </View>
          <Text style={styles.answerWrong} numberOfLines={compact ? 2 : 1}>
            {mistake.learnerAnswer}
          </Text>
        </View>
      )}
    </>
  );

  if (compact) {
    return (
      <View style={styles.lip}>
        <View style={styles.card}>{body}</View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => setExpanded((v) => !v)}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      style={({ pressed }) => [styles.lip, pressed && styles.lipPressed]}>
      <View style={[styles.card, expanded && styles.cardExpanded]}>{body}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  lip: {
    borderRadius: GAME_THEME.radius.panel + 1,
    backgroundColor: GAME_THEME.color.goldLip,
    paddingBottom: 4,
  },
  lipPressed: {
    paddingBottom: 1,
    transform: [{ translateY: 3 }],
  },
  card: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: SKY_SOFT,
    borderWidth: GAME_THEME.border.thick,
    borderColor: GAME_THEME.color.ink,
    borderRadius: GAME_THEME.radius.panel,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  cardExpanded: {
    backgroundColor: '#F4F8FF',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  kindPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '64%',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: GAME_THEME.color.sky,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  kindText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: GAME_THEME.color.cream,
  },
  when: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(26,26,26,0.48)',
  },
  chevronWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 1.5,
    borderColor: GAME_THEME.color.ink,
  },
  topic: {
    fontSize: 12,
    fontWeight: '800',
    color: GAME_THEME.color.goldLip,
  },
  promptPlate: {
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  prompt: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
    letterSpacing: -0.15,
  },
  detailBlock: {
    gap: 8,
  },
  metaChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaChip: {
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 1.5,
    borderColor: GAME_THEME.color.ink,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
    maxWidth: '48%',
  },
  metaChipWide: {
    flexGrow: 1,
    maxWidth: '100%',
  },
  metaChipLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: 'rgba(26,26,26,0.42)',
  },
  metaChipValue: {
    fontSize: 12,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
  },
  answerPlate: {
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  answerPlateWrong: {
    backgroundColor: CORAL_SOFT,
  },
  answerPlateIdeal: {
    backgroundColor: MINT_SOFT,
  },
  answerPlateCompact: {
    marginTop: 0,
  },
  answerPlateHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pairLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  answerWrong: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
    color: '#C23B2C',
  },
  answerIdeal: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
    color: '#1A7A42',
  },
  feedbackPlate: {
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  feedbackText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.78)',
  },
});
