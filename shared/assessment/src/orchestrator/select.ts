import type { AssessmentConfig } from '../config.js';
import { DEFAULT_ASSESSMENT_CONFIG, reliabilityForItem } from '../config.js';
import { resolveIrtParams } from '../irt.js';
import { statisticalEstimateFromProbs } from '../scale.js';
import { verifyPlacementLevel } from '../verification.js';
import type { AssessmentSkill, CefrLevel, ItemMeta } from '../types.js';
import { cefrRank } from '../scale.js';
import {
  DEFAULT_ORCHESTRATOR_CONFIG,
  phaseForQuestion,
  type OrchestratorConfig,
  type TestPhase,
} from './config.js';
import { findMostUncertainCefrBoundary, levelsForBoundary } from './boundary.js';
import {
  computeCoverageSnapshot,
  consecutiveConstructRun,
  consecutiveSkillRun,
} from './coverage.js';
import { expectedInformationGain, fisherAtEap } from './eig.js';
import {
  computeRoutingEnvelope,
  levelAllowed,
  relaxEnvelope,
  type RoutingEnvelope,
} from './routing-envelope.js';
import type {
  AdaptiveTestState,
  OrchestratorCandidate,
  ScoreComponents,
  SelectNextResult,
  SelectionDecision,
} from './types.js';

function isExperimental(item: ItemMeta): boolean {
  return item.calibrationStatus === 'experimental' || item.isScored === false;
}

function softHardFilter(
  orch: AdaptiveTestState,
  cand: OrchestratorCandidate,
  phase: TestPhase,
  questionNumber: number,
  config: OrchestratorConfig,
  coverage: ReturnType<typeof computeCoverageSnapshot>,
): string[] {
  const reasons: string[] = [];
  const item = cand.item;

  if (!cand.eligible || cand.qualityGate !== 'PASS') {
    reasons.push('NOT_ELIGIBLE_OR_QUALITY');
  }
  if (item.status === 'retired' || item.status === 'draft') {
    reasons.push('BAD_STATUS');
  }
  if (orch.presentedItems.some((p) => p.item.id === item.id)) {
    reasons.push('ALREADY_PRESENTED');
  }

  const experimental = isExperimental(item);
  if (questionNumber === 1) {
    if (experimental) reasons.push('NO_EXPERIMENTAL_Q1');
    if (!item.isScored) reasons.push('Q1_MUST_SCORE');
    if (config.firstItem.forbidReading && item.skill === 'reading') {
      reasons.push('NO_READING_Q1');
    }
    if (config.firstItem.forbidLevels.includes(item.targetLevel)) {
      reasons.push('Q1_LEVEL_FORBIDDEN');
    }
  }

  if (experimental) {
    if (orch.experimentalItemIds.length >= config.maxExperimentalItems) {
      reasons.push('MAX_EXPERIMENTAL');
    }
    if (phase === 'final') reasons.push('NO_EXPERIMENTAL_FINAL');
    // Don't burn remaining slots needed for coverage
    const totalDeficit = Object.values(coverage.deficits).reduce((a, b) => a + (b ?? 0), 0);
    if (totalDeficit > 0 && coverage.scoredRemaining <= totalDeficit) {
      reasons.push('COVERAGE_BLOCKS_EXPERIMENTAL');
    }
    if (
      coverage.scoredRemaining <= 2 &&
      orch.presentedItems.length >= config.phaseEnds.boundary
    ) {
      reasons.push('VERIFICATION_BLOCKS_EXPERIMENTAL');
    }
  }

  // Soft diversity → not hard fail (handled in score), except extreme construct spam when alternatives exist
  return reasons;
}

function firstItemPreferenceScore(item: ItemMeta, config: OrchestratorConfig): number {
  let s = 0;
  if (item.targetLevel === config.firstItem.targetLevel) s += 1.2;
  const within = item.difficultyWithinLevel;
  if (
    within >= config.firstItem.difficultyWithinLevelMin &&
    within <= config.firstItem.difficultyWithinLevelMax
  ) {
    s += 0.8;
  }
  if (config.firstItem.preferredSkills.includes(item.skill)) s += 0.5;
  if (item.calibrationStatus === 'anchor') s += 0.6;
  else if (item.calibrationStatus === 'calibrated') s += 0.4;
  return s;
}

