import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image as ExpoImage, type ImageSource } from 'expo-image';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameGoldButton } from '@/components/game/game-gold-button';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';
import { TEARZ_MARIO } from '@/components/game/tearz-mario-source';
import { GAME_THEME } from '@/constants/game-theme';
import { TearzThinking } from '@/components/teacher/tearz-thinking';
import { useTranslation } from '@/contexts/locale-context';
import { useCompanionVoiceRecorder } from '@/hooks/use-companion-voice-recorder';
import { postCompanionVoiceTranscribe } from '@/services/companion-voice-transcribe';
import { teacherUiLanguageFromLocale } from '@/utils/teacher-ui-language';
import type {
  CompanionChatApiLanguage,
  TeacherDrillFollowUp,
  TeacherExerciseCheckSuccessBody,
  TeacherExerciseItem,
  TeacherNextTopicRecommendation,
} from '@/types/companion-chat-api';
import { postTeacherDrillFollowUp } from '@/services/companion-chat-ai';
import { buildLocalDrillFollowUp } from '@/utils/teacher-drill-followup';
import type { TeacherDrillMistakeItem } from '@/utils/teacher-drill-mistakes';
import { DRILL, drillShellStyles } from '@/components/teacher/teacher-drill-styles';
import { EXERCISE_KIND_META } from '@/components/teacher/teacher-exercise-kind-meta';
import { TeacherExerciseTaskBody } from '@/components/teacher/teacher-exercise-task-body';
import {
  isChoiceExerciseKind,
  isFormExerciseKind,
} from '@/utils/teacher-exercise-kinds';
import { WordDragProvider } from '@/components/teacher/teacher-word-drag';
import {
  buildExerciseCheckPayload,
  emptyExerciseAnswerState,
  exerciseHasCompleteAnswer,
  type ExerciseAnswerState,
} from '@/utils/teacher-exercise-normalize';

const CHOICE_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

const AnimatedExpoImage = Animated.createAnimatedComponent(ExpoImage);

/** Анимированный Mario Tearz. */
function AnimatedMarioTearz({ source, size }: { source: ImageSource; size: number }) {
  const bob = useSharedValue(0);

  useEffect(() => {
    bob.value = withRepeat(
      withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [bob]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -4 * bob.value }] }));

  return (
    <AnimatedExpoImage
      source={source}
      contentFit="contain"
      style={[{ width: size, height: size }, style]}
    />
  );
}

