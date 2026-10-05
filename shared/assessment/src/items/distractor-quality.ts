/**
 * Distractor quality gate — structural, fail closed.
 * Functional: all options must be natural utterances.
 * Broken language as the way to mark "wrong" is forbidden.
 */

import { cefrRank } from '../scale.js';
import { wordCount } from './deterministic/normalize.js';
import {
  classifyDistractorDefect,
  findBrokenFunctionalOptions,
  isOrthographicLookalikeCluster,
} from './distractor-helpers.js';
import { PROMPT_VERSIONS } from './prompt-versions.js';
import type { GeneratedItem, ReviewIssue, ReviewVerdict } from './types.js';

export type DistractorQualityResult = {
  promptVersion: string;
  verdict: ReviewVerdict;
  issues: ReviewIssue[];
};

function distractors(item: GeneratedItem): string[] {
  return item.options.filter((o) => !o.isCorrect).map((o) => o.text.trim());
}

function lengthSpreadTooWide(options: string[]): boolean {
  const lens = options.map((o) => o.length);
  const min = Math.min(...lens);
  const max = Math.max(...lens);
  return max > min * 2.8 && max - min > 24;
}

function sameRoughShape(options: string[]): boolean {
  const counts = options.map((o) => wordCount(o));
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  // Allow some spread; flag extreme POS/shape mismatch (1 token vs 8+)
  return !(max >= 6 && min <= 1 && max - min >= 5);
}

export function reviewDistractorQuality(item: GeneratedItem): DistractorQualityResult {
  const issues: ReviewIssue[] = [];
  const rank = cefrRank(item.specification.targetLevel);
  const lang = item.language;
  const skill = item.specification.skill;
  const opts = item.options.map((o) => o.text.trim());
  const wrong = distractors(item);
  const ctx = { language: lang, skill };

  // All options scanned (including key for functional naturalness)
  for (const d of wrong) {
    const defect = classifyDistractorDefect(d, ctx);
    if (defect) {
      const code =
        defect.class === 'absurd_object' || defect.class === 'nonsense_category_claim'
          ? 'NONSENSE_DISTRACTOR'
          : defect.class === 'greeting_noun_append' || defect.class === 'character_salad'
            ? 'NONSENSE_DISTRACTOR'
            : defect.class === 'pseudo_morphology'
              ? 'IMPLAUSIBLE_DISTRACTOR'
              : defect.class === 'broken_syntax' || defect.class === 'telegraphic_broken'
                ? 'NONSENSE_DISTRACTOR'
                : 'IMPLAUSIBLE_DISTRACTOR';
      issues.push({
        code,
        severity: 'critical',
        message: `Distractor defect [${defect.class}]: "${d}" — ${defect.reason}`,
        dimension: 'distractorQuality',
      });
    }
  }

  // Functional: every option must be a natural utterance (broken language forbidden)
  if (skill === 'functional') {
    const broken = findBrokenFunctionalOptions(opts, lang);
    for (const b of broken) {
      issues.push({
        code: 'NONSENSE_DISTRACTOR',
        severity: 'critical',
        message: `Functional option not a natural utterance [${b.defect.class}]: "${b.text}"`,
        dimension: 'distractorQuality',
      });
    }
    // Also: if ≥2 distractors are defective, item is solvable by elimination
    const defectiveWrong = wrong.filter((d) => classifyDistractorDefect(d, ctx) != null);
    if (defectiveWrong.length >= 2) {
      issues.push({
        code: 'DISTRACTOR_TOO_EASY',
        severity: 'critical',
        message: 'Item answerable by eliminating broken/absurd options without construct knowledge',
        dimension: 'cueResistance',
      });
    }
  }

  if (lengthSpreadTooWide(opts)) {
    issues.push({
      code: 'DISTRACTOR_NOT_PARALLEL',
      severity: rank >= cefrRank('B1') ? 'critical' : 'warning',
      message: 'Option lengths are highly unbalanced (parallelism cue)',
      dimension: 'distractorQuality',
    });
  }

  if (!sameRoughShape(opts) && rank >= cefrRank('B1')) {
    issues.push({
      code: 'DISTRACTOR_NOT_PARALLEL',
      severity: 'warning',
      message: 'Option shapes/POS length diverge sharply',
      dimension: 'distractorQuality',
    });
  }

  // B1+: any nonsense class is critical (already); also flag too-easy if ≥2 defective
  if (rank >= cefrRank('B1') && skill !== 'functional') {
    const defective = wrong.filter((d) => classifyDistractorDefect(d, ctx) != null);
    if (defective.length >= 2) {
      issues.push({
        code: 'DISTRACTOR_TOO_EASY',
        severity: 'critical',
        message: 'Multiple distractors are structurally defective — answer cue',
        dimension: 'distractorQuality',
      });
    }
  }

  // B2+: orthographic lookalike padding is not a legitimate near-neighbour set by itself
  if (rank >= cefrRank('B2') && skill === 'vocabulary' && isOrthographicLookalikeCluster(opts)) {
    // Warning here; C1/C2 handled as critical in CEFR depth. Still mark implausible if short stems.
    if (wordCount(item.stem) <= 8) {
      issues.push({
        code: 'IMPLAUSIBLE_DISTRACTOR',
        severity: 'critical',
        message: 'Options form an orthographic lookalike cluster without rich semantic competition',
        dimension: 'distractorQuality',
      });
    }
  }

  const critical = issues.some((i) => i.severity === 'critical');
  return {
    promptVersion: PROMPT_VERSIONS.distractor_quality_v3,
    verdict: critical ? 'reject' : issues.length ? 'revise' : 'pass',
    issues,
  };
}
