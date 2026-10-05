import { Image } from 'expo-image';
import * as Haptics from '@/utils/safe-haptics';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameGoldButton } from '@/components/game/game-gold-button';
import { TEARZ_MARIO } from '@/components/game/tearz-mario-source';
import { TeacherLessonWindow } from '@/components/teacher/teacher-lesson-window';
import { FadeInView } from '@/components/ui';
import { GAME_THEME } from '@/constants/game-theme';
import { useCompanionChats } from '@/contexts/companion-chats-context';
import { useTranslation } from '@/contexts/locale-context';
import { usePlacement } from '@/contexts/placement-context';
import { useTeacherJourney } from '@/contexts/teacher-journey-context';
import { useLearnerModel } from '@/hooks/use-learner-model';
import { nextPlacementTarget } from '@/utils/placement-next-level';
import { buildPlacementPathChat } from '@/utils/placement-path-chat';

export function PlacementLearningPathScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { record, hydrated } = usePlacement();
  const { learnerModel } = useLearnerModel();
  const { addChat, saveCompanionThread, getCompanionThread, chats } = useCompanionChats();
  const { addRecentLesson, markLessonCreated } = useTeacherJourney();

  const [lessonOpen, setLessonOpen] = useState(false);
  const createdRef = useRef(false);

  const target = useMemo(() => {
    if (!record) return null;
    return nextPlacementTarget(record);
  }, [record]);

  const chatTitle = useMemo(() => {
    if (!target) return '';
    return target.isMastery
      ? t('placement.pathMasteryTitle', { level: target.currentLabel })
      : t('placement.pathChatTitle', { level: target.nextLabel });
  }, [t, target]);

  const pathBundle = useMemo(() => {
    if (!record || !target) return null;
    return buildPlacementPathChat({
      language: record.language,
      nextLabel: target.nextLabel,
      chatTitle,
      openingText: target.isMastery
        ? t('placement.pathOpeningMastery', {
            current: target.currentLabel,
          })
        : t('placement.pathOpening', {
            current: target.currentLabel,
            next: target.nextLabel,
          }),
      teacherName: 'Преподаватель',
      learnerModel,
    });
  }, [chatTitle, learnerModel, record, t, target]);

  // Prefer localized teacher label from teacher.chats / hardcode like other screens.
  const ensurePathChat = useCallback(() => {
    if (!pathBundle || !record) return null;
    if (createdRef.current) {
      return {
        id: pathBundle.id,
        title: pathBundle.title,
        thread: getCompanionThread(pathBundle.id) ?? pathBundle.opening,
      };
    }
    createdRef.current = true;
    const existing = chats.some((c) => c.id === pathBundle.id);
    if (!existing) {
      addChat(pathBundle.chatRow);
    }
    void addRecentLesson(pathBundle.lesson);
    void markLessonCreated();
    const existingThread = getCompanionThread(pathBundle.id);
    const staleAskMenu =
      existingThread?.length === 1 &&
      existingThread[0]?.from === 'them' &&
      /с чего хочешь|what should we start|想先从|что хочешь прокачать|what should we train/i.test(
        existingThread[0]?.text ?? '',
      );
    if (!existingThread?.length || staleAskMenu) {
      saveCompanionThread(pathBundle.id, pathBundle.opening);
      return {
        id: pathBundle.id,
        title: pathBundle.title,
        thread: pathBundle.opening,
      };
    }
    return {
      id: pathBundle.id,
      title: pathBundle.title,
      thread: existingThread,
    };
  }, [
    addChat,
    addRecentLesson,
    chats,
    getCompanionThread,
    markLessonCreated,
    pathBundle,
    record,
    saveCompanionThread,
  ]);

  useEffect(() => {
    if (!hydrated || !record || !pathBundle) return;
    ensurePathChat();
  }, [ensurePathChat, hydrated, pathBundle, record]);

  const openPath = useCallback(() => {
    const lesson = ensurePathChat();
    if (!lesson || !record) {
      router.replace('/onboarding/welcome');
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLessonOpen(true);
  }, [ensurePathChat, record]);

  const closePath = useCallback(() => {
    setLessonOpen(false);
    router.replace('/onboarding/welcome');
  }, []);

  const skipToHub = useCallback(() => {
    ensurePathChat();
    router.replace('/onboarding/welcome');
  }, [ensurePathChat]);

  if (!hydrated) {
    return <View style={[styles.root, { paddingTop: insets.top }]} />;
  }

  if (!record || !target || !pathBundle) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
        <StatusBar style="dark" />
        <Text style={styles.error}>{t('placement.error')}</Text>
        <GameGoldButton onPress={() => router.replace('/onboarding/welcome')} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>{t('placement.continue')}</Text>
        </GameGoldButton>
      </View>
    );
  }

  if (lessonOpen) {
    return (
      <TeacherLessonWindow
        onClose={closePath}
        lessonId={pathBundle.id}
        lessonTopic={pathBundle.title}
        initialMessages={getCompanionThread(pathBundle.id) ?? pathBundle.opening}
        language={record.language}
      />
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
      <StatusBar style="dark" />

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}>
        <FadeInView duration={520} offsetY={18}>
          <Text style={styles.kicker}>{t('placement.pathKicker')}</Text>
          <Text style={styles.title}>
            {target.isMastery
              ? t('placement.pathMasteryTitle', { level: target.currentLabel })
              : t('placement.pathTitle', { level: target.nextLabel })}
          </Text>
          <Text style={styles.subtitle}>
            {target.isMastery
              ? t('placement.pathMasterySubtitle', { current: target.currentLabel })
              : t('placement.pathSubtitle', {
                  current: target.currentLabel,
                  next: target.nextLabel,
                })}
          </Text>

          <View style={styles.hero}>
            <Image
              source={TEARZ_MARIO.pathLaptop}
              style={styles.tearz}
              contentFit="contain"
              accessibilityLabel="Tearz"
            />
          </View>

          <View style={styles.ladder}>
            <View style={[styles.levelPill, styles.levelPillNow]}>
              <Text style={styles.levelPillHint}>{t('placement.pathNow')}</Text>
              <Text style={styles.levelPillValue}>{target.currentLabel}</Text>
            </View>
            <Text style={styles.ladderArrow}>→</Text>
            <View style={[styles.levelPill, styles.levelPillNext]}>
              <Text style={styles.levelPillHint}>{t('placement.pathGoal')}</Text>
              <Text style={[styles.levelPillValue, styles.levelPillValueNext]}>
                {target.isMastery ? t('placement.pathMasteryGoal') : target.nextLabel}
              </Text>
            </View>
          </View>

          <Text style={styles.chatHint}>{t('placement.pathChatHint', { title: chatTitle })}</Text>
        </FadeInView>
      </ScrollView>

      <View style={styles.footer}>
        <GameGoldButton
          onPress={openPath}
          style={styles.primaryBtn}
          accessibilityLabel={t('placement.pathStart')}>
          <Text style={styles.primaryBtnText}>{t('placement.pathStart')}</Text>
        </GameGoldButton>
        <Pressable onPress={skipToHub} style={({ pressed }) => [styles.skip, pressed && styles.pressed]}>
          <Text style={styles.skipText}>{t('placement.pathLater')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: GAME_THEME.color.cream,
    paddingHorizontal: 22,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingBottom: 12,
  },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: GAME_THEME.color.sky,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
    lineHeight: 34,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    color: 'rgba(26,26,26,0.72)',
    marginBottom: 8,
  },
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 18,
  },
  tearz: {
    width: 168,
    height: 168,
  },
  ladder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 18,
  },
  levelPill: {
    minWidth: 112,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: GAME_THEME.color.ink,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  levelPillNow: {
    backgroundColor: GAME_THEME.color.paper,
  },
  levelPillNext: {
    backgroundColor: '#FFE566',
  },
  levelPillHint: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(26,26,26,0.55)',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  levelPillValue: {
    fontSize: 26,
    fontWeight: '900',
    color: GAME_THEME.color.ink,
  },
  levelPillValueNext: {
    color: GAME_THEME.color.ink,
  },
  ladderArrow: {
    fontSize: 28,
    fontWeight: '800',
    color: GAME_THEME.color.sky,
  },
  chatHint: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(26,26,26,0.62)',
    textAlign: 'center',
  },
  footer: {
    gap: 10,
    paddingTop: 8,
  },
  primaryBtn: {
    width: '100%',
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
  },
  skip: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.5)',
  },
  pressed: {
    opacity: 0.7,
  },
  error: {
    color: GAME_THEME.color.danger,
    marginBottom: 16,
    fontSize: 15,
  },
});