function phaseTargetScore(
  item: ItemMeta,
  phase: TestPhase,
  orch: AdaptiveTestState,
  boundaryLevels: CefrLevel[],
): number {
  const est = statisticalEstimateFromProbs(orch.assessmentState.levelProbabilities);
  if (phase === 'routing') {
    // Prefer items away from prior mean difficulty cluster — exploration via |b - theta|
    const paramsB = item.predictedDifficulty;
    return Math.min(1.5, Math.abs(paramsB - orch.assessmentState.theta) * 0.35);
  }
  if (phase === 'localization') {
    return Math.max(0, 1.2 - Math.abs(item.predictedDifficulty - orch.assessmentState.theta));
  }
  if (phase === 'boundary') {
    return boundaryLevels.includes(item.targetLevel) ? 1.3 : 0.1;
  }
  // final — decision value around active boundary / verification
  if (boundaryLevels.includes(item.targetLevel)) return 1.1;
  if (item.targetLevel === est) return 0.7;
  return 0.2;
}

function verificationPriority(
  item: ItemMeta,
  orch: AdaptiveTestState,
  assessmentConfig: AssessmentConfig,
): number {
  const probs = orch.assessmentState.levelProbabilities;
  const statistical = statisticalEstimateFromProbs(probs);
  const { verified, verification } = verifyPlacementLevel(
    statistical,
    orch.assessmentState.answerHistory,
    assessmentConfig,
  );

  let score = 0;
  if (verification.applied && cefrRank(statistical) > cefrRank(verified)) {
    // Need high-level supporting evidence
    if (statistical === 'C2' && item.predictedDifficulty >= 2.0 && item.isScored) score += 1.6;
    else if (statistical === 'C1' && item.predictedDifficulty >= 1.0 && item.isScored) score += 1.4;
    else if (statistical === 'B2' && item.predictedDifficulty >= 0.0 && item.isScored) score += 1.1;
    else if (statistical === 'B1' && item.predictedDifficulty >= -1.0 && item.isScored) score += 1.0;
  }

  // Low-end: prefer easy evidence when theta very low
  if (
    orch.assessmentState.theta < -1.8 &&
    (item.targetLevel === 'A1' || item.targetLevel === 'A2')
  ) {
    score += 0.6;
  }

  return score;
}

function diversityScore(
  item: ItemMeta,
  orch: AdaptiveTestState,
  config: OrchestratorConfig,
): { score: number; codes: string[] } {
  const codes: string[] = [];
  let score = 0.5;
  const skillRun = consecutiveSkillRun(orch, item.skill);
  if (skillRun >= config.maxSameSkillConsecutive) {
    score -= 1.2;
    codes.push('SKILL_STREAK');
  }
  const constructTotal = orch.constructCounts[item.construct] ?? 0;
  if (constructTotal >= config.maxSameConstructTotal) {
    score -= 1.4;
    codes.push('CONSTRUCT_CAP');
  }
  const constructRun = consecutiveConstructRun(orch, item.construct);
  if (constructRun >= config.maxSameConstructConsecutive) {
    score -= 0.9;
    codes.push('CONSTRUCT_STREAK');
  }
  if (constructTotal === 0) score += 0.35;
  return { score, codes };
}

export type RankedCandidate = {
  candidate: OrchestratorCandidate;
  totalScore: number;
  components: ScoreComponents;
  reasonCodes: string[];
  eig: number;
  fisher: number;
};

/**
 * Rank eligible candidates for the next question.
 * Deterministic given identical state + candidate list order (stable sort by score then id).
 */
