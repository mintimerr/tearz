import { Ionicons } from '@expo/vector-icons';
import { Kalam_400Regular, useFonts } from '@expo-google-fonts/kalam';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Reanimated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BoardLessonBubble,
  BoardLessonTyping,
  BoardStudentText,
} from '@/components/teacher/board-lesson-bubble';
import { BoardChalkBackdrop } from '@/components/teacher/board-chalk-backdrop';
import type { TeacherComposerAttachment } from '@/components/teacher/teacher-home-composer';
import { TeacherExerciseActions } from '@/components/teacher/teacher-exercise-actions';
import { TeacherExerciseDrill } from '@/components/teacher/teacher-exercise-drill';
import { TeacherExerciseGenerating } from '@/components/teacher/teacher-exercise-generating';
import {
  TeacherFullWorkoutPaywall,
  type TearzPlusFeature,
} from '@/components/teacher/teacher-full-workout-paywall';
import { TeacherMessageBody } from '@/components/teacher/teacher-message-body';
import {
  TEACHER_MUTED,
  TEACHER_MUTED_SOFT,
  TEACHER_TITLE,
  teacherLessonColor,
} from '@/components/teacher/teacher-tokens';
import { FadeInView } from '@/components/ui';
import { GAME_THEME } from '@/constants/game-theme';
import { APP_THEME } from '@/constants/theme';
import { TearzBoardChatAvatar } from '@/components/teacher/tearz-board-chat-avatar';
import { useAuth } from '@/contexts/auth-context';
import { useCompanionChats } from '@/contexts/companion-chats-context';
import { useEngagement } from '@/contexts/engagement-context';
import { useLexicon } from '@/contexts/lexicon-context';
import { useTranslation } from '@/contexts/locale-context';
import { useTeacherJourney } from '@/contexts/teacher-journey-context';
import { useUserProfile } from '@/contexts/user-profile-context';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';
import {
  postTeacherChatReply,
  postTeacherExerciseCheck,
  postTeacherExerciseSet,
} from '@/services/companion-chat-ai';
import type {
  CompanionChatApiLanguage,
  TeacherExerciseItem,
  TeacherNextTopicRecommendation,
} from '@/types/companion-chat-api';
import type { CompanionMsg } from '@/types/companion-message';
import { messagesToCompanionApiHistory } from '@/utils/companion-chat-history';
import { setTeacherLessonBootstrap } from '@/utils/teacher-lesson-bootstrap';
import { inferTeacherLessonLanguage } from '@/utils/teacher-lesson-language';
import {
  evaluateMiniDrillAccess,
  getPriorExerciseTexts,
  loadMiniDrillUsage,
  recordMiniDrillGeneration,
  saveMiniDrillUsage,
  type MiniDrillUsage,
} from '@/utils/teacher-mini-drill-usage';

function formatChatTime(d = new Date()) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function lastUserTextBefore(messages: CompanionMsg[], teacherMsgId: string): string {
  const idx = messages.findIndex((m) => m.id === teacherMsgId);
  if (idx <= 0) return '';
  for (let i = idx - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.from === 'me' && typeof msg.text === 'string' && msg.text.trim()) {
      return msg.text.trim();
    }
  }
  return '';
}

function buildNextTopicChatMessage(topic: TeacherNextTopicRecommendation): string {
  const title = topic.title.trim();
  if (topic.connection?.trim()) {
    return `Расскажи про тему «${title}». ${topic.connection.trim()}`;
  }
  if (topic.reason?.trim()) {
    return `Расскажи про тему «${title}». ${topic.reason.trim()}`;
  }
  return `Расскажи про тему «${title}»`;
}

type Props = {
  onClose: () => void;
  /** Первый вопрос с доски — сразу уходит в обработку. */
  seedQuestion?: string;
  /** Готовый тред (после полёта с автомата) — без «думаю». */
  initialMessages?: CompanionMsg[];
  seedAttachment?: TeacherComposerAttachment | null;
  language?: CompanionChatApiLanguage;
  /** Игровой chrome (cream/ink/gold) вместо iOS glass. */
  gameChrome?: boolean;
};

