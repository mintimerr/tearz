import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  TeacherBoardChat,
} from '@/components/teacher/teacher-board-chat';
import type { TeacherComposerAttachment } from '@/components/teacher/teacher-home-composer';
import { GAME_THEME } from '@/constants/game-theme';
import type { CompanionChatApiLanguage } from '@/types/companion-chat-api';
import type { CompanionMsg } from '@/types/companion-message';

type Props = {
  onClose: () => void;
  seedQuestion?: string;
  /** Готовый тред после полёта — диалог без «думаю». */
  initialMessages?: CompanionMsg[];
  seedAttachment?: TeacherComposerAttachment | null;
  language?: CompanionChatApiLanguage;
};

/**
 * Урок с учителем — edge-to-edge, без inset-рамы.
 */
export function TeacherLessonWindow({
  onClose,
  seedQuestion,
  initialMessages,
  seedAttachment,
  language = 'russian',
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={[styles.statusFill, { height: insets.top }]} />
      <View style={styles.inner}>
        <TeacherBoardChat
          onClose={onClose}
          seedQuestion={seedQuestion}
          initialMessages={initialMessages}
          seedAttachment={seedAttachment}
          language={language}
          gameChrome
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: GAME_THEME.color.cream,
  },
  statusFill: {
    width: '100%',
    backgroundColor: GAME_THEME.color.gold,
  },
  inner: {
    flex: 1,
    minHeight: 0,
  },
});
