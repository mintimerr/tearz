import {
  createItemFromSpec,
  type AssessmentResult,
  type AssessmentState,
  type CefrLevel,
  type ItemMeta,
  type ScoringResponse,
  applyAnswer,
  createAssessmentState,
  finalize,
} from '../src/index.js';

export function itemAt(
  level: CefrLevel,
  within: number,
  id: string,
  opts?: Partial<{ skill: ItemMeta['skill']; isScored: boolean }>,
): ItemMeta {
  return createItemFromSpec({
    id,
    language: 'english',
    skill: opts?.skill ?? 'grammar',
    construct: `probe-${level}`,
    itemType: 'grammarForm',
    responseFormat: 'singleChoice',
    optionCount: 4,
    targetLevel: level,
    difficultyWithinLevel: within,
    isScored: opts?.isScored !== false,
    calibrationStatus: 'provisional',
    source: 'manual',
  });
}

export function correct(): ScoringResponse {
  return { correct: true, timedOut: false };
}

export function wrong(): ScoringResponse {
  return { correct: false, timedOut: false };
}

export function timeout(): ScoringResponse {
  return { correct: false, timedOut: true };
}

export type Step = { item: ItemMeta; response: ScoringResponse };

/** Build a 15-item path with given per-level outcomes. */
export function pathFromPlan(
  plan: { level: CefrLevel; within: number; ok: boolean }[],
): Step[] {
  return plan.map((p, i) => ({
    item: itemAt(p.level, p.within, `q-${i}-${p.level}`),
    response: p.ok ? correct() : wrong(),
  }));
}

export function runSteps(steps: Step[]): { state: AssessmentState; result: AssessmentResult } {
  let state = createAssessmentState();
  for (const s of steps) {
    state = applyAnswer(state, s.item, s.response).state;
  }
  return { state, result: finalize(state) };
}

export function fmtProbs(result: AssessmentResult): string {
  const p = result.levelProbabilities;
  return (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const)
    .map((L) => `${L}=${p[L].toFixed(3)}`)
    .join(' ');
}

export function snapshot(result: AssessmentResult) {
  return {
    theta: Number(result.theta.toFixed(4)),
    ci: {
      lower: Number(result.thetaCredibleInterval.lower.toFixed(4)),
      upper: Number(result.thetaCredibleInterval.upper.toFixed(4)),
    },
    levelProbabilities: Object.fromEntries(
      (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map((L) => [
        L,
        Number(result.levelProbabilities[L].toFixed(4)),
      ]),
    ),
    statisticalEstimate: result.statisticalEstimate,
    verifiedPlacementLevel: result.verifiedPlacementLevel,
    measurementConfidence: Number(result.measurementConfidence.toFixed(4)),
    qualityConfidence: Number(result.qualityConfidence.toFixed(4)),
    confidence: Number(result.confidence.toFixed(4)),
    confidenceLabel: result.confidenceLabel,
    verification: result.verification,
  };
}
