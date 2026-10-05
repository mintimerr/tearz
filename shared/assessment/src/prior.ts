import type { AssessmentConfig } from './config.js';
import { DEFAULT_ASSESSMENT_CONFIG } from './config.js';

/** Build theta grid from config. */
export function buildThetaGrid(config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG): number[] {
  const grid: number[] = [];
  const { thetaMin, thetaMax, thetaStep } = config;
  // Inclusive endpoints with stable float stepping.
  const n = Math.round((thetaMax - thetaMin) / thetaStep);
  for (let i = 0; i <= n; i += 1) {
    const v = thetaMin + i * thetaStep;
    grid.push(Number(v.toFixed(4)));
  }
  if (grid[grid.length - 1] !== thetaMax) grid.push(thetaMax);
  return grid;
}

/** Discretized Normal(mu, sigma²) prior on the grid (sums to 1). */
export function buildNormalPrior(
  grid: readonly number[],
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): number[] {
  const { priorMu, priorSigma } = config;
  if (!(priorSigma > 0) || !Number.isFinite(priorSigma)) {
    return buildFlatPrior(grid);
  }
  // Very large sigma ≈ flat for practical purposes on a finite grid.
  if (priorSigma >= 50) {
    return buildFlatPrior(grid);
  }
  const invTwoVar = 1 / (2 * priorSigma * priorSigma);
  const raw = grid.map((th) => {
    const d = th - priorMu;
    return Math.exp(-d * d * invTwoVar);
  });
  return normalize(raw);
}

/** Uniform prior on the grid (sums to 1). */
export function buildFlatPrior(grid: readonly number[]): number[] {
  const u = 1 / Math.max(1, grid.length);
  return grid.map(() => u);
}

export function normalize(weights: readonly number[]): number[] {
  let sum = 0;
  for (const w of weights) sum += w;
  if (!(sum > 0) || !Number.isFinite(sum)) {
    const u = 1 / weights.length;
    return weights.map(() => u);
  }
  return weights.map((w) => w / sum);
}

/** Shannon entropy in nats. */
export function entropy(posterior: readonly number[]): number {
  let h = 0;
  for (const p of posterior) {
    if (p > 1e-15) h -= p * Math.log(p);
  }
  return h;
}
