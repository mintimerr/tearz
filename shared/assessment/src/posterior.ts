import type { AssessmentConfig } from './config.js';
import { DEFAULT_ASSESSMENT_CONFIG } from './config.js';
import { observedLikelihood } from './irt.js';
import { entropy, normalize } from './prior.js';
import { levelProbabilitiesFromPosterior } from './scale.js';
import type { CredibleInterval, LevelProbabilities } from './types.js';

export type PosteriorUpdateResult = {
  posterior: number[];
  theta: number;
  thetaCredibleInterval: CredibleInterval;
  levelProbabilities: LevelProbabilities;
  entropyBefore: number;
  entropyAfter: number;
  posteriorInformationGain: number;
};

/** EAP: E[θ | responses]. */
export function eapTheta(grid: readonly number[], posterior: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < grid.length; i += 1) {
    sum += grid[i] * (posterior[i] ?? 0);
  }
  return sum;
}

/** Equal-tailed credible interval from discrete posterior CDF. */
export function credibleInterval(
  grid: readonly number[],
  posterior: readonly number[],
  mass: number = 0.95,
): CredibleInterval {
  const alpha = (1 - mass) / 2;
  let cdf = 0;
  let lower = grid[0];
  let upper = grid[grid.length - 1];
  let lowerSet = false;
  for (let i = 0; i < grid.length; i += 1) {
    cdf += posterior[i] ?? 0;
    if (!lowerSet && cdf >= alpha) {
      lower = grid[i];
      lowerSet = true;
    }
    if (cdf >= 1 - alpha) {
      upper = grid[i];
      break;
    }
  }
  return { lower, upper };
}

/**
 * Bayesian update:
 *   posterior(θ) ∝ previous(θ) × L_obs(response | θ, item)^weight
 *
 * weight = responseWeight × itemReliability (timeout / provisional downweighting).
 * posteriorInformationGain = H(before) − H(after) — may be negative for surprising responses.
 */
export function updatePosterior(
  grid: readonly number[],
  previous: readonly number[],
  params: { a: number; b: number; c: number },
  correct: boolean,
  weight: number,
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): PosteriorUpdateResult {
  const entropyBefore = entropy(previous);
  const w = Math.max(0, Math.min(1, weight));

  let next: number[];
  if (w <= 0) {
    next = [...previous];
  } else {
    const raw = new Array<number>(grid.length);
    for (let i = 0; i < grid.length; i += 1) {
      const L = observedLikelihood(grid[i], correct, params.a, params.b, params.c, config);
      const factor = w === 1 ? L : Math.pow(L, w);
      raw[i] = (previous[i] ?? 0) * factor;
    }
    next = normalize(raw);
  }

  const entropyAfter = entropy(next);
  return {
    posterior: next,
    theta: eapTheta(grid, next),
    thetaCredibleInterval: credibleInterval(grid, next, config.credibleIntervalMass),
    levelProbabilities: levelProbabilitiesFromPosterior(grid, next, config),
    entropyBefore,
    entropyAfter,
    // Do NOT clamp: negative IG is diagnostic (surprising / entropy-increasing update).
    posteriorInformationGain: entropyBefore - entropyAfter,
  };
}

export function summarizePosterior(
  grid: readonly number[],
  posterior: readonly number[],
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
) {
  return {
    theta: eapTheta(grid, posterior),
    thetaCredibleInterval: credibleInterval(grid, posterior, config.credibleIntervalMass),
    levelProbabilities: levelProbabilitiesFromPosterior(grid, posterior, config),
    entropy: entropy(posterior),
  };
}