export function TeacherBoardChat({
  onClose,
  seedQuestion,
  initialMessages,
  seedAttachment,
  language = 'english',
  gameChrome = true,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [fontsLoaded] = useFonts({ Kalam_400Regular });
  const { registerUserStudyText, recordStudySwipe } = useUserProfile();
  const { addChat, saveCompanionThread } = useCompanionChats();
  const { markLessonCreated, addRecentLesson } = useTeacherJourney();
  const { recordActivity, hasPlusAccess } = useEngagement();
  const { ingestTeacherText } = useLexicon();
  const { animatedStyle: composerInsetStyle, isOpen: keyboardOpen } = useKeyboardInset(
    Math.max(insets.bottom, gameChrome ? 4 : 10) + (gameChrome ? 0 : 8),
  );
  const miniDrillUserId = user?.id ?? '';

  const scrollRef = useRef<ScrollView>(null);
  const lessonIdRef = useRef<string | null>(null);
  const lessonTopicRef = useRef<string>(t('teacher.lessonDefault'));
  const seededRef = useRef(false);
  const sendScale = useRef(new Animated.Value(1)).current;
  const messagesRef = useRef<CompanionMsg[]>([]);

  const [messages, setMessages] = useState<CompanionMsg[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [exerciseLoadingId, setExerciseLoadingId] = useState<string | null>(null);
  const [drillExercises, setDrillExercises] = useState<TeacherExerciseItem[]>([]);
  const [drillNextTopic, setDrillNextTopic] = useState<TeacherNextTopicRecommendation | null>(null);
  const [drillSessionKey, setDrillSessionKey] = useState('');
  const [drillOpen, setDrillOpen] = useState(false);
  const [plusPaywallFeature, setPlusPaywallFeature] = useState<TearzPlusFeature | null>(null);
  const pendingFullMsgRef = useRef<CompanionMsg | null>(null);
  const [miniDrillUsage, setMiniDrillUsage] = useState<MiniDrillUsage>({ perMessage: {}, priorSets: {} });

  messagesRef.current = messages;

  useEffect(() => {
    if (!miniDrillUserId) {
      setMiniDrillUsage({ perMessage: {}, priorSets: {} });
      return;
    }
    void loadMiniDrillUsage(miniDrillUserId).then(setMiniDrillUsage);
  }, [miniDrillUserId]);

  const scrollToEnd = (animated = true) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated });
    });
  };

  /** Один плавный уезд в конец — в такт выезду клавиатуры, без дёрганых повторов */
  useEffect(() => {
    if (!keyboardOpen) return;
    const id = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 220);
    return () => clearTimeout(id);
  }, [keyboardOpen]);

  useEffect(() => {
    if (!keyboardOpen) return;
    // Новые сообщения / typing — тоже мягко к низу, пока клавиатура открыта
    const id = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 60);
    return () => clearTimeout(id);
  }, [keyboardOpen, messages.length, typing]);

  const ensureLesson = useCallback(
    (thread: CompanionMsg[], titleSource: string) => {
      if (lessonIdRef.current) return lessonIdRef.current;

      const id = `tl-${Date.now()}`;
      const lessonColor = teacherLessonColor(id);
      const time = formatChatTime();
      const title = titleSource.length > 72 ? `${titleSource.slice(0, 72)}…` : titleSource;
      const preview =
        titleSource.length > 80 ? `${titleSource.slice(0, 80)}…` : titleSource || t('teacher.lessonDefault');
      const createdAt = Date.now();

      lessonIdRef.current = id;
      lessonTopicRef.current = title;

      if (thread.some((m) => m.from === 'me')) {
        setTeacherLessonBootstrap(id, thread);
        saveCompanionThread(id, thread);
      }

      void markLessonCreated();
      addChat({
        id,
        name: 'Преподаватель',
        preview,
        time,
        unread: 0,
        online: true,
        letter: 'T',
        color: lessonColor,
        presence: 'урок',
      });
      void addRecentLesson({
        id,
        title,
        subtitle: 'Преподаватель',
        createdAt,
        spentSecondsTotal: 0,
      });

      return id;
    },
    [addChat, addRecentLesson, markLessonCreated, saveCompanionThread, t],
  );

  const requestReply = useCallback(
    async (userText: string, historyBefore: CompanionMsg[]) => {
      setTyping(true);
      try {
        const reply = await postTeacherChatReply({
          message: userText.trim(),
          conversationHistory: messagesToCompanionApiHistory(historyBefore),
          language,
          lessonTopic: lessonTopicRef.current,
        });
        ingestTeacherText(reply);
        const replyTime = formatChatTime();
        const assistantMsg: CompanionMsg = {
          id: `a-${Date.now()}`,
          from: 'them',
          text: reply,
          time: replyTime,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        if (lessonIdRef.current) {
          saveCompanionThread(lessonIdRef.current, [...historyBefore, assistantMsg]);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Ошибка сети';
        const replyTime = formatChatTime();
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            from: 'them',
            text: `${t('teacher.boardChatError')}\n\n${msg}`,
            time: replyTime,
          },
        ]);
      } finally {
        setTyping(false);
        setSending(false);
        scrollToEnd();
      }
    },
    [ingestTeacherText, language, saveCompanionThread, t],
  );

  useEffect(() => {
    if (seededRef.current) return;

    if (initialMessages && initialMessages.length > 0) {
      seededRef.current = true;
      const titleSrc =
        initialMessages.find((m) => m.from === 'me' && typeof m.text === 'string')?.text?.trim() ||
        t('teacher.lessonDefault');
      if (titleSrc) registerUserStudyText(titleSrc);
      setMessages(initialMessages);
      ensureLesson(initialMessages, titleSrc);
      scrollToEnd();
      return;
    }

    const q = seedQuestion?.trim();
    if (!q) return;
    seededRef.current = true;
    registerUserStudyText(q);

    const time = formatChatTime();
    const userMsg: CompanionMsg = {
      id: 'seed',
      from: 'me',
      text: q,
      time,
      read: 'read',
    };
    setMessages([userMsg]);
    ensureLesson([userMsg], q);
    void requestReply(q, [userMsg]);
    scrollToEnd();
  }, [ensureLesson, initialMessages, registerUserStudyText, requestReply, seedQuestion, t]);

  const send = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();
    setSending(true);
    registerUserStudyText(text);

    const time = formatChatTime();
    const userMsg: CompanionMsg = {
      id: `u-${Date.now()}`,
      from: 'me',
      text,
      time,
      read: 'sent',
    };

    const nextThread = [...messages, userMsg];
    setMessages(nextThread);
    setInput('');
    ensureLesson(nextThread, text);
    if (lessonIdRef.current) {
      saveCompanionThread(lessonIdRef.current, nextThread);
    }
    scrollToEnd();

    await requestReply(text, nextThread);
  }, [ensureLesson, input, messages, registerUserStudyText, requestReply, saveCompanionThread, sending]);

  const generateExerciseForMessage = useCallback(
    async (source: CompanionMsg) => {
      if (exerciseLoadingId || typing) return;
      const explanation = source.text.trim();
      if (!explanation) return;

      const access = evaluateMiniDrillAccess(miniDrillUsage, source.id);
      if (!access.allowed) {
        Alert.alert('Мини-тренировка', access.reason ?? 'Лимит исчерпан.');
        return;
      }

      setExerciseLoadingId(source.id);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const generationSeed = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const lastUser = lastUserTextBefore(messagesRef.current, source.id);
      const drillLanguage = inferTeacherLessonLanguage(
        `${lastUser}\n${lessonTopicRef.current}\n${explanation}`,
        language,
      );
      try {
        const { exercises: raw, nextTopic } = await postTeacherExerciseSet({
          explanation,
          lastUserMessage: lastUser,
          conversationHistory: messagesToCompanionApiHistory(messagesRef.current),
          language: drillLanguage,
          lessonTopic: lessonTopicRef.current,
          generationSeed,
          generationAttempt: access.generationsUsed + 1,
          avoidExerciseTexts: getPriorExerciseTexts(miniDrillUsage, source.id),
        });
        const sessionKey = `drill-${generationSeed}`;
        const exercises = raw.map((ex, i) => ({
          ...ex,
          id: `${sessionKey}-${i}`,
        }));
        const nextUsage = recordMiniDrillGeneration(
          miniDrillUsage,
          source.id,
          exercises.map((ex) => ex.checkText),
        );
        setMiniDrillUsage(nextUsage);
        if (miniDrillUserId) {
          void saveMiniDrillUsage(miniDrillUserId, nextUsage);
        }
        setDrillSessionKey(sessionKey);
        setDrillExercises(exercises);
        setDrillNextTopic(nextTopic ?? null);
        setExerciseLoadingId(null);
        setDrillOpen(true);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Ошибка сети';
        Alert.alert('Тренировка', `Не удалось создать задания.\n\n${msg}`);
        setExerciseLoadingId(null);
      }
    },
    [exerciseLoadingId, language, miniDrillUsage, miniDrillUserId, typing],
  );

  const checkDrillExercise = useCallback(
    async (payload: {
      exercise: string;
      answer: string;
      item: TeacherExerciseItem;
      learnerAnswers: {
        blanks: Record<string, string>;
        selectedChoice: string | null;
        freeText: string;
        formChoices: Record<string, string>;
        imageAssignments: Record<string, string>;
        numberedAssignments: Record<string, string>;
        matchPairs: Record<string, string>;
        sentenceOrder: string[];
        readSelectChoice: 'real' | 'fake' | null;
        partialGapInputs: Record<string, string>;
      };
    }) => {
      const result = await postTeacherExerciseCheck({
        exercise: payload.exercise,
        answer: payload.answer,
        item: payload.item,
        learnerAnswers: payload.learnerAnswers,
        conversationHistory: messagesToCompanionApiHistory(messagesRef.current),
        language,
        lessonTopic: lessonTopicRef.current,
      });
      recordStudySwipe(result.correct);
      return result;
    },
    [language, recordStudySwipe],
  );

  const closeDrill = useCallback(
    (summary: { correct: number; total: number } | null) => {
      setDrillOpen(false);
      setDrillExercises([]);
      setDrillSessionKey('');
      setDrillNextTopic(null);
      if (summary && summary.correct > 0) {
        recordActivity({
          kind: 'teacher_drill',
          drillCorrect: summary.correct,
          lessonTopic: lessonTopicRef.current,
        });
      }
    },
    [recordActivity],
  );

  const handleDrillNextTopic = useCallback(
    (topic: TeacherNextTopicRecommendation) => {
      const text = buildNextTopicChatMessage(topic);
      setTimeout(() => {
        void send(text);
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 120);
    },
    [send],
  );

  const renderPracticeActions = useCallback(
    (message: CompanionMsg) => {
      if (message.from !== 'them' || message.id.startsWith('ex-') || message.text.startsWith('Не удалось')) {
        return null;
      }
      return (
        <TeacherExerciseActions
          messageId={message.id}
          message={message}
          exerciseLoadingId={exerciseLoadingId}
          typing={typing}
          miniAccess={evaluateMiniDrillAccess(miniDrillUsage, message.id)}
          onMiniPress={(msg) => void generateExerciseForMessage(msg)}
          onMiniBlocked={(reason) => Alert.alert('Мини-тренировка', reason)}
          onFullPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (hasPlusAccess) {
              void generateExerciseForMessage(message);
              return;
            }
            pendingFullMsgRef.current = message;
            setPlusPaywallFeature('fullWorkout');
          }}
        />
      );
    },
    [exerciseLoadingId, generateExerciseForMessage, hasPlusAccess, miniDrillUsage, typing],
  );

  const markerFamily = fontsLoaded ? 'Kalam_400Regular' : undefined;
  const canSend = Boolean(input.trim()) && !sending;

  const pressSendIn = () => {
    if (!canSend) return;
    Animated.spring(sendScale, {
      toValue: APP_THEME.motion.pressScaleDeep,
      friction: 8,
      tension: 320,
      useNativeDriver: true,
    }).start();
  };

  const pressSendOut = () => {
    Animated.spring(sendScale, { toValue: 1, friction: 7, tension: 240, useNativeDriver: true }).start();
  };

  return (
    <View style={[styles.root, gameChrome && styles.rootGame]}>
      {gameChrome ? null : <BoardChalkBackdrop style={StyleSheet.absoluteFill} />}

      <View style={styles.flex}>
        <View
          style={[
            styles.header,
            gameChrome ? styles.headerGame : null,
            { paddingTop: gameChrome ? 6 : insets.top + 4 },
          ]}>
          <View style={styles.headerInner}>
            <Pressable
              onPress={() => {
                void Haptics.selectionAsync();
                Keyboard.dismiss();
                onClose();
              }}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
              style={({ pressed }) => [
                styles.closeBtn,
                gameChrome && styles.closeBtnGame,
                pressed && styles.closeBtnPressed,
              ]}>
              <Ionicons
                name={gameChrome ? 'chevron-back' : 'chevron-down'}
                size={22}
                color={gameChrome ? GAME_THEME.color.ink : TEACHER_MUTED}
              />
            </Pressable>

            <View style={styles.headerCenter}>
              <TearzBoardChatAvatar size={36} bordered={false} />
              <Text style={[styles.headerTitle, gameChrome && styles.headerTitleGame]}>Tearz</Text>
            </View>

            <View style={styles.headerSpacer} />
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[styles.thread, gameChrome && styles.threadGame]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
          {messages.map((m, idx) => {
            const isMe = m.from === 'me';
            const bubbleVariant = gameChrome ? 'game' : 'default';
            return (
              <FadeInView key={m.id} delay={idx * 60} offsetY={10} duration={380}>
                <BoardLessonBubble
                  side={isMe ? 'student' : 'teacher'}
                  compact={m.text.length < 56}
                  variant={bubbleVariant}>
                  {isMe ? (
                    <BoardStudentText markerFamily={markerFamily} game={gameChrome}>
                      {m.text}
                    </BoardStudentText>
                  ) : (
                    <TeacherMessageBody
                      text={m.text}
                      messageId={m.id}
                      textStyle={[styles.teacherText, gameChrome && styles.teacherTextGame]}
                      variant={gameChrome ? 'game' : 'default'}
                      practiceActions={gameChrome ? renderPracticeActions(m) : undefined}
                    />
                  )}
                </BoardLessonBubble>
              </FadeInView>
            );
          })}

          {typing ? (
            <FadeInView delay={40} offsetY={8} duration={300}>
              <BoardLessonTyping
                label={t('teacher.boardChatTyping')}
                variant={gameChrome ? 'game' : 'default'}
              />
            </FadeInView>
          ) : null}
        </ScrollView>

        <Reanimated.View
          style={[
            styles.composerWrap,
            gameChrome && styles.composerWrapGame,
            composerInsetStyle,
          ]}>
          {gameChrome ? null : <BlurView intensity={38} tint="light" style={styles.composerBlur} />}
          <View style={[styles.composerShell, gameChrome ? styles.composerShellGame : styles.composerShellIos]}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={t('teacher.boardChatPlaceholder')}
              placeholderTextColor={gameChrome ? 'rgba(26,26,26,0.4)' : TEACHER_MUTED_SOFT}
              style={[styles.composerInput, gameChrome && styles.composerInputGame]}
              multiline
              maxLength={2000}
              editable={!sending}
              blurOnSubmit={false}
              onFocus={() => {
                setTimeout(() => {
                  scrollRef.current?.scrollToEnd({ animated: true });
                }, 220);
              }}
            />
            <Pressable
              onPress={() => void send()}
              onPressIn={pressSendIn}
              onPressOut={pressSendOut}
              disabled={!canSend}
              hitSlop={8}
              accessibilityRole="button">
              <Animated.View
                style={[
                  styles.sendBtn,
                  canSend
                    ? gameChrome
                      ? styles.sendBtnOnGame
                      : styles.sendBtnOn
                    : gameChrome
                      ? styles.sendBtnOffGame
                      : styles.sendBtnOff,
                  { transform: [{ scale: sendScale }] },
                ]}>
                <Ionicons
                  name="arrow-up"
                  size={18}
                  color={canSend ? (gameChrome ? GAME_THEME.color.ink : '#FFFFFF') : 'rgba(26,26,26,0.35)'}
                  style={styles.sendIcon}
                />
              </Animated.View>
            </Pressable>
          </View>
        </Reanimated.View>
      </View>

      <TeacherExerciseGenerating visible={Boolean(exerciseLoadingId) && !drillOpen} />

      <TeacherFullWorkoutPaywall
        visible={plusPaywallFeature === 'fullWorkout'}
        feature="fullWorkout"
        onClose={() => {
          pendingFullMsgRef.current = null;
          setPlusPaywallFeature(null);
        }}
        onUnlocked={() => {
          const msg = pendingFullMsgRef.current;
          pendingFullMsgRef.current = null;
          setPlusPaywallFeature(null);
          if (msg) void generateExerciseForMessage(msg);
        }}
      />

      <TeacherExerciseDrill
        visible={drillOpen}
        sessionKey={drillSessionKey}
        exercises={drillExercises}
        nextTopic={drillNextTopic}
        transcribeLanguage={language}
        onClose={closeDrill}
        onNextTopicPress={handleDrillNextTopic}
        onCheck={checkDrillExercise}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: APP_THEME.color.bgSoft,
  },
  rootGame: {
    backgroundColor: GAME_THEME.color.cream,
  },
  flex: {
    flex: 1,
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: APP_THEME.color.border,
  },
  headerGame: {
    borderBottomWidth: 3,
    borderBottomColor: GAME_THEME.color.ink,
    backgroundColor: GAME_THEME.color.gold,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnGame: {
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    borderRadius: 18,
    backgroundColor: GAME_THEME.color.cream,
  },
  closeBtnPressed: {
    opacity: 0.55,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerSpacer: {
    width: 36,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: TEACHER_TITLE,
    letterSpacing: -0.2,
  },
  headerTitleGame: {
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: GAME_THEME.color.ink,
  },
  thread: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 16,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  threadGame: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: GAME_THEME.color.cream,
  },
  teacherText: {
    fontSize: 16,
    lineHeight: 24,
    color: TEACHER_TITLE,
    letterSpacing: -0.2,
  },
  teacherTextGame: {
    color: GAME_THEME.color.ink,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  composerWrap: {
    paddingHorizontal: 14,
    paddingTop: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  composerWrapGame: {
    borderTopWidth: 3,
    borderTopColor: GAME_THEME.color.ink,
    backgroundColor: GAME_THEME.color.cream,
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  composerBlur: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.92,
  },
  composerShell: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
    minHeight: 52,
    zIndex: 1,
  },
  composerShellIos: {
    borderRadius: APP_THEME.radius.xxl,
    backgroundColor: APP_THEME.color.glassStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.borderStrong,
  },
  composerShellGame: {
    borderRadius: 0,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 0,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 10,
  },
  composerInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    color: TEACHER_TITLE,
    maxHeight: 120,
    paddingVertical: 8,
    letterSpacing: -0.18,
  },
  composerInputGame: {
    color: GAME_THEME.color.ink,
    fontWeight: '600',
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    overflow: 'hidden',
  },
  sendBtnOn: {
    backgroundColor: APP_THEME.color.brand,
  },
  sendBtnOff: {
    backgroundColor: APP_THEME.color.accentSoft,
  },
  sendBtnOnGame: {
    backgroundColor: GAME_THEME.color.gold,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    borderBottomWidth: 3,
    borderBottomColor: GAME_THEME.color.goldLip,
    borderRadius: 4,
  },
  sendBtnOffGame: {
    backgroundColor: 'rgba(26,26,26,0.08)',
    borderWidth: 2,
    borderColor: 'rgba(26,26,26,0.25)',
    borderRadius: 4,
  },
  sendIcon: {
    zIndex: 1,
  },
});
