import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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

type BeginGeneratingResult =
  | { status: 'started'; token: number }
  | { status: 'already'; token: number }
  | { status: 'blocked' };

type DrillSessionContextValue = {
  messageIdLoading: string | null;
  isDrillBusy: boolean;
  /** started = новый запуск; already = эта же генерация уже идёт; blocked = активная тренировка. */
  beginGenerating: (messageId: string) => BeginGeneratingResult;
  beginDrill: (payload: DrillActivePayload) => void;
  cancelGenerating: () => void;
  endDrill: () => void;
  isGenerationCurrent: (token: number) => boolean;
};

const TeacherDrillSessionContext = createContext<DrillSessionContextValue | null>(null);
const TeacherDrillSessionStateContext = createContext<DrillSessionState>({ phase: 'idle' });

/** Чуть дольше client timeout (120s) + запас на ретраи — иначе UI залипает навсегда. */
const GENERATING_WATCHDOG_MS = 180_000;

function DrillSessionOverlay({
  session,
  mode,
  onDismissGenerating,
}: {
  session: DrillSessionState;
  mode: 'modal' | 'embedded';
  onDismissGenerating: () => void;
}) {
  if (session.phase === 'idle') return null;

  const active = session.phase === 'active' ? session : null;

  const body = (
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
  );

  if (mode === 'embedded') {
    return (
      <View style={styles.embeddedRoot} pointerEvents="auto" collapsable={false}>
        {body}
      </View>
    );
  }

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
      {body}
    </Modal>
  );
}

/**
 * Provider. Overlay по умолчанию через Modal (companion-chat и т.п.).
 * Внутри другого Modal (урок) монтируйте {@link TeacherDrillSessionOverlay} с mode="embedded".
 */
export function TeacherDrillSessionProvider({
  children,
  rootOverlay = true,
}: {
  children: ReactNode;
  /** false — только context; overlay рисует host (урок / экран). */
  rootOverlay?: boolean;
}) {
  const [session, setSession] = useState<DrillSessionState>({ phase: 'idle' });
  const sessionRef = useRef<DrillSessionState>({ phase: 'idle' });
  const generationTokenRef = useRef(0);
  const generatingStartedAtRef = useRef(0);

  const applySession = useCallback((next: DrillSessionState) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const bumpToken = useCallback(() => {
    generationTokenRef.current += 1;
    return generationTokenRef.current;
  }, []);

  const beginGenerating = useCallback(
    (messageId: string): BeginGeneratingResult => {
      const current = sessionRef.current;
      if (current.phase === 'active') return { status: 'blocked' };
      if (current.phase === 'generating' && current.messageId === messageId) {
        // Повторный тап сразу после старта — не дублируем запрос.
        // Если UI не показался / сеть зависла дольше 3с — перезапускаем.
        if (Date.now() - generatingStartedAtRef.current < 3000) {
          return { status: 'already', token: generationTokenRef.current };
        }
      }
      const token = bumpToken();
      generatingStartedAtRef.current = Date.now();
      applySession({ phase: 'generating', messageId });
      return { status: 'started', token };
    },
    [applySession, bumpToken],
  );

  const beginDrill = useCallback(
    (payload: DrillActivePayload) => {
      applySession({ phase: 'active', ...payload });
    },
    [applySession],
  );

  const cancelGenerating = useCallback(() => {
    bumpToken();
    applySession({ phase: 'idle' });
  }, [applySession, bumpToken]);

  const endDrill = useCallback(() => {
    bumpToken();
    applySession({ phase: 'idle' });
  }, [applySession, bumpToken]);

  const isGenerationCurrent = useCallback((token: number) => {
    return generationTokenRef.current === token;
  }, []);

  const generatingMessageId = session.phase === 'generating' ? session.messageId : null;

  useEffect(() => {
    if (!generatingMessageId) return;
    const timer = setTimeout(() => {
      if (sessionRef.current.phase === 'generating') {
        bumpToken();
        applySession({ phase: 'idle' });
      }
    }, GENERATING_WATCHDOG_MS);
    return () => clearTimeout(timer);
  }, [applySession, bumpToken, generatingMessageId]);

  const messageIdLoading = generatingMessageId;
  const isDrillBusy = session.phase !== 'idle';

  const value = useMemo(
    () => ({
      messageIdLoading,
      isDrillBusy,
      beginGenerating,
      beginDrill,
      cancelGenerating,
      endDrill,
      isGenerationCurrent,
    }),
    [
      beginDrill,
      beginGenerating,
      cancelGenerating,
      endDrill,
      isDrillBusy,
      isGenerationCurrent,
      messageIdLoading,
    ],
  );

  return (
    <TeacherDrillSessionStateContext.Provider value={session}>
      <TeacherDrillSessionContext.Provider value={value}>
        {children}
        {rootOverlay ? (
          <DrillSessionOverlay session={session} mode="modal" onDismissGenerating={cancelGenerating} />
        ) : null}
      </TeacherDrillSessionContext.Provider>
    </TeacherDrillSessionStateContext.Provider>
  );
}

/** Оверлей поверх UI host (обязателен внутри Modal урока — корневой Modal оказывается под ним). */
export function TeacherDrillSessionOverlay({ mode = 'embedded' }: { mode?: 'modal' | 'embedded' }) {
  const session = useContext(TeacherDrillSessionStateContext);
  const ctx = useContext(TeacherDrillSessionContext);
  if (!ctx) {
    throw new Error('TeacherDrillSessionProvider is missing');
  }
  return (
    <DrillSessionOverlay
      session={session}
      mode={mode}
      onDismissGenerating={ctx.cancelGenerating}
    />
  );
}

/** Локальный host для arcade sheet (вне tabs layout). */
export function TeacherDrillSessionHost({ children }: { children: ReactNode }) {
  return (
    <TeacherDrillSessionProvider rootOverlay={false}>
      <View style={styles.host}>
        {children}
        <TeacherDrillSessionOverlay mode="embedded" />
      </View>
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
  embeddedRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
  },
});
