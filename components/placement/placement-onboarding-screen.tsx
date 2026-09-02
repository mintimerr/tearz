import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameGoldButton } from '@/components/game/game-gold-button';
import { GAME_THEME } from '@/constants/game-theme';
import { usePlacement } from '@/contexts/placement-context';
import { useTranslation } from '@/contexts/locale-context';
import { teacherUiLanguageFromLocale } from '@/utils/teacher-ui-language';
import { postPlacementStep } from '@/services/placement-api';
import type { CompanionChatApiLanguage } from '@/types/companion-chat-api';
import type {
  PlacementHistoryItem,
  PlacementQuestion,
  PlacementResult,
} from '@/types/placement-api';

const LANGUAGES: { id: CompanionChatApiLanguage; labelKey: string; emoji: string }[] = [
  { id: 'french', labelKey: 'placement.lang.french', emoji: '🇫🇷' },
  { id: 'english', labelKey: 'placement.lang.english', emoji: '🇬🇧' },
  { id: 'chinese', labelKey: 'placement.lang.chinese', emoji: '🇨🇳' },
  { id: 'german', labelKey: 'placement.lang.german', emoji: '🇩🇪' },
  { id: 'russian', labelKey: 'placement.lang.russian', emoji: '🇷🇺' },
];

type Phase = 'language' | 'test' | 'result';

export function PlacementOnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { t, locale } = useTranslation();
  const uiLanguage = teacherUiLanguageFromLocale(locale);
  const { savePlacement } = usePlacement();

  const [phase, setPhase] = useState<Phase>('language');
  const [language, setLanguage] = useState<CompanionChatApiLanguage>('french');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState<PlacementQuestion | null>(null);
  const [answerKey, setAnswerKey] = useState<string | null>(null);
  const [ability, setAbility] = useState(45);
  const [history, setHistory] = useState<PlacementHistoryItem[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<PlacementResult | null>(null);

  const progress = useMemo(() => {
    if (phase !== 'test' || totalQuestions <= 0) return 0;
    return questionIndex / totalQuestions;
  }, [phase, questionIndex, totalQuestions]);

  const startTest = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelected(null);
    try {
      const res = await postPlacementStep({
        action: 'start',
        language,
        uiLanguage,
      });
      if (res.done) return;
      setAbility(res.ability);
      setQuestion(res.question);
      setAnswerKey(res.answerKey);
      setQuestionIndex(res.questionIndex);
      setTotalQuestions(res.totalQuestions);
      setHistory([]);
      setPhase('test');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('placement.error'));
    } finally {
      setLoading(false);
    }
  }, [language, t, uiLanguage]);

  const submitAnswer = useCallback(async () => {
    if (!question || !answerKey || !selected || loading) return;
    setLoading(true);
    setError(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const res = await postPlacementStep({
        action: 'answer',
        language,
        uiLanguage,
        ability,
        history,
        answer: selected,
        answerKey,
        questionIndex,
        lastQuestion: {
          prompt: question.prompt,
          section: question.section,
          difficulty: question.difficulty,
        },
      });
      setAbility(res.ability);
      setSelected(null);
      if (res.done) {
        setResult(res.result);
        await savePlacement({
          completedAt: Date.now(),
          language,
          level: res.result.level,
          score: res.result.score,
          summary: res.result.summary,
          hskLevel: res.result.hskLevel,
        });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setPhase('result');
        return;
      }
      setQuestion(res.question);
      setAnswerKey(res.answerKey);
      setQuestionIndex(res.questionIndex);
      setTotalQuestions(res.totalQuestions);
      if (question && typeof res.correct === 'boolean') {
        setHistory((prev) => [
          ...prev,
          {
            section: question.section,
            difficulty: question.difficulty,
            correct: res.correct ?? false,
            prompt: question.prompt,
          },
        ]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('placement.error'));
    } finally {
      setLoading(false);
    }
  }, [
    ability,
    answerKey,
    history,
    language,
    loading,
    question,
    questionIndex,
    savePlacement,
    selected,
    t,
    uiLanguage,
  ]);

  const finish = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/hub');
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
      <StatusBar style="dark" />

      {phase === 'language' ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.kicker}>{t('placement.kicker')}</Text>
          <Text style={styles.title}>{t('placement.title')}</Text>
          <Text style={styles.subtitle}>{t('placement.subtitle')}</Text>

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
                    {t(lang.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <GameGoldButton
            onPress={() => void startTest()}
            disabled={loading}
            style={styles.primaryBtn}
            accessibilityLabel={t('placement.start')}>
            {loading ? (
              <ActivityIndicator color={GAME_THEME.color.ink} />
            ) : (
              <Text style={styles.primaryBtnText}>{t('placement.start')}</Text>
            )}
          </GameGoldButton>
        </ScrollView>
      ) : null}

      {phase === 'test' && question ? (
        <View style={styles.testWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={styles.progressMeta}>
            {t('placement.progress', { current: questionIndex, total: totalQuestions })}
          </Text>

          <ScrollView contentContainerStyle={styles.testScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.instruction}>{question.instruction}</Text>
            <View style={styles.promptCard}>
              <Text style={styles.prompt}>{question.prompt}</Text>
            </View>

            <View style={styles.choices}>
              {question.choices.map((choice) => {
                const active = selected === choice;
                return (
                  <Pressable
                    key={choice}
                    onPress={() => {
                      setSelected(choice);
                      void Haptics.selectionAsync();
                    }}
                    style={({ pressed }) => [
                      styles.choice,
                      active && styles.choiceActive,
                      pressed && styles.pressed,
                    ]}>
                    <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{choice}</Text>
                  </Pressable>
                );
              })}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <GameGoldButton
            onPress={() => void submitAnswer()}
            disabled={!selected || loading}
            style={styles.primaryBtn}
            accessibilityLabel={t('placement.next')}>
            {loading ? (
              <ActivityIndicator color={GAME_THEME.color.ink} />
            ) : (
              <Text style={styles.primaryBtnText}>{t('placement.next')}</Text>
            )}
          </GameGoldButton>
        </View>
      ) : null}

      {phase === 'result' && result ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.resultBadge}>
            <Ionicons name="ribbon-outline" size={28} color={GAME_THEME.color.ink} />
          </View>
          <Text style={styles.resultTitle}>{t('placement.resultTitle')}</Text>
          <Text style={styles.level}>{result.level}</Text>
          {result.hskLevel ? <Text style={styles.hsk}>{result.hskLevel}</Text> : null}
          {result.summary ? <Text style={styles.summary}>{result.summary}</Text> : null}

          <GameGoldButton onPress={finish} style={styles.primaryBtn} accessibilityLabel={t('placement.continue')}>
            <Text style={styles.primaryBtnText}>{t('placement.continue')}</Text>
          </GameGoldButton>
        </ScrollView>
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
    marginBottom: 12,
    fontSize: 13,
    fontWeight: '800',
    color: 'rgba(26,26,26,0.55)',
    textAlign: 'center',
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
  error: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: '#B42318',
  },
  pressed: {
    opacity: 0.72,
  },
  resultBadge: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GAME_THEME.color.sky,
    borderWidth: 3,
    borderColor: GAME_THEME.color.ink,
    marginBottom: 8,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    color: 'rgba(26,26,26,0.55)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  level: {
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
    marginTop: 12,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '500',
    textAlign: 'center',
    color: 'rgba(26,26,26,0.72)',
  },
});
