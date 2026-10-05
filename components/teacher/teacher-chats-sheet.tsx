import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '@/utils/safe-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  FlatList,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GAME_THEME } from '@/constants/game-theme';
import { TeacherChatSwipeRow } from '@/components/teacher/teacher-chat-swipe-row';
import { useCompanionChats } from '@/contexts/companion-chats-context';
import { useLocale, useTranslation } from '@/contexts/locale-context';
import {
  useTeacherJourney,
  type TeacherRecentLesson,
} from '@/contexts/teacher-journey-context';
import type { CompanionChatApiLanguage } from '@/types/companion-chat-api';
import type { CompanionMsg } from '@/types/companion-message';

const LESSON_OPEN_MS = 420;
const LESSON_CLOSE_MS = 480;
const LESSON_EASING = Easing.bezier(0.22, 1, 0.36, 1);
const LESSON_CLOSE_EASING = Easing.bezier(0.4, 0, 0.2, 1);
const LESSON_SLIDE_IN = 28;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function configureChatDeleteLayout() {
  LayoutAnimation.configureNext(
    Platform.OS === 'ios'
      ? {
          duration: 340,
          update: { type: LayoutAnimation.Types.spring, springDamping: 0.78 },
          delete: {
            type: LayoutAnimation.Types.spring,
            springDamping: 0.7,
            property: LayoutAnimation.Properties.opacity,
          },
        }
      : {
          duration: 280,
          update: { type: LayoutAnimation.Types.easeInEaseOut },
          delete: {
            type: LayoutAnimation.Types.easeInEaseOut,
            property: LayoutAnimation.Properties.opacity,
          },
        },
  );
}

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Снять фокус с CRT/доски под оверлеем урока (автомат). */
  onLessonOpen?: () => void;
  /** Урок закрыт — можно вернуть CRT. */
  onLessonClose?: () => void;
  lessonLanguage?: CompanionChatApiLanguage;
};

/** Не тянем board/drill/expo-audio при открытии списка чатов. */
function LazyTeacherLessonWindow(props: {
  lessonId: string;
  lessonTopic: string;
  initialMessages?: CompanionMsg[];
  language?: CompanionChatApiLanguage;
  onClose: () => void;
}) {
  const { TeacherLessonWindow } = require('@/components/teacher/teacher-lesson-window') as typeof import('@/components/teacher/teacher-lesson-window');
  return <TeacherLessonWindow {...props} />;
}

function formatLessonTime(ts: number, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-US' : 'ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ts));
  } catch {
    return '';
  }
}

type OpenLessonState = {
  id: string;
  title: string;
  messages: CompanionMsg[];
};

