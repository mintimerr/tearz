import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LongPressWordText } from '@/components/long-press-word-text';
import { GAME_THEME } from '@/constants/game-theme';
import { useTranslation } from '@/contexts/locale-context';
import type { TeacherVocabWordCard } from '@/types/companion-chat-api';
import type { TeacherExampleGroup } from '@/utils/teacher-message-examples';
import type { TeacherSectionIcon } from '@/utils/teacher-message-sections';

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

type Props = {
  visible: boolean;
  onClose: () => void;
  words: TeacherVocabWordCard[] | null;
  fallbackGroups: TeacherExampleGroup[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

function VocabWordCard({ card, index }: { card: TeacherVocabWordCard; index: number }) {
  const { t } = useTranslation();
  const showPinyin = Boolean(card.pinyin || card.sentences.some((s) => s.pinyin));

  return (
    <View style={styles.wordCard}>
      <View style={styles.wordCardStripe} />
      <View style={styles.wordHero}>
        <View style={styles.wordIndex}>
          <Text style={styles.wordIndexText}>{index + 1}</Text>
        </View>
        <View style={styles.wordHeroCopy}>
          <LongPressWordText text={card.word} style={styles.wordHead} />
          {showPinyin && card.pinyin ? <Text style={styles.wordPinyin}>{card.pinyin}</Text> : null}
          <LongPressWordText text={card.gloss} style={styles.wordGloss} />
        </View>
      </View>

      <View style={styles.usageHeader}>
        <Ionicons name="chatbubble-ellipses-outline" size={13} color={GAME_THEME.color.ink} />
        <Text style={styles.usageTitle}>
          {t('teacher.examples.usageTitle', { count: card.sentences.length })}
        </Text>
      </View>

      <View style={styles.sentenceList}>
        {card.sentences.map((sentence, sentenceIndex) => (
          <View key={`${card.word}-${sentenceIndex}`} style={styles.sentenceCard}>
            <View style={styles.sentenceIndex}>
              <Text style={styles.sentenceIndexText}>{sentenceIndex + 1}</Text>
            </View>
            <View style={styles.sentenceCopy}>
              <LongPressWordText text={sentence.l2} style={styles.sentenceL2} />
              {sentence.pinyin ? <Text style={styles.sentencePinyin}>{sentence.pinyin}</Text> : null}
              <LongPressWordText text={sentence.translation} style={styles.sentenceTr} />
              {sentence.note ? <Text style={styles.sentenceNote}>{sentence.note}</Text> : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export function TeacherExamplesSheet({
  visible,
  onClose,
  words,
  fallbackGroups,
  loading,
  error,
  onRetry,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  const richWords = words ?? [];
  const totalSentences = richWords.reduce((sum, w) => sum + w.sentences.length, 0);
  const hasRich = richWords.length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.host}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel={t('common.close')} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{t('teacher.examples.sheetTitle')}</Text>
              <Text style={styles.subtitle}>
                {loading
                  ? t('teacher.examples.loadingHint')
                  : hasRich
                    ? t('teacher.examples.sheetRichSubtitle', {
                        words: richWords.length,
                        count: totalSentences,
                      })
                    : t('teacher.examples.sheetEmptyHint')}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}>
              <Ionicons name="close" size={18} color={GAME_THEME.color.ink} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {loading ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator size="small" color={GAME_THEME.color.ink} />
                <Text style={styles.loadingText}>{t('teacher.examples.loading')}</Text>
              </View>
            ) : null}

            {error && !loading ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable
                  onPress={onRetry}
                  style={({ pressed }) => [styles.retryBtn, pressed && styles.retryBtnPressed]}>
                  <Text style={styles.retryText}>{t('teacher.examples.retry')}</Text>
                </Pressable>
              </View>
            ) : null}

            {hasRich
              ? richWords.map((card, index) => (
                  <VocabWordCard key={`${card.word}-${index}`} card={card} index={index} />
                ))
              : null}

            {!loading && !hasRich && fallbackGroups.length > 0
              ? fallbackGroups.map((group) => (
                  <View key={`${group.category}-${group.title}`} style={styles.group}>
                    <View style={styles.groupHeader}>
                      <View style={styles.groupIcon}>
                        <Ionicons
                          name={SECTION_IONICON[group.icon]}
                          size={14}
                          color={GAME_THEME.color.ink}
                        />
                      </View>
                      <Text style={styles.groupTitle}>
                        {group.title || t(`teacher.examples.category.${group.category}`)}
                      </Text>
                    </View>
                    <View style={styles.groupBody}>
                      {group.items.map((item) => (
                        <View key={item.id} style={styles.itemCard}>
                          {item.subtext ? (
                            <Text style={styles.itemSpeaker} numberOfLines={1}>
                              {item.subtext}
                            </Text>
                          ) : null}
                          <LongPressWordText text={item.text} style={styles.itemText} />
                        </View>
                      ))}
                    </View>
                  </View>
                ))
              : null}

            {!loading && !hasRich && fallbackGroups.length === 0 && !error ? (
              <View style={styles.emptyCard}>
                <Ionicons name="book-outline" size={28} color="rgba(26,26,26,0.35)" />
                <Text style={styles.emptyText}>{t('teacher.examples.emptyBody')}</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 3,
    borderColor: GAME_THEME.color.ink,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: 'rgba(26,26,26,0.15)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(26,26,26,0.08)',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.2,
    color: GAME_THEME.color.ink,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: 'rgba(26,26,26,0.55)',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GAME_THEME.color.paperWarm,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  closeBtnPressed: {
    opacity: 0.65,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 14,
  },
  loadingCard: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 28,
    borderRadius: 12,
    backgroundColor: GAME_THEME.color.paper,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.55)',
  },
  errorCard: {
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FFF5F5',
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: GAME_THEME.color.ink,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: GAME_THEME.color.sky,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  retryBtnPressed: {
    opacity: 0.7,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
  },
  wordCard: {
    borderRadius: 14,
    backgroundColor: GAME_THEME.color.paper,
    borderWidth: 3,
    borderColor: GAME_THEME.color.ink,
    borderBottomWidth: 5,
    overflow: 'hidden',
  },
  wordCardStripe: {
    height: 5,
    backgroundColor: GAME_THEME.color.sky,
  },
  wordHero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
  },
  wordIndex: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  wordIndexText: {
    fontSize: 13,
    fontWeight: '900',
    color: GAME_THEME.color.ink,
  },
  wordHeroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  wordHead: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: GAME_THEME.color.ink,
  },
  wordPinyin: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.52)',
  },
  wordGloss: {
    marginTop: 2,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: GAME_THEME.color.ink,
  },
  usageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  usageTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: 'rgba(26,26,26,0.55)',
  },
  sentenceList: {
    paddingHorizontal: 10,
    paddingBottom: 12,
    gap: 8,
  },
  sentenceCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    borderLeftWidth: 4,
    borderLeftColor: GAME_THEME.color.sky,
  },
  sentenceIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GAME_THEME.color.paperWarm,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  sentenceIndexText: {
    fontSize: 11,
    fontWeight: '900',
    color: GAME_THEME.color.ink,
  },
  sentenceCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  sentenceL2: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
  },
  sentencePinyin: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: 'rgba(26,26,26,0.5)',
  },
  sentenceTr: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.78)',
  },
  sentenceNote: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: GAME_THEME.color.sky,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: GAME_THEME.color.paper,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    textAlign: 'center',
    color: 'rgba(26,26,26,0.55)',
  },
  group: {
    gap: 8,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GAME_THEME.color.sky,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  groupTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: GAME_THEME.color.ink,
  },
  groupBody: {
    gap: 8,
  },
  itemCard: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: GAME_THEME.color.paper,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  itemSpeaker: {
    marginBottom: 4,
    fontSize: 12,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
    opacity: 0.72,
  },
  itemText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: GAME_THEME.color.ink,
  },
});
