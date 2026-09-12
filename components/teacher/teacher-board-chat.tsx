import { Ionicons } from '@expo/vector-icons';
import { Kalam_400Regular, useFonts } from '@expo-google-fonts/kalam';
import { BlurView } from 'expo-blur';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from '@/utils/safe-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Keyboard,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import Reanimated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const COMPOSER_LINE = 22;
const COMPOSER_INPUT_MIN = COMPOSER_LINE;
const COMPOSER_INPUT_MAX = COMPOSER_LINE * 8; // как GPT — растёт вверх до ~8 строк

import {
  BoardLessonBubble,
  BoardLessonTyping,
  BoardStudentText,
} from '@/components/teacher/board-lesson-bubble';
import { BoardChalkBackdrop } from '@/components/teacher/board-chalk-backdrop';
import { FileMessageBubble } from '@/components/companion/file-message-bubble';
import { ImageMessageBubble } from '@/components/companion/image-message-bubble';
import type { TeacherComposerAttachment } from '@/components/teacher/teacher-home-composer';
import { TeacherAttachGallery } from '@/components/teacher/teacher-attach-gallery';
import { TeacherExerciseActions } from '@/components/teacher/teacher-exercise-actions';
import { findTeacherVocabSourceText } from '@/utils/teacher-message-examples';
import { useTeacherDrillSession } from '@/components/teacher/teacher-drill-session';
import { TeacherMessageBody } from '@/components/teacher/teacher-message-body';
import { WordAddSheetHost, useWordAddSheet } from '@/components/word-add-sheet';
import { detectExplicitL2Switch } from '@/utils/teacher-lesson-language';
import { setActiveStudyLanguage } from '@/utils/active-study-language';
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
import { usePlacement } from '@/contexts/placement-context';
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
  TeacherDrillFollowUp,
  TeacherExerciseItem,
  TeacherNextTopicRecommendation,
} from '@/types/companion-chat-api';
import { isFileMsg, isImageMsg, type CompanionMsg } from '@/types/companion-message';
import { persistCompanionAttachment } from '@/utils/companion-attachment-storage';
import { prepareCompanionImageForApi } from '@/utils/companion-image-base64';
import { messagesToCompanionApiHistory } from '@/utils/companion-chat-history';
import { pickCompanionPhoto } from '@/utils/pick-companion-photo';
import { setTeacherLessonBootstrap } from '@/utils/teacher-lesson-bootstrap';
import { resolveDrillTargetLanguage } from '@/utils/teacher-lesson-language';
import {
  teacherPhotoFallbackMessage,
  teacherUiLanguageFromLocale,
} from '@/utils/teacher-ui-language';
import {
  evaluateMiniDrillAccess,
  getPriorExerciseTexts,
  loadMiniDrillUsage,
  recordMiniDrillGeneration,
  saveMiniDrillUsage,
  type MiniDrillUsage,
} from '@/utils/teacher-mini-drill-usage';
import {
  getMistakeSummariesForApi,
  loadDrillMistakes,
  recordDrillMistakes,
  saveDrillMistakes,
  type TeacherDrillMistakeRecord,
} from '@/utils/teacher-drill-mistakes';
import { buildFollowUpChatMessage } from '@/utils/teacher-drill-followup';

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
  /** Готовый тред (после полёта с автомата / повторное открытие) — без «думаю». */
  initialMessages?: CompanionMsg[];
  /** Уже существующий урок — не создавать новый tl-* при открытии из списка. */
  lessonId?: string;
  lessonTopic?: string;
  seedAttachment?: TeacherComposerAttachment | null;
  language?: CompanionChatApiLanguage;
  /** Игровой chrome (cream/ink/gold) вместо iOS glass. */
  gameChrome?: boolean;
};

