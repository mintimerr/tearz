import type { AssessmentConfig } from './config.js';
import { DEFAULT_ASSESSMENT_CONFIG } from './config.js';
import { createItemFromSpec } from './item-factory.js';
import { legacyDifficulty100ToTheta, predictedDifficultyFromSpec } from './scale.js';
import type {
  AssessmentSkill,
  CefrLevel,
  ItemMeta,
  ItemType,
  ResponseFormat,
} from './types.js';

/** Map legacy placement section → assessment skill. */
export function skillFromLegacySection(section: string): AssessmentSkill {
  const s = section.toLowerCase();
  if (s.includes('vocab')) return 'vocabulary';
  if (s.includes('comprehens') || s.includes('read')) return 'reading';
  if (s.includes('phrase') || s.includes('functional')) return 'functional';
  if (s.includes('structure') || s.includes('order') || s.includes('error')) return 'grammar';
  return 'grammar';
}

export function itemTypeFromLegacyKind(kind: string): ItemType {
  switch (kind) {
    case 'select_missing_word':
    case 'grammar_form':
      return 'grammarForm';
    case 'choose_translation':
      return 'vocabularyChoice';
    case 'multiple_choice':
      return 'readingComprehension';
    case 'sentence_order':
      return 'sentenceOrder';
    case 'error_correction':
      return 'errorCorrection';
    case 'true_false':
      return 'other';
    default:
      return 'other';
  }
}

export function responseFormatFromLegacyKind(kind: string): ResponseFormat {
  if (kind === 'true_false') return 'singleChoice';
  if (kind === 'sentence_order' || kind === 'error_correction') return 'singleChoice';
  return 'singleChoice';
}

/** Approximate CEFR from legacy 0–100 difficulty (provisional). */
export function targetLevelFromLegacyDifficulty100(d100: number): CefrLevel {
  if (d100 <= 16) return 'A1';
  if (d100 <= 33) return 'A2';
  if (d100 <= 50) return 'B1';
  if (d100 <= 67) return 'B2';
  if (d100 <= 84) return 'C1';
  return 'C2';
}

/**
 * Build ItemMeta from a legacy placement question shape.
 * Difficulty 0–100 is treated as predicted only (never empirical).
 */
export function itemMetaFromLegacyQuestion(
  q: {
    id: string;
    kind?: string;
    section?: string;
    difficulty: number;
    choices?: string[];
    language?: string;
  },
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): ItemMeta {
  const kind = q.kind ?? 'multiple_choice';
  const targetLevel = targetLevelFromLegacyDifficulty100(q.difficulty);
  const optionCount = Array.isArray(q.choices) ? q.choices.length : 4;
  // Place within band from residual of legacy scale.
  const bandStart =
    targetLevel === 'A1'
      ? 0
      : targetLevel === 'A2'
        ? 17
        : targetLevel === 'B1'
          ? 34
          : targetLevel === 'B2'
            ? 51
            : targetLevel === 'C1'
              ? 68
              : 85;
  const bandEnd =
    targetLevel === 'A1'
      ? 16
      : targetLevel === 'A2'
        ? 33
        : targetLevel === 'B1'
          ? 50
          : targetLevel === 'B2'
            ? 67
            : targetLevel === 'C1'
              ? 84
              : 100;
  const within =
    bandEnd > bandStart
      ? Math.max(0, Math.min(1, (q.difficulty - bandStart) / (bandEnd - bandStart)))
      : 0.5;

  const item = createItemFromSpec(
    {
      id: q.id,
      language: q.language ?? 'english',
      skill: skillFromLegacySection(q.section ?? 'grammar'),
      construct: kind,
      itemType: itemTypeFromLegacyKind(kind),
      responseFormat: responseFormatFromLegacyKind(kind),
      optionCount,
      targetLevel,
      difficultyWithinLevel: within,
      calibrationStatus: 'provisional',
      source: 'bank',
      isScored: true,
    },
    config,
  );

  // Prefer mapping that stays close to legacy 0–100 → theta for continuity,
  // while still recording predictedDifficulty from CEFR spec.
  const legacyB = legacyDifficulty100ToTheta(q.difficulty, config);
  const specB = predictedDifficultyFromSpec(targetLevel, within, config);
  return {
    ...item,
    predictedDifficulty: 0.65 * legacyB + 0.35 * specB,
  };
}
