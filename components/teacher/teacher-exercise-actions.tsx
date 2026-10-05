import { StyleSheet, View } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { GuestSignupSheet } from '@/components/auth/guest-signup-sheet';
import { SpotlightAnchor } from '@/components/onboarding/tearz-spotlight';
import { TeacherExamplesCta } from '@/components/teacher/teacher-examples-cta';
import { TeacherExamplesSheet } from '@/components/teacher/teacher-examples-sheet';
import { TeacherExerciseCta } from '@/components/teacher/teacher-exercise-cta';
import { isGuestAccount, useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/contexts/locale-context';
import { postTeacherVocabExamples } from '@/services/companion-chat-ai';
import type { CompanionChatApiLanguage, TeacherVocabWordCard } from '@/types/companion-chat-api';
import type { CompanionMsg } from '@/types/companion-message';
import type { MiniDrillAccess } from '@/utils/teacher-mini-drill-usage';
import {
  getCachedTeacherExamples,
  setCachedTeacherExamples,
} from '@/utils/teacher-examples-cache';
import { buildLocalVocabExamples } from '@/utils/teacher-local-vocab-examples';
import { filterVocabExamplesNotInExplanation } from '@/utils/teacher-vocab-examples-filter';
import { GUEST_FREE_TRAININGS, loadGuestTrainingsDone } from '@/utils/guest-training-quota';
import { pinyinZhSync } from '@/utils/pinyin-zh';

type Props = {
  messageId: string;
  exerciseLoadingId: string | null;
  typing: boolean;
  miniAccess: MiniDrillAccess;
  language: CompanionChatApiLanguage;
  uiLanguage: 'ru' | 'en' | 'zh';
  lessonTopic?: string;
  lastUserMessage?: string;
  /** Текст с лексикой (может быть из более раннего ответа учителя). */
  examplesExplanation?: string;
  /** Ключ кэша примеров (обычно id сообщения с лексикой). */
  examplesCacheKey?: string;
  /** Скрыть кнопку, если в треде нет слов. */
  examplesAvailable?: boolean;
  onPrepare: (message: CompanionMsg) => boolean;
  onPress: (message: CompanionMsg) => void;
  onBlocked: (reason: string) => void;
  message: CompanionMsg;
  /** Подсветить кнопки один раз, после подсказки про выделение слов. */
  coach?: boolean;
};

function withChinesePinyin(
  words: TeacherVocabWordCard[],
  language: CompanionChatApiLanguage,
): TeacherVocabWordCard[] {
  if (language !== 'chinese') return words;
  return words.map((card) => ({
    ...card,
    pinyin: card.pinyin?.trim() || pinyinZhSync(card.word) || undefined,
    sentences: card.sentences.map((s) => ({
      ...s,
      pinyin: s.pinyin?.trim() || pinyinZhSync(s.l2) || undefined,
    })),
  }));
}

export function TeacherExerciseActions({
  messageId,
  exerciseLoadingId,
  typing,
  miniAccess,
  language,
  uiLanguage,
  lessonTopic,
  lastUserMessage,
  examplesExplanation,
  examplesCacheKey,
  examplesAvailable = true,
  onPrepare,
  onPress,
  onBlocked,
  message,
  coach = false,
}: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [localLoading, setLocalLoading] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [examplesLoading, setExamplesLoading] = useState(false);
  const [examplesUpgrading, setExamplesUpgrading] = useState(false);
  const [examplesError, setExamplesError] = useState<string | null>(null);
  const [vocabWords, setVocabWords] = useState<TeacherVocabWordCard[] | null>(null);
  const apiAttemptRef = useRef(0);
  const vocabWordsRef = useRef<TeacherVocabWordCard[] | null>(null);
  vocabWordsRef.current = vocabWords;

  const explanationText = examplesExplanation?.trim() || message.text;
  const cacheKey = examplesCacheKey || message.id;

  const localFallback = useMemo(
    () => buildLocalVocabExamples(explanationText, language, uiLanguage),
    [explanationText, language, uiLanguage],
  );

  const applyWords = useCallback(
    (words: TeacherVocabWordCard[], opts: { cache?: boolean } = {}) => {
      if (words.length === 0) return;
      const next = withChinesePinyin(words, language);
      if (opts.cache !== false) {
        setCachedTeacherExamples(cacheKey, next);
      }
      setVocabWords(next);
      setExamplesError(null);
    },
    [cacheKey, language],
  );

  const fetchRemoteExamples = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      const cached = getCachedTeacherExamples(cacheKey);
      const cachedFresh = cached?.length
        ? filterVocabExamplesNotInExplanation(cached, explanationText, language)
        : [];
      if (cachedFresh.length > 0) {
        setVocabWords(cachedFresh);
        setExamplesError(null);
        setExamplesLoading(false);
        setExamplesUpgrading(false);
        return;
      }

      const attempt = ++apiAttemptRef.current;
      if (vocabWordsRef.current?.length) setExamplesUpgrading(true);
      else if (!opts.silent) setExamplesLoading(true);
      else setExamplesUpgrading(true);
      setExamplesError(null);

      try {
        const { words } = await postTeacherVocabExamples({
          explanation: explanationText,
          language,
          uiLanguage,
          lessonTopic,
          lastUserMessage,
        });
        if (attempt !== apiAttemptRef.current) return;
        const fresh = filterVocabExamplesNotInExplanation(words, explanationText, language);
        if (fresh.length > 0) {
          applyWords(fresh, { cache: true });
        } else if (!vocabWordsRef.current?.length && localFallback.length > 0) {
          applyWords(localFallback, { cache: false });
        } else if (!vocabWordsRef.current?.length) {
          setExamplesError(t('teacher.examples.emptyBody'));
        }
      } catch {
        if (attempt !== apiAttemptRef.current) return;
        if (!vocabWordsRef.current?.length && localFallback.length > 0) {
          applyWords(localFallback, { cache: false });
        } else if (!vocabWordsRef.current?.length) {
          setExamplesError(
            localFallback.length === 0
              ? t('teacher.examples.noVocabBody')
              : t('teacher.examples.loadFailed'),
          );
        }
      } finally {
        if (attempt !== apiAttemptRef.current) return;
        setExamplesLoading(false);
        setExamplesUpgrading(false);
      }
    },
    [
      applyWords,
      cacheKey,
      explanationText,
      language,
      lastUserMessage,
      lessonTopic,
      localFallback,
      t,
      uiLanguage,
    ],
  );

  useEffect(() => {
    if (!examplesAvailable || !coach) return;
    void fetchRemoteExamples({ silent: true });
  }, [cacheKey, coach, examplesAvailable, fetchRemoteExamples]);

  const openExamples = useCallback(() => {
    const cached = getCachedTeacherExamples(cacheKey);
    const cachedFresh = cached?.length
      ? filterVocabExamplesNotInExplanation(cached, explanationText, language)
      : [];
    if (cachedFresh.length > 0) {
      setVocabWords(cachedFresh);
      setExamplesError(null);
      setExamplesOpen(true);
      return;
    }
    if (localFallback.length > 0) {
      applyWords(localFallback, { cache: false });
      setExamplesOpen(true);
      void fetchRemoteExamples({ silent: true });
      return;
    }
    setVocabWords(null);
    setExamplesError(null);
    setExamplesOpen(true);
    void fetchRemoteExamples({ silent: false });
  }, [
    applyWords,
    cacheKey,
    explanationText,
    fetchRemoteExamples,
    language,
    localFallback,
  ]);

  const loading = localLoading || exerciseLoadingId === messageId;
  const blockedByOther = Boolean(exerciseLoadingId) && exerciseLoadingId !== messageId;
  const exhausted = !miniAccess.allowed;

  useEffect(() => {
    if (exerciseLoadingId === messageId) {
      setLocalLoading(false);
      return;
    }
    if (!localLoading) return;
    const timer = setTimeout(() => setLocalLoading(false), 240);
    return () => clearTimeout(timer);
  }, [exerciseLoadingId, localLoading, messageId]);

  const activate = () => {
    void (async () => {
      if (typing) {
        onBlocked(t('teacher.drill.waitForReply'));
        return;
      }
      if (blockedByOther) {
        onBlocked(t('teacher.drill.generatingInProgress'));
        return;
      }
      if (exhausted) {
        const reason =
          miniAccess.reasonKey === 'refreshLimit'
            ? t('teacher.drill.refreshLimit', { count: miniAccess.reasonCount ?? 0 })
            : miniAccess.reasonKey === 'lessonLimit'
              ? t('teacher.drill.lessonLimit', { count: miniAccess.reasonCount ?? 0 })
              : t('teacher.drill.limitFallback');
        onBlocked(reason);
        return;
      }
      if (isGuestAccount(user)) {
        const done = await loadGuestTrainingsDone();
        if (done >= GUEST_FREE_TRAININGS) {
          setGateOpen(true);
          return;
        }
      }
      setLocalLoading(true);
      if (!onPrepare(message)) {
        setLocalLoading(false);
        return;
      }
      onPress(message);
    })();
  };

  return (
    <>
      <SpotlightAnchor
        tipId="coachTrain3"
        line={t('onboarding.spotTrain')}
        enabled={coach}
        afterTip="coachWords2"
        style={styles.coach}>
      <View style={styles.wrap} collapsable={false}>
        <View style={styles.row}>
          <View style={[styles.slot, !examplesAvailable && styles.slotSolo]}>
            <TeacherExerciseCta
              loading={loading}
              disabled={blockedByOther}
              exhausted={exhausted}
              isRepeat={miniAccess.isRepeat}
              refreshesLeft={miniAccess.refreshesLeft}
              onPress={activate}
              style={styles.btnFill}
            />
          </View>
          {examplesAvailable ? (
            <View style={styles.slot}>
              <TeacherExamplesCta onPress={openExamples} style={styles.btnFill} />
            </View>
          ) : null}
        </View>
      </View>
      </SpotlightAnchor>
      <GuestSignupSheet visible={gateOpen} onClose={() => setGateOpen(false)} />
      <TeacherExamplesSheet
        visible={examplesOpen}
        words={vocabWords}
        loading={examplesLoading}
        upgrading={examplesUpgrading}
        error={examplesError}
        onRetry={() => void fetchRemoteExamples()}
        onClose={() => setExamplesOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  coach: {
    width: '100%',
    alignSelf: 'stretch',
  },
  wrap: {
    width: '100%',
    alignSelf: 'stretch',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  slot: {
    flex: 1,
    minWidth: 0,
  },
  slotSolo: {
    flex: 1,
  },
  btnFill: {
    flex: 1,
    width: '100%',
  },
});
