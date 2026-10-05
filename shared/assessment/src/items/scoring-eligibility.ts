import type { AssessmentConfig } from '../config.js';
import { DEFAULT_ASSESSMENT_CONFIG, reliabilityForItem } from '../config.js';
import type { CalibrationStatus } from '../types.js';
import type { ItemQualityReport, QualityReasonCode, ScoringEligibility } from './types.js';

export type EligibilityPolicy = {
  /**
   * experimental items may pass quality but remain unscored.
   * provisional may be scored with reduced evidence weight.
   */
  scoreProvisional: boolean;
  scoreExperimental: boolean;
};

export const DEFAULT_ELIGIBILITY_POLICY: EligibilityPolicy = {
  scoreProvisional: true,
  scoreExperimental: false,
};

/**
 * Quality gate ≠ calibration.
 * PASS + provisional → may score with reliability weight.
 * PASS + experimental → typically unscored until promoted.
 * calibrated/anchor cannot be granted by this function.
 */
export function decideScoringEligibility(
  report: ItemQualityReport,
  calibrationStatus: CalibrationStatus,
  policy: EligibilityPolicy = DEFAULT_ELIGIBILITY_POLICY,
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): ScoringEligibility {
  const reasonCodes: QualityReasonCode[] = [];

  if (report.qualityGate === 'REJECT') {
    return {
      eligible: false,
      evidenceWeight: 0,
      reasonCodes: ['CRITICAL_CORRECTNESS', ...report.criticalIssues.map((i) => i.code)],
      calibrationStatus,
      isScored: false,
      qualityGate: report.qualityGate,
    };
  }

  if (report.qualityGate === 'REVISE') {
    return {
      eligible: false,
      evidenceWeight: 0,
      reasonCodes: ['OTHER', ...report.criticalIssues.map((i) => i.code)],
      calibrationStatus,
      isScored: false,
      qualityGate: report.qualityGate,
    };
  }

  if (calibrationStatus === 'calibrated' || calibrationStatus === 'anchor') {
    // Eligibility may use these only if already set by empirical pipeline.
    const weight = reliabilityForItem(calibrationStatus, config);
    return {
      eligible: true,
      evidenceWeight: weight,
      reasonCodes: [],
      calibrationStatus,
      isScored: true,
      qualityGate: 'PASS',
    };
  }

  if (calibrationStatus === 'experimental') {
    if (!policy.scoreExperimental) {
      reasonCodes.push('OTHER');
      return {
        eligible: false,
        evidenceWeight: 0,
        reasonCodes,
        calibrationStatus,
        isScored: false,
        qualityGate: 'PASS',
      };
    }
  }

  if (calibrationStatus === 'provisional' && !policy.scoreProvisional) {
    return {
      eligible: false,
      evidenceWeight: 0,
      reasonCodes: ['OTHER'],
      calibrationStatus,
      isScored: false,
      qualityGate: 'PASS',
    };
  }

  const weight = reliabilityForItem(calibrationStatus, config);
  return {
    eligible: weight > 0,
    evidenceWeight: weight,
    reasonCodes,
    calibrationStatus,
    isScored: weight > 0,
    qualityGate: 'PASS',
  };
}
