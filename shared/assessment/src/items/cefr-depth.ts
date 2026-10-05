/**
 * CEFR depth — rare word / orthographic lookalike alone ≠ C1/C2.
 * Stem length uses language-aware discourseUnits (CJK chars vs whitespace words).
 */

import { cefrRank } from '../scale.js';
import { cefrContextMinUnits, discourseUnits } from './deterministic/normalize.js';
import {
  classifyDistractorDefect,
  isOrthographicLookalikeCluster,
} from './distractor-helpers.js';
import { PROMPT_VERSIONS } from './prompt-versions.js';
import type { GeneratedItem, ReviewIssue, ReviewVerdict } from './types.js';

export type CefrDepthResult = {
  promptVersion: string;
  verdict: ReviewVerdict;
  issues: ReviewIssue[];
};

function defectiveDistractorCount(item: GeneratedItem): number {
  return item.options.filter((o) => !o.isCorrect).filter((o) =>
    classifyDistractorDefect(o.text, {
      language: item.language,
      skill: item.specification.skill,
    }),
  ).length;
}

/**
 * Independent sanity: would eliminating broken options alone yield the key?
 */
export function isSolvableByEliminatingBrokenOptions(item: GeneratedItem): boolean {
  const wrong = item.options.filter((o) => !o.isCorrect);
  const broken = wrong.filter(
    (o) =>
      classifyDistractorDefect(o.text, {
        language: item.language,
        skill: item.specification.skill,
      }) != null,
  );
  return broken.length >= 2;
}

/**
 * For C1/C2: require contextual depth beyond rare lexeme + lookalikes/transparent distractors.
 */
export function reviewCefrDepth(item: GeneratedItem): CefrDepthResult {
  const issues: ReviewIssue[] = [];
  const rank = cefrRank(item.specification.targetLevel);
  const skill = item.specification.skill;
  const stemUnits = discourseUnits(item.stem, item.language);
  const opts = item.options.map((o) => o.text);
  const transparent = isSolvableByEliminatingBrokenOptions(item) || defectiveDistractorCount(item) >= 2;
  const ortho = isOrthographicLookalikeCluster(opts);
  const minUnits = cefrContextMinUnits(item.language, skill);

  if (rank < cefrRank('C1')) {
    return { promptVersion: PROMPT_VERSIONS.cefr_depth_v3, verdict: 'pass', issues };
  }

  if (skill === 'vocabulary' && ortho) {
    issues.push({
      code: 'LEXICAL_RARITY_ONLY',
      severity: 'critical',
      message:
        'C1/C2 vocab options are orthographic lookalikes (rare-word recognition), not genuine near-neighbour competition',
      dimension: 'levelPlausibility',
    });
  }

  if (skill === 'vocabulary' && stemUnits < minUnits) {
    issues.push({
      code: 'INSUFFICIENT_INFERENCE_DEMAND',
      severity: 'critical',
      message: 'C1/C2 vocabulary needs richer context (inference/register/collocation), not a short blank',
      dimension: 'levelPlausibility',
    });
  }

  if (transparent) {
    issues.push({
      code: 'HIGH_LEVEL_ITEM_TOO_TRANSPARENT',
      severity: 'critical',
      message: 'High-level item is solvable by eliminating broken/absurd options',
      dimension: 'distractorQuality',
    });
  }

  if (skill === 'reading' && stemUnits < minUnits) {
    issues.push({
      code: 'INSUFFICIENT_INFERENCE_DEMAND',
      severity: 'critical',
      message: 'C1/C2 reading stem too short for stance/implication/discourse inference',
      dimension: 'levelPlausibility',
    });
  }

  if (skill === 'functional' && stemUnits < minUnits) {
    issues.push({
      code: 'CEFR_DEPTH_INSUFFICIENT',
      severity: 'critical',
      message: 'C1/C2 functional needs situational context for pragmatic/register choice',
      dimension: 'levelPlausibility',
    });
  }

  if (skill === 'grammar' && stemUnits < minUnits) {
    issues.push({
      code: 'CEFR_DEPTH_INSUFFICIENT',
      severity: 'warning',
      message: 'C1/C2 grammar may be rule trivia without meaningful context',
      dimension: 'levelPlausibility',
    });
  }

  if (skill === 'vocabulary' && ortho && stemUnits < cefrContextMinUnits(item.language, 'reading')) {
    issues.push({
      code: 'CEFR_DEPTH_INSUFFICIENT',
      severity: 'critical',
      message: 'CEFR level not supported once lexical rarity/orthography is discounted',
      dimension: 'levelPlausibility',
    });
  }

  const critical = issues.some((i) => i.severity === 'critical');
  return {
    promptVersion: PROMPT_VERSIONS.cefr_depth_v3,
    verdict: critical ? 'reject' : issues.length ? 'revise' : 'pass',
    issues,
  };
}
