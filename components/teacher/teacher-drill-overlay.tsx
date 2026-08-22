import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';

import { TeacherExerciseDrill } from '@/components/teacher/teacher-exercise-drill';
import { TeacherExerciseGenerating } from '@/components/teacher/teacher-exercise-generating';
import type {
  CompanionChatApiLanguage,
  TeacherDrillFollowUp,
  TeacherExerciseCheckSuccessBody,
  TeacherExerciseItem,
  TeacherNextTopicRecommendation,
} from '@/types/companion-chat-api';

export type TeacherDrillOverlayModel = {
  generatingVisible: boolean;
  drillVisible: boolean;
  sessionKey: string;
  exercises: TeacherExerciseItem[];
  nextTopic: TeacherNextTopicRecommendation | null;
  followUpContext?: {
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
  } | null;
  transcribeLanguage: CompanionChatApiLanguage;
  onCloseDrill: (summary: { correct: number; total: number } | null) => void;
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
  onCheckDrill: (payload: {
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

type OverlayContextValue = {
  setModel: (model: TeacherDrillOverlayModel | null) => void;
};

const TeacherDrillOverlayContext = createContext<OverlayContextValue | null>(null);

/** Рендерит генерацию/тренировку поверх урока (вне вложенных Modal). */
export function TeacherDrillOverlayRoot({ children }: { children: ReactNode }) {
  const [model, setModel] = useState<TeacherDrillOverlayModel | null>(null);
  const value = useMemo(() => ({ setModel }), []);

  return (
    <TeacherDrillOverlayContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        {model ? (
          <View style={styles.host} pointerEvents="box-none">
            <TeacherExerciseGenerating visible={model.generatingVisible} />
            <TeacherExerciseDrill
              visible={model.drillVisible}
              sessionKey={model.sessionKey}
              exercises={model.exercises}
              nextTopic={model.nextTopic}
              followUpContext={model.followUpContext}
              transcribeLanguage={model.transcribeLanguage}
              onClose={model.onCloseDrill}
              onNextTopicPress={model.onNextTopicPress}
              onFollowUpPress={model.onFollowUpPress}
              onMistakesRecorded={model.onMistakesRecorded}
              onCheck={model.onCheckDrill}
            />
          </View>
        ) : null}
      </View>
    </TeacherDrillOverlayContext.Provider>
  );
}

export function useTeacherDrillOverlay(model: TeacherDrillOverlayModel | null) {
  const ctx = useContext(TeacherDrillOverlayContext);
  if (!ctx) {
    throw new Error('TeacherDrillOverlayRoot missing');
  }

  useEffect(() => {
    ctx.setModel(model);
    return () => ctx.setModel(null);
  }, [ctx, model]);
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    position: 'relative',
  },
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 500,
    elevation: 500,
  },
});
