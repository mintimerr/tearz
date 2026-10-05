import type { AssessmentConfig } from './config.js';
import { DEFAULT_ASSESSMENT_CONFIG, defaultGuessingProbability } from './config.js';
import type { ItemMeta, ResolvedIrtParams } from './types.js';

export function logistic(x: number): number {
  if (x >= 20) return 1;
  if (x <= -20) return 0;
  return 1 / (1 + Math.exp(-x));
}

/** 3PL probability of a correct response. */
export function probabilityCorrect(theta: number, a: number, b: number, c: number): number {
  const cc = Math.max(0, Math.min(0.5, c));
  return cc + (1 - cc) * logistic(a * (theta - b));
}

/** Pure IRT Bernoulli likelihood (no slip / contamination). */
export function likelihood(
  theta: number,
  correct: boolean,
  a: number,
  b: number,
  c: number,
): number {
  const p = probabilityCorrect(theta, a, b, c);
  const L = correct ? p : 1 - p;
  return floorL(L);
}

/**
 * Observed-response likelihood with optional slip contamination:
 *   P_obs = (1-ε)·P_IRT + ε·P_noise
 *
 * When ε=0 this equals pure IRT likelihood.
 */
export function observedLikelihood(
  theta: number,
  correct: boolean,
  a: number,
  b: number,
  c: number,
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): number {
  const pIrt = probabilityCorrect(theta, a, b, c);
  const Lirt = correct ? pIrt : 1 - pIrt;
  const eps = Math.max(0, Math.min(0.5, config.robustness.slipEpsilon));
  if (eps <= 0) return floorL(Lirt);

  const pNoise =
    config.robustness.slipNoiseMode === 'uniform'
      ? 0.5
      : Math.max(0, Math.min(0.5, c)); // chanceLevel: noise correct-rate = guessing floor
  const Lnoise = correct ? pNoise : 1 - pNoise;
  return floorL((1 - eps) * Lirt + eps * Lnoise);
}

function floorL(L: number): number {
  return Math.max(1e-12, Math.min(1 - 1e-12, L));
}

/**
 * Fisher information for 3PL at theta.
 * Used by the selector as potential informativeness — not stored as information gain.
 */
export function fisherInformation(theta: number, a: number, b: number, c: number): number {
  const p = probabilityCorrect(theta, a, b, c);
  const q = 1 - p;
  if (p <= 1e-12 || q <= 1e-12) return 0;
  const cc = Math.max(0, Math.min(0.5, c));
  const s = logistic(a * (theta - b));
  const num = a * a * (1 - cc) * (1 - cc) * s * s * (1 - s) * (1 - s);
  return num / (p * q);
}

export function resolveIrtParams(
  item: ItemMeta,
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): ResolvedIrtParams {
  const sample = item.sampleSize ?? 0;
  const empiricalReady =
    sample >= config.minCalibrationSampleSize &&
    typeof item.empiricalDifficulty === 'number' &&
    Number.isFinite(item.empiricalDifficulty);

  if (empiricalReady) {
    return {
      a:
        typeof item.empiricalDiscrimination === 'number' &&
        Number.isFinite(item.empiricalDiscrimination)
          ? item.empiricalDiscrimination
          : config.defaultDiscrimination,
      b: item.empiricalDifficulty as number,
      c:
        typeof item.empiricalGuessingProbability === 'number' &&
        Number.isFinite(item.empiricalGuessingProbability)
          ? item.empiricalGuessingProbability
          : resolvePredictedC(item, config),
      source: 'empirical',
    };
  }

  return {
    a: item.predictedDiscrimination || config.defaultDiscrimination,
    b: item.predictedDifficulty,
    c: resolvePredictedC(item, config),
    source: 'predicted',
  };
}

function resolvePredictedC(item: ItemMeta, config: AssessmentConfig): number {
  if (typeof item.guessingProbability === 'number' && Number.isFinite(item.guessingProbability)) {
    return Math.max(0, Math.min(0.5, item.guessingProbability));
  }
  return defaultGuessingProbability(item.responseFormat, item.optionCount, config);
}
