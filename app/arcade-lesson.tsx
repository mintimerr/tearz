import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, type ComponentType } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GAME_THEME } from '@/constants/game-theme';
import { useCompanionChats } from '@/contexts/companion-chats-context';
import type { CompanionChatApiLanguage } from '@/types/companion-chat-api';
import type { CompanionMsg } from '@/types/companion-message';

type LessonWindowProps = {
  lessonId: string;
  lessonTopic: string;
  initialMessages?: CompanionMsg[];
  language?: CompanionChatApiLanguage;
  onClose: () => void;
};

/**
 * Урок открываем отдельным роутом и грузим board только здесь —
 * не из списка и не из arcade.
 */
export default function ArcadeLessonRoute() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getCompanionThread } = useCompanionChats();
  const params = useLocalSearchParams<{
    lessonId?: string;
    title?: string;
    language?: string;
  }>();

  const lessonId = typeof params.lessonId === 'string' ? params.lessonId : '';
  const title = typeof params.title === 'string' ? params.title : 'Урок';
  const language = (params.language as CompanionChatApiLanguage | undefined) ?? 'english';

  const [Window, setWindow] = useState<ComponentType<LessonWindowProps> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('@/components/teacher/teacher-lesson-window') as typeof import('@/components/teacher/teacher-lesson-window');
      if (alive) {
        // Нельзя setState(Component) напрямую — React примет функцию за updater.
        setWindow(() => mod.TeacherLessonWindow);
      }
    } catch (e) {
      if (alive) setError(e instanceof Error ? e.message : 'failed');
    }
    return () => {
      alive = false;
    };
  }, []);

  const onClose = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/arcade-chats');
  };

  if (!lessonId) {
    return (
      <View style={[styles.boot, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.bootText}>Нет id урока</Text>
        <Pressable onPress={onClose} style={styles.bootBtn}>
          <Text style={styles.bootBtnText}>Назад</Text>
        </Pressable>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.boot, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.bootText}>{error}</Text>
        <Pressable onPress={onClose} style={styles.bootBtn}>
          <Text style={styles.bootBtnText}>Назад</Text>
        </Pressable>
      </View>
    );
  }

  if (!Window) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={GAME_THEME.color.ink} />
        <Text style={styles.bootText}>Открываю урок…</Text>
      </View>
    );
  }

  return (
    <Window
      lessonId={lessonId}
      lessonTopic={title}
      initialMessages={getCompanionThread(lessonId) ?? []}
      language={language}
      onClose={onClose}
    />
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    gap: 12,
    paddingHorizontal: 24,
  },
  bootText: {
    fontSize: 15,
    fontWeight: '700',
    color: GAME_THEME.color.ink,
    textAlign: 'center',
  },
  bootBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: GAME_THEME.color.gold,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  bootBtnText: {
    fontWeight: '800',
    color: GAME_THEME.color.ink,
  },
});