export function rankCandidates(
  orch: AdaptiveTestState,
  candidates: OrchestratorCandidate[],
  orchestratorConfig: OrchestratorConfig = DEFAULT_ORCHESTRATOR_CONFIG,
  assessmentConfig: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): { ranked: RankedCandidate[]; rejected: Array<{ id: string; reasons: string[] }> } {
  const questionNumber = orch.presentedItems.length + 1;
  const phase = phaseForQuestion(questionNumber, orchestratorConfig);
  const coverage = computeCoverageSnapshot(orch, orchestratorConfig);
  const boundary =
    orch.activeBoundary ??
    findMostUncertainCefrBoundary(
      orch.assessmentState.thetaGrid,
      orch.assessmentState.posterior,
    );
  const boundaryLevels = levelsForBoundary(boundary);
  const W = orchestratorConfig.weights;

  const rejected: Array<{ id: string; reasons: string[] }> = [];
  const passable: OrchestratorCandidate[] = [];

  for (const c of candidates) {
    const hard = softHardFilter(orch, c, phase, questionNumber, orchestratorConfig, coverage);
    if (hard.length) {
      rejected.push({ id: c.item.id, reasons: hard });
      continue;
    }
    passable.push(c);
  }

  // Q1: if a valid B1 central-anchor candidate exists, do not start on other levels.
  if (questionNumber === 1) {
    const q1Anchors = passable.filter((c) => {
      const within = c.item.difficultyWithinLevel;
      return (
        c.item.targetLevel === orchestratorConfig.firstItem.targetLevel &&
        within >= orchestratorConfig.firstItem.difficultyWithinLevelMin &&
        within <= orchestratorConfig.firstItem.difficultyWithinLevelMax &&
        orchestratorConfig.firstItem.preferredSkills.includes(c.item.skill)
      );
    });
    if (q1Anchors.length > 0) {
      const allowed = new Set(q1Anchors.map((c) => c.item.id));
      const filtered: OrchestratorCandidate[] = [];
      for (const c of passable) {
        if (allowed.has(c.item.id)) filtered.push(c);
        else rejected.push({ id: c.item.id, reasons: ['Q1_PREFER_CENTRAL_B1'] });
      }
      passable.length = 0;
      passable.push(...filtered);
    }
  }

  // Early routing envelope (Q2–Q3): prevent pathological CEFR jumps; relax if bank thin.
  {
    let envelope: RoutingEnvelope | null = computeRoutingEnvelope(
      orch,
      questionNumber,
      orchestratorConfig,
    );
    if (envelope && passable.length > 0) {
      const preEnvelope = [...passable];
      const filterByEnvelope = (env: RoutingEnvelope, pool: OrchestratorCandidate[]) => {
        const kept: OrchestratorCandidate[] = [];
        const dropped: OrchestratorCandidate[] = [];
        for (const c of pool) {
          if (levelAllowed(c.item.targetLevel, env)) kept.push(c);
          else dropped.push(c);
        }
        return { kept, dropped };
      };

      let { kept, dropped } = filterByEnvelope(envelope, preEnvelope);
      while (kept.length === 0 && envelope.relaxSteps < 2) {
        envelope = relaxEnvelope(envelope);
        ({ kept, dropped } = filterByEnvelope(envelope, preEnvelope));
      }

      if (kept.length > 0) {
        passable.length = 0;
        passable.push(...kept);
        for (const c of dropped) {
          rejected.push({ id: c.item.id, reasons: [`ROUTING_ENVELOPE:${envelope.reason}`] });
        }
      }
      // else: bank empty even after relax — keep pre-envelope passable (no hard fail)
    }
  }

  // Prefetch fisher for top-K EIG
  const pre = passable.map((c) => ({
    c,
    fisher: fisherAtEap(orch.assessmentState, c.item, assessmentConfig),
    rel: reliabilityForItem(c.item.calibrationStatus, assessmentConfig),
  }));
  pre.sort((a, b) => b.fisher * (0.5 + b.rel) - a.fisher * (0.5 + a.rel));
  const eigSet = new Set(pre.slice(0, orchestratorConfig.eigTopK).map((x) => x.c.item.id));

  const ranked: RankedCandidate[] = [];

  for (const { c, fisher, rel } of pre) {
    const item = c.item;
    const codes: string[] = [];
    const eig = eigSet.has(item.id)
      ? expectedInformationGain(orch.assessmentState, item, assessmentConfig, {
          gridStride: orchestratorConfig.eigGridStride,
          weight: c.evidenceWeight > 0 ? c.evidenceWeight : rel,
        })
      : fisher * 0.15; // cheap proxy outside top-K

    const covPri = coverage.skillPriority[item.skill] ?? 0;
    const div = diversityScore(item, orch, orchestratorConfig);
    codes.push(...div.codes);

    const calBonus = orchestratorConfig.calibrationBonusByStatus[item.calibrationStatus] ?? 0;
    const ver = verificationPriority(item, orch, assessmentConfig);
    const exposure = orch.presentedItems.some((p) => p.item.id === item.id) ? -10 : 0;

    let routingExploration = 0;
    if (phase === 'routing') {
      routingExploration = Math.abs(item.predictedDifficulty - orch.assessmentState.theta) * 0.4;
    }

    let phaseTarget = phaseTargetScore(item, phase, orch, boundaryLevels);
    if (questionNumber === 1) {
      phaseTarget += firstItemPreferenceScore(item, orchestratorConfig);
    }

    // Hard coverage: if deficit exists and scoredRemaining tight, heavily prefer deficit skills
    let coveragePriority = covPri;
    if ((coverage.deficits[item.skill] ?? 0) > 0 && item.isScored && !isExperimental(item)) {
      coveragePriority += 0.5;
    }
    // Penalize non-deficit skills when a deficit skill is urgent
    const maxDeficitPri = Math.max(0, ...Object.values(coverage.skillPriority));
    if (
      maxDeficitPri >= 1 &&
      (coverage.deficits[item.skill] ?? 0) === 0 &&
      item.isScored
    ) {
      coveragePriority -= 0.75;
      codes.push('NON_DEFICIT_SKILL');
    }

    if (isExperimental(item)) {
      codes.push('EXPERIMENTAL');
    }

    const components: ScoreComponents = {
      expectedInformationGain: eig,
      fisherInformation: fisher,
      reliability: rel,
      coveragePriority,
      constructDiversity: div.score,
      calibrationBonus: calBonus,
      verificationPriority: ver,
      exposurePenalty: exposure,
      routingExploration,
      phaseTarget,
    };

    const totalScore =
      W.expectedInformationGain * components.expectedInformationGain +
      W.fisherInformation * components.fisherInformation +
      W.reliability * components.reliability +
      W.coveragePriority * components.coveragePriority +
      W.constructDiversity * components.constructDiversity +
      W.calibrationBonus * components.calibrationBonus +
      W.verificationPriority * components.verificationPriority +
      W.exposurePenalty * components.exposurePenalty +
      W.routingExploration * components.routingExploration +
      W.phaseTarget * components.phaseTarget;

    ranked.push({
      candidate: c,
      totalScore,
      components,
      reasonCodes: codes,
      eig,
      fisher,
    });
  }

  ranked.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return a.candidate.item.id.localeCompare(b.candidate.item.id);
  });

  // If coverage minima unmet and bank has deficit skill items, prefer forcing them among top
  if (!coverage.allMinimaMet) {
    const urgent = (Object.entries(coverage.deficits) as Array<[AssessmentSkill, number]>)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1]);
    for (const [skill] of urgent) {
      const idx = ranked.findIndex(
        (r) =>
          r.candidate.item.skill === skill &&
          r.candidate.item.isScored &&
          !isExperimental(r.candidate.item),
      );
      if (idx > 0 && coverage.scoredRemaining <= (coverage.deficits[skill] ?? 0) + 2) {
        const [hit] = ranked.splice(idx, 1);
        ranked.unshift(hit);
        break;
      }
    }
  }

  return { ranked, rejected };
}

