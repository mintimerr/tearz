import type { AssessmentConfig } from './config.js';
import { DEFAULT_ASSESSMENT_CONFIG, defaultGuessingProbability } from './config.js';
import { predictedDifficultyFromSpec } from './scale.js';
import type { ItemFactorySpec, ItemMeta } from './types.js';

/** Build psychometric ItemMeta from a factory spec (IRT layer only). */
export function createItemFromSpec(
  spec: ItemFactorySpec,
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): ItemMeta {
  const predictedDifficulty = predictedDifficultyFromSpec(
    spec.targetLevel,
    spec.difficultyWithinLevel,
    config,
  );
  const guessingProbability = defaultGuessingProbability(
    spec.responseFormat,
    spec.optionCount,
    config,
  );
  return {
    id: spec.id ?? `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    language: spec.language,
    skill: spec.skill,
    construct: spec.construct,
    itemType: spec.itemType,
    responseFormat: spec.responseFormat,
    optionCount: spec.optionCount,
    targetLevel: spec.targetLevel,
    difficultyWithinLevel: Math.max(0, Math.min(1, spec.difficultyWithinLevel)),
    predictedDifficulty,
    predictedDiscrimination: config.defaultDiscrimination,
    guessingProbability,
    calibrationStatus: spec.calibrationStatus ?? 'provisional',
    isScored: spec.isScored !== false,
    status: 'active',
    source: spec.source ?? 'manual',
    createdAt: Date.now(),
  };
}
