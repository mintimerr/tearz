/**
 * Post-generation adversarial sanity (independent of prior gate labels).
 *
 * Q1: Can you answer correctly without knowing the construct,
 *     merely because other options are broken/absurd/wrong-type?
 * Q2 (C1/C2): Does the item still require high-level competence
 *     if lexical rarity of the key is discounted?
 */

import { cefrRank } from '../scale.js';
import { cefrContextMinUnits, discourseUnits } from './deterministic/normalize.js';
import {
  classifyDistractorDefect,
  isOrthographicLookalikeCluster,
} from './distractor-helpers.js';
import { isSolvableByEliminatingBrokenOptions } from './cefr-depth.js';
import { PROMPT_VERSIONS } from './prompt-versions.js';
import type { GeneratedItem, ReviewIssue, ReviewVerdict } from './types.js';

export type AnswerCueSanityResult = {
  promptVersion: string;
  verdict: ReviewVerdict;
  issues: ReviewIssue[];
  solvableByBrokenElimination: boolean;
  rarityOnlyHighLevel: boolean;
};

export function reviewAnswerCueSanity(item: GeneratedItem): AnswerCueSanityResult {
  const issues: ReviewIssue[] = [];
  const rank = cefrRank(item.specification.targetLevel);
  const skill = item.specification.skill;
  const opts = item.options.map((o) => o.text);
  const stemUnits = discourseUnits(item.stem, item.language);

  const solvableByBrokenElimination = isSolvableByEliminatingBrokenOptions(item);
  if (solvableByBrokenElimination) {
    issues.push({
      code: 'DISTRACTOR_TOO_EASY',
      severity: 'critical',
      message:
        'Sanity: item solvable without construct knowledge by eliminating broken/absurd options',
      dimension: 'cueResistance',
    });
  }

  // Wrong-type cue: functional key is a full utterance but distractors are single nonsense tokens
  if (skill === 'functional') {
    const wrong = item.options.filter((o) => !o.isCorrect);
    const brokenCount = wrong.filter(
      (o) => classifyDistractorDefect(o.text, { language: item.language, skill }) != null,
    ).length;
    if (brokenCount >= 1) {
      issues.push({
        code: 'NONSENSE_DISTRACTOR',
        severity: 'critical',
        message: 'Sanity: functional distractor(s) are not natural utterances',
        dimension: 'distractorQuality',
      });
    }
  }

  const ortho = isOrthographicLookalikeCluster(opts);
  const short = stemUnits < cefrContextMinUnits(item.language, 'vocabulary');
  const rarityOnlyHighLevel =
    rank >= cefrRank('C1') && skill === 'vocabulary' && (ortho || short);

  if (rarityOnlyHighLevel) {
    issues.push({
      code: 'LEXICAL_RARITY_ONLY',
      severity: 'critical',
      message:
        'Sanity: C1/C2 level not supported once rare/orthographic correct word is discounted',
      dimension: 'levelPlausibility',
    });
  }

  if (
    rank >= cefrRank('C1') &&
    skill === 'reading' &&
    stemUnits < cefrContextMinUnits(item.language, 'reading')
  ) {
    issues.push({
      code: 'INSUFFICIENT_INFERENCE_DEMAND',
      severity: 'critical',
      message: 'Sanity: C1/C2 reading lacks passage-level inference demand',
      dimension: 'levelPlausibility',
    });
  }

  const critical = issues.some((i) => i.severity === 'critical');
  return {
    promptVersion: PROMPT_VERSIONS.answer_cue_sanity_v3,
    verdict: critical ? 'reject' : issues.length ? 'revise' : 'pass',
    issues,
    solvableByBrokenElimination,
    rarityOnlyHighLevel,
  };
}
