import type {
  AdversarialReviewResult,
  DeterministicCheckResult,
  ItemQualityReport,
  QualityScores,
  ReviewIssue,
  SemanticReviewResult,
} from './types.js';
import { emptyScores } from './semantic/heuristic-review.js';

/**
 * Build ItemQualityReport.
 * Critical correctness / ambiguity failures cannot be rescued by high average scores.
 */
export function buildQualityReport(input: {
  itemId: string;
  specificationId: string;
  deterministicChecks: DeterministicCheckResult[];
  semantic?: SemanticReviewResult;
  adversarial?: AdversarialReviewResult;
  generationPromptVersion?: string;
}): ItemQualityReport {
  const detFails = input.deterministicChecks.filter((c) => c.severity === 'fail');
  const detWarns = input.deterministicChecks.filter((c) => c.severity === 'warning');
  const deterministicPassed = detFails.length === 0;

  const criticalIssues: ReviewIssue[] = [
    ...detFails.map((c) => ({
      code: c.code,
      severity: 'critical' as const,
      message: c.message,
    })),
    ...(input.semantic?.issues.filter((i) => i.severity === 'critical') ?? []),
    ...(input.adversarial?.issues.filter((i) => i.severity === 'critical') ?? []),
  ];

  const warnings: ReviewIssue[] = [
    ...detWarns.map((c) => ({
      code: c.code,
      severity: 'warning' as const,
      message: c.message,
    })),
    ...(input.semantic?.issues.filter((i) => i.severity === 'warning') ?? []),
    ...(input.adversarial?.issues.filter((i) => i.severity === 'warning') ?? []),
  ];

  const scores = mergeScores(input.semantic?.scores, deterministicPassed);
  const overallQuality = mean(Object.values(scores));

  const correctnessFail =
    criticalIssues.some((i) => i.dimension === 'correctness') ||
    criticalIssues.some((i) =>
      [
        'NO_CORRECT_OPTION',
        'MULTIPLE_CORRECT_STRUCTURE',
        'CORRECT_ANSWER_MISSING',
        'EXPLANATION_CONTRADICTS',
        'CRITICAL_CORRECTNESS',
      ].includes(i.code),
    );

  const ambiguityCritical = criticalIssues.some(
    (i) =>
      i.dimension === 'unambiguity' ||
      i.code === 'AMBIGUITY_SUSPECT' ||
      i.code === 'MULTIPLE_PLAUSIBLE' ||
      i.code === 'CRITICAL_AMBIGUITY',
  );

  let qualityGate: ItemQualityReport['qualityGate'] = 'PASS';

  if (!deterministicPassed || correctnessFail || ambiguityCritical) {
    qualityGate = 'REJECT';
  } else if (
    input.semantic?.verdict === 'reject' ||
    input.adversarial?.verdict === 'reject' ||
    input.adversarial?.broken
  ) {
    qualityGate = 'REJECT';
  } else if (
    input.semantic?.verdict === 'revise' ||
    input.adversarial?.verdict === 'revise' ||
    warnings.length > 0
  ) {
    qualityGate = 'REVISE';
  }

  // Hard rule: critical correctness/ambiguity → REJECT regardless of overallQuality
  if (correctnessFail || ambiguityCritical) {
    qualityGate = 'REJECT';
  }

  return {
    itemId: input.itemId,
    specificationId: input.specificationId,
    deterministic: {
      passed: deterministicPassed,
      checks: input.deterministicChecks,
    },
    semantic: input.semantic,
    adversarial: input.adversarial,
    scores,
    overallQuality,
    criticalIssues,
    warnings,
    reviewVersions: {
      generation: input.generationPromptVersion,
      semantic: input.semantic?.promptVersion,
      adversarial: input.adversarial?.promptVersion,
    },
    qualityGate,
  };
}

function mergeScores(semantic: QualityScores | undefined, detOk: boolean): QualityScores {
  const base = semantic ?? emptyScores(detOk ? 0.75 : 0.2);
  if (!detOk) {
    return {
      ...base,
      correctness: Math.min(base.correctness, 0.2),
      unambiguity: Math.min(base.unambiguity, 0.35),
    };
  }
  return base;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
