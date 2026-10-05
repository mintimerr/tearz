/**
 * Fail-closed intake for remote AI-generated placement items.
 * Never silently promotes a generated item to full scoring without a complete gate.
 */

import type { GeneratedItem } from '../items/types.js';
import { runItemQualityPipeline, type ReviewProviders } from '../items/pipeline.js';
import type { ItemQualityReport, ScoringEligibility } from '../items/types.js';
import {
  DEFAULT_PLACEMENT_BETA_FLAGS,
  resolveAiScoringAllowed,
  type PlacementBetaFlags,
} from './beta-flags.js';

export type AiIntakeResult =
  | {
      ok: true;
      report: ItemQualityReport;
      eligibility: ScoringEligibility;
      /** After beta policy — may still be false even if gate PASS. */
      isScored: boolean;
      evidenceWeight: number;
    }
  | {
      ok: false;
      reason:
        | 'malformed_json'
        | 'schema_invalid'
        | 'deterministic_fail'
        | 'semantic_reject'
        | 'adversarial_reject'
        | 'reviewer_unavailable'
        | 'reviewer_invalid'
        | 'quality_report_missing'
        | 'eligibility_missing'
        | 'beta_unscored'
        | 'timeout';
      report?: ItemQualityReport;
      eligibility?: ScoringEligibility;
    };

export type AiIntakeInput = {
  /** Pre-parsed GeneratedItem; null/undefined → malformed. */
  item: GeneratedItem | null | undefined;
  /** Parse error from generator JSON. */
  parseError?: boolean;
  /** Reviewer timed out. */
  reviewerTimeout?: boolean;
  /** Reviewer returned invalid JSON. */
  reviewerInvalidJson?: boolean;
  /** Explicitly mark reviewers as unavailable (no heuristic fallback desired). */
  reviewersUnavailable?: boolean;
  providers?: ReviewProviders;
  flags?: PlacementBetaFlags;
};

/** Build a minimal GeneratedItem from a placement MCQ draft (server bridge). */
export function generatedItemFromPlacementDraft(draft: {
  id: string;
  prompt: string;
  choices: string[];
  correctChoice: string;
  instruction?: string;
  language?: string;
  targetLevel?: string;
  skill?: string;
  kind?: string;
}): GeneratedItem {
  const options = draft.choices.map((text, i) => ({
    id: `o${i}`,
    text,
    isCorrect: text === draft.correctChoice,
  }));
  const specification = {
    language: draft.language ?? 'english',
    targetLevel: (draft.targetLevel as 'A1') || 'B1',
    difficultyWithinLevel: 0.45,
    skill: (draft.skill as 'grammar') || 'grammar',
    construct: draft.kind || 'generated.mcq',
    itemType: 'other' as const,
    responseFormat: 'singleChoice' as const,
    optionCount: draft.choices.length,
  };
  return {
    id: draft.id,
    specificationId: `spec-${draft.id}`,
    language: specification.language,
    stem: draft.prompt,
    prompt: draft.prompt,
    options,
    correctAnswer: draft.correctChoice,
    explanation: draft.instruction || '',
    generationModel: 'remote',
    generationPromptVersion: 'en_item_generation_v1',
    generatedAt: Date.now(),
    calibrationStatus: 'provisional',
    specification,
  };
}

/**
 * Run AI item through quality pipeline with fail-closed beta policy.
 * On any failure → ok:false → caller must use approved bank fallback.
 */
export function intakeRemoteAiItem(input: AiIntakeInput): AiIntakeResult {
  const flags = input.flags ?? DEFAULT_PLACEMENT_BETA_FLAGS;

  if (input.parseError || !input.item) {
    return { ok: false, reason: 'malformed_json' };
  }
  if (input.reviewerTimeout) {
    return { ok: false, reason: 'timeout' };
  }
  if (input.reviewerInvalidJson) {
    return { ok: false, reason: 'reviewer_invalid' };
  }
  if (input.reviewersUnavailable) {
    return { ok: false, reason: 'reviewer_unavailable' };
  }

  // Schema-ish minimum (GeneratedItem uses options/correctAnswer)
  const item = input.item;
  const options = Array.isArray(item.options) ? item.options : [];
  const correctAnswer = item.correctAnswer;
  if (!item.id || !(item.prompt || item.stem) || options.length < 2 || !correctAnswer) {
    return { ok: false, reason: 'schema_invalid' };
  }

  let pipeline: ReturnType<typeof runItemQualityPipeline>;
  try {
    pipeline = runItemQualityPipeline(item, input.providers ?? {});
  } catch {
    return { ok: false, reason: 'reviewer_invalid' };
  }

  if (!pipeline?.report) {
    return { ok: false, reason: 'quality_report_missing' };
  }
  if (!pipeline.eligibility) {
    return { ok: false, reason: 'eligibility_missing' };
  }

  const { report, eligibility } = pipeline;

  if (report.qualityGate === 'REJECT') {
    if (report.semantic?.verdict === 'reject') {
      return { ok: false, reason: 'semantic_reject', report, eligibility };
    }
    if (report.adversarial?.verdict === 'reject' || report.adversarial?.broken) {
      return { ok: false, reason: 'adversarial_reject', report, eligibility };
    }
    if (report.deterministic && !report.deterministic.passed) {
      return { ok: false, reason: 'deterministic_fail', report, eligibility };
    }
    return { ok: false, reason: 'semantic_reject', report, eligibility };
  }

  if (report.qualityGate === 'REVISE') {
    return { ok: false, reason: 'deterministic_fail', report, eligibility };
  }

  const scoring = resolveAiScoringAllowed(flags, {
    fullGateCompleted: true,
    qualityGate: report.qualityGate,
    reviewersAvailable: !input.reviewersUnavailable,
    eligibilityIsScored: eligibility.isScored,
  });

  if (!scoring.mayScore) {
    // Item may still be shown as unscored experimental if ok structurally —
    // but for beta never_score we treat as fallback-required for scoring path.
    if (flags.aiItemScoringPolicy === 'never_score') {
      return {
        ok: true,
        report,
        eligibility: { ...eligibility, isScored: false, evidenceWeight: 0 },
        isScored: false,
        evidenceWeight: 0,
      };
    }
    return { ok: false, reason: 'beta_unscored', report, eligibility };
  }

  return {
    ok: true,
    report,
    eligibility,
    isScored: eligibility.isScored,
    evidenceWeight: eligibility.evidenceWeight,
  };
}
