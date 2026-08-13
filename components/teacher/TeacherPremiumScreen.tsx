import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  TearzBoardComposer,
  type TeacherComposerAttachment,
  type TeacherHomeComposerRef,
} from '@/components/teacher/tearz-board-composer';
import { GameWindowShell } from '@/components/game/game-window-shell';
import { TeacherLessonWindow } from '@/components/teacher/teacher-lesson-window';
import { TeacherLessonSwipeItem } from '@/components/teacher/teacher-lesson-swipe-item';
import { TearzThinking } from '@/components/teacher/tearz-thinking';
import { GAME_THEME } from '@/constants/game-theme';
import { translate, type AppLocale } from '@/constants/i18n/translations';
import { APP_THEME } from '@/constants/theme';
import { useTranslation } from '@/contexts/locale-context';
import type { CompanionMsg } from '@/types/companion-message';
import { persistCompanionAttachment } from '@/utils/companion-attachment-storage';
import { setTeacherLessonBootstrap } from '@/utils/teacher-lesson-bootstrap';
import {
  TEACHER_MUTED,
  TEACHER_TITLE,
  teacherLessonColor,
} from '@/components/teacher/teacher-tokens';
import { useCompanionChats } from '@/contexts/companion-chats-context';
import { useTeacherJourney, type TeacherRecentLesson } from '@/contexts/teacher-journey-context';
import { useUserProfile } from '@/contexts/user-profile-context';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function configureRecentLessonDeleteLayout() {
  LayoutAnimation.configureNext(
    Platform.OS === 'ios'
      ? {
          duration: 380,
          update: { type: LayoutAnimation.Types.spring, springDamping: 0.78 },
          delete: {
            type: LayoutAnimation.Types.spring,
            springDamping: 0.7,
            property: LayoutAnimation.Properties.opacity,
          },
        }
      : {
          duration: 300,
          update: { type: LayoutAnimation.Types.easeInEaseOut },
          delete: {
            type: LayoutAnimation.Types.easeInEaseOut,
            property: LayoutAnimation.Properties.opacity,
          },
        },
  );
}

const SEND_BTN_ACTIVE = '#F4F4F5';
const SEND_ICON_ACTIVE = '#09090B';

function LessonSeparator() {
  return <View style={styles.lessonSeparator} />;
}

function formatLessonTime(ts: number, locale: AppLocale): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return translate(locale, 'teacher.yesterday');
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatChatClock(d = new Date()) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatLessonSpent(locale: AppLocale, seconds?: number): string {
  const s = seconds ?? 0;
  if (s < 60) return translate(locale, 'teacher.lessonStart');
  const mTotal = Math.floor(s / 60);
  const h = Math.floor(mTotal / 60);
  const m = mTotal % 60;
  if (h >= 1) return m > 0 ? `${h}\u00a0ч\u00a0${m}\u00a0мин` : `${h}\u00a0ч`;
  return `${mTotal}\u00a0мин`;
}

