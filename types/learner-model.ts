import type { CompanionChatApiLanguage } from '@/types/companion-chat-api';

/** CEFR band used by learning / AI layer (same set as placement). */
export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export type LearnerSkillEvidence = {
  /** Band estimate only when evidence is strong enough — never fake precision. */
  levelEstimate?: CefrLevel;
  evidenceCount: number;
  estimatedTheta?: number;
  confidence?: number;
};

export type LearnerSkillProfile = Record<string, LearnerSkillEvidence>;

/**
 * Compact derived view for learning / AI.
 * Not a persistent SoT — build from PlacementRecord + TeacherGoal.
 */
export type LearnerModel = {
  overallLevel: CefrLevel;
  targetLanguage: CompanionChatApiLanguage;

  placement: {
    theta?: number;
    confidence?: number;
    confidenceLabel?: string;
    levelProbabilities?: Partial<Record<CefrLevel, number>>;
    skillProfile?: LearnerSkillProfile;
    assessmentSessionId?: string;
  };

  goal?: {
    title: string;
    targetDate?: string;
  };

  /** Reserved for continuous adaptation after beta. */
  observedPerformance?: Record<string, unknown>;
};

/**
 * Wire payload for teacher / exercise APIs — learning-relevant fields only.
 * Never include posterior grid, canonical responses, or assessment telemetry.
 */
export type CompactLearnerContext = {
  overallLevel: string;
  targetLanguage?: CompanionChatApiLanguage;
  confidence?: number;
  confidenceLabel?: string;
  skillProfile?: LearnerSkillProfile;
  goal?: {
    title: string;
    targetDate?: string;
  };
};

export type LearnerActivitySignal = {
  kind?: string;
  correct?: boolean;
  skill?: string;
  difficultyHint?: string;
  notes?: string;
};