export function TeacherBoardChat({
  onClose,
  seedQuestion,
  initialMessages,
  lessonId,
  lessonTopic,
  seedAttachment,
  language = 'english',
  gameChrome = true,
}: Props) {
  const { t, locale } = useTranslation();
  const uiLanguage = teacherUiLanguageFromLocale(locale);

  useEffect(() => {
    setActiveStudyLanguage(language);
    return () => setActiveStudyLanguage(null);
  }, [language]);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { learnerLevel } = usePlacement();
  const [fontsLoaded] = useFonts({ Kalam_400Regular });
  const { registerUserStudyText, recordStudySwipe } = useUserProfile();
  const { addChat, saveCompanionThread } = useCompanionChats();
  const { markLessonCreated, addRecentLesson } = useTeacherJourney();
  const { recordActivity } = useEngagement();
  const { ingestTeacherText } = useLexicon();
  const drillSession = useTeacherDrillSession();
  const { animatedStyle: composerInsetStyle, isOpen: keyboardOpen } = useKeyboardInset(
    Math.max(insets.bottom, gameChrome ? 4 : 10) + (gameChrome ? 0 : 8),
  );
  const miniDrillUserId = user?.id ?? '';

  const scrollRef = useRef<ScrollView>(null);
  const composerRef = useRef<TextInput>(null);
  const lessonIdRef = useRef<string | null>(lessonId ?? null);
  const lessonTopicRef = useRef<string>(lessonTopic?.trim() || t('teacher.lessonDefault'));
  const seededRef = useRef(false);
  const sendScale = useRef(new Animated.Value(1)).current;
  const messagesRef = useRef<CompanionMsg[]>([]);

  const [messages, setMessages] = useState<CompanionMsg[]>([]);
  const [input, setInput] = useState('');
  /** Высота текста; undefined = одна строка, растёт сама. */
  const [inputHeight, setInputHeight] = useState<number | undefined>(undefined);
  const [attachOpen, setAttachOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [drillMistakes, setDrillMistakes] = useState<TeacherDrillMistakeRecord[]>([]);
  const drillSourceMessageRef = useRef<CompanionMsg | null>(null);
  const drillExplanationRef = useRef('');
  const drillLanguageRef = useRef<CompanionChatApiLanguage>(language);
  const drillGenerationTokenRef = useRef(0);
  const [drillNotice, setDrillNotice] = useState<string | null>(null);
  const drillNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [miniDrillUsage, setMiniDrillUsage] = useState<MiniDrillUsage>({ perMessage: {}, priorSets: {} });
  const [threadViewportH, setThreadViewportH] = useState(0);
  const { clearWordSelections } = useWordAddSheet();

  useEffect(() => {
    if (!input) setInputHeight(undefined);
  }, [input]);

  const dismissChatKeyboard = useCallback(() => {
    composerRef.current?.blur();
    Keyboard.dismiss();
  }, []);

  const dismissChatChrome = useCallback(() => {
    clearWordSelections();
    dismissChatKeyboard();
  }, [clearWordSelections, dismissChatKeyboard]);

  useEffect(() => {
    dismissChatKeyboard();
  }, [dismissChatKeyboard]);

  const showDrillNotice = useCallback((text: string) => {
    setDrillNotice(text);
    if (drillNoticeTimer.current) clearTimeout(drillNoticeTimer.current);
    drillNoticeTimer.current = setTimeout(() => setDrillNotice(null), 4500);
  }, []);

  useEffect(
    () => () => {
      if (drillNoticeTimer.current) clearTimeout(drillNoticeTimer.current);
    },
    [],
  );

  messagesRef.current = messages;

  useEffect(() => {
    if (!miniDrillUserId) {
      setMiniDrillUsage({ perMessage: {}, priorSets: {} });
      setDrillMistakes([]);
      return;
    }
    void loadMiniDrillUsage(miniDrillUserId).then(setMiniDrillUsage);
    void loadDrillMistakes(miniDrillUserId).then(setDrillMistakes);
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
    async (
      userText: string,
      historyBefore: CompanionMsg[],
      image?: { base64: string; mimeType: string },
    ) => {
      setTyping(true);
      try {
        const switched = detectExplicitL2Switch(userText);
        const replyLanguage = switched ?? language;
        if (switched) {
          drillLanguageRef.current = switched;
          setActiveStudyLanguage(switched);
        }
        const reply = await postTeacherChatReply({
          message: userText.trim() || (image ? teacherPhotoFallbackMessage(uiLanguage) : ''),
          conversationHistory: messagesToCompanionApiHistory(historyBefore),
          language: replyLanguage,
          uiLanguage,
          lessonTopic: lessonTopicRef.current,
          ...(learnerLevel ? { learnerLevel } : {}),
          ...(image?.base64 ? { imageBase64: image.base64, imageMimeType: image.mimeType } : {}),
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
    [ingestTeacherText, language, saveCompanionThread, t, uiLanguage],
  );

  useEffect(() => {
    if (seededRef.current) return;

    if (lessonId) {
      lessonIdRef.current = lessonId;
    }
    if (lessonTopic?.trim()) {
      lessonTopicRef.current = lessonTopic.trim();
    }

    if (initialMessages && initialMessages.length > 0) {
      seededRef.current = true;
      const titleSrc =
        lessonTopic?.trim() ||
        initialMessages.find((m) => m.from === 'me' && typeof m.text === 'string')?.text?.trim() ||
        t('teacher.lessonDefault');
      if (titleSrc) registerUserStudyText(titleSrc);
      setMessages(initialMessages);
      if (!lessonId) {
        ensureLesson(initialMessages, titleSrc);
      } else {
        lessonTopicRef.current = titleSrc;
      }
      scrollToEnd();
      return;
    }

    if (lessonId) {
      seededRef.current = true;
      setMessages([]);
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
  }, [
    ensureLesson,
    initialMessages,
    lessonId,
    lessonTopic,
    registerUserStudyText,
    requestReply,
    seedQuestion,
    t,
  ]);

  const trackUserMessage = useCallback(
    (preview: string) => {
      recordActivity({
        kind: 'message',
        messagePreview: preview.slice(0, 120),
        chatName: t('teacher.subtitle'),
        lessonTopic: lessonTopicRef.current,
      });
    },
    [recordActivity, t],
  );

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

    trackUserMessage(text);
    await requestReply(text, nextThread);
  }, [ensureLesson, input, messages, registerUserStudyText, requestReply, saveCompanionThread, sending, trackUserMessage]);

  const sendImageFromUri = useCallback(
    async (uri: string, pickedName?: string) => {
      if (sending || typing) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Keyboard.dismiss();
      setAttachOpen(false);
      setSending(true);

      const caption = input.trim();
      const msgId = `img-${Date.now()}`;
      const time = formatChatTime();
      const userMsg: CompanionMsg = {
        id: msgId,
        from: 'me',
        kind: 'image',
        imageUri: uri,
        text: caption || '📷 Фото',
        time,
        read: 'sent',
      };

      const nextThread = [...messagesRef.current, userMsg];
      setMessages(nextThread);
      if (caption) {
        setInput('');
        registerUserStudyText(caption);
      }
      ensureLesson(nextThread, caption || 'Фото');
      if (lessonIdRef.current) {
        saveCompanionThread(lessonIdRef.current, nextThread);
      }
      scrollToEnd();

      trackUserMessage(caption || '📷 Фото');
      try {
        const storedUri = await persistCompanionAttachment(uri, msgId, pickedName);
        setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, imageUri: storedUri } : m)));
        const image = await prepareCompanionImageForApi(storedUri);
        await requestReply(caption, [...messagesRef.current.filter((m) => m.id !== msgId), { ...userMsg, imageUri: storedUri }], image);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Не удалось отправить фото';
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, text: `📷 ${msg}`, read: 'read' } : m)),
        );
        setSending(false);
        setTyping(false);
      }
    },
    [ensureLesson, input, registerUserStudyText, requestReply, saveCompanionThread, sending, trackUserMessage, typing],
  );

  const handleAttachToggle = useCallback(() => {
    if (sending || typing) return;
    void Haptics.selectionAsync();
    setAttachOpen((open) => !open);
  }, [sending, typing]);

  const handlePickGallery = useCallback(() => {
    void pickCompanionPhoto().then((picked) => {
      if (picked) void sendImageFromUri(picked.uri, picked.name);
    });
  }, [sendImageFromUri]);

  const sendFileFromUri = useCallback(
    async (uri: string, fileName: string, mimeType?: string | null) => {
      if (sending || typing) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Keyboard.dismiss();
      setAttachOpen(false);
      setSending(true);

      const caption = input.trim();
      const label = fileName.trim() || 'Файл';
      const msgId = `file-${Date.now()}`;
      const time = formatChatTime();
      const userMsg: CompanionMsg = {
        id: msgId,
        from: 'me',
        kind: 'file',
        fileUri: uri,
        fileName: label,
        mimeType: mimeType ?? undefined,
        text: caption || `📎 ${label}`,
        time,
        read: 'sent',
      };

      const nextThread = [...messagesRef.current, userMsg];
      setMessages(nextThread);
      if (caption) {
        setInput('');
        registerUserStudyText(caption);
      }
      ensureLesson(nextThread, caption || label);
      if (lessonIdRef.current) {
        saveCompanionThread(lessonIdRef.current, nextThread);
      }
      scrollToEnd();

      trackUserMessage(caption || `📎 ${label}`);
      try {
        const storedUri = await persistCompanionAttachment(uri, msgId, label);
        const storedMsg: CompanionMsg = { ...userMsg, fileUri: storedUri };
        setMessages((prev) => prev.map((m) => (m.id === msgId ? storedMsg : m)));
        const apiText = caption
          ? `Пользователь отправил файл «${label}» с подписью: «${caption}». Ответь по смыслу подписи и беседы.`
          : `Пользователь отправил файл «${label}» (${mimeType ?? 'тип неизвестен'}). Ответь уместно в контексте беседы.`;
        await requestReply(apiText, [
          ...messagesRef.current.filter((m) => m.id !== msgId),
          storedMsg,
        ]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Не удалось отправить файл';
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, text: `📎 ${msg}`, read: 'read' } : m)),
        );
        setSending(false);
        setTyping(false);
      }
    },
    [
      ensureLesson,
      input,
      registerUserStudyText,
      requestReply,
      saveCompanionThread,
      sending,
      trackUserMessage,
      typing,
    ],
  );

  const handleBrowseFiles = useCallback(async () => {
    if (sending || typing) return;
    if (Platform.OS === 'web') {
      Alert.alert('Файлы', 'Выбор файлов доступен в приложении на iOS или Android.');
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      const asset = result.assets[0];
      const { uri, name, mimeType } = asset;
      const isImage =
        mimeType?.startsWith('image/') === true ||
        /\.(jpe?g|png|gif|webp|heic|bmp)$/i.test(name ?? '');

      if (isImage) {
        void sendImageFromUri(uri, name ?? undefined);
        return;
      }
      void sendFileFromUri(uri, name?.trim() || 'Файл', mimeType);
    } catch {
      Alert.alert('Файлы', 'Не удалось открыть приложение «Файлы».');
    }
  }, [sendFileFromUri, sendImageFromUri, sending, typing]);

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
        uiLanguage,
        lessonTopic: lessonTopicRef.current,
      });
      recordStudySwipe(result.correct);
      return result;
    },
    [language, recordStudySwipe, uiLanguage],
  );

  const closeDrill = useCallback(
    (summary: { correct: number; total: number } | null) => {
      drillSession.endDrill();
      if (summary && summary.correct > 0) {
        recordActivity({
          kind: 'teacher_drill',
          drillCorrect: summary.correct,
          lessonTopic: lessonTopicRef.current,
        });
      }
    },
    [drillSession, recordActivity],
  );

  const handleDrillMistakesRecorded = useCallback(
    (mistakes: Array<{
      kind: string;
      checkText: string;
      learnerAnswer: string;
      idealAnswer?: string;
      feedback?: string;
    }>) => {
      if (!miniDrillUserId || mistakes.length === 0) return;
      setDrillMistakes((prev) => {
        const next = recordDrillMistakes(prev, mistakes, {
          lessonTopic: lessonTopicRef.current,
          language: drillLanguageRef.current,
        });
        void saveDrillMistakes(miniDrillUserId, next);
        return next;
      });
    },
    [miniDrillUserId],
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

  const handleDrillFollowUpRef = useRef<(followUp: TeacherDrillFollowUp) => void>(() => {});

  const prepareDrillForMessage = useCallback(
    (source: CompanionMsg): boolean => {
      const explanation = source.text.trim();
      if (!explanation) {
        Alert.alert(t('teacher.drill.generateFailedTitle'), t('teacher.drill.emptyExplanation'));
        showDrillNotice(t('teacher.drill.emptyExplanation'));
        return false;
      }
      if (typing) {
        Alert.alert(t('teacher.drill.generateFailedTitle'), t('teacher.drill.waitForReply'));
        showDrillNotice(t('teacher.drill.waitForReply'));
        return false;
      }

      const access = evaluateMiniDrillAccess(miniDrillUsage, source.id);
      if (!access.allowed) {
        const reason =
          access.reasonKey === 'refreshLimit'
            ? t('teacher.drill.refreshLimit', { count: access.reasonCount ?? 0 })
            : access.reasonKey === 'lessonLimit'
              ? t('teacher.drill.lessonLimit', { count: access.reasonCount ?? 0 })
              : t('teacher.drill.limitFallback');
        Alert.alert(t('teacher.drill.generateFailedTitle'), reason);
        showDrillNotice(reason);
        return false;
      }

      const start = drillSession.beginGenerating(source.id);
      if (start.status === 'blocked') {
        Alert.alert(t('teacher.drill.generateFailedTitle'), t('teacher.drill.generatingInProgress'));
        showDrillNotice(t('teacher.drill.generatingInProgress'));
        return false;
      }
      if (start.status === 'already') {
        return false;
      }
      drillGenerationTokenRef.current = start.token;

      Keyboard.dismiss();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return true;
    },
    [drillSession, miniDrillUsage, showDrillNotice, t, typing],
  );

  const generateExerciseForMessage = useCallback(
    async (source: CompanionMsg) => {
      const explanation = source.text.trim();
      if (!explanation) return;

      const generationToken = drillGenerationTokenRef.current;
      const access = evaluateMiniDrillAccess(miniDrillUsage, source.id);
      const generationSeed = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const lastUser = lastUserTextBefore(messagesRef.current, source.id);
      const drillLanguage = resolveDrillTargetLanguage(language, lastUser);
      drillSourceMessageRef.current = source;
      drillExplanationRef.current = explanation;
      drillLanguageRef.current = drillLanguage;
      try {
        const { exercises: raw, nextTopic } = await postTeacherExerciseSet({
          explanation,
          lastUserMessage: lastUser,
          conversationHistory: messagesToCompanionApiHistory(messagesRef.current),
          language: drillLanguage,
          uiLanguage,
          lessonTopic: lessonTopicRef.current,
          generationSeed,
          generationAttempt: access.generationsUsed + 1,
          avoidExerciseTexts: getPriorExerciseTexts(miniDrillUsage, source.id),
          recentMistakes: getMistakeSummariesForApi(drillMistakes),
        });
        if (!drillSession.isGenerationCurrent(generationToken)) return;
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
        drillSession.beginDrill({
          sessionKey,
          exercises,
          nextTopic: nextTopic ?? null,
          followUpContext: {
            explanation,
            lessonTopic: lessonTopicRef.current,
            language: drillLanguage,
            uiLanguage,
            recentMistakes: getMistakeSummariesForApi(drillMistakes),
          },
          transcribeLanguage: language,
          onClose: closeDrill,
          onNextTopicPress: handleDrillNextTopic,
          onFollowUpPress: (followUp) => handleDrillFollowUpRef.current(followUp),
          onMistakesRecorded: handleDrillMistakesRecorded,
          onCheck: checkDrillExercise,
        });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {
        if (!drillSession.isGenerationCurrent(generationToken)) return;
        const msg = e instanceof Error ? e.message : t('teacher.drill.networkError');
        drillSession.cancelGenerating();
        showDrillNotice(t('teacher.drill.generateFailedBody', { error: msg }));
        Alert.alert(t('teacher.drill.generateFailedTitle'), t('teacher.drill.generateFailedBody', { error: msg }));
      }
    },
    [
      checkDrillExercise,
      closeDrill,
      drillMistakes,
      drillSession,
      handleDrillMistakesRecorded,
      handleDrillNextTopic,
      language,
      miniDrillUsage,
      miniDrillUserId,
      showDrillNotice,
      t,
      uiLanguage,
    ],
  );

  const handlePracticePress = useCallback(
    (message: CompanionMsg) => {
      void generateExerciseForMessage(message);
    },
    [generateExerciseForMessage],
  );

  const handleDrillFollowUp = useCallback(
    (followUp: TeacherDrillFollowUp) => {
      if (followUp.action === 'repeat_same' && drillSourceMessageRef.current) {
        setTimeout(() => {
          const msg = drillSourceMessageRef.current!;
          if (prepareDrillForMessage(msg)) void generateExerciseForMessage(msg);
        }, 120);
        return;
      }
      if (followUp.action === 'advance' && followUp.title) {
        const text = buildFollowUpChatMessage(followUp, uiLanguage);
        setTimeout(() => {
          void send(text);
          scrollRef.current?.scrollToEnd({ animated: true });
        }, 120);
        return;
      }
      const text = buildFollowUpChatMessage(followUp, uiLanguage);
      setTimeout(() => {
        void send(text);
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 120);
    },
    [generateExerciseForMessage, prepareDrillForMessage, send],
  );

  handleDrillFollowUpRef.current = handleDrillFollowUp;

  const renderPracticeActions = useCallback(
    (message: CompanionMsg) => {
      if (message.from !== 'them' || message.id.startsWith('ex-') || message.text.startsWith('Не удалось')) {
        return null;
      }
      const idx = messages.findIndex((m) => m.id === message.id);
      let lastUserMessage: string | undefined;
      for (let i = idx - 1; i >= 0; i -= 1) {
        if (messages[i]?.from === 'me') {
          lastUserMessage = messages[i].text;
          break;
        }
      }
      const vocabSource = findTeacherVocabSourceText(messages, idx >= 0 ? idx : messages.length - 1);
      return (
        <TeacherExerciseActions
          messageId={message.id}
          message={message}
          exerciseLoadingId={drillSession.messageIdLoading}
          typing={typing}
          miniAccess={evaluateMiniDrillAccess(miniDrillUsage, message.id)}
          language={language}
          uiLanguage={uiLanguage}
          lessonTopic={lessonTopicRef.current}
          lastUserMessage={lastUserMessage}
          examplesExplanation={vocabSource?.text}
          examplesCacheKey={vocabSource?.messageId}
          examplesAvailable={Boolean(vocabSource)}
          onPrepare={prepareDrillForMessage}
          onPress={handlePracticePress}
          onBlocked={showDrillNotice}
        />
      );
    },
    [
      drillSession.messageIdLoading,
      handlePracticePress,
      language,
      messages,
      miniDrillUsage,
      prepareDrillForMessage,
      showDrillNotice,
      typing,
      uiLanguage,
    ],
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
          onLayout={(e) => setThreadViewportH(e.nativeEvent.layout.height)}
          contentContainerStyle={[
            styles.thread,
            gameChrome && styles.threadGame,
            threadViewportH > 0 ? { minHeight: threadViewportH } : null,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={dismissChatChrome}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
          <Pressable
            onPress={dismissChatChrome}
            accessible={false}
            style={[
              styles.threadTapDismiss,
              threadViewportH > 0 ? { minHeight: threadViewportH } : null,
            ]}>
            {messages.map((m, idx) => {
            const isMe = m.from === 'me';
            const bubbleVariant = gameChrome ? 'game' : 'default';
            const photo = isImageMsg(m) && Boolean(m.imageUri);
            const file = isFileMsg(m);
            const caption = m.text.trim();
            const showCaption = caption.length > 0 && caption !== '📷 Фото' && !caption.startsWith('📷 ');
            const showFileCaption =
              caption.length > 0 && !caption.startsWith('📎 ') && caption !== (m.fileName ?? '');

            if (isMe && photo && m.imageUri) {
              return (
                <FadeInView key={m.id} delay={idx * 60} offsetY={10} duration={380}>
                  <View style={styles.photoOnlyWrap}>
                    <View style={styles.photoBody}>
                      <ImageMessageBubble uri={m.imageUri} outgoing />
                      {showCaption ? (
                        <BoardLessonBubble side="student" compact variant={bubbleVariant}>
                          <BoardStudentText markerFamily={markerFamily} game={gameChrome}>
                            {caption}
                          </BoardStudentText>
                        </BoardLessonBubble>
                      ) : null}
                    </View>
                  </View>
                </FadeInView>
              );
            }

            if (isMe && file) {
              return (
                <FadeInView key={m.id} delay={idx * 60} offsetY={10} duration={380}>
                  <View style={styles.photoOnlyWrap}>
                    <View style={styles.photoBody}>
                      <BoardLessonBubble side="student" compact variant={bubbleVariant}>
                        <FileMessageBubble fileName={m.fileName?.trim() || 'Файл'} outgoing />
                      </BoardLessonBubble>
                      {showFileCaption ? (
                        <BoardLessonBubble side="student" compact variant={bubbleVariant}>
                          <BoardStudentText markerFamily={markerFamily} game={gameChrome}>
                            {caption}
                          </BoardStudentText>
                        </BoardLessonBubble>
                      ) : null}
                    </View>
                  </View>
                </FadeInView>
              );
            }

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
                      practiceActions={renderPracticeActions(m)}
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
          </Pressable>
        </ScrollView>

        <WordAddSheetHost />

        <Reanimated.View
          style={[
            styles.composerWrap,
            gameChrome && styles.composerWrapGame,
            composerInsetStyle,
          ]}>
          {drillNotice ? (
            <FadeInView offsetY={8} duration={260} style={styles.drillToastHost}>
              <Pressable
                onPress={() => setDrillNotice(null)}
                accessibilityRole="button"
                accessibilityLabel={t('teacher.drill.limitToastTitle')}
                style={({ pressed }) => [
                  styles.drillToastLip,
                  pressed && styles.drillToastLipPressed,
                ]}>
                <View style={[styles.drillToast, gameChrome && styles.drillToastGame]}>
                  <View style={[styles.drillToastIconWrap, gameChrome && styles.drillToastIconWrapGame]}>
                    <Ionicons
                      name="barbell-outline"
                      size={16}
                      color={gameChrome ? GAME_THEME.color.cream : GAME_THEME.color.ink}
                    />
                  </View>
                  <View style={styles.drillToastCopy}>
                    <Text style={[styles.drillToastEyebrow, gameChrome && styles.drillToastEyebrowGame]}>
                      {t('teacher.drill.limitToastTitle')}
                    </Text>
                    <Text style={[styles.drillToastText, gameChrome && styles.drillToastTextGame]}>
                      {drillNotice}
                    </Text>
                  </View>
                  <Ionicons
                    name="close"
                    size={16}
                    color={gameChrome ? 'rgba(26,26,26,0.35)' : 'rgba(26,26,26,0.4)'}
                  />
                </View>
              </Pressable>
            </FadeInView>
          ) : null}

          {gameChrome ? null : <BlurView intensity={38} tint="light" style={styles.composerBlur} />}

          {attachOpen ? (
            <View style={styles.attachPanel}>
              <TeacherAttachGallery
                visible={attachOpen}
                onPhotoSelected={(uri) => void sendImageFromUri(uri)}
              />
              <Pressable
                onPress={() => void handleBrowseFiles()}
                style={({ pressed }) => [
                  styles.attachGalleryBtn,
                  gameChrome && styles.attachGalleryBtnGame,
                  pressed && styles.attachGalleryBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Выбрать файл">
                <Ionicons name="document-outline" size={18} color={gameChrome ? GAME_THEME.color.ink : APP_THEME.color.textSoft} />
                <Text style={[styles.attachGalleryLabel, gameChrome && styles.attachGalleryLabelGame]}>
                  Файлы
                </Text>
              </Pressable>
              <Pressable
                onPress={handlePickGallery}
                style={({ pressed }) => [
                  styles.attachGalleryBtn,
                  gameChrome && styles.attachGalleryBtnGame,
                  pressed && styles.attachGalleryBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Выбрать фото из галереи">
                <Ionicons name="images-outline" size={18} color={gameChrome ? GAME_THEME.color.ink : APP_THEME.color.textSoft} />
                <Text style={[styles.attachGalleryLabel, gameChrome && styles.attachGalleryLabelGame]}>
                  Галерея
                </Text>
              </Pressable>
            </View>
          ) : null}

          {gameChrome ? (
            <View style={styles.composerShellGameGpt}>
              <TextInput
                ref={composerRef}
                value={input}
                onChangeText={(text) => {
                  setInput(text);
                  if (!text) setInputHeight(COMPOSER_INPUT_MIN);
                }}
                placeholder={t('teacher.boardChatPlaceholder')}
                placeholderTextColor="rgba(26,26,26,0.38)"
                style={[
                  styles.composerInputGameGpt,
                  {
                    minHeight: COMPOSER_INPUT_MIN,
                    maxHeight: COMPOSER_INPUT_MAX,
                    // iOS сам растягивает multiline; height фиксируем на Android
                    ...(Platform.OS === 'android'
                      ? { height: inputHeight ?? COMPOSER_INPUT_MIN }
                      : null),
                  },
                ]}
                multiline
                maxLength={2000}
                editable={!sending}
                blurOnSubmit={false}
                scrollEnabled={(inputHeight ?? COMPOSER_INPUT_MIN) >= COMPOSER_INPUT_MAX - 2}
                textAlignVertical="top"
                onContentSizeChange={(e) => {
                  const raw = Math.ceil(e.nativeEvent.contentSize.height);
                  const next = Math.min(COMPOSER_INPUT_MAX, Math.max(COMPOSER_INPUT_MIN, raw));
                  setInputHeight((prev) => {
                    if (prev != null && Math.abs(prev - next) < 1) return prev;
                    LayoutAnimation.configureNext({
                      duration: 120,
                      update: { type: LayoutAnimation.Types.easeInEaseOut },
                    });
                    return next;
                  });
                }}
                onFocus={() => {
                  clearWordSelections();
                  setAttachOpen(false);
                  setTimeout(() => {
                    scrollRef.current?.scrollToEnd({ animated: true });
                  }, 220);
                }}
              />
              <View style={styles.composerToolbarGame}>
                <Pressable
                  onPress={handleAttachToggle}
                  disabled={sending || typing}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={attachOpen ? 'Закрыть вложения' : 'Прикрепить фото или файл'}
                  style={({ pressed }) => [
                    styles.attachBtnGameIn,
                    attachOpen && styles.attachBtnGameOn,
                    pressed && styles.attachBtnGamePressed,
                    (sending || typing) && styles.attachBtnOff,
                  ]}>
                  <Ionicons
                    name={attachOpen ? 'close' : 'add'}
                    size={22}
                    color={GAME_THEME.color.ink}
                  />
                </Pressable>
                <Pressable
                  onPress={() => void send()}
                  onPressIn={pressSendIn}
                  onPressOut={pressSendOut}
                  disabled={!canSend}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Отправить">
                  {({ pressed }) => (
                    <Animated.View
                      style={[
                        styles.sendBtn,
                        styles.sendBtnGameIn,
                        canSend ? styles.sendBtnOnGame : styles.sendBtnOffGame,
                        canSend && pressed && styles.sendBtnOnGamePressed,
                        { transform: [{ scale: sendScale }] },
                      ]}>
                      <Ionicons
                        name="arrow-up"
                        size={18}
                        color={canSend ? GAME_THEME.color.ink : 'rgba(26,26,26,0.32)'}
                        style={styles.sendIcon}
                      />
                    </Animated.View>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
          <View style={[styles.composerShell, styles.composerShellIos]}>
            <Pressable
              onPress={handleAttachToggle}
              disabled={sending || typing}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={attachOpen ? 'Закрыть вложения' : 'Прикрепить фото или файл'}
              style={({ pressed }) => [
                styles.attachBtn,
                attachOpen && styles.attachBtnOn,
                pressed && styles.attachBtnPressed,
                (sending || typing) && styles.attachBtnOff,
              ]}>
              <Ionicons
                name={attachOpen ? 'close' : 'add'}
                size={22}
                color={APP_THEME.color.textSoft}
              />
            </Pressable>

            <View style={styles.composerField}>
              <TextInput
                ref={composerRef}
                value={input}
                onChangeText={(text) => {
                  setInput(text);
                  if (!text) setInputHeight(undefined);
                }}
                placeholder={t('teacher.boardChatPlaceholder')}
                placeholderTextColor={TEACHER_MUTED_SOFT}
                style={[
                  styles.composerInput,
                  {
                    minHeight: COMPOSER_INPUT_MIN,
                    maxHeight: COMPOSER_INPUT_MAX,
                    ...(inputHeight != null ? { height: inputHeight } : null),
                  },
                ]}
                multiline
                maxLength={2000}
                editable={!sending}
                blurOnSubmit={false}
                scrollEnabled={(inputHeight ?? 0) >= COMPOSER_INPUT_MAX - 2}
                textAlignVertical="top"
                onContentSizeChange={(e) => {
                  const raw = Math.ceil(e.nativeEvent.contentSize.height) + 4;
                  const next = Math.min(COMPOSER_INPUT_MAX, Math.max(COMPOSER_INPUT_MIN, raw));
                  setInputHeight((prev) => {
                    if (prev != null && Math.abs(prev - next) < 1) return prev;
                    LayoutAnimation.configureNext({
                      duration: 140,
                      update: { type: LayoutAnimation.Types.easeInEaseOut },
                    });
                    return next;
                  });
                }}
                onFocus={() => {
                  clearWordSelections();
                  setAttachOpen(false);
                  setTimeout(() => {
                    scrollRef.current?.scrollToEnd({ animated: true });
                  }, 220);
                }}
              />
            </View>
            <Pressable
              onPress={() => void send()}
              onPressIn={pressSendIn}
              onPressOut={pressSendOut}
              disabled={!canSend}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Отправить">
              {({ pressed }) => (
                <Animated.View
                  style={[
                    styles.sendBtn,
                    canSend ? styles.sendBtnOn : styles.sendBtnOff,
                    { transform: [{ scale: sendScale }] },
                  ]}>
                  <Ionicons
                    name="arrow-up"
                    size={20}
                    color={canSend ? '#FFFFFF' : 'rgba(26,26,26,0.32)'}
                    style={styles.sendIcon}
                  />
                </Animated.View>
              )}
            </Pressable>
          </View>
          )}
        </Reanimated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: APP_THEME.color.bgSoft,
    position: 'relative',
  },
  rootGame: {
    backgroundColor: GAME_THEME.color.cream,
  },
  flex: {
    flex: 1,
  },
  drillToastHost: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    zIndex: 5,
  },
  drillToastLip: {
    borderRadius: 7,
    backgroundColor: GAME_THEME.color.goldLip,
    paddingBottom: 3,
  },
  drillToastLipPressed: {
    paddingBottom: 1,
    transform: [{ translateY: 2 }],
  },
  drillToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: GAME_THEME.color.paper,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  drillToastGame: {
    backgroundColor: '#E8F1FF',
    borderWidth: GAME_THEME.border.thick,
  },
  drillToastIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GAME_THEME.color.sky,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  drillToastIconWrapGame: {
    backgroundColor: GAME_THEME.color.sky,
  },
  drillToastCopy: {
    flex: 1,
    gap: 2,
    paddingRight: 2,
  },
  drillToastEyebrow: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: GAME_THEME.color.goldLip,
  },
  drillToastEyebrowGame: {
    color: GAME_THEME.color.goldLip,
  },
  drillToastText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: GAME_THEME.color.ink,
    letterSpacing: -0.1,
  },
  drillToastTextGame: {
    fontWeight: '700',
    color: GAME_THEME.color.ink,
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: APP_THEME.color.border,
  },
  headerGame: {
    borderBottomWidth: 0,
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
  threadTapDismiss: {
    flexGrow: 1,
    width: '100%',
  },
  teacherText: {
    fontSize: 16,
    lineHeight: 24,
    color: TEACHER_TITLE,
    letterSpacing: -0.2,
  },
  teacherTextGame: {
    color: GAME_THEME.color.ink,
    fontSize: 16.5,
    lineHeight: 24,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  composerWrap: {
    paddingHorizontal: 14,
    paddingTop: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  composerWrapGame: {
    borderTopWidth: 0,
    backgroundColor: GAME_THEME.color.cream,
    paddingHorizontal: 0,
    paddingTop: 6,
    overflow: 'visible',
  },
  /** Как ChatGPT: одна капсула — текст сверху, кнопки снизу, растёт вверх */
  composerShellGameGpt: {
    marginHorizontal: 12,
    marginBottom: 2,
    borderRadius: 26,
    backgroundColor: '#F7FAFF',
    borderWidth: 2.5,
    borderColor: GAME_THEME.color.ink,
    borderBottomWidth: 4,
    borderBottomColor: GAME_THEME.color.goldLip,
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  composerInputGameGpt: {
    width: '100%',
    color: GAME_THEME.color.ink,
    fontWeight: '700',
    fontSize: 16,
    lineHeight: COMPOSER_LINE,
    letterSpacing: -0.25,
    paddingTop: Platform.OS === 'ios' ? 2 : 0,
    paddingBottom: 6,
    paddingHorizontal: 4,
    includeFontPadding: false,
  },
  composerToolbarGame: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  attachBtnGameIn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  sendBtnGameIn: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    paddingLeft: 12,
    paddingRight: 12,
    paddingVertical: 12,
    gap: 8,
    alignItems: 'flex-end',
  },
  attachPanel: {
    width: '100%',
    paddingHorizontal: 10,
    paddingTop: 8,
    gap: 8,
    zIndex: 2,
  },
  attachGalleryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: APP_THEME.radius.md,
    backgroundColor: APP_THEME.color.elevated,
  },
  attachGalleryBtnGame: {
    backgroundColor: GAME_THEME.color.paper,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    borderRadius: GAME_THEME.radius.button,
  },
  attachGalleryBtnPressed: {
    opacity: 0.85,
  },
  attachGalleryLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: APP_THEME.color.textSoft,
  },
  attachGalleryLabelGame: {
    fontWeight: '800',
    color: GAME_THEME.color.ink,
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    backgroundColor: APP_THEME.color.accentSoft,
  },
  attachBtnGame: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginBottom: 0,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2.5,
    borderColor: GAME_THEME.color.ink,
    borderBottomWidth: 4,
    borderBottomColor: GAME_THEME.color.goldLip,
  },
  attachBtnOn: {
    backgroundColor: APP_THEME.color.accentGlass,
  },
  attachBtnGameOn: {
    backgroundColor: GAME_THEME.color.paperWarm,
  },
  attachBtnPressed: {
    opacity: 0.85,
  },
  attachBtnGamePressed: {
    borderBottomWidth: 2.5,
    transform: [{ translateY: 1.5 }],
  },
  attachBtnOff: {
    opacity: 0.4,
  },
  photoOnlyWrap: {
    width: '100%',
    alignItems: 'flex-end',
    marginVertical: 8,
  },
  photoBody: {
    gap: 8,
    maxWidth: '84%',
    alignItems: 'flex-end',
  },
  composerField: {
    flex: 1,
    minWidth: 0,
  },
  composerFieldGame: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: '#F7FAFF',
    borderWidth: 2.5,
    borderColor: GAME_THEME.color.ink,
    borderBottomWidth: 4,
    borderBottomColor: GAME_THEME.color.goldLip,
    overflow: 'hidden',
  },
  composerFieldGameFilled: {
    backgroundColor: GAME_THEME.color.cream,
  },
  composerInput: {
    width: '100%',
    fontSize: 16,
    lineHeight: COMPOSER_LINE,
    color: TEACHER_TITLE,
    paddingTop: Platform.OS === 'ios' ? 1 : 0,
    paddingBottom: Platform.OS === 'ios' ? 1 : 0,
    paddingHorizontal: 2,
    letterSpacing: -0.18,
    includeFontPadding: false,
  },
  composerInputGame: {
    width: '100%',
    color: GAME_THEME.color.ink,
    fontWeight: '700',
    fontSize: 16,
    lineHeight: COMPOSER_LINE,
    letterSpacing: -0.25,
    paddingTop: Platform.OS === 'ios' ? 1 : 0,
    paddingBottom: Platform.OS === 'ios' ? 1 : 0,
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
    width: 44,
    height: 44,
    marginBottom: 0,
    overflow: 'visible',
    backgroundColor: GAME_THEME.color.sky,
    borderWidth: 2.5,
    borderColor: GAME_THEME.color.ink,
    borderBottomWidth: 4,
    borderBottomColor: GAME_THEME.color.goldLip,
    borderRadius: 22,
  },
  sendBtnOnGamePressed: {
    borderBottomWidth: 2.5,
  },
  sendBtnOffGame: {
    width: 44,
    height: 44,
    marginBottom: 0,
    overflow: 'visible',
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2.5,
    borderColor: GAME_THEME.color.ink,
    borderBottomWidth: 4,
    borderBottomColor: GAME_THEME.color.goldLip,
    borderRadius: 22,
    opacity: 0.45,
  },
  sendIcon: {
    zIndex: 1,
  },
});
