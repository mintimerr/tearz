import type { AssessmentConfig } from './config.js';
import { CEFR_LEVELS, DEFAULT_ASSESSMENT_CONFIG } from './config.js';
import type { CefrLevel, LevelProbabilities } from './types.js';

/** Predicted IRT difficulty b from CEFR target + within-level position. */
export function predictedDifficultyFromSpec(
  targetLevel: CefrLevel,
  difficultyWithinLevel: number,
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): number {
  const within = Math.max(0, Math.min(1, difficultyWithinLevel));
  const anchor = config.levelAnchors[targetLevel];
  const b = anchor + (within - 0.5) * config.withinLevelWidth;
  return clamp(b, config.thetaMin, config.thetaMax);
}

/** Map legacy 0–100 difficulty onto theta b (bridge only). */
export function legacyDifficulty100ToTheta(
  d100: number,
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): number {
  const d = Math.max(0, Math.min(100, d100));
  return config.thetaMin + (d / 100) * (config.thetaMax - config.thetaMin);
}

/** EAP theta → legacy ability 0–100 for existing Placement API. */
export function thetaToLegacyAbility100(
  theta: number,
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): number {
  const span = config.thetaMax - config.thetaMin;
  const t = (theta - config.thetaMin) / span;
  return Math.max(0, Math.min(100, Math.round(t * 100)));
}

export function emptyLevelProbabilities(): LevelProbabilities {
  return { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 };
}

/**
 * Sum posterior mass inside each provisional CEFR band.
 * Bands are operational mappings (see config.cefrBandCalibrationStatus).
 */
export function levelProbabilitiesFromPosterior(
  grid: readonly number[],
  posterior: readonly number[],
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): LevelProbabilities {
  const out = emptyLevelProbabilities();
  for (let i = 0; i < grid.length; i += 1) {
    const th = grid[i];
    const p = posterior[i] ?? 0;
    const level = cefrBandForTheta(th, config);
    out[level] += p;
  }
  // Renormalize tiny float drift.
  let sum = 0;
  for (const L of CEFR_LEVELS) sum += out[L];
  if (sum > 0) {
    for (const L of CEFR_LEVELS) out[L] /= sum;
  }
  return out;
}

export function cefrBandForTheta(
  theta: number,
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): CefrLevel {
  const bands = config.cefrBands;
  for (let i = 0; i < bands.length; i += 1) {
    const band = bands[i];
    const isLast = i === bands.length - 1;
    if (isLast) {
      if (theta >= band.lower && theta <= band.upper + 1e-9) return band.level;
    } else if (theta >= band.lower && theta < band.upper) {
      return band.level;
    }
  }
  if (theta < bands[0].lower) return 'A1';
  return 'C2';
}

export function statisticalEstimateFromProbs(probs: LevelProbabilities): CefrLevel {
  let best: CefrLevel = 'A1';
  let bestP = -1;
  for (const L of CEFR_LEVELS) {
    if (probs[L] > bestP) {
      bestP = probs[L];
      best = L;
    }
  }
  return best;
}

export function cefrRank(level: CefrLevel): number {
  return CEFR_LEVELS.indexOf(level) + 1;
}

export function minCefr(a: CefrLevel, b: CefrLevel): CefrLevel {
  return cefrRank(a) <= cefrRank(b) ? a : b;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
