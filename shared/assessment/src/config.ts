import type { CefrLevel, ConfidenceLabel, ResponseFormat } from './types.js';

/**
 * Operational CEFR band edges on the theta scale.
 *
 * cefrBandCalibrationStatus: 'provisional'
 * These boundaries are a provisional operational mapping for Tearz v1 —
 * NOT objectively established CEFR cut-scores. They must be recalibrated
 * later against external CEFR-labelled learner data.
 */
export type CefrBand = {
  level: CefrLevel;
  /** Inclusive lower edge on theta grid. */
  lower: number;
  /** Exclusive upper edge, except C2 which is inclusive at grid max. */
  upper: number;
};

export type AssessmentConfig = {
  configId: string;
  configVersion: string;

  thetaMin: number;
  thetaMax: number;
  thetaStep: number;

  /** Prior: Normal(mu, sigma²) discretized on the grid. */
  priorMu: number;
  priorSigma: number;

  /**
   * Provisional operational mapping status for theta → CEFR bands.
   * Must be recalibrated on external CEFR-labelled data before treating
   * bands as exam-equivalent cut-scores.
   */
  cefrBandCalibrationStatus: 'provisional';
  cefrBands: CefrBand[];

  /** Width of within-level difficulty mapping onto theta. */
  withinLevelWidth: number;
  /** Mid-band anchors used when building predictedDifficulty. */
  levelAnchors: Record<CefrLevel, number>;

  defaultDiscrimination: number;
  minCalibrationSampleSize: number;

  /** Defaults for c by responseFormat (+ optionCount for singleChoice). */
  guessingDefaults: {
    singleChoiceByOptions: Record<number, number>;
    multiSelect: number;
    freeText: number;
    constructed: number;
    fallback: number;
  };

  timeoutResponseWeight: number;
  unscoredResponseWeight: number;

  credibleIntervalMass: number;

  /** Combined confidence formula (provisional — replace after validation). */
  confidenceFormula: {
    id: 'geometric_mean_v1';
    version: string;
  };
  confidenceLabels: {
    lowMax: number;
    mediumMax: number;
  };

  verification: {
    /** Min scored corrects with effective b in C1 band (or above) to show C1. */
    minC1Supporting: number;
    /** Min scored corrects with effective b in C2 band to show C2. */
    minC2Supporting: number;
    /** Min scored corrects at/above B2 band to show B2. */
    minB2Supporting: number;
    /** Min scored corrects at/above B1 band to show B1. */
    minB1Supporting: number;
    /** Half-width around EAP for "boundary" items. */
    boundaryHalfWidth: number;
  };

  quality: {
    minInformativeItemsForFull: number;
    informativeFisherThreshold: number;
    contradictionFlipPenalty: number;
  };

  /**
   * Robust Bayesian observation model (configurable).
   * Pure IRT Bayes = slipEpsilon: 0 and all reliability weights 1.
   */
  robustness: {
    /**
     * Contamination / slip probability ε.
     * Rationale v1: ~5% of responses in a mobile MC test are not ability-driven
     * (misclick, distraction, ambiguous stem). Literature uses similar slip rates
     * in cognitive diagnostic models; not tuned to make unit tests pass.
     */
    slipEpsilon: number;
    /**
     * Noise distribution when a slip occurs.
     * chanceLevel: P(correct|noise)=c (same guessing floor as the item).
     */
    slipNoiseMode: 'chanceLevel' | 'uniform';
    /**
     * Multiplies log-likelihood evidence (implemented as L^reliability).
     * Anchor/calibrated ≈ full evidence; provisional AI items weaker;
     * experimental weakest. Values are design choices for Tearz v1, not fit to
     * synthetic profiles.
     */
    reliabilityByCalibration: {
      anchor: number;
      calibrated: number;
      provisional: number;
      experimental: number;
    };
  };
};

