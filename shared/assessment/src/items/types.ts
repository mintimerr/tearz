/**
 * Content-layer item types: specification, generation, quality, eligibility.
 * Separate from psychometric ItemMeta / IRT engine.
 */

import type {
  AssessmentSkill,
  CalibrationStatus,
  CefrLevel,
  ItemType,
  ResponseFormat,
} from '../types.js';

export type Register = 'neutral' | 'informal' | 'formal' | 'academic' | 'any';

export type ContextDomain =
  | 'daily_life'
  | 'work'
  | 'education'
  | 'travel'
  | 'media'
  | 'abstract'
  | 'any';

export type GenerationConstraints = {
  /** Ban proper nouns / culture that need world knowledge. */
  avoidWorldKnowledge?: boolean;
  /** Ban dialect-specific forms as the sole key. */
  avoidDialectOnlyKey?: boolean;
  allowedTopics?: string[];
  bannedTopics?: string[];
  maxStemChars?: number;
  maxOptionChars?: number;
  requireSingleUnequivocalKey?: boolean;
  notes?: string[];
};

/**
 * Requirements for an item — what to measure.
 * Not a concrete question.
 */
export type ItemSpecification = {
  id?: string;
  language: string;
  targetLevel: CefrLevel;
  /** 0..1 within target CEFR band. */
  difficultyWithinLevel: number;
  skill: AssessmentSkill;
  /** Construct registry id, e.g. en.grammar.hypothetical_past */
  construct: string;
  itemType: ItemType;
  responseFormat: ResponseFormat;
  optionCount?: number;
  contextDomain?: ContextDomain;
  register?: Register;
  /** Soft cap on reading load (chars or words — interpreted by language pack). */
  maxReadingLoad?: number;
  generationConstraints?: GenerationConstraints;
};

export type GeneratedOption = {
  id: string;
  text: string;
  /** Only one should be true for singleChoice. */
  isCorrect: boolean;
};

/**
 * Concrete generated question. Predicted IRT params are predictions only.
 * AI cannot set calibrationStatus to calibrated/anchor.
 */
export type GeneratedItem = {
  id: string;
  specificationId: string;
  language: string;
  stem: string;
  prompt: string;
  options: GeneratedOption[];
  correctAnswer: string;
  explanation: string;
  generationModel: string;
  generationPromptVersion: string;
  generatedAt: number;
  /** Predicted only — never treated as empirical calibration. */
  predictedDifficulty?: number;
  predictedDiscrimination?: number;
  /** Always provisional|experimental from AI path; never calibrated/anchor. */
  calibrationStatus: Extract<CalibrationStatus, 'provisional' | 'experimental'>;
  /** Echo of specification fields for gate checks. */
  specification: ItemSpecification;
  reviewPromptVersions?: {
    semantic?: string;
    adversarial?: string;
  };
};

export type CheckSeverity = 'pass' | 'warning' | 'fail';

export type QualityReasonCode =
  | 'INVALID_OPTION_COUNT'
  | 'MULTIPLE_CORRECT_STRUCTURE'
  | 'NO_CORRECT_OPTION'
  | 'DUPLICATE_OPTION'
  | 'EMPTY_OPTION'
  | 'EMPTY_STEM'
  | 'EMPTY_PROMPT'
  | 'CORRECT_ANSWER_MISSING'
  | 'ANSWER_LEAK'
  | 'LENGTH_CUE'
  | 'GRAMMAR_FORM_MISMATCH'
  | 'STEM_TOO_LONG'
  | 'OPTION_TOO_LONG'
  | 'FORBIDDEN_PLACEHOLDER'
  | 'MALFORMED_UNICODE'
  | 'NORMALIZED_DUPLICATE_OPTION'
  | 'METADATA_LEAKAGE'
  | 'PROMPT_INJECTION_PATTERN'
  | 'FORMAT_MISMATCH'
  | 'EXPLANATION_CONTRADICTS'
  | 'SCHEMA_INVALID'
  | 'SYNONYMOUS_OPTIONS'
  | 'READING_LOAD_EXCEEDED'
  | 'WORLD_KNOWLEDGE_RISK'
  | 'CEFR_MISMATCH_SUSPECT'
  | 'CONSTRUCT_MISMATCH_SUSPECT'
  | 'AMBIGUITY_SUSPECT'
  | 'DISTRACTOR_ABSURD'
  | 'UNNATURAL_LANGUAGE'
  | 'DIALECT_DEPENDENCE'
  | 'DISPUTED_GRAMMAR'
  | 'CUEING_SUSPECT'
  | 'CONTEXT_DEPENDENCE'
  | 'TRICK_QUESTION_SUSPECT'
  | 'NEGATION_OVERLOAD'
  | 'PRONOUN_AMBIGUITY'
  | 'TENSE_AMBIGUITY'
  | 'MULTIPLE_PLAUSIBLE'
  | 'CRITICAL_CORRECTNESS'
  | 'CRITICAL_AMBIGUITY'
  | 'LIFECYCLE_VIOLATION'
  | 'CALIBRATION_CLAIM_FORBIDDEN'
  | 'OTHER';

