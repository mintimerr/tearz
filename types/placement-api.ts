import type { CompanionChatApiLanguage } from '@/types/companion-chat-api';

export type PlacementQuestionKind =
  | 'choose_translation'
  | 'select_missing_word'
  | 'true_false'
  | 'multiple_choice';

export type PlacementQuestion = {
  id: string;
  kind: PlacementQuestionKind;
  instruction: string;
  prompt: string;
  choices: string[];
  difficulty: number;
  section: string;
};

export type PlacementHistoryItem = {
  section: string;
  difficulty: number;
  correct: boolean;
  prompt: string;
};

export type PlacementResult = {
  level: string;
  score: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  hskLevel?: string;
};

export type PlacementRecord = {
  completedAt: number;
  language: CompanionChatApiLanguage;
  level: string;
  score: number;
  summary?: string;
  hskLevel?: string;
};

export type PlacementStepRequestBody = {
  action: 'start' | 'answer';
  language: CompanionChatApiLanguage;
  uiLanguage: 'ru' | 'en' | 'zh';
  ability?: number;
  history?: PlacementHistoryItem[];
  answer?: string;
  answerKey?: string;
  questionIndex?: number;
  lastQuestion?: Pick<PlacementQuestion, 'prompt' | 'section' | 'difficulty'>;
};

export type PlacementStepContinueBody = {
  done: false;
  correct?: boolean | null;
  ability: number;
  questionIndex: number;
  totalQuestions: number;
  question: PlacementQuestion;
  answerKey: string;
};

export type PlacementStepDoneBody = {
  done: true;
  ability: number;
  result: PlacementResult;
};

export type PlacementStepSuccessBody = PlacementStepContinueBody | PlacementStepDoneBody;
