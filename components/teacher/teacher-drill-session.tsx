import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';

import { TeacherExerciseDrill } from '@/components/teacher/teacher-exercise-drill';
import { TeacherExerciseGenerating } from '@/components/teacher/teacher-exercise-generating';
import { GAME_THEME } from '@/constants/game-theme';
import type {
  CompanionChatApiLanguage,
  TeacherDrillFollowUp,
  TeacherExerciseCheckSuccessBody,
  TeacherExerciseItem,
  TeacherNextTopicRecommendation,
} from '@/types/companion-chat-api';

export type TeacherDrillFollowUpContext = {
  explanation: string;
  lessonTopic?: string;
  language: CompanionChatApiLanguage;
  uiLanguage: 'ru' | 'en' | 'zh';
  recentMistakes?: Array<{
    kind: string;
    checkText: string;
    learnerAnswer: string;
    idealAnswer?: string;
    feedback?: string;
    lessonTopic?: string;
  }>;
};

type DrillActivePayload = {
  sessionKey: string;
  exercises: TeacherExerciseItem[];
  nextTopic: TeacherNextTopicRecommendation | null;
  followUpContext: TeacherDrillFollowUpContext | null;
  transcribeLanguage: CompanionChatApiLanguage;
  onClose: (summary: { correct: number; total: number } | null) => void;
  onNextTopicPress: (topic: TeacherNextTopicRecommendation) => void;
  onFollowUpPress?: (followUp: TeacherDrillFollowUp) => void;
  onMistakesRecorded?: (
    mistakes: Array<{
      kind: string;
      checkText: string;
      learnerAnswer: string;
      idealAnswer?: string;
      feedback?: string;
    }>,
  ) => void;
  onCheck: (payload: {
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
  }) => Promise<TeacherExerciseCheckSuccessBody>;
};

type DrillSessionState =
  | { phase: 'idle' }
  | { phase: 'generating'; messageId: string }
  | ({ phase: 'active' } & DrillActivePayload);

type DrillSessionContextValue = {
  messageIdLoading: string | null;
  isDrillBusy: boolean;
  beginGenerating: (messageId: string) => boolean;
  beginDrill: (payload: DrillActivePayload) => void;
  cancelGenerating: () => void;
  endDrill: () => void;
};

const TeacherDrillSessionContext = createContext<DrillSessionContextValue | null>(null);

function DrillSessionOverlay({
  session,
  onDismissGenerating,
}: {
  session: DrillSessionState;
  onDismissGenerating: () => void;
}) {
  if (session.phase === 'idle') return null;

  const active = session.phase === 'active' ? session : null;

  return (
    <Modal
      visible
      animationType="fade"
      presentationStyle="fullScreen"
      transparent={false}
      statusBarTranslucent
      onRequestClose={() => {
        if (session.phase === 'generating') onDismissGenerating();
        else if (session.phase === 'active') active?.onClose(null);
      }}>
      <View style={styles.modalRoot} collapsable={false}>
        <TeacherExerciseGenerating visible={session.phase === 'generating'} />
        {active ? (
          <TeacherExerciseDrill
            visible
            sessionKey={active.sessionKey}
            exercises={active.exercises}
            nextTopic={active.nextTopic}
            followUpContext={active.followUpContext}
            transcribeLanguage={active.transcribeLanguage}
            onClose={active.onClose}
            onNextTopicPress={active.onNextTopicPress}
            onFollowUpPress={active.onFollowUpPress}
            onMistakesRecorded={active.onMistakesRecorded}
            onCheck={active.onCheck}
          />
        ) : null}
      </View>
    </Modal>
  );
}

/**
 * Provider + overlay. В корне приложения (`app/_layout.tsx`) — overlay поверх всех экранов.
 */
export function TeacherDrillSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<DrillSessionState>({ phase: 'idle' });
  const sessionRef = useRef<DrillSessionState>({ phase: 'idle' });

  const applySession = useCallback((next: DrillSessionState) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const beginGenerating = useCallback(
    (messageId: string) => {
      if (sessionRef.current.phase !== 'idle') return false;
      const next: DrillSessionState = { phase: 'generating', messageId };
      sessionRef.current = next;
      if (Platform.OS === 'ios') {
        requestAnimationFrame(() => applySession(next));
      } else {
        applySession(next);
      }
      return true;
    },
    [applySession],
  );

  const beginDrill = useCallback(
    (payload: DrillActivePayload) => {
      applySession({ phase: 'active', ...payload });
    },
    [applySession],
  );

  const cancelGenerating = useCallback(() => {
    applySession({ phase: 'idle' });
  }, [applySession]);

  const endDrill = useCallback(() => {
    applySession({ phase: 'idle' });
  }, [applySession]);

  const messageIdLoading = session.phase === 'generating' ? session.messageId : null;
  const isDrillBusy = session.phase !== 'idle';

  const value = useMemo(
    () => ({
      messageIdLoading,
      isDrillBusy,
      beginGenerating,
      beginDrill,
      cancelGenerating,
      endDrill,
    }),
    [beginDrill, beginGenerating, cancelGenerating, endDrill, isDrillBusy, messageIdLoading],
  );

  return (
    <TeacherDrillSessionContext.Provider value={value}>
      {children}
      <DrillSessionOverlay session={session} onDismissGenerating={cancelGenerating} />
    </TeacherDrillSessionContext.Provider>
  );
}

/** Локальный host для arcade sheet (вне tabs layout). */
export function TeacherDrillSessionHost({ children }: { children: ReactNode }) {
  return (
    <TeacherDrillSessionProvider>
      <View style={styles.host}>{children}</View>
    </TeacherDrillSessionProvider>
  );
}

export function useTeacherDrillSession(): DrillSessionContextValue {
  const ctx = useContext(TeacherDrillSessionContext);
  if (!ctx) {
    throw new Error('TeacherDrillSessionProvider is missing (wrap app/_layout.tsx)');
  }
  return ctx;
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    ...(Platform.OS === 'android' ? { position: 'relative' as const } : {}),
  },
  modalRoot: {
    flex: 1,
    backgroundColor: GAME_THEME.color.cream,
  },
});