export function selectNextItem(
  orch: AdaptiveTestState,
  candidates: OrchestratorCandidate[],
  orchestratorConfig: OrchestratorConfig = DEFAULT_ORCHESTRATOR_CONFIG,
  assessmentConfig: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG,
): SelectNextResult | null {
  const questionNumber = orch.presentedItems.length + 1;
  if (questionNumber > orchestratorConfig.totalPresentedItems) return null;

  const phase = phaseForQuestion(questionNumber, orchestratorConfig);
  const { ranked, rejected } = rankCandidates(
    orch,
    candidates,
    orchestratorConfig,
    assessmentConfig,
  );
  if (ranked.length === 0) return null;

  // Relax diversity: if top is heavily penalized and alternatives exist, already sorted.
  // Fallback: if no scoring item but experimental allowed — ranked may include experimental.
  const best = ranked[0];
  const boundary =
    orch.activeBoundary ??
    findMostUncertainCefrBoundary(
      orch.assessmentState.thetaGrid,
      orch.assessmentState.posterior,
    );
  const probs = orch.assessmentState.levelProbabilities;

  const decision: SelectionDecision = {
    questionNumber,
    phase,
    candidateCount: candidates.length,
    selectedItemId: best.candidate.item.id,
    selectedSkill: best.candidate.item.skill,
    selectedConstruct: best.candidate.item.construct,
    selectedDifficulty: resolveIrtParams(best.candidate.item, assessmentConfig).b,
    selectedTargetLevel: best.candidate.item.targetLevel,
    selectedCalibration: best.candidate.item.calibrationStatus,
    isExperimental: isExperimental(best.candidate.item),
    activeBoundary: boundary,
    posteriorBefore: {
      theta: orch.assessmentState.theta,
      levelProbabilities: { ...probs },
      statisticalEstimate: statisticalEstimateFromProbs(probs),
    },
    selectionScore: best.totalScore,
    scoreComponents: best.components,
    topAlternatives: ranked.slice(1, 6).map((r) => ({
      itemId: r.candidate.item.id,
      score: r.totalScore,
      reasonCodes: r.reasonCodes,
    })),
    rejectedReasonCodes: rejected.slice(0, 12).flatMap((r) =>
      r.reasons.map((code) => `${r.id}:${code}`),
    ),
  };

  return { decision, candidate: best.candidate };
}
