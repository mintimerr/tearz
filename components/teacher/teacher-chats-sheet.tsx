import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameListRow } from '@/components/game/game-list-row';
import { teacherLessonColor } from '@/components/teacher/teacher-tokens';
import { GAME_THEME } from '@/constants/game-theme';
import { useLocale, useTranslation } from '@/contexts/locale-context';
import {
  useTeacherJourney,
  type TeacherRecentLesson,
} from '@/contexts/teacher-journey-context';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const MUTED = 'rgba(26,26,26,0.45)';

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

/** Шторка истории уроков с преподом — с экрана автомата. */
export function TeacherChatsSheet({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { lessons } = useTeacherJourney();

  const openLesson = useCallback(
    (lesson: TeacherRecentLesson) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onClose();
      router.push({
        pathname: '/companion-chat',
        params: {
          id: lesson.id,
          name: 'Преподаватель',
          online: '1',
          letter: 'T',
          color: teacherLessonColor(lesson.id),
          mode: 'teacher',
          lessonTopic: encodeURIComponent(lesson.title),
        },
      });
    },
    [onClose, router],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<TeacherRecentLesson>) => (
      <GameListRow
        title={item.title}
        subtitle={formatLessonTime(item.createdAt, locale)}
        leading={
          <View style={[styles.dot, { backgroundColor: teacherLessonColor(item.id) }]} />
        }
        trailing={<Ionicons name="chevron-forward" size={16} color={MUTED} />}
        onPress={() => openLesson(item)}
      />
    ),
    [locale, openLesson],
  );

  return (
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
              <Ionicons name="close" size={20} color={MUTED} />
            </Pressable>
          </View>

          {lessons.length > 0 ? (
            <FlatList
              data={lessons}
              keyExtractor={(l) => l.id}
              renderItem={renderItem}
              style={styles.list}
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: Math.max(insets.bottom, 12) + 16 },
              ]}
              showsVerticalScrollIndicator={false}
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
  sheet: {
    flex: 1,
    backgroundColor: GAME_THEME.color.cream,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 2,
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
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: GAME_THEME.color.ink,
    letterSpacing: -0.3,
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26,26,26,0.06)',
  },
  closePressed: { opacity: 0.7 },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 4,
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