export type DeterministicCheckResult = {
  code: QualityReasonCode;
  severity: CheckSeverity;
  message: string;
  details?: Record<string, unknown>;
};

export type QualityDimension =
  | 'correctness'
  | 'unambiguity'
  | 'constructValidity'
  | 'levelPlausibility'
  | 'distractorQuality'
  | 'naturalness'
  | 'cueResistance'
  | 'contextIndependence';

export type QualityScores = Record<QualityDimension, number>;

export type ReviewVerdict = 'pass' | 'revise' | 'reject';

export type ReviewIssue = {
  code: QualityReasonCode;
  severity: 'warning' | 'critical';
  message: string;
  dimension?: QualityDimension;
};

export type SemanticReviewResult = {
  promptVersion: string;
  verdict: ReviewVerdict;
  scores: QualityScores;
  issues: ReviewIssue[];
  suggestedAction: 'accept' | 'revise' | 'reject' | 'regenerate';
  notes?: string;
};

export type AdversarialReviewResult = {
  promptVersion: string;
  verdict: ReviewVerdict;
  broken: boolean;
  issues: ReviewIssue[];
  attackNotes: string[];
  suggestedAction: 'accept' | 'revise' | 'reject' | 'regenerate';
};

export type ItemQualityReport = {
  itemId: string;
  specificationId: string;
  deterministic: {
    passed: boolean;
    checks: DeterministicCheckResult[];
  };
  semantic?: SemanticReviewResult;
  adversarial?: AdversarialReviewResult;
  scores: QualityScores;
  overallQuality: number;
  criticalIssues: ReviewIssue[];
  warnings: ReviewIssue[];
  reviewVersions: {
    generation?: string;
    semantic?: string;
    adversarial?: string;
  };
  /** Final gate verdict after combining layers. */
  qualityGate: 'PASS' | 'REVISE' | 'REJECT';
};

export type ScoringEligibility = {
  eligible: boolean;
  /** Multiplier for likelihood evidence; 0 if not scored. */
  evidenceWeight: number;
  reasonCodes: QualityReasonCode[];
  calibrationStatus: CalibrationStatus;
  isScored: boolean;
  qualityGate: ItemQualityReport['qualityGate'];
};

export type ItemLifecycleState =
  | 'draft'
  | 'generated'
  | 'deterministic_checked'
  | 'semantic_reviewed'
  | 'adversarial_reviewed'
  | 'approved_provisional'
  | 'live_experimental'
  | 'calibrated'
  | 'anchor'
  | 'rejected'
  | 'retired';

export type GeneratorOutputJson = {
  stem: string;
  prompt: string;
  options: { id: string; text: string; isCorrect: boolean }[];
  correctAnswer: string;
  explanation: string;
  /** Forbidden if calibrated/anchor. */
  calibrationStatus?: 'provisional' | 'experimental';
  predictedDifficulty?: number;
  predictedDiscrimination?: number;
};
