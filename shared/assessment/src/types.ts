/** Tearz Assessment Engine — public types (psychometric core). */

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export type AssessmentSkill =
  | 'grammar'
  | 'vocabulary'
  | 'reading'
  | 'functional'
  | 'listening'
  | 'writing'
  | 'speaking';

/** Pedagogical item kind (what the task teaches / probes). */
export type ItemType =
  | 'grammarForm'
  | 'vocabularyChoice'
  | 'readingComprehension'
  | 'functionalPhrase'
  | 'sentenceOrder'
  | 'errorCorrection'
  | 'fillBlank'
  | 'sentenceCompletion'
  | 'shortProduction'
  | 'other';

/** How the learner responds (drives default guessing). */
export type ResponseFormat = 'singleChoice' | 'multiSelect' | 'freeText' | 'constructed';

export type CalibrationStatus = 'anchor' | 'calibrated' | 'provisional' | 'experimental';

/** Psychometric ItemMeta status (bank/runtime). Content lifecycle is separate. */
export type ItemStatus = 'active' | 'retired' | 'draft';

export type ItemSource = 'bank' | 'ai' | 'manual' | 'procedural';

export type ConfidenceLabel = 'low' | 'medium' | 'high';

export type VerificationReason =
  | 'ok'
  | 'insufficient_high_level_evidence'
  | 'insufficient_mid_level_evidence';

export type ItemMeta = {
  id: string;
  language: string;
  skill: AssessmentSkill;
  construct: string;
  itemType: ItemType;
  responseFormat: ResponseFormat;
  /** Required for singleChoice / multiSelect guessing defaults. */
  optionCount?: number;
  targetLevel: CefrLevel;
  /** 0..1 within the target CEFR band. */
  difficultyWithinLevel: number;
  /** Predicted IRT b on theta scale (from targetLevel + within). */
  predictedDifficulty: number;
  predictedDiscrimination: number;
  /** Optional override; else derived from responseFormat + optionCount. */
  guessingProbability?: number;
  empiricalDifficulty?: number;
  empiricalDiscrimination?: number;
  empiricalGuessingProbability?: number;
  sampleSize?: number;
  calibrationStatus: CalibrationStatus;
  /** If false, response is stored but does not update posterior. */
  isScored: boolean;
  status: ItemStatus;
  source: ItemSource;
  createdAt: number;
};

export type ResolvedIrtParams = {
  a: number;
  b: number;
  c: number;
  source: 'empirical' | 'predicted';
};

export type AnswerRecord = {
  questionId: string;
  skill: AssessmentSkill;
  construct: string;
  itemType: ItemType;
  responseFormat: ResponseFormat;
  targetLevel: CefrLevel;
  difficultyWithinLevel: number;
  /** Effective b used at scoring time. */
  difficulty: number;
  discrimination: number;
  guessingProbability: number;
  correct: boolean;
  timedOut: boolean;
  selectedAnswer?: string;
  responseTimeMs?: number;
  responseWeight: number;
  isScored: boolean;
  thetaBefore: number;
  thetaAfter: number;
  /** Fisher I(θ̂) at thetaBefore — selector potential, not actual gain. */
  fisherInformation: number;
  /**
   * H(posteriorBefore) − H(posteriorAfter).
   * May be negative for surprising responses; 0 if unscored.
   * Distinct from fisherInformation.
   */
  posteriorInformationGain: number;
  timestamp: number;
};

export type SkillEvidence = {
  attempts: number;
  correct: number;
  estimatedTheta: number | null;
  evidenceStrength: number;
};

export type LevelProbabilities = Record<CefrLevel, number>;

export type CredibleInterval = {
  lower: number;
  upper: number;
};

export type AssessmentState = {
  configId: string;
  thetaGrid: readonly number[];
  prior: readonly number[];
  posterior: number[];
  theta: number;
  thetaCredibleInterval: CredibleInterval;
  levelProbabilities: LevelProbabilities;
  skillEvidence: Partial<Record<AssessmentSkill, SkillEvidence>>;
  answerHistory: AnswerRecord[];
  scoredAnswerCount: number;
};

export type AssessmentEvidence = {
  supportingItems: string[];
  boundaryItems: string[];
  contradictoryItems: string[];
  highestConsistentlyDemonstratedLevel: CefrLevel;
};

export type AssessmentVerification = {
  applied: boolean;
  reason: VerificationReason;
  details?: string;
};

export type AssessmentResult = {
  /** User-facing / PlacementRecord.level === verifiedPlacementLevel */
  cefrLevel: CefrLevel;
  verifiedPlacementLevel: CefrLevel;
  statisticalEstimate: CefrLevel;
  theta: number;
  thetaCredibleInterval: CredibleInterval;
  confidence: number;
  measurementConfidence: number;
  qualityConfidence: number;
  confidenceLabel: ConfidenceLabel;
  levelProbabilities: LevelProbabilities;
  skillProfile: Partial<Record<AssessmentSkill, SkillEvidence>>;
  verification: AssessmentVerification;
  evidence: AssessmentEvidence;
  answerHistory: AnswerRecord[];
  legacyAbility100: number;
};

export type ScoringResponse = {
  correct: boolean;
  timedOut?: boolean;
  selectedAnswer?: string;
  responseTimeMs?: number;
  timestamp?: number;
};

/**
 * Thin factory input for psychometric ItemMeta (IRT layer).
 * Content pipeline uses `items/ItemSpecification` — do not conflate.
 */
export type ItemFactorySpec = {
  language: string;
  skill: AssessmentSkill;
  construct: string;
  itemType: ItemType;
  responseFormat: ResponseFormat;
  optionCount?: number;
  targetLevel: CefrLevel;
  difficultyWithinLevel: number;
  isScored?: boolean;
  calibrationStatus?: CalibrationStatus;
  source?: ItemSource;
  id?: string;
};

/** @deprecated Use ItemFactorySpec (psychometric) or items.ItemSpecification (content). */
export type ItemSpecification = ItemFactorySpec;