export function TeacherPremiumScreen() {
  const { t, locale } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { chats, addChat, removeChat, saveCompanionThread, getCompanionThread } = useCompanionChats();
  const {
    ready,
    markLessonCreated,
    lessons,
    addRecentLesson,
    removeRecentLesson,
    renameRecentLesson,
  } = useTeacherJourney();
  const { registerUserStudyText } = useUserProfile();

  const composerRef = useRef<TeacherHomeComposerRef>(null);
  const [chatsOpen, setChatsOpen] = useState(false);
  const [boardChatOpen, setBoardChatOpen] = useState(false);
  const [boardSeed, setBoardSeed] = useState('');
  const [boardLessonId, setBoardLessonId] = useState<string | undefined>();
  const [boardLessonTopic, setBoardLessonTopic] = useState<string | undefined>();
  const [boardInitialMessages, setBoardInitialMessages] = useState<CompanionMsg[] | undefined>();
  const [composerFocused, setComposerFocused] = useState(false);
  const topBarFade = useRef(new Animated.Value(1)).current;
  const chatFade = useRef(new Animated.Value(0)).current;

  /** Все чаты с учителем: уроки + любые tl-* из хранилища чатов. */
  const teacherChatRows = useMemo(() => {
    const byId = new Map<string, TeacherRecentLesson>();
    for (const lesson of lessons) {
      byId.set(lesson.id, lesson);
    }
    for (const c of chats) {
      if (!c.id.startsWith('tl-') && c.presence !== 'урок') continue;
      if (byId.has(c.id)) continue;
      byId.set(c.id, {
        id: c.id,
        title: c.profileMetaLine?.trim() || c.preview?.trim() || 'Урок',
        subtitle: 'Преподаватель',
        createdAt: Date.now(),
        spentSecondsTotal: 0,
      });
    }
    return Array.from(byId.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [chats, lessons]);

  // ── Typewriter «Что тебе объяснить?» ─────────────────────────────────────
  const prompts = useMemo(
    () => [
      t('teacher.tirzikPrompt1'),
      t('teacher.tirzikPrompt2'),
      t('teacher.tirzikPrompt3'),
      t('teacher.tirzikPrompt4'),
    ],
    [t],
  );
  const [typed, setTyped] = useState('');

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let idx = 0;
    let char = 0;
    let mode: 'typing' | 'hold' | 'deleting' = 'typing';

    const step = () => {
      if (cancelled) return;
      const full = prompts[idx % prompts.length] ?? '';
      if (mode === 'typing') {
        char = Math.min(full.length, char + 1);
        setTyped(full.slice(0, char));
        if (char >= full.length) {
          mode = 'hold';
          timer = setTimeout(step, 1900);
        } else {
          timer = setTimeout(step, 52 + Math.random() * 46);
        }
      } else if (mode === 'hold') {
        mode = 'deleting';
        timer = setTimeout(step, 60);
      } else {
        char = Math.max(0, char - 1);
        setTyped(full.slice(0, char));
        if (char <= 0) {
          mode = 'typing';
          idx += 1;
          timer = setTimeout(step, 360);
        } else {
          timer = setTimeout(step, 26);
        }
      }
    };

    timer = setTimeout(step, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [prompts]);

  // ── Hero: маскот остаётся видимым и при фокусе (он сам реагирует — прячется/выглядывает)
  const heroFade = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    useCallback(() => {
      heroFade.setValue(1);
    }, [heroFade]),
  );

  useEffect(() => {
    Animated.timing(topBarFade, {
      toValue: boardChatOpen ? 0 : 1,
      duration: boardChatOpen ? 240 : 360,
      easing: boardChatOpen ? Easing.out(Easing.cubic) : Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    Animated.timing(chatFade, {
      toValue: boardChatOpen ? 1 : 0,
      duration: boardChatOpen ? 420 : 280,
      delay: boardChatOpen ? 340 : 0,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [boardChatOpen, topBarFade, chatFade]);

  // ── Переименование урока ─────────────────────────────────────────────────
  const [renameTarget, setRenameTarget] = useState<TeacherRecentLesson | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameInputFocused, setRenameInputFocused] = useState(false);
  const renameBackdrop = useRef(new Animated.Value(0)).current;
  const renameCardAnim = useRef(new Animated.Value(0)).current;
  const renameOpenRun = useRef<Animated.CompositeAnimation | null>(null);
  const renameClosing = useRef(false);
  const renameInputRef = useRef<TextInput>(null);

  useLayoutEffect(() => {
    if (!renameTarget) return;
    renameClosing.current = false;
    renameOpenRun.current?.stop();
    renameBackdrop.setValue(0);
    renameCardAnim.setValue(0);
    renameOpenRun.current = Animated.parallel([
      Animated.timing(renameBackdrop, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(renameCardAnim, {
        toValue: 1,
        friction: 8.2,
        tension: 58,
        useNativeDriver: true,
      }),
    ]);
    renameOpenRun.current.start();
  }, [renameTarget?.id]);

  useEffect(() => {
    if (!renameTarget) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const handle = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      timeoutId = setTimeout(() => {
        if (!cancelled) renameInputRef.current?.focus();
      }, 380);
    });
    return () => {
      cancelled = true;
      handle.cancel();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [renameTarget?.id]);

  const handleBoardSubmit = (question: string, _attachment?: TeacherComposerAttachment | null) => {
    const q = question.trim();
    if (!q) return;
    setBoardLessonId(undefined);
    setBoardLessonTopic(undefined);
    setBoardInitialMessages(undefined);
    setBoardSeed(q);
    setBoardChatOpen(true);
  };

  const closeBoardChat = () => {
    setBoardChatOpen(false);
    setBoardSeed('');
    setBoardLessonId(undefined);
    setBoardLessonTopic(undefined);
    setBoardInitialMessages(undefined);
    composerRef.current?.clear();
  };

  const renameCardMotion = useMemo(
    () => ({
      opacity: renameCardAnim,
      transform: [
        { translateY: renameCardAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
        { scale: renameCardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
      ],
    }),
    [renameCardAnim],
  );

  const startLessonWithQuestion = async (
    question: string,
    attachment?: TeacherComposerAttachment | null,
  ) => {
    Animated.timing(heroFade, {
      toValue: 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const id = `tl-${Date.now()}`;
    const lessonColor = teacherLessonColor(id);
    const now = new Date();
    const time = formatChatClock(now);
    const q = question.trim();
    if (q) registerUserStudyText(q);

    const bootstrap: CompanionMsg[] = [];
    if (q) {
      bootstrap.push({ id: 'seed', from: 'me', text: q, time, read: 'read' });
    }

    if (attachment) {
      const msgId = attachment.kind === 'image' ? `img-${Date.now()}` : `file-${Date.now()}`;
      const label =
        attachment.kind === 'image' ? attachment.name?.trim() || 'Фото' : attachment.fileName;
      try {
        const storedUri = await persistCompanionAttachment(
          attachment.uri,
          msgId,
          attachment.kind === 'file' ? attachment.fileName : attachment.name,
        );
        if (attachment.kind === 'image') {
          bootstrap.push({
            id: msgId,
            from: 'me',
            kind: 'image',
            imageUri: storedUri,
            text: '📷 Фото',
            time,
            read: 'read',
          });
        } else {
          bootstrap.push({
            id: msgId,
            from: 'me',
            kind: 'file',
            fileUri: storedUri,
            fileName: attachment.fileName,
            mimeType: attachment.mimeType ?? undefined,
            text: `📎 ${label}`,
            time,
            read: 'read',
          });
        }
      } catch {
        if (attachment.kind === 'image') {
          bootstrap.push({
            id: msgId,
            from: 'me',
            kind: 'image',
            imageUri: attachment.uri,
            text: '📷 Фото',
            time,
            read: 'read',
          });
        } else {
          bootstrap.push({
            id: msgId,
            from: 'me',
            kind: 'file',
            fileUri: attachment.uri,
            fileName: attachment.fileName,
            mimeType: attachment.mimeType ?? undefined,
            text: `📎 ${label}`,
            time,
            read: 'read',
          });
        }
      }
    }

    const titleSource =
      q || (attachment?.kind === 'image' ? 'Фото' : attachment?.fileName) || 'Урок';
    const title = titleSource.length > 72 ? `${titleSource.slice(0, 72)}…` : titleSource;
    const preview = q
      ? q.length > 80
        ? `${q.slice(0, 80)}…`
        : q
      : attachment?.kind === 'image'
        ? '📷 Фото'
        : attachment
          ? `📎 ${attachment.fileName}`
          : 'Урок';
    const createdAt = Date.now();

    if (bootstrap.length > 0) {
      setTeacherLessonBootstrap(id, bootstrap);
      saveCompanionThread(id, bootstrap);
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
    composerRef.current?.clear();
    router.push({
      pathname: '/companion-chat',
      params: {
        id,
        name: 'Преподаватель',
        online: '1',
        letter: 'T',
        color: lessonColor,
        mode: 'teacher',
        lessonTopic: encodeURIComponent(title),
        ...(q ? { seed: encodeURIComponent(q) } : {}),
      },
    });
  };

  const openTeacherLessonChat = (lesson: TeacherRecentLesson) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setChatsOpen(false);
    setBoardSeed('');
    setBoardLessonId(lesson.id);
    setBoardLessonTopic(lesson.title);
    setBoardInitialMessages(getCompanionThread(lesson.id) ?? []);
    setBoardChatOpen(true);
  };

  const beginRenameLesson = useCallback((lesson: TeacherRecentLesson) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRenameTarget(lesson);
    setRenameDraft(lesson.title);
  }, []);

  const closeRenameModal = (silentHaptic?: boolean) => {
    if (!renameTarget || renameClosing.current) return;
    renameClosing.current = true;
    renameOpenRun.current?.stop();
    if (!silentHaptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.timing(renameBackdrop, {
        toValue: 0,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(renameCardAnim, {
        toValue: 0,
        duration: 280,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      renameClosing.current = false;
      if (finished) {
        setRenameTarget(null);
        setRenameDraft('');
        setRenameInputFocused(false);
      }
    });
  };

  const saveRenameLesson = () => {
    if (!renameTarget) return;
    const title = renameDraft.trim();
    if (!title) return;
    registerUserStudyText(title);
    void renameRecentLesson(renameTarget.id, title);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    closeRenameModal(true);
  };

  const confirmDeleteLesson = useCallback(
    (lesson: TeacherRecentLesson) => {
      Alert.alert(
        t('teacher.deleteLessonTitle'),
        t('teacher.deleteLessonMessage', { title: lesson.title }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: () => {
              requestAnimationFrame(() => {
                configureRecentLessonDeleteLayout();
                void removeRecentLesson(lesson.id);
                removeChat(lesson.id);
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              });
            },
          },
        ],
      );
    },
    [removeChat, removeRecentLesson, t],
  );

  const renderLessonRow = useCallback(
    ({ item: lesson, index }: ListRenderItemInfo<TeacherRecentLesson>) => {
      const spent = formatLessonSpent(locale, lesson.spentSecondsTotal);
      const meta = `${formatLessonTime(lesson.createdAt, locale)} · ${spent}`;
      return (
        <TeacherLessonSwipeItem
          title={lesson.title}
          meta={meta}
          accentColor={teacherLessonColor(lesson.id)}
          showSeparator={index < teacherChatRows.length - 1}
          renameLabel={t('common.rename')}
          deleteLabel={t('common.delete')}
          onOpen={() => openTeacherLessonChat(lesson)}
          onRename={() => beginRenameLesson(lesson)}
          onDelete={() => confirmDeleteLesson(lesson)}
        />
      );
    },
    [beginRenameLesson, confirmDeleteLesson, locale, t, teacherChatRows.length],
  );

  const openChats = useCallback(() => {
    void Haptics.selectionAsync();
    Keyboard.dismiss();
    setChatsOpen(true);
  }, []);

  const closeChats = useCallback(() => setChatsOpen(false), []);

  if (!ready) {
    return (
      <View style={[styles.rootGame, { paddingTop: insets.top }]}>
        <View style={styles.rootLoading} />
      </View>
    );
  }

  return (
    <GameWindowShell title="Учитель" contentPadding={0} backdrop="void">
      <StatusBar style="light" />
      <View style={styles.screenBody}>
      <Animated.View
        style={[
          styles.topBar,
          { opacity: topBarFade },
          boardChatOpen ? styles.topBarHidden : null,
        ]}>
        <Text style={styles.wordmarkLight}>tearz</Text>
        <Pressable
          onPress={openChats}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('teacher.chatsTitle')}
          style={({ pressed }) => [styles.chatsBtnLight, pressed && styles.chatsBtnPressed]}>
          <Ionicons name="chatbubbles-outline" size={20} color={GAME_THEME.color.ink} />
          {teacherChatRows.length > 0 ? (
            <View style={styles.chatsCount}>
              <Text style={styles.chatsCountText}>
                {teacherChatRows.length > 99 ? '99+' : teacherChatRows.length}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </Animated.View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 8}>
        <View style={styles.heroArea}>
          <Animated.View style={[styles.heroBoard, { opacity: heroFade }]}>
            <TearzBoardComposer
              ref={composerRef}
              idleBoardPrompt={composerFocused ? undefined : typed}
              idleTapHint={composerFocused ? undefined : t('teacher.boardTapHint')}
              chatOpen={boardChatOpen}
              submitOpensChat
              onFocusChange={setComposerFocused}
              onSubmit={handleBoardSubmit}
            />
          </Animated.View>
        </View>
      </KeyboardAvoidingView>

      {boardChatOpen ? (
        <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={closeBoardChat}>
          <Animated.View style={[styles.boardChatLayer, { opacity: chatFade }]}>
            <TeacherLessonWindow
              key={boardLessonId ?? (boardSeed || 'new-lesson')}
              seedQuestion={boardSeed || undefined}
              initialMessages={boardInitialMessages}
              lessonId={boardLessonId}
              lessonTopic={boardLessonTopic}
              onClose={closeBoardChat}
            />
          </Animated.View>
        </Modal>
      ) : null}

      {/* ── Список чатов ─────────────────────────────────────────────── */}
      <Modal
        visible={chatsOpen}
        transparent
        animationType="slide"
        onRequestClose={closeChats}>
        <View style={styles.chatsRoot}>
          <Pressable style={styles.chatsBackdrop} onPress={closeChats} accessibilityLabel="Закрыть" />
          <View
            style={[
              styles.chatsSheet,
              { marginTop: insets.top + 8, paddingBottom: insets.bottom + 16 },
            ]}>
            <View style={styles.chatsHandle} />
            <View style={styles.chatsHeader}>
              <Text style={styles.chatsTitle}>{t('teacher.chatsTitle')}</Text>
              <Pressable
                onPress={closeChats}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
                style={({ pressed }) => [styles.chatsClose, pressed && styles.chatsBtnPressed]}>
                <Ionicons name="close" size={20} color={GAME_THEME.color.ink} />
              </Pressable>
            </View>

            {teacherChatRows.length > 0 ? (
              <FlatList
                data={teacherChatRows}
                keyExtractor={(lesson) => lesson.id}
                renderItem={renderLessonRow}
                ItemSeparatorComponent={LessonSeparator}
                style={styles.flex}
                contentContainerStyle={styles.chatsListContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={14}
                windowSize={8}
              />
            ) : (
              <View style={styles.emptyWrap}>
                <TearzThinking size={150} style={styles.emptyMascotRive} />
                <Text style={styles.emptyTitle}>{t('teacher.chatsEmptyTitle')}</Text>
                <Text style={styles.emptySub}>{t('teacher.chatsEmptySub')}</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Переименование ──────────────────────────────────────────── */}
      <Modal
        visible={renameTarget !== null}
        transparent
        animationType="none"
        onRequestClose={() => closeRenameModal()}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? Math.max(insets.top, 12) + 8 : 0}>
          <View style={styles.renameOverlayRoot}>
            <Animated.View
              pointerEvents="box-none"
              style={[
                StyleSheet.absoluteFillObject,
                { zIndex: 0, opacity: renameBackdrop, backgroundColor: 'rgba(0,0,0,0.58)' },
              ]}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => closeRenameModal()} />
            </Animated.View>
            <Animated.View
              pointerEvents="box-none"
              style={[
                styles.renameCard,
                renameCardMotion,
                { zIndex: 2, ...(Platform.OS === 'android' ? { elevation: 26 } : {}) },
              ]}>
              <View style={styles.renameCardContent}>
                <Text style={styles.renameTitle}>{t('teacher.renameTitle')}</Text>
                <View
                  collapsable={false}
                  style={[
                    styles.renameInputShell,
                    renameInputFocused && styles.renameInputShellFocused,
                  ]}>
                  <TextInput
                    ref={renameInputRef}
                    value={renameDraft}
                    onChangeText={setRenameDraft}
                    style={styles.renameInputInner}
                    placeholder={t('teacher.renameLesson')}
                    placeholderTextColor={APP_THEME.color.mutedFaint}
                    maxLength={120}
                    selectionColor={APP_THEME.color.link}
                    cursorColor={APP_THEME.color.link}
                    onFocus={() => setRenameInputFocused(true)}
                    onBlur={() => setRenameInputFocused(false)}
                    underlineColorAndroid="transparent"
                    blurOnSubmit={false}
                    returnKeyType="done"
                  />
                </View>
                <View style={styles.renameActions}>
                  <Pressable style={styles.renameBtnGhost} onPress={() => closeRenameModal()}>
                    <Text style={styles.renameBtnGhostText}>{t('common.cancel')}</Text>
                  </Pressable>
                  <Pressable style={styles.renameBtnPrimary} onPress={saveRenameLesson}>
                    <Text style={styles.renameBtnPrimaryText}>{t('teacher.renameSave')}</Text>
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      </View>
    </GameWindowShell>
  );
}

const styles = StyleSheet.create({
  rootGame: {
    flex: 1,
    backgroundColor: GAME_THEME.color.void,
  },
  rootLight: {
    flex: 1,
    backgroundColor: GAME_THEME.color.cream,
  },
  screenBody: {
    flex: 1,
    position: 'relative',
  },
  boardChatLayer: {
    flex: 1,
    backgroundColor: GAME_THEME.color.void,
  },
  root: {
    flex: 1,
    backgroundColor: APP_THEME.color.bg,
  },
  flex: {
    flex: 1,
  },
  rootLoading: {
    flex: 1,
    minHeight: 120,
  },
  topBar: {
    height: 44,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarHidden: {
    pointerEvents: 'none',
  },
  wordmarkLight: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: '#8E8E93',
  },
  wordmark: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: APP_THEME.color.mutedSoft,
  },
  chatsBtnLight: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  chatsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_THEME.color.elevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.border,
  },
  chatsBtnPressed: {
    opacity: 0.6,
  },
  chatsCount: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_THEME.color.brand,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  chatsCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  heroArea: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 12,
  },
  heroBoard: {
    flex: 1,
    zIndex: 2,
  },
  lessonSeparator: {
    height: 10,
  },
  // chats sheet — game chrome (как список диалогов)
  chatsRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  chatsBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  chatsSheet: {
    flex: 1,
    backgroundColor: GAME_THEME.color.cream,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 3,
    borderColor: GAME_THEME.color.ink,
    overflow: 'hidden',
  },
  chatsHandle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    backgroundColor: 'rgba(26,26,26,0.2)',
  },
  chatsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: GAME_THEME.color.ink,
    backgroundColor: GAME_THEME.color.gold,
  },
  chatsTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: GAME_THEME.color.ink,
  },
  chatsClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  chatsListContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingBottom: 60,
    gap: 6,
  },
  emptyMascotRive: {
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: GAME_THEME.color.ink,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: -0.18,
    color: 'rgba(26,26,26,0.55)',
    textAlign: 'center',
    lineHeight: 20,
  },
  // rename
  renameOverlayRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  renameCard: {
    overflow: 'hidden',
    borderRadius: APP_THEME.radius.sheet,
    backgroundColor: APP_THEME.color.elevated,
  },
  renameCardContent: {
    padding: 22,
  },
  renameTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.38,
    color: TEACHER_TITLE,
    marginBottom: 14,
  },
  renameInputShell: {
    borderRadius: APP_THEME.radius.md,
    backgroundColor: APP_THEME.color.bg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 52,
    justifyContent: 'center',
  },
  renameInputShellFocused: {
    backgroundColor: APP_THEME.color.elevatedSoft,
  },
  renameInputInner: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    margin: 0,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '500',
    letterSpacing: -0.3,
    color: TEACHER_TITLE,
    backgroundColor: 'transparent',
  },
  renameActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  renameBtnGhost: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: APP_THEME.radius.pill,
  },
  renameBtnGhostText: {
    fontSize: 16,
    fontWeight: '600',
    color: TEACHER_MUTED,
  },
  renameBtnPrimary: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: APP_THEME.radius.pill,
    backgroundColor: SEND_BTN_ACTIVE,
  },
  renameBtnPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: SEND_ICON_ACTIVE,
  },
});
