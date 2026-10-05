import type { AssessmentState } from '../types.js';
import type {
  AssessmentSkill,
  CalibrationStatus,
  CefrLevel,
  ItemMeta,
} from '../types.js';
import type { TestPhase } from './config.js';

/** Candidate visible to orchestrator after quality pipeline. */
export type OrchestratorCandidate = {
  item: ItemMeta;
  eligible: boolean;
  /** Rejected / revise must not be selectable. */
  qualityGate: 'PASS' | 'REVISE' | 'REJECT';
  evidenceWeight: number;
  /** Optional soft reading-load hint (words); used to avoid Q1 reading. */
  readingLoadWords?: number;
};

export type CefrBoundaryId =
  | 'A1/A2'
  | 'A2/B1'
  | 'B1/B2'
  | 'B2/C1'
  | 'C1/C2';

export type ActiveBoundary = {
  id: CefrBoundaryId;
  lower: CefrLevel;
  upper: CefrLevel;
  /** Theta cut separating bands. */
  cut: number;
  /** Classification uncertainty p(below)*(1-p(below)). */
  uncertainty: number;
  pBelow: number;
  pAbove: number;
};

export type ScoreComponents = {
  expectedInformationGain: number;
  fisherInformation: number;
  reliability: number;
  coveragePriority: number;
  constructDiversity: number;
  calibrationBonus: number;
  verificationPriority: number;
  exposurePenalty: number;
  routingExploration: number;
  phaseTarget: number;
};

export type SelectionDecision = {
  questionNumber: number;
  phase: TestPhase;
  candidateCount: number;
  selectedItemId: string;
  selectedSkill: AssessmentSkill;
  selectedConstruct: string;
  selectedDifficulty: number;
  selectedTargetLevel: CefrLevel;
  selectedCalibration: CalibrationStatus;
  isExperimental: boolean;
  activeBoundary: ActiveBoundary | null;
  posteriorBefore: {
    theta: number;
    levelProbabilities: Record<CefrLevel, number>;
    statisticalEstimate: CefrLevel;
  };
  selectionScore: number;
  scoreComponents: ScoreComponents;
  topAlternatives: Array<{
    itemId: string;
    score: number;
    reasonCodes: string[];
  }>;
  rejectedReasonCodes: string[];
};

export type PresentedRecord = {
  questionNumber: number;
  phase: TestPhase;
  item: ItemMeta;
  isExperimental: boolean;
  isScored: boolean;
  decision: SelectionDecision;
  responseCorrect: boolean | null;
  thetaAfter: number | null;
  activeBoundaryAfter: ActiveBoundary | null;
};

export type AdaptiveTestState = {
  assessmentState: AssessmentState;
  questionNumber: number; // next question to present (1-based); 16 = done
  phase: TestPhase;
  presentedItems: PresentedRecord[];
  scoredItemIds: string[];
  experimentalItemIds: string[];
  skillCounts: Partial<Record<AssessmentSkill, number>>;
  constructCounts: Record<string, number>;
  activeBoundary: ActiveBoundary | null;
  selectionHistory: SelectionDecision[];
  wouldStopEarly: boolean;
  stopReason: string | null;
  preliminaryRange: { low: CefrLevel; high: CefrLevel } | null;
};

export type SelectNextResult = {
  decision: SelectionDecision;
  candidate: OrchestratorCandidate;
};

/** Optional generation fallback — must still pass quality gate externally. */
export type GenerationRequest = {
  specificationHint: {
    targetLevel: CefrLevel;
    skill: AssessmentSkill;
    construct?: string;
    difficultyWithinLevel: number;
  };
  reason: string;
};
