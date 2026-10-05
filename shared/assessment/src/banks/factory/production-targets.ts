/**
 * Phase C production bank targets (approved counts).
 */

import type { AssessmentSkill, CefrLevel } from '../../types.js';

export const PRODUCTION_CEFR_TARGETS: Record<CefrLevel, number> = {
  A1: 50,
  A2: 70,
  B1: 80,
  B2: 80,
  C1: 70,
  C2: 50,
};

/** Per-language skill × CEFR approved targets (sum = 400). */
export const PRODUCTION_SKILL_CEFR_TARGETS: Record<
  CefrLevel,
  Record<AssessmentSkill, number>
> = {
  A1: { grammar: 15, vocabulary: 15, reading: 10, functional: 10 },
  A2: { grammar: 18, vocabulary: 18, reading: 17, functional: 17 },
  B1: { grammar: 20, vocabulary: 20, reading: 20, functional: 20 },
  B2: { grammar: 18, vocabulary: 20, reading: 22, functional: 20 },
  C1: { grammar: 12, vocabulary: 18, reading: 22, functional: 18 },
  C2: { grammar: 7, vocabulary: 12, reading: 17, functional: 14 },
};

export const PRODUCTION_TOTAL_PER_LANGUAGE = 400;
export const PRODUCTION_APPROVED_PER_LANG_PER_CYCLE = 50;
export const PRODUCTION_MAX_CYCLES = 16;
export const PRODUCTION_MAX_ATTEMPTS_PER_SLOT = 8;

export const DIFFICULTY_BANDS = {
  low: { min: 0, max: 0.34, targetShare: 0.3 },
  mid: { min: 0.34, max: 0.67, targetShare: 0.4 },
  high: { min: 0.67, max: 1.01, targetShare: 0.3 },
} as const;

export function difficultyBand(within: number): 'low' | 'mid' | 'high' {
  if (within < 0.34) return 'low';
  if (within < 0.67) return 'mid';
  return 'high';
}

export function cellKey(level: CefrLevel, skill: AssessmentSkill): string {
  return `${level}|${skill}`;
}
