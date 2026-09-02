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

type Props = {
  visible: boolean;
  onClose: () => void;
  words: TeacherVocabWordCard[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

function WordExamples({ card }: { card: TeacherVocabWordCard }) {
  const showPinyin = Boolean(card.pinyin);

  return (
    <View style={styles.wordBlock}>
      <View style={styles.wordRow}>
        <LongPressWordText text={card.word} style={styles.wordLabel} />
        {showPinyin ? <Text style={styles.wordPinyin}>{card.pinyin}</Text> : null}
      </View>

      <View style={styles.sentenceList}>
        {card.sentences.map((sentence, index) => (
          <View key={`${card.word}-${index}`} style={styles.sentenceRow}>
            <LongPressWordText text={sentence.l2} style={styles.sentenceL2} />
            {sentence.pinyin ? <Text style={styles.sentencePinyin}>{sentence.pinyin}</Text> : null}
            <LongPressWordText text={sentence.translation} style={styles.sentenceTr} />
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
  loading,
  error,
  onRetry,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  const richWords = words ?? [];
  const hasRich = richWords.length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.host}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel={t('common.close')} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{t('teacher.examples.sheetTitle')}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}>
              <Ionicons name="close" size={18} color={GAME_THEME.color.ink} />
            </Pressable>
          </View>

          {!loading && hasRich ? (
            <Text style={styles.hint}>{t('teacher.examples.sheetHint')}</Text>
          ) : null}

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
                  <WordExamples key={`${card.word}-${index}`} card={card} />
                ))
              : null}

            {!loading && !hasRich && !error ? (
              <View style={styles.emptyCard}>
                <Ionicons name="chatbubbles-outline" size={28} color="rgba(26,26,26,0.35)" />
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
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.2,
    color: GAME_THEME.color.ink,
  },
  hint: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500',
    color: 'rgba(26,26,26,0.5)',
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
    paddingTop: 4,
    paddingBottom: 12,
    gap: 16,
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
    fontSize: 15,
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
    fontSize: 15,
    lineHeight: 21,
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
    fontSize: 14,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
  },
  wordBlock: {
    gap: 10,
  },
  wordRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: 8,
    paddingHorizontal: 4,
  },
  wordLabel: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
    color: GAME_THEME.color.ink,
  },
  wordPinyin: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.5)',
  },
  sentenceList: {
    gap: 10,
  },
  sentenceRow: {
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: GAME_THEME.color.paper,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    borderLeftWidth: 5,
    borderLeftColor: GAME_THEME.color.sky,
  },
  sentenceL2: {
    fontSize: 19,
    lineHeight: 26,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
  },
  sentencePinyin: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    color: 'rgba(26,26,26,0.48)',
  },
  sentenceTr: {
    marginTop: 2,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.72)',
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
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
    textAlign: 'center',
    color: 'rgba(26,26,26,0.55)',
  },
});
