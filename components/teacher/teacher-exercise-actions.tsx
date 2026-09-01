import { StyleSheet, View } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { TeacherExamplesCta } from '@/components/teacher/teacher-examples-cta';
import { TeacherExamplesSheet } from '@/components/teacher/teacher-examples-sheet';
import { TeacherExerciseCta } from '@/components/teacher/teacher-exercise-cta';
import { useTranslation } from '@/contexts/locale-context';
import { postTeacherVocabExamples } from '@/services/companion-chat-ai';
import type { CompanionChatApiLanguage, TeacherVocabWordCard } from '@/types/companion-chat-api';
import type { CompanionMsg } from '@/types/companion-message';
import type { MiniDrillAccess } from '@/utils/teacher-mini-drill-usage';
import {
  estimateVocabWordCount,
  extractTeacherExamples,
} from '@/utils/teacher-message-examples';

type Props = {
  messageId: string;
  exerciseLoadingId: string | null;
  typing: boolean;
  miniAccess: MiniDrillAccess;
  language: CompanionChatApiLanguage;
  uiLanguage: 'ru' | 'en' | 'zh';
  lessonTopic?: string;
  lastUserMessage?: string;
  onPrepare: (message: CompanionMsg) => boolean;
  onPress: (message: CompanionMsg) => void;
  onBlocked: (reason: string) => void;
  message: CompanionMsg;
};

export function TeacherExerciseActions({
  messageId,
  exerciseLoadingId,
  typing,
  miniAccess,
  language,
  uiLanguage,
  lessonTopic,
  lastUserMessage,
  onPrepare,
  onPress,
  onBlocked,
  message,
}: Props) {
  const { t } = useTranslation();
  const [localLoading, setLocalLoading] = useState(false);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [examplesLoading, setExamplesLoading] = useState(false);
  const [examplesError, setExamplesError] = useState<string | null>(null);
  const [vocabWords, setVocabWords] = useState<TeacherVocabWordCard[] | null>(null);
  const cacheRef = useRef<Map<string, TeacherVocabWordCard[]>>(new Map());

  const fallbackGroups = useMemo(
    () => extractTeacherExamples(message.text, message.id),
    [message.id, message.text],
  );
  const exampleCount = useMemo(() => {
    if (vocabWords?.length) return vocabWords.length;
    return estimateVocabWordCount(message.text);
  }, [message.text, vocabWords]);

  const loadExamples = useCallback(async () => {
    const cached = cacheRef.current.get(message.id);
    if (cached) {
      setVocabWords(cached);
      setExamplesError(null);
      setExamplesLoading(false);
      return;
    }

    setExamplesLoading(true);
    setExamplesError(null);
    try {
      const { words } = await postTeacherVocabExamples({
        explanation: message.text,
        language,
        uiLanguage,
        lessonTopic,
        lastUserMessage,
      });
      cacheRef.current.set(message.id, words);
      setVocabWords(words);
    } catch (e) {
      setVocabWords(null);
      setExamplesError(e instanceof Error ? e.message : t('teacher.examples.loadFailed'));
    } finally {
      setExamplesLoading(false);
    }
  }, [language, lastUserMessage, lessonTopic, message.id, message.text, t, uiLanguage]);

  useEffect(() => {
    if (!examplesOpen) return;
    void loadExamples();
  }, [examplesOpen, loadExamples]);

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
    setLocalLoading(true);
    if (!onPrepare(message)) {
      setLocalLoading(false);
      return;
    }
    onPress(message);
  };

  return (
    <>
      <View style={styles.wrap} collapsable={false}>
        <View style={styles.row}>
          <TeacherExerciseCta
            loading={loading}
            disabled={blockedByOther}
            exhausted={exhausted}
            isRepeat={miniAccess.isRepeat}
            refreshesLeft={miniAccess.refreshesLeft}
            onPress={activate}
            style={styles.cta}
          />
          <TeacherExamplesCta
            count={exampleCount > 0 ? exampleCount : undefined}
            onPress={() => setExamplesOpen(true)}
          />
        </View>
      </View>
      <TeacherExamplesSheet
        visible={examplesOpen}
        words={vocabWords}
        fallbackGroups={fallbackGroups}
        loading={examplesLoading}
        error={examplesError}
        onRetry={() => void loadExamples()}
        onClose={() => setExamplesOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignSelf: 'stretch',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  cta: {
    flex: 1,
  },
});
