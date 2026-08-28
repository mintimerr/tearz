import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameListRow } from '@/components/game/game-list-row';
import { TeacherLessonWindow } from '@/components/teacher/teacher-lesson-window';
import { teacherLessonColor } from '@/components/teacher/teacher-tokens';
import { GAME_THEME } from '@/constants/game-theme';
import { useCompanionChats } from '@/contexts/companion-chats-context';
import { useLocale, useTranslation } from '@/contexts/locale-context';
import {
  useTeacherJourney,
  type TeacherRecentLesson,
} from '@/contexts/teacher-journey-context';
import type { CompanionChatApiLanguage } from '@/types/companion-chat-api';
import type { CompanionMsg } from '@/types/companion-message';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Снять фокус с CRT/доски под оверлеем урока (автомат). */
  onLessonOpen?: () => void;
  /** Урок закрыт — можно вернуть CRT. */
  onLessonClose?: () => void;
  lessonLanguage?: CompanionChatApiLanguage;
};

const MUTED = 'rgba(26,26,26,0.45)';
const LESSON_OPEN_MS = 380;
const LESSON_CLOSE_MS = 480;
const LESSON_EASING = Easing.bezier(0.22, 1, 0.36, 1);
const LESSON_CLOSE_EASING = Easing.bezier(0.4, 0, 0.2, 1);

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
  const { lessons } = useTeacherJourney();
  const { chats, getCompanionThread } = useCompanionChats();
  const [openLesson, setOpenLesson] = useState<OpenLessonState | null>(null);
  const [lessonMounted, setLessonMounted] = useState(false);
  const lessonOpenRef = useRef(false);
  const lessonFade = useRef(new Animated.Value(0)).current;
  const closeRun = useRef<Animated.CompositeAnimation | null>(null);

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
      lessonOpenRef.current = true;
      setOpenLesson({
        id: lesson.id,
        title: lesson.title,
        messages: getCompanionThread(lesson.id) ?? [],
      });
      setLessonMounted(true);
      lessonFade.setValue(0);
      onClose();
      requestAnimationFrame(() => {
        Animated.timing(lessonFade, {
          toValue: 1,
          duration: LESSON_OPEN_MS,
          easing: LESSON_EASING,
          useNativeDriver: true,
        }).start();
      });
    },
    [getCompanionThread, lessonFade, onClose, onLessonOpen],
  );

  const closeLesson = useCallback(() => {
    if (!lessonOpenRef.current) return;
    lessonOpenRef.current = false;
    void Haptics.selectionAsync();
    closeRun.current?.stop();
    closeRun.current = Animated.timing(lessonFade, {
      toValue: 0,
      duration: LESSON_CLOSE_MS,
      easing: LESSON_CLOSE_EASING,
      useNativeDriver: true,
    });
    closeRun.current.start(({ finished }) => {
      if (!finished) return;
      setLessonMounted(false);
      setOpenLesson(null);
      onLessonClose?.();
    });
  }, [lessonFade, onLessonClose]);

  useEffect(() => {
    return () => {
      closeRun.current?.stop();
    };
  }, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<TeacherRecentLesson>) => (
      <GameListRow
        title={item.title}
        subtitle={formatLessonTime(item.createdAt, locale)}
        leading={
          <View style={[styles.dot, { backgroundColor: teacherLessonColor(item.id) }]} />
        }
        trailing={<Ionicons name="chevron-forward" size={16} color={MUTED} />}
        onPress={() => openLessonChat(item)}
      />
    ),
    [locale, openLessonChat],
  );

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.root}>
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
      </Modal>

      {lessonMounted && openLesson ? (
        <Modal
          visible
          animationType="none"
          presentationStyle="fullScreen"
          onRequestClose={closeLesson}
          onShow={() => {
            Keyboard.dismiss();
          }}>
          <Animated.View style={[styles.lessonModalInner, { opacity: lessonFade }]}>
            <TeacherLessonWindow
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
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
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
    backgroundColor: GAME_THEME.color.cream,
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
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  sep: { height: 8 },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
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