function DrillHeader({
  total,
  index,
  finished,
  onClose,
}: {
  total: number;
  index: number;
  finished: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const progress = finished ? 1 : (index + 1) / total;

  return (
    <View style={styles.header}>
      <View style={styles.titleBar}>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          style={({ pressed }) => [styles.headerSideBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('teacher.drill.closeA11y')}>
          <Ionicons name="chevron-down" size={22} color={GAME_THEME.color.ink} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{t('teacher.drill.title')}</Text>
          <Text style={styles.headerMeta}>
            {finished
              ? t('teacher.drill.summary')
              : t('teacher.drill.of', { current: index + 1, total })}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
    </View>
  );
}

function DrillFeedback({
  result,
  voiceTranscript,
}: {
  result: TeacherExerciseCheckSuccessBody;
  voiceTranscript: string;
}) {
  const { t } = useTranslation();
  const ok = result.correct;

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.feedback}>
      <View style={styles.fbRow}>
        <AnimatedMarioTearz source={ok ? TEARZ_MARIO.jump : TEARZ_MARIO.phone} size={108} />
        <View style={[styles.fbBubble, ok ? styles.fbBubbleOk : styles.fbBubbleWarn]}>
          <View style={[styles.fbTail, ok ? styles.fbTailOk : styles.fbTailWarn]} />
          <Text style={styles.fbTitle}>{result.title}</Text>
          {result.feedback ? <Text style={styles.fbText}>{result.feedback}</Text> : null}

          {result.idealAnswer && !ok ? (
            <View style={styles.fbAnswer}>
              <Text style={styles.fbAnswerLabel}>{t('teacher.drill.idealAnswer')}</Text>
              <Text style={styles.fbAnswerText}>{result.idealAnswer}</Text>
            </View>
          ) : null}

          {voiceTranscript ? (
            <Text style={styles.fbMeta}>
              {t('teacher.drill.transcript')} · {voiceTranscript}
            </Text>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

type VoiceCapture = { uri: string; durationMs: number };

function formatRecordMs(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function DrillVoiceAnswer({
  disabled,
  capture,
  onCapture,
}: {
  disabled: boolean;
  capture: VoiceCapture | null;
  onCapture: (next: VoiceCapture | null) => void;
}) {
  const { t } = useTranslation();
  const voice = useCompanionVoiceRecorder();
  const recording = voice.isRecording;

  const finishRecording = useCallback(async () => {
    const next = await voice.stopRecording();
    if (next) {
      onCapture(next);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [onCapture, voice]);

  const startRecording = useCallback(async () => {
    if (disabled || capture) return;
    const ok = await voice.startRecording(() => {
      void finishRecording();
    });
    if (ok) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [capture, disabled, finishRecording, voice]);

  const handlePressOut = useCallback(() => {
    if (recording) void finishRecording();
  }, [finishRecording, recording]);

  const handleRetake = useCallback(() => {
    void voice.cancelRecording();
    onCapture(null);
    void Haptics.selectionAsync();
  }, [onCapture, voice]);

  if (capture) {
    return (
      <View style={styles.voicePanel}>
        <View style={styles.voiceReadyRow}>
          <View style={styles.voiceReadyIcon}>
            <Ionicons name="checkmark" size={16} color={GAME_THEME.color.ink} />
          </View>
          <View style={styles.voiceReadyCopy}>
            <Text style={styles.voiceReadyTitle}>{t('teacher.drill.voiceReady')}</Text>
            <Text style={styles.voiceReadyMeta}>{formatRecordMs(capture.durationMs)}</Text>
          </View>
        </View>
        <Pressable
          onPress={handleRetake}
          disabled={disabled}
          style={({ pressed }) => [styles.voiceRetakeBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('teacher.drill.voiceRetakeA11y')}>
          <Ionicons name="refresh" size={15} color={GAME_THEME.color.ink} />
          <Text style={styles.voiceRetakeText}>{t('teacher.drill.voiceRetake')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.voicePanel}>
      <Pressable
        onPressIn={() => void startRecording()}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={({ pressed }) => [
          styles.voiceMicOuter,
          recording && styles.voiceMicOuterActive,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('teacher.drill.voiceHoldA11y')}>
        <View style={[styles.voiceMicBtn, recording && styles.voiceMicBtnActive]}>
          <Ionicons name="mic" size={26} color={recording ? GAME_THEME.color.cream : GAME_THEME.color.ink} />
        </View>
      </Pressable>
      <Text style={styles.voiceHint}>
        {recording
          ? t('teacher.drill.voiceRecording', { time: formatRecordMs(voice.durationMs) })
          : t('teacher.drill.voiceHold')}
      </Text>
    </View>
  );
}

type DrillSummary = { correct: number; total: number };

type DrillFollowUpContext = {
  explanation: string;
  lessonTopic?: string;
  language: CompanionChatApiLanguage;
  uiLanguage: 'ru' | 'en' | 'zh';
  recentMistakes?: TeacherDrillMistakeItem[];
};

type Props = {
  visible: boolean;
  sessionKey: string;
  exercises: TeacherExerciseItem[];
  nextTopic?: TeacherNextTopicRecommendation | null;
  followUpContext?: DrillFollowUpContext | null;
  transcribeLanguage: CompanionChatApiLanguage;
  onClose: (summary: DrillSummary | null) => void;
  onNextTopicPress?: (topic: TeacherNextTopicRecommendation) => void;
  onFollowUpPress?: (followUp: TeacherDrillFollowUp) => void;
  onMistakesRecorded?: (mistakes: TeacherDrillMistakeItem[]) => void;
  onCheck: (payload: {
    exercise: string;
    answer: string;
    item: TeacherExerciseItem;
    learnerAnswers: ExerciseAnswerState;
  }) => Promise<TeacherExerciseCheckSuccessBody>;
};

function ChoiceOption({
  label,
  selected,
  disabled,
  onPress,
  letter,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
  letter: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.choiceRow,
        selected && styles.choiceRowSelected,
        disabled && styles.choiceRowDisabled,
        pressed && !disabled && styles.pressed,
      ]}>
      <View style={[styles.choiceLetter, selected && styles.choiceLetterSelected]}>
        <Text style={[styles.choiceLetterText, selected && styles.choiceLetterTextSelected]}>{letter}</Text>
      </View>
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function TeacherExerciseDrill({
  visible,
  sessionKey,
  exercises,
  nextTopic,
  followUpContext,
  transcribeLanguage,
  onClose,
  onNextTopicPress,
  onFollowUpPress,
  onMistakesRecorded,
  onCheck,
}: Props) {
  const { t, locale } = useTranslation();
  const uiLanguage = teacherUiLanguageFromLocale(locale);
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 10);
  const { animatedStyle: keyboardInsetStyle, isOpen: keyboardOpen } = useKeyboardInset(bottomInset);
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [answerState, setAnswerState] = useState<ExerciseAnswerState>(emptyExerciseAnswerState());
  const [activeBlankId, setActiveBlankId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<TeacherExerciseCheckSuccessBody | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [sessionMistakes, setSessionMistakes] = useState<TeacherDrillMistakeItem[]>([]);
  const [followUp, setFollowUp] = useState<TeacherDrillFollowUp | null>(null);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const mistakesRecordedRef = useRef(false);
  const [finished, setFinished] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const blankRefs = useRef<Record<string, TextInput | null>>({});

  const patchAnswerState = useCallback((patch: Partial<ExerciseAnswerState>) => {
    setAnswerState((prev) => ({ ...prev, ...patch }));
    setResult((prev) => (prev ? null : prev));
  }, []);

  const open = visible && exercises.length > 0;
  const total = exercises.length;
  const current = exercises[index] ?? null;
  const keyboardScrollKind =
    current?.kind === 'write_sentences' ||
    current?.kind === 'free_text' ||
    current?.kind === 'fill_partial_word';

  useEffect(() => {
    if (!keyboardOpen || !keyboardScrollKind) return;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 90);
    return () => clearTimeout(timer);
  }, [keyboardOpen, keyboardScrollKind, index]);

  const resetCardState = useCallback(() => {
    setAnswerState(emptyExerciseAnswerState());
    setActiveBlankId(null);
    setVoiceTranscript('');
    setResult(null);
    setChecking(false);
  }, []);

  const resetAll = useCallback(() => {
    setIndex(0);
    resetCardState();
    setCorrectCount(0);
    setSessionMistakes([]);
    setFollowUp(null);
    setFollowUpLoading(false);
    mistakesRecordedRef.current = false;
    setFinished(false);
  }, [resetCardState]);

  useEffect(() => {
    if (!open) return;
    setIndex(0);
    resetCardState();
    setCorrectCount(0);
    setSessionMistakes([]);
    setFollowUp(null);
    setFollowUpLoading(false);
    mistakesRecordedRef.current = false;
    setFinished(false);
  }, [open, resetCardState, sessionKey]);

  useEffect(() => {
    if (!finished) return;
    if (sessionMistakes.length > 0 && !mistakesRecordedRef.current) {
      mistakesRecordedRef.current = true;
      onMistakesRecorded?.(sessionMistakes);
    }

    let cancelled = false;
    setFollowUpLoading(true);
    void (async () => {
      try {
        const { followUp: nextFollowUp } = await postTeacherDrillFollowUp({
          correct: correctCount,
          total,
          sessionMistakes,
          recentMistakes: followUpContext?.recentMistakes,
          explanation: followUpContext?.explanation,
          lessonTopic: followUpContext?.lessonTopic,
          language: followUpContext?.language,
          uiLanguage: followUpContext?.uiLanguage,
          nextTopic: nextTopic ?? undefined,
        });
        if (!cancelled) setFollowUp(nextFollowUp);
      } catch {
        if (!cancelled) {
          setFollowUp(buildLocalDrillFollowUp(correctCount, total, sessionMistakes, nextTopic));
        }
      } finally {
        if (!cancelled) setFollowUpLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    correctCount,
    finished,
    followUpContext,
    nextTopic,
    onMistakesRecorded,
    sessionMistakes,
    total,
  ]);

  const canCheck = useMemo(() => {
    if (!current || checking || result) return false;
    return exerciseHasCompleteAnswer(current, answerState);
  }, [answerState, checking, current, result]);

  const focusBlank = useCallback((id: string) => {
    setActiveBlankId(id);
    blankRefs.current[id]?.focus();
    void Haptics.selectionAsync();
  }, []);

  const handleCheck = useCallback(async () => {
    if (!current || !canCheck) return;
    setChecking(true);
    try {
      let answerText = '';
      if (current.kind === 'voice_recording' && answerState.voiceCapture) {
        const transcript = await postCompanionVoiceTranscribe(
          answerState.voiceCapture.uri,
          transcribeLanguage,
          uiLanguage,
        );
        setVoiceTranscript(transcript);
        answerText = transcript;
      }
      const payload = buildExerciseCheckPayload(current, answerState, answerText);
      const check = await onCheck(payload);
      setResult(check);
      if (check.correct) {
        setCorrectCount((c) => c + 1);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setSessionMistakes((prev) => [
          ...prev,
          {
            kind: current.kind,
            checkText: current.checkText,
            learnerAnswer: payload.answer,
            idealAnswer: check.idealAnswer,
            feedback: check.feedback,
          },
        ]);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('teacher.drill.networkError');
      setResult({
        correct: false,
        title: t('teacher.drill.checkFailed'),
        feedback: msg,
      });
    } finally {
      setChecking(false);
    }
  }, [
    answerState,
    canCheck,
    current,
    onCheck,
    t,
    transcribeLanguage,
    uiLanguage,
  ]);

  const handleContinue = useCallback(() => {
    if (!result) return;
    Keyboard.dismiss();
    const next = index + 1;
    if (next >= total) {
      setFinished(true);
      return;
    }
    resetCardState();
    setIndex(next);
  }, [index, resetCardState, result, total]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    const summary = finished || result ? { correct: correctCount, total } : null;
    resetAll();
    onClose(summary);
  }, [correctCount, finished, onClose, resetAll, result, total]);

  const handleFinish = useCallback(() => {
    Keyboard.dismiss();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const summary = { correct: correctCount, total };
    resetAll();
    onClose(summary);
  }, [correctCount, onClose, resetAll, total]);

  const handleFollowUpPress = useCallback(() => {
    if (!followUp) return;
    Keyboard.dismiss();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const summary = { correct: correctCount, total };
    const picked = followUp;
    resetAll();
    onClose(summary);
    onFollowUpPress?.(picked);
  }, [correctCount, followUp, onClose, onFollowUpPress, resetAll, total]);

  const handleNextTopicPress = useCallback(() => {
    if (!nextTopic?.title?.trim()) return;
    Keyboard.dismiss();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const summary = { correct: correctCount, total };
    const topic = nextTopic;
    resetAll();
    onClose(summary);
    onNextTopicPress?.(topic);
  }, [correctCount, nextTopic, onClose, onNextTopicPress, resetAll, total]);

  if (!open) return null;

  return (
    <View style={styles.overlay}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Animated.View style={[styles.flex, keyboardInsetStyle]}>
        <Pressable style={styles.flex} onPress={Keyboard.dismiss} accessible={false}>
        <WordDragProvider>
        <DrillHeader total={total} index={index} finished={finished} onClose={handleClose} />

        {finished ? (
          <>
            <ScrollView
              style={styles.summaryScroll}
              contentContainerStyle={styles.summaryScrollContent}
              showsVerticalScrollIndicator={false}>
            <View style={styles.summaryBody}>
              <Text style={styles.summaryEyebrow}>{t('teacher.drill.summary')}</Text>
              <View style={styles.scoreRow}>
                <Text style={styles.summaryScore}>{correctCount}</Text>
                <Text style={styles.scoreSlash}>/</Text>
                <Text style={styles.scoreTotal}>{total}</Text>
              </View>
              <Text style={styles.summarySub}>
                {correctCount === total
                  ? t('teacher.drill.summaryPerfect')
                  : correctCount >= Math.ceil(total / 2)
                    ? t('teacher.drill.summaryGood')
                    : t('teacher.drill.summaryRetry')}
              </Text>

              {sessionMistakes.length > 0 ? (
                <View style={styles.mistakesCard}>
                  <Text style={styles.mistakesEyebrow}>
                    {t('teacher.drill.mistakesTitle', { count: sessionMistakes.length })}
                  </Text>
                  {sessionMistakes.slice(0, 3).map((mistake, mi) => (
                    <View key={`${mistake.checkText}-${mi}`} style={styles.mistakeRow}>
                      <Text style={styles.mistakePrompt} numberOfLines={2}>
                        {mistake.checkText}
                      </Text>
                      {mistake.feedback ? (
                        <Text style={styles.mistakeFeedback} numberOfLines={2}>
                          {mistake.feedback}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}

              {followUpLoading ? (
                <View style={styles.followUpLoading}>
                  <ActivityIndicator color={GAME_THEME.color.ink} />
                  <Text style={styles.followUpLoadingText}>{t('teacher.drill.followUpLoading')}</Text>
                </View>
              ) : followUp ? (
                <Pressable
                  onPress={handleFollowUpPress}
                  style={({ pressed }) => [
                    styles.nextTopicCard,
                    followUp.action !== 'advance' && styles.followUpCardAccent,
                    pressed && styles.nextTopicCardPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={followUp.title}>
                  <View style={styles.nextTopicHeader}>
                    <View style={styles.nextTopicHeading}>
                      <Text style={styles.nextTopicEyebrowAccent}>
                        {followUp.action === 'repeat_same'
                          ? t('teacher.drill.followUpRepeatEyebrow')
                          : followUp.action === 'review_gaps'
                            ? t('teacher.drill.followUpReviewEyebrow')
                            : t('teacher.drill.nextTopicFor')}
                      </Text>
                      <Text style={styles.nextTopicEyebrow}>
                        {followUp.action === 'advance'
                          ? t('teacher.drill.nextTopic')
                          : t('teacher.drill.followUpAction')}
                      </Text>
                    </View>
                    <View style={styles.nextTopicArrow}>
                      <Ionicons
                        name={
                          followUp.action === 'repeat_same'
                            ? 'refresh'
                            : followUp.action === 'review_gaps'
                              ? 'book'
                              : 'arrow-forward'
                        }
                        size={16}
                        color={GAME_THEME.color.ink}
                      />
                    </View>
                  </View>
                  <Text style={styles.nextTopicTitle}>{followUp.title}</Text>
                  {followUp.reason ? (
                    <Text style={styles.nextTopicLine}>
                      <Text style={styles.nextTopicLabel}>{t('teacher.drill.nextTopicWhy')}</Text>
                      {followUp.reason}
                    </Text>
                  ) : null}
                  {followUp.connection && followUp.action === 'advance' ? (
                    <Text style={styles.nextTopicLine}>
                      <Text style={styles.nextTopicLabel}>{t('teacher.drill.nextTopicLink')}</Text>
                      {followUp.connection}
                    </Text>
                  ) : null}
                  {followUp.focusAreas && followUp.focusAreas.length > 0 && followUp.action !== 'advance' ? (
                    <Text style={styles.nextTopicLine}>
                      <Text style={styles.nextTopicLabel}>{t('teacher.drill.followUpFocus')}</Text>
                      {followUp.focusAreas.join(' · ')}
                    </Text>
                  ) : null}
                  <Text style={styles.nextTopicTapHint}>
                    {followUp.action === 'advance'
                      ? t('teacher.drill.nextTopicTap')
                      : followUp.action === 'repeat_same'
                        ? t('teacher.drill.followUpRepeatTap')
                        : t('teacher.drill.followUpReviewTap')}
                  </Text>
                </Pressable>
              ) : nextTopic?.title ? (
                <Pressable
                  onPress={handleNextTopicPress}
                  style={({ pressed }) => [styles.nextTopicCard, pressed && styles.nextTopicCardPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('teacher.drill.nextTopicFor')} ${t('teacher.drill.nextTopic')}: ${nextTopic.title}`}>
                  <View style={styles.nextTopicHeader}>
                    <View style={styles.nextTopicHeading}>
                      <Text style={styles.nextTopicEyebrowAccent}>{t('teacher.drill.nextTopicFor')}</Text>
                      <Text style={styles.nextTopicEyebrow}>{t('teacher.drill.nextTopic')}</Text>
                    </View>
                    <View style={styles.nextTopicArrow}>
                      <Ionicons name="arrow-forward" size={16} color={GAME_THEME.color.ink} />
                    </View>
                  </View>
                  <Text style={styles.nextTopicTitle}>{nextTopic.title}</Text>
                  {nextTopic.reason ? (
                    <Text style={styles.nextTopicLine}>
                      <Text style={styles.nextTopicLabel}>{t('teacher.drill.nextTopicWhy')}</Text>
                      {nextTopic.reason}
                    </Text>
                  ) : null}
                  {nextTopic.connection ? (
                    <Text style={styles.nextTopicLine}>
                      <Text style={styles.nextTopicLabel}>{t('teacher.drill.nextTopicLink')}</Text>
                      {nextTopic.connection}
                    </Text>
                  ) : null}
                  <Text style={styles.nextTopicTapHint}>{t('teacher.drill.nextTopicTap')}</Text>
                </Pressable>
              ) : null}
            </View>
            </ScrollView>

            <View style={styles.footer}>
              <Pressable
                onPress={handleFinish}
                style={({ pressed }) => [styles.summaryCloseBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={t('teacher.drill.backToLesson')}>
                <Text style={styles.summaryCloseText}>{t('teacher.drill.backToLesson')}</Text>
                <Ionicons name="arrow-forward" size={17} color={GAME_THEME.color.ink} />
              </Pressable>
            </View>
          </>
        ) : current ? (
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              keyboardOpen && keyboardScrollKind ? styles.scrollContentKeyboard : null,
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}>
            <View style={styles.stage}>
              {!result ? (
                <View style={styles.coach}>
                  <TearzThinking size={96} />
                </View>
              ) : null}
              <View key={`${sessionKey}-${index}`} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.typeBadge}>
                    <Ionicons
                      name={EXERCISE_KIND_META[current.kind]?.icon ?? 'help-outline'}
                      size={13}
                      color={GAME_THEME.color.cream}
                    />
                    <Text style={styles.typeBadgeText}>
                      {EXERCISE_KIND_META[current.kind]
                        ? t(EXERCISE_KIND_META[current.kind].labelKey)
                        : t('teacher.drill.taskFallback')}
                    </Text>
                  </View>
                  <Text style={styles.cardStep}>
                    {index + 1}/{total}
                  </Text>
                </View>

                {current.instruction && !isFormExerciseKind(current.kind) ? (
                  <Text style={styles.instruction}>{current.instruction}</Text>
                ) : null}

                {!result ? (
                  <TeacherExerciseTaskBody
                    exercise={current}
                    disabled={checking || Boolean(result)}
                    state={answerState}
                    onStateChange={patchAnswerState}
                    blankRefs={blankRefs}
                    onFocusBlank={focusBlank}
                    activeBlankId={activeBlankId}
                    VoiceBlock={DrillVoiceAnswer}
                    voiceCapture={answerState.voiceCapture ?? null}
                    onVoiceCapture={(next) => {
                      patchAnswerState({ voiceCapture: next });
                      setVoiceTranscript('');
                    }}
                  />
                ) : null}

                {isChoiceExerciseKind(current.kind) && current.choices && !result ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>{t('teacher.drill.choices')}</Text>
                    <View style={styles.choicesCol}>
                      {current.choices.map((choice, ci) => (
                        <ChoiceOption
                          key={choice}
                          label={choice}
                          letter={CHOICE_LETTERS[ci] ?? String(ci + 1)}
                          selected={answerState.selectedChoice === choice}
                          disabled={Boolean(result)}
                          onPress={() => {
                            patchAnswerState({ selectedChoice: choice });
                            void Haptics.selectionAsync();
                          }}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
          </ScrollView>
        ) : null}

        {!finished && result ? (
          <DrillFeedback result={result} voiceTranscript={voiceTranscript} />
        ) : null}

        {!finished && current ? (
          <View style={styles.footer}>
            {result ? (
              <GameGoldButton
                onPress={handleContinue}
                size="lg"
                accessibilityLabel={
                  index + 1 >= total ? t('teacher.drill.toSummary') : t('teacher.drill.next')
                }
                style={styles.primaryBtn}>
                <View style={styles.primaryBtnRow}>
                  <Text style={styles.primaryBtnText}>
                    {index + 1 >= total ? t('teacher.drill.toSummary') : t('teacher.drill.next')}
                  </Text>
                  <Ionicons name="arrow-forward" size={17} color={GAME_THEME.color.ink} />
                </View>
              </GameGoldButton>
            ) : (
              <GameGoldButton
                onPress={() => void handleCheck()}
                disabled={!canCheck || checking}
                size="lg"
                accessibilityLabel={
                  current.kind === 'voice_recording'
                    ? t('teacher.drill.checkVoice')
                    : t('teacher.drill.check')
                }
                style={styles.primaryBtn}>
                {checking ? (
                  <ActivityIndicator color={GAME_THEME.color.ink} size="small" />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {current.kind === 'voice_recording'
                      ? t('teacher.drill.checkVoice')
                      : t('teacher.drill.check')}
                  </Text>
                )}
              </GameGoldButton>
            )}
          </View>
        ) : null}
        </WordDragProvider>
        </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  root: {
    flex: 1,
    backgroundColor: GAME_THEME.color.cream,
  },
  flex: {
    flex: 1,
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(26,26,26,0.12)',
    backgroundColor: GAME_THEME.color.cream,
  },
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: 6,
  },
  headerSideBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(26,26,26,0.05)',
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: GAME_THEME.color.ink,
  },
  headerMeta: {
    fontSize: 12,
    color: 'rgba(26,26,26,0.42)',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
    fontWeight: '600',
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(26,26,26,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: GAME_THEME.color.phosphor,
  },
  scroll: {
    flex: 1,
    backgroundColor: GAME_THEME.color.cream,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  scrollContentKeyboard: {
    paddingBottom: 28,
  },
  stage: {
    flexGrow: 1,
    gap: 12,
  },
  coach: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachImg: {
    width: 88,
    height: 88,
  },
  card: drillShellStyles.card,
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typeBadge: drillShellStyles.typeBadge,
  typeBadgeText: drillShellStyles.typeBadgeText,
  cardStep: drillShellStyles.cardStep,
  instruction: drillShellStyles.instruction,
  section: drillShellStyles.section,
  sectionLabel: drillShellStyles.sectionLabel,
  promptPlain: {
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: GAME_THEME.color.ink,
  },
  inlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    rowGap: 8,
    columnGap: 2,
  },
  promptText: {
    fontSize: 21,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.35,
    color: GAME_THEME.color.ink,
  },
  blankShell: {
    minWidth: 80,
    minHeight: 40,
    maxWidth: '100%',
    borderRadius: 6,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    borderBottomWidth: 3,
    borderBottomColor: GAME_THEME.color.goldLip,
    paddingHorizontal: 10,
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  blankShellFocused: {
    borderColor: GAME_THEME.color.ink,
    backgroundColor: GAME_THEME.color.paperWarm,
  },
  blankShellFilled: {
    borderColor: GAME_THEME.color.ink,
    backgroundColor: GAME_THEME.color.paperWarm,
  },
  blankInput: {
    minWidth: 56,
    padding: 0,
    margin: 0,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    letterSpacing: -0.25,
    color: GAME_THEME.color.ink,
    textAlign: 'center',
  },
  bankRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bankChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    borderBottomWidth: 3,
    borderBottomColor: GAME_THEME.color.goldLip,
  },
  bankChipPressed: {
    backgroundColor: GAME_THEME.color.paperWarm,
    transform: [{ translateY: 1 }],
  },
  bankChipText: {
    fontSize: 14,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
  },
  choicesCol: drillShellStyles.choicesCol,
  choiceRow: drillShellStyles.choiceRow,
  choiceRowSelected: drillShellStyles.choiceRowSelected,
  choiceRowDisabled: drillShellStyles.choiceRowDisabled,
  choiceLetter: drillShellStyles.choiceLetter,
  choiceLetterSelected: drillShellStyles.choiceLetterSelected,
  choiceLetterText: drillShellStyles.choiceLetterText,
  choiceLetterTextSelected: drillShellStyles.choiceLetterTextSelected,
  choiceText: drillShellStyles.choiceText,
  choiceTextSelected: drillShellStyles.choiceTextSelected,
  freeInput: {
    minHeight: 120,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: GAME_THEME.color.paper,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: GAME_THEME.color.ink,
    textAlignVertical: 'top',
  },
  voicePanel: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 12,
  },
  voiceMicOuter: {
    width: 96,
    height: 96,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: GAME_THEME.color.ink,
    backgroundColor: GAME_THEME.color.paper,
  },
  voiceMicOuterActive: {
    borderColor: GAME_THEME.color.ink,
    backgroundColor: GAME_THEME.color.paperWarm,
  },
  voiceMicBtn: {
    width: 68,
    height: 68,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  voiceMicBtnActive: {
    backgroundColor: GAME_THEME.color.ink,
    borderColor: GAME_THEME.color.ink,
  },
  voiceHint: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.5)',
    textAlign: 'center',
  },
  voiceReadyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    alignSelf: 'stretch',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 6,
    backgroundColor: DRILL.successBg,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  voiceReadyIcon: {
    width: 32,
    height: 32,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GAME_THEME.color.phosphor,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  voiceReadyCopy: {
    flex: 1,
    gap: 2,
  },
  voiceReadyTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
    color: GAME_THEME.color.ink,
  },
  voiceReadyMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(26,26,26,0.45)',
    fontVariant: ['tabular-nums'],
  },
  voiceRetakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  voiceRetakeText: {
    fontSize: 13,
    color: GAME_THEME.color.ink,
    fontWeight: '800',
  },
  feedback: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: GAME_THEME.color.cream,
  },
  fbRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  fbBubble: {
    flex: 1,
    marginLeft: -6,
    marginBottom: 10,
    padding: 16,
    borderRadius: 6,
    backgroundColor: GAME_THEME.color.paper,
    borderWidth: 3,
    borderColor: GAME_THEME.color.ink,
    gap: 6,
  },
  fbBubbleOk: {
    backgroundColor: DRILL.successBg,
  },
  fbBubbleWarn: {
    backgroundColor: 'rgba(232,93,76,0.12)',
  },
  fbTail: {
    position: 'absolute',
    left: -7,
    bottom: 22,
    width: 0,
    height: 0,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderRightWidth: 9,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: GAME_THEME.color.paper,
  },
  fbTailOk: {
    borderRightColor: DRILL.successBg,
  },
  fbTailWarn: {
    borderRightColor: 'rgba(232,93,76,0.12)',
  },
  fbTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
    color: GAME_THEME.color.ink,
  },
  fbText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: -0.1,
    color: 'rgba(26,26,26,0.62)',
  },
  fbAnswer: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: 'rgba(26,26,26,0.12)',
    gap: 3,
  },
  fbAnswerLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: 'rgba(26,26,26,0.45)',
  },
  fbAnswerText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: -0.18,
    color: GAME_THEME.color.ink,
  },
  fbMeta: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.4)',
  },
  footer: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: GAME_THEME.color.cream,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(26,26,26,0.1)',
  },
  primaryBtn: {
    alignSelf: 'stretch',
  },
  primaryBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.2,
    color: GAME_THEME.color.ink,
  },
  pressed: {
    opacity: 0.82,
  },
  summaryBody: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 14,
    backgroundColor: GAME_THEME.color.cream,
  },
  summaryScroll: {
    flex: 1,
  },
  summaryScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 8,
  },
  mistakesCard: {
    width: '100%',
    borderRadius: DRILL.radiusControl,
    borderWidth: GAME_THEME.border.thin,
    borderColor: 'rgba(198, 40, 40, 0.28)',
    backgroundColor: 'rgba(255, 235, 238, 0.55)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  mistakesEyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: 'rgba(198, 40, 40, 0.85)',
  },
  mistakeRow: {
    gap: 2,
  },
  mistakePrompt: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
    color: GAME_THEME.color.ink,
  },
  mistakeFeedback: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.62)',
  },
  followUpLoading: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  followUpLoadingText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.55)',
  },
  followUpCardAccent: {
    borderColor: 'rgba(255, 152, 0, 0.45)',
    backgroundColor: 'rgba(255, 243, 224, 0.75)',
  },
  summaryEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    color: 'rgba(26,26,26,0.45)',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 4,
  },
  summaryScore: {
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: -2,
    color: GAME_THEME.color.ink,
    fontVariant: ['tabular-nums'],
  },
  scoreSlash: {
    fontSize: 24,
    fontWeight: '700',
    color: 'rgba(26,26,26,0.3)',
  },
  scoreTotal: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: 'rgba(26,26,26,0.45)',
    fontVariant: ['tabular-nums'],
  },
  summarySub: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.55)',
    textAlign: 'center',
    maxWidth: 300,
    alignSelf: 'center',
  },
  nextTopicCard: {
    marginTop: 12,
    padding: 18,
    borderRadius: 6,
    backgroundColor: GAME_THEME.color.paper,
    borderWidth: 3,
    borderColor: GAME_THEME.color.ink,
    gap: 10,
    maxWidth: 340,
    alignSelf: 'center',
    width: '100%',
  },
  nextTopicEyebrowAccent: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.06,
    color: GAME_THEME.color.ink,
  },
  nextTopicEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.04,
    color: 'rgba(26,26,26,0.45)',
  },
  nextTopicHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  nextTopicHeading: {
    flex: 1,
    gap: 2,
  },
  nextTopicCardPressed: {
    opacity: 0.9,
    backgroundColor: GAME_THEME.color.paperWarm,
  },
  nextTopicArrow: {
    width: 30,
    height: 30,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    marginTop: 2,
  },
  nextTopicTitle: {
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.38,
    color: GAME_THEME.color.ink,
    lineHeight: 26,
  },
  nextTopicLine: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.55)',
  },
  nextTopicLabel: {
    color: 'rgba(26,26,26,0.4)',
    fontWeight: '800',
  },
  nextTopicTapHint: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(26,26,26,0.35)',
    marginTop: 2,
  },
  summaryCloseBtn: {
    minHeight: 52,
    borderRadius: GAME_THEME.radius.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    borderWidth: GAME_THEME.border.thin,
    borderColor: GAME_THEME.color.ink,
    backgroundColor: GAME_THEME.color.cream,
  },
  summaryCloseText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.1,
    color: GAME_THEME.color.ink,
  },
});