/** Шторка истории уроков с преподом — с экрана автомата / учителя. */
export function TeacherChatsSheet({
  visible,
  onClose,
  onLessonOpen,
  onLessonClose,
  lessonLanguage = 'english',
}: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { lessons, removeRecentLesson, renameRecentLesson } = useTeacherJourney();
  const { chats, getCompanionThread, removeChat, renameChat } = useCompanionChats();
  const [openLesson, setOpenLesson] = useState<OpenLessonState | null>(null);
  const [lessonMounted, setLessonMounted] = useState(false);
  const [renameTarget, setRenameTarget] = useState<TeacherRecentLesson | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameFocused, setRenameFocused] = useState(false);
  const renameInputRef = useRef<TextInput>(null);
  const renameBackdrop = useRef(new Animated.Value(0)).current;
  const renameCardAnim = useRef(new Animated.Value(0)).current;
  const renameOpenRun = useRef<Animated.CompositeAnimation | null>(null);
  const renameClosing = useRef(false);
  const lessonOpenRef = useRef(false);
  const lessonFade = useRef(new Animated.Value(0)).current;
  const lessonSlide = useRef(new Animated.Value(LESSON_SLIDE_IN)).current;
  const closeRun = useRef<Animated.CompositeAnimation | null>(null);
  const openRun = useRef<Animated.CompositeAnimation | null>(null);

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

  const openLessonChat = useCallback(
    (lesson: TeacherRecentLesson) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Keyboard.dismiss();
      onLessonOpen?.();
      closeRun.current?.stop();
      openRun.current?.stop();
      lessonOpenRef.current = true;
      setOpenLesson({
        id: lesson.id,
        title: lesson.title,
        messages: getCompanionThread(lesson.id) ?? [],
      });
      // Стартуем невидимыми — анимация только в onShow Modal, иначе вспыхивает резко.
      lessonFade.setValue(0);
      lessonSlide.setValue(LESSON_SLIDE_IN);
      setLessonMounted(true);
      onClose();
    },
    [getCompanionThread, lessonFade, lessonSlide, onClose, onLessonOpen],
  );

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
                configureChatDeleteLayout();
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

  const beginRenameLesson = useCallback((lesson: TeacherRecentLesson) => {
    void Haptics.selectionAsync();
    renameClosing.current = false;
    setRenameDraft(lesson.title);
    setRenameFocused(false);
    setRenameTarget(lesson);
  }, []);

  useEffect(() => {
    if (!renameTarget) return;
    renameClosing.current = false;
    renameOpenRun.current?.stop();
    renameBackdrop.setValue(0);
    renameCardAnim.setValue(0);
    renameOpenRun.current = Animated.parallel([
      Animated.timing(renameBackdrop, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(renameCardAnim, {
        toValue: 1,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }),
    ]);
    renameOpenRun.current.start();
    const tFocus = setTimeout(() => renameInputRef.current?.focus(), 280);
    return () => clearTimeout(tFocus);
  }, [renameBackdrop, renameCardAnim, renameTarget?.id]);

  const closeRenameModal = useCallback(
    (after?: () => void) => {
      if (!renameTarget || renameClosing.current) return;
      renameClosing.current = true;
      renameOpenRun.current?.stop();
      Keyboard.dismiss();
      Animated.parallel([
        Animated.timing(renameBackdrop, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(renameCardAnim, {
          toValue: 0,
          duration: 160,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;
        renameClosing.current = false;
        setRenameTarget(null);
        setRenameDraft('');
        setRenameFocused(false);
        after?.();
      });
    },
    [renameBackdrop, renameCardAnim, renameTarget],
  );

  const saveRenameLesson = useCallback(() => {
    if (!renameTarget) return;
    const title = renameDraft.trim();
    if (!title) return;
    void renameRecentLesson(renameTarget.id, title);
    renameChat(renameTarget.id, title);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    closeRenameModal();
  }, [closeRenameModal, renameChat, renameDraft, renameRecentLesson, renameTarget]);

  const renameCardMotion = useMemo(
    () => ({
      opacity: renameCardAnim,
      transform: [
        { translateY: renameCardAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
        { scale: renameCardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
      ],
    }),
    [renameCardAnim],
  );

  const playLessonOpen = useCallback(() => {
    if (!lessonOpenRef.current) return;
    openRun.current?.stop();
    openRun.current = Animated.parallel([
      Animated.timing(lessonFade, {
        toValue: 1,
        duration: LESSON_OPEN_MS,
        easing: LESSON_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(lessonSlide, {
        toValue: 0,
        duration: LESSON_OPEN_MS,
        easing: LESSON_EASING,
        useNativeDriver: true,
      }),
    ]);
    openRun.current.start();
  }, [lessonFade, lessonSlide]);

  const closeLesson = useCallback(() => {
    if (!lessonOpenRef.current) return;
    lessonOpenRef.current = false;
    void Haptics.selectionAsync();
    openRun.current?.stop();
    closeRun.current?.stop();
    closeRun.current = Animated.parallel([
      Animated.timing(lessonFade, {
        toValue: 0,
        duration: LESSON_CLOSE_MS,
        easing: LESSON_CLOSE_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(lessonSlide, {
        toValue: LESSON_SLIDE_IN * 0.55,
        duration: LESSON_CLOSE_MS,
        easing: LESSON_CLOSE_EASING,
        useNativeDriver: true,
      }),
    ]);
    closeRun.current.start(({ finished }) => {
      if (!finished) return;
      setLessonMounted(false);
      setOpenLesson(null);
      onLessonClose?.();
    });
  }, [lessonFade, lessonSlide, onLessonClose]);

  useEffect(() => {
    return () => {
      openRun.current?.stop();
      closeRun.current?.stop();
    };
  }, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<TeacherRecentLesson>) => (
      <TeacherChatSwipeRow
        lesson={item}
        subtitle={formatLessonTime(item.createdAt, locale)}
        renameLabel={t('common.rename')}
        deleteLabel={t('common.delete')}
        onOpen={() => openLessonChat(item)}
        onRename={() => beginRenameLesson(item)}
        onDelete={() => confirmDeleteLesson(item)}
      />
    ),
    [beginRenameLesson, confirmDeleteLesson, locale, openLessonChat, t],
  );

  return (
    <>
      {visible ? (
        <View style={styles.overlayHost} pointerEvents="auto">
          <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Закрыть" />
          <View style={[styles.sheet, { marginTop: insets.top + 10 }]}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.title}>{t('teacher.chatsTitle')}</Text>
              <Pressable
                onPress={onClose}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
                style={({ pressed }) => [styles.close, pressed && styles.closePressed]}>
                <Ionicons name="close" size={20} color={GAME_THEME.color.ink} />
              </Pressable>
            </View>

            {teacherChatRows.length > 0 ? (
              <FlatList
                data={teacherChatRows}
                keyExtractor={(l) => l.id}
                renderItem={renderItem}
                style={styles.list}
                contentContainerStyle={[
                  styles.listContent,
                  { paddingBottom: Math.max(insets.bottom, 12) + 16 },
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
                ItemSeparatorComponent={() => <View style={styles.sep} />}
              />
            ) : (
              <View style={[styles.empty, { paddingBottom: Math.max(insets.bottom, 12) + 24 }]}>
                <Text style={styles.emptyTitle}>{t('teacher.chatsEmptyTitle')}</Text>
                <Text style={styles.emptySub}>{t('teacher.chatsEmptySub')}</Text>
              </View>
            )}
          </View>
        </View>
      ) : null}

      {lessonMounted && openLesson ? (
        <Modal
          visible
          transparent
          animationType="none"
          presentationStyle="overFullScreen"
          statusBarTranslucent
          onRequestClose={closeLesson}
          onShow={() => {
            Keyboard.dismiss();
            playLessonOpen();
          }}>
          <Animated.View
            style={[
              styles.lessonModalInner,
              {
                opacity: lessonFade,
                transform: [{ translateY: lessonSlide }],
              },
            ]}>
            <LazyTeacherLessonWindow
              key={openLesson.id}
              lessonId={openLesson.id}
              lessonTopic={openLesson.title}
              initialMessages={openLesson.messages}
              language={lessonLanguage}
              onClose={closeLesson}
            />
          </Animated.View>
        </Modal>
      ) : null}

      {renameTarget !== null ? (
        <View style={styles.overlayHost} pointerEvents="box-none">
          <KeyboardAvoidingView
            style={styles.renameRoot}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? Math.max(insets.top, 12) + 8 : 0}>
            <Animated.View
              pointerEvents="box-none"
              style={[styles.renameBackdrop, { opacity: renameBackdrop }]}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => closeRenameModal()} />
            </Animated.View>
            <Animated.View style={[styles.renameCard, renameCardMotion]}>
              <Text style={styles.renameTitle}>{t('teacher.renameTitle')}</Text>
              <Text style={styles.renameSubtitle}>{t('teacher.renameLesson')}</Text>
              <View
                style={[styles.renameInputShell, renameFocused && styles.renameInputShellFocused]}>
                <TextInput
                  ref={renameInputRef}
                  value={renameDraft}
                  onChangeText={setRenameDraft}
                  style={styles.renameInput}
                  placeholder={t('teacher.renameLesson')}
                  placeholderTextColor="rgba(26,26,26,0.32)"
                  maxLength={120}
                  selectionColor="#4C8DFF"
                  cursorColor="#4C8DFF"
                  onFocus={() => setRenameFocused(true)}
                  onBlur={() => setRenameFocused(false)}
                  underlineColorAndroid="transparent"
                  blurOnSubmit={false}
                  returnKeyType="done"
                  onSubmitEditing={saveRenameLesson}
                />
              </View>
              <View style={styles.renameActions}>
                <Pressable
                  onPress={() => closeRenameModal()}
                  style={({ pressed }) => [styles.renameBtnGhost, pressed && styles.renameBtnPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.cancel')}>
                  <Text style={styles.renameBtnGhostText}>{t('common.cancel')}</Text>
                </Pressable>
                <Pressable
                  onPress={saveRenameLesson}
                  disabled={!renameDraft.trim()}
                  style={({ pressed }) => [
                    styles.renameBtnPrimary,
                    !renameDraft.trim() && styles.renameBtnPrimaryOff,
                    pressed && renameDraft.trim() && styles.renameBtnPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t('teacher.renameSave')}>
                  <Text style={styles.renameBtnPrimaryText}>{t('teacher.renameSave')}</Text>
                </Pressable>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  overlayHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    elevation: 1,
    backgroundColor: 'transparent',
  },
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  lessonOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 500,
    elevation: 500,
    backgroundColor: GAME_THEME.color.cream,
  },
  lessonModalInner: {
    flex: 1,
    backgroundColor: GAME_THEME.color.cream,
  },
  sheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 3,
    borderColor: GAME_THEME.color.ink,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(26,26,26,0.18)',
    marginTop: 10,
    marginBottom: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: GAME_THEME.color.ink,
    backgroundColor: GAME_THEME.color.gold,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: GAME_THEME.color.ink,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  closePressed: { opacity: 0.7 },
  list: { flex: 1, backgroundColor: '#FFFFFF' },
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  sep: { height: 10 },
  renameRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  renameBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12,18,36,0.45)',
  },
  renameCard: {
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.98)',
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    gap: 10,
    shadowColor: '#0B1430',
    shadowOpacity: 0.2,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 16,
  },
  renameTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.45,
    color: GAME_THEME.color.ink,
  },
  renameSubtitle: {
    marginTop: -4,
    marginBottom: 4,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.15,
    color: 'rgba(26,26,26,0.45)',
  },
  renameInputShell: {
    borderRadius: 16,
    backgroundColor: 'rgba(26,26,26,0.05)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 54,
    justifyContent: 'center',
  },
  renameInputShellFocused: {
    backgroundColor: 'rgba(76,141,255,0.08)',
  },
  renameInput: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '500',
    color: GAME_THEME.color.ink,
    letterSpacing: -0.25,
    padding: 0,
    margin: 0,
  },
  renameActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  renameBtnGhost: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26,26,26,0.05)',
  },
  renameBtnGhostText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: 'rgba(26,26,26,0.7)',
  },
  renameBtnPrimary: {
    flex: 1.2,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4C8DFF',
  },
  renameBtnPrimaryOff: {
    opacity: 0.4,
  },
  renameBtnPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: '#FFFFFF',
  },
  renameBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    fontWeight: '600',
    color: MUTED,
    textAlign: 'center',
    lineHeight: 20,
  },
});
