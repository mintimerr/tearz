import type { AssessmentSkill, CefrLevel } from '../types.js';

export type TestPhase = 'routing' | 'localization' | 'boundary' | 'final';

export type OrchestratorConfig = {
  configId: string;
  totalPresentedItems: number;
  maxExperimentalItems: number;
  /** Soft target for production placement. */
  minScoringItemsPreferred: number;

  phaseEnds: {
    routing: number; // inclusive question number
    localization: number;
    boundary: number;
    // final = rest through totalPresentedItems
  };

  firstItem: {
    targetLevel: CefrLevel;
    difficultyWithinLevelMin: number;
    difficultyWithinLevelMax: number;
    preferredSkills: AssessmentSkill[];
    forbidReading: boolean;
    forbidLevels: CefrLevel[];
  };

  skillMinima: Partial<Record<AssessmentSkill, number>>;

  maxSameSkillConsecutive: number;
  maxSameConstructTotal: number;
  maxSameConstructConsecutive: number;

  /** Soft weights for selection score (not psychometric engine params). */
  weights: {
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

  calibrationBonusByStatus: {
    anchor: number;
    calibrated: number;
    provisional: number;
    experimental: number;
  };

  /** Compute full EIG only for top-K prefiltered candidates (performance). */
  eigTopK: number;
  /** Stride on theta grid when computing EIG (1 = full grid). */
  eigGridStride: number;

  earlyStop: {
    maxPosteriorEntropy: number;
    minTopLevelProbability: number;
  };
};

export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  configId: 'tearz-orchestrator-v1',
  totalPresentedItems: 15,
  maxExperimentalItems: 2,
  minScoringItemsPreferred: 13,

  phaseEnds: {
    routing: 4,
    localization: 9,
    boundary: 13,
  },

  firstItem: {
    targetLevel: 'B1',
    difficultyWithinLevelMin: 0.35,
    difficultyWithinLevelMax: 0.5,
    preferredSkills: ['functional', 'vocabulary', 'grammar'],
    forbidReading: true,
    forbidLevels: ['A1', 'C1', 'C2'],
  },

  skillMinima: {
    grammar: 3,
    vocabulary: 3,
    reading: 3,
    functional: 2,
  },

  maxSameSkillConsecutive: 2,
  maxSameConstructTotal: 2,
  maxSameConstructConsecutive: 1,

  weights: {
    expectedInformationGain: 1.0,
    fisherInformation: 0.25,
    reliability: 0.35,
    coveragePriority: 0.9,
    constructDiversity: 0.45,
    calibrationBonus: 0.2,
    verificationPriority: 0.85,
    exposurePenalty: 1.0,
    routingExploration: 0.55,
    phaseTarget: 0.4,
  },

  calibrationBonusByStatus: {
    anchor: 0.35,
    calibrated: 0.25,
    provisional: 0.05,
    experimental: -0.15,
  },

  eigTopK: 28,
  eigGridStride: 2,

  earlyStop: {
    maxPosteriorEntropy: 2.2,
    minTopLevelProbability: 0.72,
  },
};

export function phaseForQuestion(
  questionNumber: number,
  config: OrchestratorConfig = DEFAULT_ORCHESTRATOR_CONFIG,
): TestPhase {
  if (questionNumber <= config.phaseEnds.routing) return 'routing';
  if (questionNumber <= config.phaseEnds.localization) return 'localization';
  if (questionNumber <= config.phaseEnds.boundary) return 'boundary';
  return 'final';
}
