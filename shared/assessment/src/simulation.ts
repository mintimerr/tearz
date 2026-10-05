/**
 * Model-recovery simulation harness (synthetic IRT data only).
 * Not Tearz real-world accuracy — recovers ability under the assumed 3PL model.
 */

import type { AssessmentConfig } from './config.js';
import { CEFR_LEVELS, DEFAULT_ASSESSMENT_CONFIG, pureBayesConfig } from './config.js';
import {
  applyAnswer,
  createAssessmentState,
  finalize,
} from './engine.js';
import { createItemFromSpec } from './item-factory.js';
import { probabilityCorrect, resolveIrtParams } from './irt.js';
import { cefrBandForTheta, cefrRank, statisticalEstimateFromProbs } from './scale.js';
import { pickNextItem } from './selector.js';
import type {
  AssessmentResult,
  AssessmentState,
  CalibrationStatus,
  CefrLevel,
  ItemMeta,
  LevelProbabilities,
  ScoringResponse,
} from './types.js';

export const DEFAULT_TRUE_THETA_GRID = [
  -2.75, -2.25, -1.75, -1.25, -0.75, -0.25, 0.25, 0.75, 1.25, 1.75, 2.25, 2.75,
] as const;

export type Rng = () => number;

/** Mulberry32 — deterministic, seedable. */
export function mulberry32(seed: number): Rng {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function sampleBernoulli(p: number, rng: Rng): boolean {
  return rng() < Math.max(0, Math.min(1, p));
}

export function itemAtLevel(
  level: CefrLevel,
  within: number,
  id: string,
  opts?: Partial<{
    skill: ItemMeta['skill'];
    calibrationStatus: CalibrationStatus;
    isScored: boolean;
  }>,
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): ItemMeta {
  return createItemFromSpec(
    {
      id,
      language: 'english',
      skill: opts?.skill ?? 'grammar',
      construct: `sim-${level}`,
      itemType: 'grammarForm',
      responseFormat: 'singleChoice',
      optionCount: 4,
      targetLevel: level,
      difficultyWithinLevel: within,
      isScored: opts?.isScored !== false,
      calibrationStatus: opts?.calibrationStatus ?? 'provisional',
      source: 'procedural',
    },
    config,
  );
}

/** Representative fixed 15-item ladder spanning A1→C2. */
export function buildFixedLadderItems(
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
  calibrationStatus: CalibrationStatus = 'provisional',
): ItemMeta[] {
  const plan: { level: CefrLevel; within: number }[] = [
    { level: 'A1', within: 0.4 },
    { level: 'A1', within: 0.7 },
    { level: 'A2', within: 0.3 },
    { level: 'A2', within: 0.6 },
    { level: 'A2', within: 0.8 },
    { level: 'B1', within: 0.3 },
    { level: 'B1', within: 0.5 },
    { level: 'B1', within: 0.7 },
    { level: 'B2', within: 0.3 },
    { level: 'B2', within: 0.5 },
    { level: 'B2', within: 0.7 },
    { level: 'C1', within: 0.4 },
    { level: 'C1', within: 0.6 },
    { level: 'C2', within: 0.3 },
    { level: 'C2', within: 0.5 },
  ];
  return plan.map((p, i) =>
    itemAtLevel(p.level, p.within, `fixed-${i}-${p.level}`, { calibrationStatus }, config),
  );
}

/** Broad candidate pool for adaptive selector sims. */
export function buildCandidatePool(
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
  calibrationStatus: CalibrationStatus = 'provisional',
  perLevel = 8,
): ItemMeta[] {
  const items: ItemMeta[] = [];
  for (const level of CEFR_LEVELS) {
    for (let i = 0; i < perLevel; i += 1) {
      const within = 0.15 + (i / Math.max(1, perLevel - 1)) * 0.7;
      items.push(
        itemAtLevel(level, within, `pool-${level}-${i}`, { calibrationStatus }, config),
      );
    }
  }
  return items;
}

export function respondFromTrueTheta(
  item: ItemMeta,
  trueTheta: number,
  rng: Rng,
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): ScoringResponse {
  const params = resolveIrtParams(item, config);
  const p = probabilityCorrect(trueTheta, params.a, params.b, params.c);
  return { correct: sampleBernoulli(p, rng), timedOut: false };
}

export function runFixedSession(
  trueTheta: number,
  items: ItemMeta[],
  rng: Rng,
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): { state: AssessmentState; result: AssessmentResult } {
  let state = createAssessmentState(config);
  for (const item of items) {
    const response = respondFromTrueTheta(item, trueTheta, rng, config);
    state = applyAnswer(state, item, response, config).state;
  }
  return { state, result: finalize(state, config) };
}

export function runAdaptiveSession(
  trueTheta: number,
  pool: ItemMeta[],
  nItems: number,
  rng: Rng,
  config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): { state: AssessmentState; result: AssessmentResult } {
  let state = createAssessmentState(config);
  const remaining = [...pool];
  for (let i = 0; i < nItems; i += 1) {
    const picked = pickNextItem(state, remaining, config);
    if (!picked) break;
    const response = respondFromTrueTheta(picked, trueTheta, rng, config);
    state = applyAnswer(state, picked, response, config).state;
    const idx = remaining.findIndex((x) => x.id === picked.id);
    if (idx >= 0) remaining.splice(idx, 1);
  }
  return { state, result: finalize(state, config) };
}

export type ThetaCellStats = {
  trueTheta: number;
  trueCefr: CefrLevel;
  n: number;
  meanEstimatedTheta: number;
  bias: number;
  rmse: number;
  meanPosteriorSd: number;
  coverage95: number;
  meanConfidence: number;
  exactCefrRate: number;
  within1CefrRate: number;
  statisticalDistribution: Record<CefrLevel, number>;
  verifiedDistribution: Record<CefrLevel, number>;
};

export type MonteCarloReport = {
  mode: 'fixed' | 'adaptive';
  configId: string;
  nSessionsPerTheta: number;
  nItems: number;
  cells: ThetaCellStats[];
  confusionStatistical: Record<CefrLevel, Record<CefrLevel, number>>;
  confusionVerified: Record<CefrLevel, Record<CefrLevel, number>>;
};

function emptyCefrCounts(): Record<CefrLevel, number> {
  return { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 };
}

function emptyConfusion(): Record<CefrLevel, Record<CefrLevel, number>> {
  const out = {} as Record<CefrLevel, Record<CefrLevel, number>>;
  for (const a of CEFR_LEVELS) {
    out[a] = emptyCefrCounts();
  }
  return out;
}

function posteriorSd(grid: readonly number[], posterior: readonly number[], mean: number): number {
  let v = 0;
  for (let i = 0; i < grid.length; i += 1) {
    const d = grid[i] - mean;
    v += (posterior[i] ?? 0) * d * d;
  }
  return Math.sqrt(Math.max(0, v));
}

export type RunMonteCarloOptions = {
  trueThetas?: readonly number[];
  nSessionsPerTheta?: number;
  nItems?: number;
  mode?: 'fixed' | 'adaptive';
  seed?: number;
  config?: AssessmentConfig;
  calibrationStatus?: CalibrationStatus;
};

export function runMonteCarlo(options: RunMonteCarloOptions = {}): MonteCarloReport {
  const trueThetas = options.trueThetas ?? DEFAULT_TRUE_THETA_GRID;
  const nSessions = options.nSessionsPerTheta ?? 1000;
  const nItems = options.nItems ?? 15;
  const mode = options.mode ?? 'fixed';
  const seed = options.seed ?? 42;
  const config = options.config ?? DEFAULT_ASSESSMENT_CONFIG;
  const calibrationStatus = options.calibrationStatus ?? 'provisional';

  const fixedItems = buildFixedLadderItems(config, calibrationStatus).slice(0, nItems);
  const pool = buildCandidatePool(config, calibrationStatus);

  const cells: ThetaCellStats[] = [];
  const confusionStatistical = emptyConfusion();
  const confusionVerified = emptyConfusion();

  for (let ti = 0; ti < trueThetas.length; ti += 1) {
    const trueTheta = trueThetas[ti];
    const trueCefr = cefrBandForTheta(trueTheta, config);
    let sumEst = 0;
    let sumSqErr = 0;
    let sumSd = 0;
    let covered = 0;
    let sumConf = 0;
    let exact = 0;
    let within1 = 0;
    const statDist = emptyCefrCounts();
    const verDist = emptyCefrCounts();

    for (let s = 0; s < nSessions; s += 1) {
      const rng = mulberry32(seed + ti * 100_003 + s * 17 + (mode === 'adaptive' ? 9_001 : 0));
      const { state, result } =
        mode === 'fixed'
          ? runFixedSession(trueTheta, fixedItems, rng, config)
          : runAdaptiveSession(trueTheta, pool, nItems, rng, config);

      const est = result.theta;
      sumEst += est;
      sumSqErr += (est - trueTheta) ** 2;
      sumSd += posteriorSd(state.thetaGrid, state.posterior, est);
      if (
        trueTheta >= result.thetaCredibleInterval.lower &&
        trueTheta <= result.thetaCredibleInterval.upper
      ) {
        covered += 1;
      }
      sumConf += result.confidence;

      const stat = result.statisticalEstimate;
      const ver = result.verifiedPlacementLevel;
      statDist[stat] += 1;
      verDist[ver] += 1;
      confusionStatistical[trueCefr][stat] += 1;
      confusionVerified[trueCefr][ver] += 1;

      if (stat === trueCefr) exact += 1;
      if (Math.abs(cefrRank(stat) - cefrRank(trueCefr)) <= 1) within1 += 1;
    }

    const meanEst = sumEst / nSessions;
    const toRate = (counts: Record<CefrLevel, number>) => {
      const out = emptyCefrCounts();
      for (const L of CEFR_LEVELS) out[L] = counts[L] / nSessions;
      return out;
    };

    cells.push({
      trueTheta,
      trueCefr,
      n: nSessions,
      meanEstimatedTheta: meanEst,
      bias: meanEst - trueTheta,
      rmse: Math.sqrt(sumSqErr / nSessions),
      meanPosteriorSd: sumSd / nSessions,
      coverage95: covered / nSessions,
      meanConfidence: sumConf / nSessions,
      exactCefrRate: exact / nSessions,
      within1CefrRate: within1 / nSessions,
      statisticalDistribution: toRate(statDist),
      verifiedDistribution: toRate(verDist),
    });
  }

  return {
    mode,
    configId: config.configId,
    nSessionsPerTheta: nSessions,
    nItems,
    cells,
    confusionStatistical,
    confusionVerified,
  };
}

/** Robustness ablation configs. */
export function robustnessConfigs(base: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG): {
  A_pureBayes: AssessmentConfig;
  B_slipOnly: AssessmentConfig;
  C_reliabilityOnly: AssessmentConfig;
  BC_combined: AssessmentConfig;
} {
  const pure = pureBayesConfig(base);
  return {
    A_pureBayes: pure,
    B_slipOnly: {
      ...base,
      configId: `${base.configId}-slip-only`,
      robustness: {
        ...base.robustness,
        slipEpsilon: base.robustness.slipEpsilon,
        reliabilityByCalibration: {
          anchor: 1,
          calibrated: 1,
          provisional: 1,
          experimental: 1,
        },
      },
    },
    C_reliabilityOnly: {
      ...base,
      configId: `${base.configId}-reliability-only`,
      robustness: {
        ...base.robustness,
        slipEpsilon: 0,
        reliabilityByCalibration: { ...base.robustness.reliabilityByCalibration },
      },
    },
    BC_combined: {
      ...base,
      configId: `${base.configId}-slip+reliability`,
      robustness: { ...base.robustness },
    },
  };
}

export type StepTrace = {
  step: number;
  itemId: string;
  targetLevel: CefrLevel;
  within: number;
  a: number;
  b: number;
  c: number;
  pCorrectAtTrueTheta: number;
  syntheticCorrect: boolean;
  responseConsistentWithTrueTheta: boolean;
  thetaAfter: number;
  levelProbabilities: LevelProbabilities;
  statisticalEstimate: CefrLevel;
  posteriorInformationGain: number;
};

export type ProfileAudit = {
  profileId: string;
  intendedCefr: CefrLevel;
  trueTheta: number;
  configId: string;
  steps: StepTrace[];
  final: {
    theta: number;
    statisticalEstimate: CefrLevel;
    verifiedPlacementLevel: CefrLevel;
    levelProbabilities: LevelProbabilities;
    confidence: number;
  };
  /** Same items, but responses sampled from IRT at trueTheta (one seed). */
  irtSampledReplay: {
    theta: number;
    statisticalEstimate: CefrLevel;
    verifiedPlacementLevel: CefrLevel;
  };
};

export function auditDeterministicProfile(
  profileId: string,
  intendedCefr: CefrLevel,
  trueTheta: number,
  plan: { level: CefrLevel; within: number; ok: boolean }[],
  config: AssessmentConfig = pureBayesConfig(),
  sampleSeed = 12345,
): ProfileAudit {
  let state = createAssessmentState(config);
  const steps: StepTrace[] = [];
  const items: ItemMeta[] = [];

  for (let i = 0; i < plan.length; i += 1) {
    const p = plan[i];
    const item = itemAtLevel(p.level, p.within, `${profileId}-q${i}`, undefined, config);
    items.push(item);
    const params = resolveIrtParams(item, config);
    const pCorrect = probabilityCorrect(trueTheta, params.a, params.b, params.c);
    const { state: next, record } = applyAnswer(
      state,
      item,
      { correct: p.ok, timedOut: false },
      config,
    );
    state = next;
    const probs = state.levelProbabilities;
    steps.push({
      step: i + 1,
      itemId: item.id,
      targetLevel: p.level,
      within: p.within,
      a: params.a,
      b: params.b,
      c: params.c,
      pCorrectAtTrueTheta: pCorrect,
      syntheticCorrect: p.ok,
      // "Consistent" if the chosen response is the more likely outcome at trueTheta
      // (ties broken as consistent).
      responseConsistentWithTrueTheta: p.ok ? pCorrect >= 0.5 : pCorrect <= 0.5,
      thetaAfter: state.theta,
      levelProbabilities: { ...probs },
      statisticalEstimate: statisticalEstimateFromProbs(probs),
      posteriorInformationGain: record.posteriorInformationGain,
    });
  }

  const result = finalize(state, config);
  const rng = mulberry32(sampleSeed);
  const sampled = runFixedSession(trueTheta, items, rng, config);

  return {
    profileId,
    intendedCefr,
    trueTheta,
    configId: config.configId,
    steps,
    final: {
      theta: result.theta,
      statisticalEstimate: result.statisticalEstimate,
      verifiedPlacementLevel: result.verifiedPlacementLevel,
      levelProbabilities: result.levelProbabilities,
      confidence: result.confidence,
    },
    irtSampledReplay: {
      theta: sampled.result.theta,
      statisticalEstimate: sampled.result.statisticalEstimate,
      verifiedPlacementLevel: sampled.result.verifiedPlacementLevel,
    },
  };
}

/** Strong-user sequence for slip / reliability comparison (8 high corrects + A2 miss). */
export function runStrongUserA2Miss(
  config: AssessmentConfig,
  calibrationStatus: CalibrationStatus = 'provisional',
): {
  thetaBeforeMiss: number;
  thetaAfterMiss: number;
  delta: number;
  igMiss: number;
  finalVerified: CefrLevel;
  finalTheta: number;
} {
  let state = createAssessmentState(config);
  const strongPlan: { level: CefrLevel; within: number }[] = [
    { level: 'B2', within: 0.5 },
    { level: 'C1', within: 0.4 },
    { level: 'C1', within: 0.6 },
    { level: 'C1', within: 0.7 },
    { level: 'C2', within: 0.4 },
    { level: 'C2', within: 0.5 },
    { level: 'C2', within: 0.6 },
    { level: 'C2', within: 0.7 },
  ];
  for (let i = 0; i < strongPlan.length; i += 1) {
    const p = strongPlan[i];
    const item = itemAtLevel(p.level, p.within, `strong-${i}`, { calibrationStatus }, config);
    state = applyAnswer(state, item, { correct: true, timedOut: false }, config).state;
  }
  const thetaBeforeMiss = state.theta;
  const missItem = itemAtLevel('A2', 0.4, 'miss-a2', { calibrationStatus }, config);
  const { state: after, record } = applyAnswer(
    state,
    missItem,
    { correct: false, timedOut: false },
    config,
  );
  state = after;
  // Recovery items
  for (let i = 0; i < 4; i += 1) {
    const item = itemAtLevel('C2', 0.5, `rec-${i}`, { calibrationStatus }, config);
    state = applyAnswer(state, item, { correct: true, timedOut: false }, config).state;
  }
  const result = finalize(state, config);
  return {
    thetaBeforeMiss,
    thetaAfterMiss: after.theta,
    delta: after.theta - thetaBeforeMiss,
    igMiss: record.posteriorInformationGain,
    finalVerified: result.verifiedPlacementLevel,
    finalTheta: result.theta,
  };
}
