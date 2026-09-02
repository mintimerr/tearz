import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameGoldButton } from '@/components/game/game-gold-button';
import { TEARZ_MARIO } from '@/components/game/tearz-mario-source';
import { FadeInView } from '@/components/ui';
import { GAME_THEME } from '@/constants/game-theme';
import { translate } from '@/constants/i18n/translations';
import { usePlacement } from '@/contexts/placement-context';
import {
  clearPlacementPrefetch,
  prefetchPlacementStep,
  runPlacementStart,
  runPlacementStep,
  warmPlacementApi,
} from '@/services/placement-step';
import type { CompanionChatApiLanguage } from '@/types/companion-chat-api';
import type {
  PlacementHistoryItem,
  PlacementQuestion,
  PlacementResult,
} from '@/types/placement-api';
import { buildSeenQuestionKeys, isQuestionAlreadySeen, questionContentKey } from '@/utils/placement-seen';
import { PLACEMENT_TOTAL, START_ABILITY } from '@/utils/placement-adaptive';

const LANGUAGES: { id: CompanionChatApiLanguage; labelKey: string; emoji: string }[] = [
  { id: 'french', labelKey: 'lang.french', emoji: '🇫🇷' },
  { id: 'english', labelKey: 'lang.english', emoji: '🇬🇧' },
  { id: 'chinese', labelKey: 'lang.chinese', emoji: '🇨🇳' },
  { id: 'german', labelKey: 'lang.german', emoji: '🇩🇪' },
  { id: 'russian', labelKey: 'lang.russian', emoji: '🇷🇺' },
];

const QUESTION_SECONDS = 60;
const CONFETTI = [
  { left: '8%', top: '12%', color: GAME_THEME.color.sky, delay: 0 },
  { left: '82%', top: '18%', color: '#FFD166', delay: 80 },
  { left: '18%', top: '28%', color: '#FF8FAB', delay: 140 },
  { left: '74%', top: '8%', color: GAME_THEME.color.sky, delay: 200 },
  { left: '90%', top: '34%', color: '#8AFFA8', delay: 60 },
  { left: '6%', top: '38%', color: '#FFD166', delay: 180 },
] as const;

type Phase = 'language' | 'test' | 'result';

const pt = (key: string, params?: Record<string, string | number>) =>
  translate('en', `placement.${key}`, params);

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function useProgressAnim(progress: number) {
  const anim = useRef(new Animated.Value(progress)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: progress,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [anim, progress]);
  return anim;
}