export const CEFR_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const DEFAULT_ASSESSMENT_CONFIG: AssessmentConfig = {
  configId: 'tearz-assessment-v1',
  configVersion: '1.1.0-provisional',

  /** Expanded after grid-edge audit: ±3.5 truncated A1/C2 posteriors. */
  thetaMin: -4.5,
  thetaMax: 4.5,
  thetaStep: 0.05,

  priorMu: 0,
  priorSigma: 1.5,

  cefrBandCalibrationStatus: 'provisional',
  /** Band edges unchanged; posterior tails outside ±3.5 still map to A1/C2. */
  cefrBands: [
    { level: 'A1', lower: -4.5, upper: -2.0 },
    { level: 'A2', lower: -2.0, upper: -1.0 },
    { level: 'B1', lower: -1.0, upper: 0.0 },
    { level: 'B2', lower: 0.0, upper: 1.0 },
    { level: 'C1', lower: 1.0, upper: 2.0 },
    { level: 'C2', lower: 2.0, upper: 4.5 },
  ],

  withinLevelWidth: 0.9,
  levelAnchors: {
    A1: -2.5,
    A2: -1.5,
    B1: -0.5,
    B2: 0.5,
    C1: 1.5,
    C2: 2.5,
  },

  defaultDiscrimination: 1.2,
  minCalibrationSampleSize: 200,

  guessingDefaults: {
    singleChoiceByOptions: {
      2: 0.5,
      3: 1 / 3,
      4: 0.25,
      5: 0.2,
      6: 1 / 6,
    },
    multiSelect: 0.1,
    freeText: 0.02,
    constructed: 0.02,
    fallback: 0.25,
  },

  timeoutResponseWeight: 0.4,
  unscoredResponseWeight: 0,

  credibleIntervalMass: 0.95,

  confidenceFormula: {
    id: 'geometric_mean_v1',
    version: 'provisional-1',
  },
  confidenceLabels: {
    lowMax: 0.54,
    mediumMax: 0.74,
  },

  verification: {
    minC1Supporting: 3,
    minC2Supporting: 4,
    minB2Supporting: 2,
    minB1Supporting: 2,
    boundaryHalfWidth: 0.55,
  },

  quality: {
    minInformativeItemsForFull: 8,
    informativeFisherThreshold: 0.15,
    contradictionFlipPenalty: 0.08,
  },

  robustness: {
    slipEpsilon: 0.05,
    slipNoiseMode: 'chanceLevel',
    reliabilityByCalibration: {
      anchor: 1.0,
      calibrated: 0.95,
      provisional: 0.55,
      experimental: 0.25,
    },
  },
};

/** Pure Bayes (no slip, full reliability) — for audits / ablation. */
export function pureBayesConfig(
  base: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): AssessmentConfig {
  return {
    ...base,
    configId: `${base.configId}-pure-bayes`,
    robustness: {
      slipEpsilon: 0,
      slipNoiseMode: 'chanceLevel',
      reliabilityByCalibration: {
        anchor: 1,
        calibrated: 1,
        provisional: 1,
        experimental: 1,
      },
    },
  };
}

export function reliabilityForItem(
  calibrationStatus: keyof AssessmentConfig['robustness']['reliabilityByCalibration'],
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): number {
  return config.robustness.reliabilityByCalibration[calibrationStatus] ?? 1;
}

export function defaultGuessingProbability(
  responseFormat: ResponseFormat,
  optionCount: number | undefined,
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): number {
  if (responseFormat === 'singleChoice') {
    const n = optionCount && optionCount > 0 ? Math.round(optionCount) : 4;
    return config.guessingDefaults.singleChoiceByOptions[n] ?? 1 / Math.max(2, n);
  }
  if (responseFormat === 'multiSelect') return config.guessingDefaults.multiSelect;
  if (responseFormat === 'freeText') return config.guessingDefaults.freeText;
  if (responseFormat === 'constructed') return config.guessingDefaults.constructed;
  return config.guessingDefaults.fallback;
}

export function confidenceLabelFromValue(
  confidence: number,
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): ConfidenceLabel {
  if (confidence <= config.confidenceLabels.lowMax) return 'low';
  if (confidence <= config.confidenceLabels.mediumMax) return 'medium';
  return 'high';
}

export function combineConfidence(
  measurementConfidence: number,
  qualityConfidence: number,
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): number {
  // Provisional formula — versioned in config for later replacement.
  if (config.confidenceFormula.id === 'geometric_mean_v1') {
    const m = clamp01(measurementConfidence);
    const q = clamp01(qualityConfidence);
    return Math.sqrt(m * q);
  }
  return clamp01(0.5 * measurementConfidence + 0.5 * qualityConfidence);
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}
