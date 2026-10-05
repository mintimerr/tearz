import type { AssessmentConfig } from '../config.js';
import { DEFAULT_ASSESSMENT_CONFIG, reliabilityForItem } from '../config.js';
import { fisherInformation, observedLikelihood, probabilityCorrect, resolveIrtParams } from '../irt.js';
import { entropy } from '../prior.js';
import { updatePosterior } from '../posterior.js';
import type { AssessmentState, ItemMeta } from '../types.js';

/**
 * Expected information gain for a binary scored item:
 *   EIG = H(π) − Σ_r P(r) H(π | r)
 */
export function expectedInformationGain(
  state: AssessmentState,
  item: ItemMeta,
  assessmentConfig: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
  opts: { gridStride?: number; weight?: number } = {},
): number {
  if (!item.isScored) return 0;

  const params = resolveIrtParams(item, assessmentConfig);
  const weight =
    opts.weight ??
    reliabilityForItem(item.calibrationStatus, assessmentConfig);
  if (weight <= 0) return 0;

  const stride = Math.max(1, opts.gridStride ?? 1);
  const grid = state.thetaGrid;
  const post = state.posterior;

  // Marginal P(correct) under current posterior (optionally strided approx)
  let pCorrect = 0;
  let mass = 0;
  for (let i = 0; i < grid.length; i += stride) {
    const w = post[i] ?? 0;
    mass += w;
    pCorrect += w * probabilityCorrect(grid[i], params.a, params.b, params.c);
  }
  if (mass > 0) pCorrect /= mass;
  pCorrect = Math.max(1e-9, Math.min(1 - 1e-9, pCorrect));
  const pWrong = 1 - pCorrect;

  const h0 = entropy(post);
  const afterCorrect = updatePosterior(
    grid,
    post,
    params,
    true,
    weight,
    assessmentConfig,
  );
  const afterWrong = updatePosterior(
    grid,
    post,
    params,
    false,
    weight,
    assessmentConfig,
  );

  return h0 - (pCorrect * afterCorrect.entropyAfter + pWrong * afterWrong.entropyAfter);
}

export function fisherAtEap(
  state: AssessmentState,
  item: ItemMeta,
  assessmentConfig: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): number {
  const params = resolveIrtParams(item, assessmentConfig);
  return fisherInformation(state.theta, params.a, params.b, params.c);
}

/** Predictively average likelihood of correct under posterior (for diagnostics). */
export function expectedPCorrect(
  state: AssessmentState,
  item: ItemMeta,
  assessmentConfig: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): number {
  const params = resolveIrtParams(item, assessmentConfig);
  let s = 0;
  for (let i = 0; i < state.thetaGrid.length; i += 1) {
    s += (state.posterior[i] ?? 0) * probabilityCorrect(state.thetaGrid[i], params.a, params.b, params.c);
  }
  return s;
}

export function predictiveLikelihoodRatio(
  state: AssessmentState,
  item: ItemMeta,
  assessmentConfig: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): { pCorrect: number; meanLCorrect: number; meanLWrong: number } {
  const params = resolveIrtParams(item, assessmentConfig);
  let pCorrect = 0;
  let meanLCorrect = 0;
  let meanLWrong = 0;
  for (let i = 0; i < state.thetaGrid.length; i += 1) {
    const th = state.thetaGrid[i];
    const w = state.posterior[i] ?? 0;
    const pc = probabilityCorrect(th, params.a, params.b, params.c);
    pCorrect += w * pc;
    meanLCorrect += w * observedLikelihood(th, true, params.a, params.b, params.c, assessmentConfig);
    meanLWrong += w * observedLikelihood(th, false, params.a, params.b, params.c, assessmentConfig);
  }
  return { pCorrect, meanLCorrect, meanLWrong };
}
