import type { CalibrationStatus } from '../types.js';
import type { ItemLifecycleState, QualityReasonCode } from './types.js';

export const LIFECYCLE_STATES: ItemLifecycleState[] = [
  'draft',
  'generated',
  'deterministic_checked',
  'semantic_reviewed',
  'adversarial_reviewed',
  'approved_provisional',
  'live_experimental',
  'calibrated',
  'anchor',
  'rejected',
  'retired',
];

/** Allowed transitions. Empirical calibration steps are human/system only. */
const ALLOWED: Record<ItemLifecycleState, ItemLifecycleState[]> = {
  draft: ['generated', 'rejected'],
  generated: ['deterministic_checked', 'rejected'],
  deterministic_checked: ['semantic_reviewed', 'rejected'],
  semantic_reviewed: ['adversarial_reviewed', 'rejected', 'retired'],
  adversarial_reviewed: ['approved_provisional', 'live_experimental', 'rejected', 'retired'],
  approved_provisional: ['live_experimental', 'calibrated', 'rejected', 'retired'],
  live_experimental: ['approved_provisional', 'calibrated', 'rejected', 'retired'],
  calibrated: ['anchor', 'retired'],
  anchor: ['retired'],
  rejected: ['draft', 'retired'],
  retired: [],
};

export type TransitionResult = {
  ok: boolean;
  reasonCodes: QualityReasonCode[];
  message?: string;
};

export function canTransition(
  from: ItemLifecycleState,
  to: ItemLifecycleState,
): TransitionResult {
  if (from === to) return { ok: true, reasonCodes: [] };
  const allowed = ALLOWED[from] ?? [];
  if (!allowed.includes(to)) {
    return {
      ok: false,
      reasonCodes: ['LIFECYCLE_VIOLATION'],
      message: `Illegal transition ${from} → ${to}`,
    };
  }
  return { ok: true, reasonCodes: [] };
}

/**
 * AI-generated content may never jump to calibrated/anchor.
 * Those require empirical evidence outside this package.
 */
export function assertAiCalibrationPolicy(
  claimed: CalibrationStatus | undefined,
  source: 'ai' | 'manual' | 'bank' | 'procedural' | 'empirical',
): TransitionResult {
  if ((claimed === 'calibrated' || claimed === 'anchor') && source === 'ai') {
    return {
      ok: false,
      reasonCodes: ['CALIBRATION_CLAIM_FORBIDDEN'],
      message: 'AI cannot assign calibrated/anchor',
    };
  }
  if (
    (claimed === 'calibrated' || claimed === 'anchor') &&
    source !== 'empirical' &&
    source !== 'bank'
  ) {
    return {
      ok: false,
      reasonCodes: ['CALIBRATION_CLAIM_FORBIDDEN'],
      message: `${source} cannot assign ${claimed} without empirical path`,
    };
  }
  return { ok: true, reasonCodes: [] };
}

export function transition(
  from: ItemLifecycleState,
  to: ItemLifecycleState,
): TransitionResult {
  return canTransition(from, to);
}
