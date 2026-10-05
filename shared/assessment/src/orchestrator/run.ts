import type { AssessmentConfig } from '../config.js';
import { DEFAULT_ASSESSMENT_CONFIG } from '../config.js';
import { cefrBandForTheta, cefrRank } from '../scale.js';
import {
  buildFixedLadderItems,
  mulberry32,
  respondFromTrueTheta,
  runFixedSession,
  type Rng,
} from '../simulation.js';
import type { AssessmentResult, CalibrationStatus } from '../types.js';
import { buildOrchestratorBank } from './bank.js';
import { DEFAULT_ORCHESTRATOR_CONFIG, type OrchestratorConfig } from './config.js';
import {
  applyOrchestratorAnswer,
  chooseNext,
  commitSelection,
  createAdaptiveTestState,
  finalizeAdaptiveTest,
} from './state.js';
import type { AdaptiveTestState, OrchestratorCandidate, PresentedRecord } from './types.js';

export type AdaptiveSessionResult = {
  state: AdaptiveTestState;
  result: AssessmentResult;
  sequence: ReturnType<typeof summarizeSequence>;
};

export function summarizeSequence(presented: PresentedRecord[]) {
  return presented.map((p) => ({
    questionNumber: p.questionNumber,
    phase: p.phase,
    skill: p.item.skill,
    construct: p.item.construct,
    targetLevel: p.item.targetLevel,
    difficulty: p.decision.selectedDifficulty,
    response: p.responseCorrect,
    thetaAfter: p.thetaAfter,
    activeBoundary: p.activeBoundaryAfter?.id ?? p.decision.activeBoundary?.id ?? null,
  }));
}

export function runAdaptiveSession(
  trueTheta: number,
  bank: OrchestratorCandidate[],
  rng: Rng,
  orchestratorConfig: OrchestratorConfig = DEFAULT_ORCHESTRATOR_CONFIG,
  assessmentConfig: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): AdaptiveSessionResult {
  let orch = createAdaptiveTestState(assessmentConfig, orchestratorConfig);
  const remaining = [...bank];

  for (let q = 1; q <= orchestratorConfig.totalPresentedItems; q += 1) {
    const selection = chooseNext(orch, remaining, orchestratorConfig, assessmentConfig);
    if (!selection) break;
    orch = commitSelection(orch, selection, orchestratorConfig);
    const item = selection.candidate.item;
    const response = respondFromTrueTheta(item, trueTheta, rng, assessmentConfig);
    orch = applyOrchestratorAnswer(orch, response, assessmentConfig, orchestratorConfig);
    const idx = remaining.findIndex((c) => c.item.id === item.id);
    if (idx >= 0) remaining.splice(idx, 1);
  }

  return {
    state: orch,
    result: finalizeAdaptiveTest(orch, assessmentConfig),
    sequence: summarizeSequence(orch.presentedItems),
  };
}

export type ModeCompareCell = {
  trueTheta: number;
  n: number;
  meanEstimatedTheta: number;
  bias: number;
  rmse: number;
  exactCefrRate: number;
  within1CefrRate: number;
  coverage95: number;
  meanCiWidth: number;
  meanMeasurementConfidence: number;
  meanQualityConfidence: number;
  meanConfidence: number;
};

function accumulateCell(trueTheta: number, results: AssessmentResult[]): ModeCompareCell {
  const n = results.length;
  let sumEst = 0;
  let sumSq = 0;
  let exact = 0;
  let within1 = 0;
  let covered = 0;
  let sumWidth = 0;
  let sumM = 0;
  let sumQ = 0;
  let sumC = 0;
  for (const r of results) {
    sumEst += r.theta;
    sumSq += (r.theta - trueTheta) ** 2;
    const trueCefr = cefrBandForTheta(trueTheta);
    if (r.statisticalEstimate === trueCefr) exact += 1;
    if (Math.abs(cefrRank(r.statisticalEstimate) - cefrRank(trueCefr)) <= 1) within1 += 1;
    if (
      trueTheta >= r.thetaCredibleInterval.lower &&
      trueTheta <= r.thetaCredibleInterval.upper
    ) {
      covered += 1;
    }
    sumWidth += r.thetaCredibleInterval.upper - r.thetaCredibleInterval.lower;
    sumM += r.measurementConfidence;
    sumQ += r.qualityConfidence;
    sumC += r.confidence;
  }
  const meanEst = sumEst / n;
  return {
    trueTheta,
    n,
    meanEstimatedTheta: meanEst,
    bias: meanEst - trueTheta,
    rmse: Math.sqrt(sumSq / n),
    exactCefrRate: exact / n,
    within1CefrRate: within1 / n,
    coverage95: covered / n,
    meanCiWidth: sumWidth / n,
    meanMeasurementConfidence: sumM / n,
    meanQualityConfidence: sumQ / n,
    meanConfidence: sumC / n,
  };
}

export type OrchestratorMonteCarloReport = {
  adaptive: ModeCompareCell[];
  fixed: ModeCompareCell[];
  note: string;
};

/**
 * Model-recovery comparison: fixed ladder vs adaptive orchestrator.
 * Synthetic IRT only — not Tearz real-world accuracy.
 */
export function runOrchestratorMonteCarlo(options: {
  trueThetas?: readonly number[];
  nSessionsPerTheta?: number;
  seed?: number;
  assessmentConfig?: AssessmentConfig;
  orchestratorConfig?: OrchestratorConfig;
  calibrationStatus?: CalibrationStatus;
} = {}): OrchestratorMonteCarloReport {
  const trueThetas =
    options.trueThetas ??
    ([-2.75, -2.25, -1.75, -1.25, -0.75, -0.25, 0.25, 0.75, 1.25, 1.75, 2.25, 2.75] as const);
  const nSessions = options.nSessionsPerTheta ?? 1000;
  const seed = options.seed ?? 101;
  const assessmentConfig = options.assessmentConfig ?? DEFAULT_ASSESSMENT_CONFIG;
  const orchestratorConfig = options.orchestratorConfig ?? {
    ...DEFAULT_ORCHESTRATOR_CONFIG,
    maxExperimentalItems: 0,
  };
  const cal = options.calibrationStatus ?? 'calibrated';

  const bank = buildOrchestratorBank({
    perLevelPerSkill: 4,
    calibrationStatus: cal,
    includeExperimental: 0,
    assessmentConfig,
  });
  const fixedItems = buildFixedLadderItems(assessmentConfig, cal);

  const adaptiveCells: ModeCompareCell[] = [];
  const fixedCells: ModeCompareCell[] = [];

  for (let ti = 0; ti < trueThetas.length; ti += 1) {
    const trueTheta = trueThetas[ti];
    const adaptiveResults: AssessmentResult[] = [];
    const fixedResults: AssessmentResult[] = [];

    for (let s = 0; s < nSessions; s += 1) {
      const rngA = mulberry32(seed + ti * 100_003 + s * 19);
      const rngF = mulberry32(seed + 7_777 + ti * 100_003 + s * 19);
      adaptiveResults.push(
        runAdaptiveSession(trueTheta, bank, rngA, orchestratorConfig, assessmentConfig).result,
      );
      fixedResults.push(runFixedSession(trueTheta, fixedItems, rngF, assessmentConfig).result);
    }

    adaptiveCells.push(accumulateCell(trueTheta, adaptiveResults));
    fixedCells.push(accumulateCell(trueTheta, fixedResults));
  }

  return {
    adaptive: adaptiveCells,
    fixed: fixedCells,
    note: 'Synthetic model-recovery only — not Tearz production accuracy',
  };
}