export function PlacementOnboardingScreen() {
  const insets = useSafeAreaInsets();
  const uiLanguage = 'en' as const;
  const { savePlacement } = usePlacement();

  const [phase, setPhase] = useState<Phase>('language');
  const [language, setLanguage] = useState<CompanionChatApiLanguage>('english');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [question, setQuestion] = useState<PlacementQuestion | null>(null);
  const [answerKey, setAnswerKey] = useState<string | null>(null);
  const [ability, setAbility] = useState(START_ABILITY);
  const [history, setHistory] = useState<PlacementHistoryItem[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(PLACEMENT_TOTAL);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<PlacementResult | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_SECONDS);
  const [questionEpoch, setQuestionEpoch] = useState(0);
  const [seenQuestionIds, setSeenQuestionIds] = useState<string[]>([]);
  const [seenPrompts, setSeenPrompts] = useState<string[]>([]);
  const [seenContentKeys, setSeenContentKeys] = useState<string[]>([]);
  const sessionSaltRef = useRef(Date.now());

  const rememberQuestion = useCallback(
    (q: PlacementQuestion) => {
      const contentKey = questionContentKey(q);
      setSeenQuestionIds((prev) => (prev.includes(q.id) ? prev : [...prev, q.id]));
      setSeenPrompts((prev) => (prev.includes(q.prompt) ? prev : [...prev, q.prompt]));
      setSeenContentKeys((prev) => (prev.includes(contentKey) ? prev : [...prev, contentKey]));
      void rememberLifetimeQuestion(language, q);
    },
    [language],
  );

  useEffect(() => {
    let cancelled = false;
    void loadLifetimeSeen(language).then((record) => {
      if (cancelled) return;
      setSeenQuestionIds(record.ids);
      setSeenPrompts(record.prompts);
      setSeenContentKeys(record.contentKeys);
    });
    return () => {
      cancelled = true;
    };
  }, [language]);

  useEffect(() => {
    warmPlacementApi();
  }, []);

  const progress = useMemo(() => {
    if (phase !== 'test' || totalQuestions <= 0) return 0;
    return questionIndex / totalQuestions;
  }, [phase, questionIndex, totalQuestions]);
  const progressAnim = useProgressAnim(progress);
  const levelPop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (phase !== 'result') {
      levelPop.setValue(0);
      return;
    }
    Animated.spring(levelPop, {
      toValue: 1,
      friction: 7,
      tension: 70,
      useNativeDriver: true,
    }).start();
  }, [levelPop, phase, result?.level]);

  const applyStepResult = useCallback(
    (
      res: Awaited<ReturnType<typeof runPlacementStep>>,
      prevQuestion: PlacementQuestion | null,
    ) => {
      setAbility(res.ability);
      if (res.done) {
        setResult(res.result);
        void savePlacement({
          completedAt: Date.now(),
          language,
          level: res.result.level,
          score: res.result.score,
          summary: res.result.summary,
          hskLevel: res.result.hskLevel,
        });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setPhase('result');
        return;
      }

      if (prevQuestion) {
        setHistory((prev) => {
          if (
            prev.some(
              (h) => h.questionId === prevQuestion.id || h.prompt === prevQuestion.prompt,
            )
          ) {
            return prev;
          }
          return [
            ...prev,
            {
              section: prevQuestion.section,
              difficulty: prevQuestion.difficulty,
              correct: typeof res.correct === 'boolean' ? res.correct : false,
              prompt: prevQuestion.prompt,
              questionId: prevQuestion.id,
              choices: prevQuestion.choices,
            },
          ];
        });
      }

      const seen = buildSeenQuestionKeys(history);
      for (const id of seenQuestionIds) seen.ids.add(id);
      for (const prompt of seenPrompts) seen.prompts.add(prompt);
      for (const key of seenContentKeys) seen.contents.add(key);
      if (isQuestionAlreadySeen(res.question, seen)) {
        setError(pt('error'));
        return;
      }

      if (prevQuestion?.prompt === res.question.prompt || prevQuestion?.id === res.question.id) {
        setError(pt('error'));
        return;
      }

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setQuestion(res.question);
      setAnswerKey(res.answerKey);
      setQuestionIndex(res.questionIndex);
      setTotalQuestions(res.totalQuestions);
      setSelected(null);
      setSecondsLeft(QUESTION_SECONDS);
      setQuestionEpoch((n) => n + 1);
      rememberQuestion(res.question);
    },
    [language, rememberQuestion, savePlacement, history, seenContentKeys, seenPrompts, seenQuestionIds],
  );

  const submitAnswer = useCallback(
    async (forcedAnswer?: string | null, timedOut = false) => {
      if (!question || !answerKey || checking) return;
      const answer = forcedAnswer ?? selected;
      if (!answer && !timedOut) return;

      setChecking(true);
      setError(null);
      void Haptics.impactAsync(
        timedOut ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
      );

      const prevQuestion = question;
      try {
        const res = await runPlacementStep({
          action: 'answer',
          language,
          uiLanguage,
          ability,
          history,
          answer: answer ?? '',
          answerKey,
          questionIndex,
          timedOut,
          seenQuestionIds: [...seenQuestionIds, question.id],
          seenPrompts: [...seenPrompts, question.prompt],
          seenContentKeys: [...seenContentKeys, questionContentKey(question)],
          sessionSalt: sessionSaltRef.current,
          lastQuestion: {
            id: question.id,
            prompt: question.prompt,
            section: question.section,
            difficulty: question.difficulty,
            choices: question.choices,
          },
        });
        applyStepResult(res, prevQuestion);
        if (res.done) clearPlacementPrefetch();
      } catch (e) {
        setError(e instanceof Error ? e.message : pt('error'));
      } finally {
        setChecking(false);
      }
    },
    [
      ability,
      answerKey,
      applyStepResult,
      checking,
      history,
      language,
      question,
      questionIndex,
      seenPrompts,
      seenQuestionIds,
      seenContentKeys,
      selected,
      uiLanguage,
    ],
  );

  const submitRef = useRef(submitAnswer);
  submitRef.current = submitAnswer;

  useEffect(() => {
    if (phase !== 'test' || !question || !answerKey || !selected || checking) return;
    prefetchPlacementStep({
      action: 'answer',
      language,
      uiLanguage,
      ability,
      history,
      answer: selected,
      answerKey,
      questionIndex,
      seenQuestionIds: [...seenQuestionIds, question.id],
      seenPrompts: [...seenPrompts, question.prompt],
      seenContentKeys: [...seenContentKeys, questionContentKey(question)],
      sessionSalt: sessionSaltRef.current,
      lastQuestion: {
        id: question.id,
        prompt: question.prompt,
        section: question.section,
        difficulty: question.difficulty,
        choices: question.choices,
      },
    });
  }, [
    ability,
    answerKey,
    checking,
    history,
    language,
    phase,
    question,
    questionIndex,
    seenContentKeys,
    seenPrompts,
    seenQuestionIds,
    selected,
    uiLanguage,
  ]);

  useEffect(() => {
    if (phase !== 'test' || !question || checking) return;
    setSecondsLeft(QUESTION_SECONDS);
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          void submitRef.current(null, true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, question?.id, questionEpoch, checking]);

  const startTest = useCallback(async () => {
    setError(null);
    setSelected(null);
    clearPlacementPrefetch();
    setHistory([]);
    try {
      const merged = await mergeLifetimeIntoSeen(language, {
        ids: [],
        prompts: [],
        contentKeys: [],
      });
      const sessionSalt = Date.now() ^ Math.floor(Math.random() * 1_000_000_000);
      sessionSaltRef.current = sessionSalt;
      setSeenQuestionIds(merged.ids);
      setSeenPrompts(merged.prompts);
      setSeenContentKeys(merged.contentKeys);
      const res = runPlacementStart({
        action: 'start',
        language,
        uiLanguage,
        seenQuestionIds: merged.ids,
        seenPrompts: merged.prompts,
        seenContentKeys: merged.contentKeys,
        sessionSalt,
      });
      if (res.done) return;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setAbility(res.ability);
      setQuestion(res.question);
      setAnswerKey(res.answerKey);
      setQuestionIndex(res.questionIndex);
      setTotalQuestions(res.totalQuestions);
      setSecondsLeft(QUESTION_SECONDS);
      setQuestionEpoch((n) => n + 1);
      rememberQuestion(res.question);
      setPhase('test');
    } catch (e) {
      setError(e instanceof Error ? e.message : pt('error'));
    }
  }, [language, rememberQuestion, uiLanguage]);

  const finish = useCallback(() => {
    clearPlacementPrefetch();
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/hub');
  }, []);

  const timerProgress = secondsLeft / QUESTION_SECONDS;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
      <StatusBar style="dark" />

      {phase === 'language' ? (
        <FadeInView duration={520} offsetY={18}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.kicker}>{pt('kicker')}</Text>
            <Text style={styles.title}>{pt('title')}</Text>
            <Text style={styles.subtitle}>{pt('subtitle')}</Text>

            <Text style={styles.languagePickLabel}>{pt('languagePickLabel')}</Text>
            <View style={styles.langGrid}>
              {LANGUAGES.map((lang) => {
                const active = language === lang.id;
                return (
                  <Pressable
                    key={lang.id}
                    onPress={() => {
                      setLanguage(lang.id);
                      void Haptics.selectionAsync();
                    }}
                    style={({ pressed }) => [
                      styles.langCard,
                      active && styles.langCardActive,
                      pressed && styles.pressed,
                    ]}>
                    <Text style={styles.langEmoji}>{lang.emoji}</Text>
                    <Text style={[styles.langLabel, active && styles.langLabelActive]}>
                      {pt(lang.labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

          <GameGoldButton
            onPress={startTest}
            style={styles.primaryBtn}
            accessibilityLabel={pt('start')}>
            <Text style={styles.primaryBtnText}>{pt('start')}</Text>
          </GameGoldButton>
          </ScrollView>
        </FadeInView>
      ) : null}

      {phase === 'test' && question ? (
        <View style={styles.testWrap}>
          <View style={styles.topMetaRow}>
            <View style={styles.timerPill}>
              <Ionicons
                name="time-outline"
                size={16}
                color={secondsLeft <= 10 ? '#B42318' : GAME_THEME.color.ink}
              />
              <Text style={[styles.timerText, secondsLeft <= 10 && styles.timerTextUrgent]}>
                {pt('timer', { seconds: secondsLeft })}
              </Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
          <Text style={styles.progressMeta}>
            {pt('progress', { current: questionIndex, total: totalQuestions })}
          </Text>

          <View style={styles.timerTrack}>
            <Animated.View
              style={[
                styles.timerFill,
                {
                  width: `${Math.round(timerProgress * 100)}%`,
                  backgroundColor: secondsLeft <= 10 ? '#F97066' : GAME_THEME.color.sky,
                },
              ]}
            />
          </View>

          <ScrollView contentContainerStyle={styles.testScroll} showsVerticalScrollIndicator={false}>
            <FadeInView key={`${question.id}-${questionEpoch}`} duration={480} offsetY={16}>
              <Text style={styles.instruction}>{question.instruction}</Text>
              <View style={styles.promptCard}>
                <Text style={styles.prompt}>{question.prompt}</Text>
              </View>

              <View style={styles.choices}>
                {question.choices.map((choice, idx) => {
                  const active = selected === choice;
                  return (
                    <FadeInView key={choice} delay={idx * 55} duration={400} offsetY={10}>
                      <Pressable
                        onPress={() => {
                          setSelected(choice);
                          void Haptics.selectionAsync();
                        }}
                        disabled={checking}
                        style={({ pressed }) => [
                          styles.choice,
                          active && styles.choiceActive,
                          pressed && styles.pressed,
                        ]}>
                        <Text style={[styles.choiceText, active && styles.choiceTextActive]}>
                          {choice}
                        </Text>
                      </Pressable>
                    </FadeInView>
                  );
                })}
              </View>
            </FadeInView>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <GameGoldButton
            onPress={() => void submitAnswer()}
            disabled={!selected || checking}
            style={styles.primaryBtn}
            accessibilityLabel={pt('next')}>
            {checking ? (
              <View style={styles.checkingRow}>
                <ActivityIndicator color={GAME_THEME.color.ink} />
                <Text style={styles.primaryBtnText}>{pt('checking')}</Text>
              </View>
            ) : (
              <Text style={styles.primaryBtnText}>{pt('next')}</Text>
            )}
          </GameGoldButton>
        </View>
      ) : null}

      {phase === 'result' && result ? (
        <View style={styles.resultWrap}>
          {CONFETTI.map((piece, idx) => (
            <FadeInView
              key={`confetti-${idx}`}
              delay={piece.delay}
              duration={420}
              offsetY={0}
              style={[styles.confetti, { left: piece.left, top: piece.top, backgroundColor: piece.color }]}
            />
          ))}

          <ScrollView contentContainerStyle={styles.resultScroll} showsVerticalScrollIndicator={false}>
            <FadeInView duration={520} offsetY={24}>
              <View style={styles.resultHero}>
                <Image
                  source={TEARZ_MARIO.celebrate}
                  style={styles.resultTearz}
                  contentFit="contain"
                  accessibilityLabel="Tearz celebrates"
                />
              </View>
            </FadeInView>

            <FadeInView delay={120} duration={480} offsetY={14}>
              <Text style={styles.resultKicker}>{pt('resultCompleteKicker')}</Text>
              <Text style={styles.resultCompleteTitle}>{pt('resultCompleteTitle')}</Text>
              <Text style={styles.resultCompleteSubtitle}>{pt('resultCompleteSubtitle')}</Text>
            </FadeInView>

            <FadeInView delay={240} duration={500} offsetY={12}>
              <Animated.View
                style={[
                  styles.levelCard,
                  {
                    opacity: levelPop,
                    transform: [
                      {
                        scale: levelPop.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.88, 1],
                        }),
                      },
                    ],
                  },
                ]}>
                <Text style={styles.resultTitle}>{pt('resultTitle')}</Text>
                <Text style={styles.level}>{result.level}</Text>
                {result.hskLevel ? <Text style={styles.hsk}>{result.hskLevel}</Text> : null}
              </Animated.View>
            </FadeInView>

            {result.summary ? (
              <FadeInView delay={360} duration={460} offsetY={10}>
                <Text style={styles.summary}>{result.summary}</Text>
              </FadeInView>
            ) : null}

            <FadeInView delay={460} duration={420} offsetY={8}>
              <GameGoldButton onPress={finish} style={styles.primaryBtn} accessibilityLabel={pt('continue')}>
                <Text style={styles.primaryBtnText}>{pt('continue')}</Text>
              </GameGoldButton>
            </FadeInView>
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: GAME_THEME.color.cream,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 14,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(26,26,26,0.45)',
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    color: GAME_THEME.color.ink,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
    color: 'rgba(26,26,26,0.62)',
    marginBottom: 8,
  },
  languagePickLabel: {
    marginTop: 16,
    marginBottom: 10,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: 'rgba(26,26,26,0.52)',
  },
  langGrid: {
    gap: 10,
  },
  langCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: GAME_THEME.color.paper,
    borderWidth: 3,
    borderColor: GAME_THEME.color.ink,
  },
  langCardActive: {
    backgroundColor: GAME_THEME.color.sky,
    borderBottomWidth: 5,
  },
  langEmoji: {
    fontSize: 24,
  },
  langLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
  },
  langLabelActive: {
    fontWeight: '900',
  },
  testWrap: {
    flex: 1,
    paddingHorizontal: 16,
  },
  topMetaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 10,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: GAME_THEME.color.paperWarm,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  timerText: {
    fontSize: 13,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
  },
  timerTextUrgent: {
    color: '#B42318',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(26,26,26,0.08)',
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: GAME_THEME.color.sky,
  },
  progressMeta: {
    marginTop: 8,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '800',
    color: 'rgba(26,26,26,0.55)',
    textAlign: 'center',
  },
  timerTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(26,26,26,0.06)',
    overflow: 'hidden',
    marginBottom: 10,
  },
  timerFill: {
    height: '100%',
    borderRadius: 2,
  },
  testScroll: {
    paddingBottom: 16,
    gap: 12,
  },
  instruction: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: 'rgba(26,26,26,0.55)',
  },
  promptCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: GAME_THEME.color.paper,
    borderWidth: 3,
    borderColor: GAME_THEME.color.ink,
    borderLeftWidth: 6,
    borderLeftColor: GAME_THEME.color.sky,
  },
  prompt: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
  },
  choices: {
    gap: 10,
  },
  choice: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: GAME_THEME.color.paperWarm,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  choiceActive: {
    backgroundColor: GAME_THEME.color.sky,
    borderBottomWidth: 4,
  },
  choiceText: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: GAME_THEME.color.ink,
  },
  choiceTextActive: {
    fontWeight: '900',
  },
  primaryBtn: {
    marginTop: 'auto',
    marginHorizontal: 4,
    minHeight: 52,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: GAME_THEME.color.ink,
  },
  checkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: '#B42318',
  },
  pressed: {
    opacity: 0.72,
  },
  resultWrap: {
    flex: 1,
    position: 'relative',
  },
  confetti: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    zIndex: 0,
  },
  resultScroll: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 16,
    alignItems: 'stretch',
  },
  resultHero: {
    alignSelf: 'center',
    width: 220,
    height: 220,
    borderRadius: 28,
    backgroundColor: GAME_THEME.color.paper,
    borderWidth: 3,
    borderColor: GAME_THEME.color.ink,
    borderBottomWidth: 6,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 4,
  },
  resultTearz: {
    width: 200,
    height: 200,
  },
  resultKicker: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: 'rgba(26,26,26,0.45)',
  },
  resultCompleteTitle: {
    marginTop: 6,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900',
    textAlign: 'center',
    color: GAME_THEME.color.ink,
  },
  resultCompleteSubtitle: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
    textAlign: 'center',
    color: 'rgba(26,26,26,0.62)',
  },
  levelCard: {
    marginTop: 4,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 18,
    backgroundColor: GAME_THEME.color.sky,
    borderWidth: 3,
    borderColor: GAME_THEME.color.ink,
    borderBottomWidth: 6,
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    color: 'rgba(26,26,26,0.55)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  level: {
    marginTop: 4,
    fontSize: 56,
    lineHeight: 60,
    fontWeight: '900',
    textAlign: 'center',
    color: GAME_THEME.color.ink,
  },
  hsk: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    color: GAME_THEME.color.ink,
  },
  summary: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '500',
    textAlign: 'center',
    color: 'rgba(26,26,26,0.72)',
  },
});
