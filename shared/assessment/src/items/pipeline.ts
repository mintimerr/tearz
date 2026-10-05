import { heuristicAdversarialReview } from './adversarial/heuristic-review.js';
import { runDeterministicChecks } from './deterministic/validators.js';
import { buildQualityReport } from './quality-report.js';
import { decideScoringEligibility, type EligibilityPolicy } from './scoring-eligibility.js';
import { heuristicSemanticReview } from './semantic/heuristic-review.js';
import type {
  AdversarialReviewResult,
  GeneratedItem,
  ItemQualityReport,
  ScoringEligibility,
  SemanticReviewResult,
} from './types.js';

export type ReviewProviders = {
  /** If omitted, uses offline heuristic semantic reviewer. */
  semantic?: (item: GeneratedItem) => SemanticReviewResult;
  /** If omitted, uses offline heuristic adversarial reviewer. */
  adversarial?: (item: GeneratedItem) => AdversarialReviewResult;
  /** Skip LLM-style layers (deterministic only). */
  deterministicOnly?: boolean;
};

export type QualityPipelineResult = {
  report: ItemQualityReport;
  eligibility: ScoringEligibility;
};

/**
 * Full quality pipeline for a GeneratedItem.
 * Stages are independent: deterministic → semantic → adversarial → eligibility.
 */
export function runItemQualityPipeline(
  item: GeneratedItem,
  opts: ReviewProviders & { eligibilityPolicy?: EligibilityPolicy } = {},
): QualityPipelineResult {
  const deterministicChecks = runDeterministicChecks(item);
  const detFailed = deterministicChecks.some((c) => c.severity === 'fail');

  let semantic: SemanticReviewResult | undefined;
  let adversarial: AdversarialReviewResult | undefined;

  if (!opts.deterministicOnly) {
    // Still run semantic/adversarial for diagnostics even if deterministic failed,
    // but eligibility will reject.
    const semFn = opts.semantic ?? heuristicSemanticReview;
    const advFn = opts.adversarial ?? heuristicAdversarialReview;
    semantic = semFn(item);
    // Adversarial is a separate independent stage
    adversarial = advFn(item);
  }

  const report = buildQualityReport({
    itemId: item.id,
    specificationId: item.specificationId,
    deterministicChecks,
    semantic,
    adversarial,
    generationPromptVersion: item.generationPromptVersion,
  });

  // If deterministic failed hard, force REJECT even if reviewers soft-pass
  if (detFailed && report.qualityGate !== 'REJECT') {
    report.qualityGate = 'REJECT';
  }

  const eligibility = decideScoringEligibility(
    report,
    item.calibrationStatus,
    opts.eligibilityPolicy,
  );

  return { report, eligibility };
}
