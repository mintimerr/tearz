import type { CompanionChatApiLanguage } from '@/types/companion-chat-api';

export type PlacementQuestionKind =
  | 'choose_translation'
  | 'select_missing_word'
  | 'true_false'
  | 'multiple_choice'
  | 'grammar_form'
  | 'sentence_order'
  | 'error_correction';

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
  questionId?: string;
  choices?: string[];
};

export type PlacementResult = {
  level: string;
  score: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  hskLevel?: string;
  statisticalEstimate?: string;
  theta?: number;
  thetaCredibleInterval?: { lower: number; upper: number };
  confidence?: number;
  confidenceLabel?: string;
  levelProbabilities?: Record<string, number>;
  /** Engine skill evidence — optional for old clients / records. */
  skillProfile?: unknown;
  verification?: unknown;
  assessmentEngineVersion?: string;
  orchestratorVersion?: string;
  cefrMapVersion?: string;
  itemQualityVersion?: string;
  placementVersion?: string;
  sessionId?: string;
  assessmentSessionId?: string;
};

export type PlacementRecord = {
  completedAt: number;
  language: CompanionChatApiLanguage;
  /** verifiedPlacementLevel from assessment engine */
  level: string;
  /** Legacy ability 0–100 compatibility representation (API only — not user-facing %). */
  score: number;
  summary?: string;
  hskLevel?: string;
  /** Extended assessment fields (optional for old consumers) */
  statisticalEstimate?: string;
  theta?: number;
  thetaCredibleInterval?: { lower: number; upper: number };
  confidence?: number;
  confidenceLabel?: string;
  levelProbabilities?: Record<string, number>;
  skillProfile?: unknown;
  verification?: unknown;
  assessmentEngineVersion?: string;
  orchestratorVersion?: string;
  cefrMapVersion?: string;
  itemQualityVersion?: string;
  placementVersion?: string;
  sessionId?: string;
  assessmentSessionId?: string;
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
  timedOut?: boolean;
  lastQuestion?: Pick<PlacementQuestion, 'id' | 'prompt' | 'section' | 'difficulty' | 'choices'>;
  seenQuestionIds?: string[];
  seenPrompts?: string[];
  seenContentKeys?: string[];
  sessionSalt?: number;
  userEntropy?: number;
  /** Unique placement attempt id — ties client/server/analytics/record. */
  assessmentSessionId?: string;
  /** Canonical frozen response history for server SoT finalize / selection. */
  canonicalResponses?: unknown[];
  /** Client AssessmentResult hint for mismatch telemetry only — never authoritative. */
  clientResult?: {
    level?: string;
    theta?: number;
    confidence?: number;
    statisticalEstimate?: string;
    levelProbabilities?: Record<string, number>;
  };
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
