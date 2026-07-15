import { Ionicons } from '@expo/vector-icons';
import { Kalam_400Regular, useFonts } from '@expo-google-fonts/kalam';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
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
import { TeacherMessageBody } from '@/components/teacher/teacher-message-body';
import {
  TEACHER_MUTED,
  TEACHER_MUTED_SOFT,
  TEACHER_TITLE,
  teacherLessonColor,
} from '@/components/teacher/teacher-tokens';
import { BrandGradient, FadeInView, GlowCard } from '@/components/ui';
import { APP_THEME } from '@/constants/theme';
import { TearzBoardChatAvatar } from '@/components/teacher/tearz-board-chat-avatar';
import { useCompanionChats } from '@/contexts/companion-chats-context';
import { useTranslation } from '@/contexts/locale-context';
import { useTeacherJourney } from '@/contexts/teacher-journey-context';
import { useUserProfile } from '@/contexts/user-profile-context';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';
import { postTeacherChatReply } from '@/services/companion-chat-ai';
import type { CompanionChatApiLanguage } from '@/types/companion-chat-api';
import type { CompanionMsg } from '@/types/companion-message';
import { messagesToCompanionApiHistory } from '@/utils/companion-chat-history';
import { setTeacherLessonBootstrap } from '@/utils/teacher-lesson-bootstrap';
function formatChatTime(d = new Date()) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

type Props = {
  onClose: () => void;
  /** Первый вопрос с доски — сразу уходит в обработку. */
  seedQuestion?: string;
  seedAttachment?: TeacherComposerAttachment | null;
  language?: CompanionChatApiLanguage;
};

export function TeacherBoardChat({
  onClose,
  seedQuestion,
  seedAttachment,
  language = 'russian',
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({ Kalam_400Regular });
  const { registerUserStudyText } = useUserProfile();
  const { addChat, saveCompanionThread } = useCompanionChats();
  const { markLessonCreated, addRecentLesson } = useTeacherJourney();
  const { animatedStyle: composerInsetStyle, isOpen: keyboardOpen } = useKeyboardInset(insets.bottom + 8);

  const scrollRef = useRef<ScrollView>(null);
  const lessonIdRef = useRef<string | null>(null);
  const lessonTopicRef = useRef<string>(t('teacher.lessonDefault'));
  const seededRef = useRef(false);
  const sendScale = useRef(new Animated.Value(1)).current;

  const [messages, setMessages] = useState<CompanionMsg[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [sending, setSending] = useState(false);

  const scrollToEnd = () => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

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
    [language, saveCompanionThread, t],
  );

  useEffect(() => {
    const q = seedQuestion?.trim();
    if (!q || seededRef.current) return;
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
  }, [ensureLesson, registerUserStudyText, requestReply, seedQuestion]);

  useEffect(() => {
    if (!keyboardOpen) return;
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(id);
  }, [keyboardOpen, messages.length, typing]);

  const send = useCallback(async () => {
    const text = input.trim();
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
    <View style={styles.root}>
      <BoardChalkBackdrop style={StyleSheet.absoluteFill} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
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
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}>
              <Ionicons name="chevron-down" size={22} color={TEACHER_MUTED} />
            </Pressable>

            <View style={styles.headerCenter}>
              <TearzBoardChatAvatar size={36} bordered={false} />
              <Text style={styles.headerTitle}>Tearz</Text>
            </View>

            <View style={styles.headerSpacer} />
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.thread}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
          {messages.map((m, idx) => {
            const isMe = m.from === 'me';
            return (
              <FadeInView key={m.id} delay={idx * 60} offsetY={10} duration={380}>
                <BoardLessonBubble
                  side={isMe ? 'student' : 'teacher'}
                  compact={m.text.length < 56}>
                  {isMe ? (
                    <BoardStudentText markerFamily={markerFamily}>{m.text}</BoardStudentText>
                  ) : (
                    <TeacherMessageBody text={m.text} messageId={m.id} textStyle={styles.teacherText} />
                  )}
                </BoardLessonBubble>
              </FadeInView>
            );
          })}

          {typing ? (
            <FadeInView delay={40} offsetY={8} duration={300}>
              <BoardLessonTyping label={t('teacher.boardChatTyping')} />
            </FadeInView>
          ) : null}
        </ScrollView>

        <Reanimated.View
          style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, 14) }, composerInsetStyle]}>
          <BlurView intensity={38} tint="light" style={styles.composerBlur} />
          <GlowCard
            radius={APP_THEME.radius.xxl}
            glowStrength={0.34}
            borderColor={APP_THEME.color.borderStrong}
            backgroundColor={APP_THEME.color.glassStrong}
            style={styles.composerShell}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={t('teacher.boardChatPlaceholder')}
              placeholderTextColor={TEACHER_MUTED_SOFT}
              style={styles.composerInput}
              multiline
              maxLength={2000}
              editable={!sending}
              blurOnSubmit={false}
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
                  canSend ? styles.sendBtnOn : styles.sendBtnOff,
                  { transform: [{ scale: sendScale }] },
                ]}>
                {canSend ? <BrandGradient borderRadius={18} direction="diagonal" /> : null}
                <Ionicons
                  name="arrow-up"
                  size={18}
                  color={canSend ? '#FFFFFF' : TEACHER_MUTED_SOFT}
                  style={styles.sendIcon}
                />
              </Animated.View>
            </Pressable>
          </GlowCard>
        </Reanimated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: APP_THEME.color.bgSoft,
  },
  flex: {
    flex: 1,
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: APP_THEME.color.border,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
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
  thread: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 24,
    flexGrow: 1,
  },
  teacherText: {
    fontSize: 16,
    lineHeight: 24,
    color: TEACHER_TITLE,
    letterSpacing: -0.2,
  },
  composerWrap: {
    paddingHorizontal: 14,
    paddingTop: 10,
    position: 'relative',
    overflow: 'hidden',
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
  composerInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    color: TEACHER_TITLE,
    maxHeight: 120,
    paddingVertical: 8,
    letterSpacing: -0.18,
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
  sendIcon: {
    zIndex: 1,
  },
});
