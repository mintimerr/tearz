/**
 * Diagnostic audit for Assessment Engine (no placement wiring).
 *
 * Run: npx tsx scripts/audit-diagnostic.ts
 *
 * Outputs JSON summary for the audit report (model-recovery only).
 */

import {
  DEFAULT_ASSESSMENT_CONFIG,
  type AssessmentConfig,
  pureBayesConfig,
} from '../src/config.js';
import { applyAnswer, createAssessmentState } from '../src/engine.js';
import { createItemFromSpec } from '../src/item-factory.js';
import { probabilityCorrect } from '../src/irt.js';
import { buildThetaGrid } from '../src/prior.js';
import { predictedDifficultyFromSpec } from '../src/scale.js';
import {
  auditDeterministicProfile,
  robustnessConfigs,
  runMonteCarlo,
  runStrongUserA2Miss,
  type MonteCarloReport,
  type ProfileAudit,
} from '../src/simulation.js';
import type { CefrLevel } from '../src/types.js';

const LEVEL_ANCHORS = DEFAULT_ASSESSMENT_CONFIG.levelAnchors;

type PlanStep = { level: CefrLevel; within: number; ok: boolean };

const PROFILE_PLANS: Record<
  string,
  { intended: CefrLevel; trueTheta: number; plan: PlanStep[] }
> = {
  P2: {
    intended: 'A2',
    trueTheta: LEVEL_ANCHORS.A2, // -1.5
    plan: [
      { level: 'A1', within: 0.4, ok: true },
      { level: 'A1', within: 0.7, ok: true },
      { level: 'A2', within: 0.3, ok: true },
      { level: 'A2', within: 0.6, ok: true },
      { level: 'A2', within: 0.8, ok: true },
      { level: 'B1', within: 0.3, ok: false },
      { level: 'B1', within: 0.5, ok: false },
      { level: 'A2', within: 0.5, ok: true },
      { level: 'B1', within: 0.4, ok: false },
      { level: 'A2', within: 0.7, ok: true },
      { level: 'B1', within: 0.6, ok: false },
      { level: 'A2', within: 0.4, ok: true },
      { level: 'B1', within: 0.5, ok: false },
      { level: 'A2', within: 0.6, ok: true },
      { level: 'B1', within: 0.7, ok: false },
    ],
  },
  P3: {
    intended: 'B1',
    trueTheta: LEVEL_ANCHORS.B1, // -0.5
    plan: [
      { level: 'A2', within: 0.5, ok: true },
      { level: 'B1', within: 0.3, ok: true },
      { level: 'B1', within: 0.5, ok: true },
      { level: 'B1', within: 0.7, ok: true },
      { level: 'B2', within: 0.3, ok: false },
      { level: 'B1', within: 0.6, ok: true },
      { level: 'B2', within: 0.4, ok: false },
      { level: 'B1', within: 0.4, ok: true },
      { level: 'B2', within: 0.5, ok: false },
      { level: 'B1', within: 0.8, ok: true },
      { level: 'B2', within: 0.6, ok: false },
      { level: 'A2', within: 0.7, ok: true },
      { level: 'B1', within: 0.5, ok: true },
      { level: 'B2', within: 0.7, ok: false },
      { level: 'B1', within: 0.3, ok: true },
    ],
  },
  P4: {
    intended: 'B2',
    trueTheta: LEVEL_ANCHORS.B2, // 0.5
    plan: [
      { level: 'B1', within: 0.5, ok: true },
      { level: 'B2', within: 0.3, ok: true },
      { level: 'B2', within: 0.5, ok: true },
      { level: 'B2', within: 0.7, ok: true },
      { level: 'C1', within: 0.3, ok: false },
      { level: 'B2', within: 0.6, ok: true },
      { level: 'C1', within: 0.4, ok: false },
      { level: 'B2', within: 0.4, ok: true },
      { level: 'C1', within: 0.5, ok: false },
      { level: 'B1', within: 0.8, ok: true },
      { level: 'B2', within: 0.8, ok: true },
      { level: 'C1', within: 0.6, ok: false },
      { level: 'B2', within: 0.5, ok: true },
      { level: 'C1', within: 0.7, ok: false },
      { level: 'B2', within: 0.3, ok: true },
    ],
  },
  P5: {
    intended: 'C1',
    trueTheta: LEVEL_ANCHORS.C1, // 1.5
    plan: [
      { level: 'B1', within: 0.5, ok: true },
      { level: 'B2', within: 0.4, ok: true },
      { level: 'B2', within: 0.7, ok: true },
      { level: 'C1', within: 0.3, ok: true },
      { level: 'C1', within: 0.5, ok: true },
      { level: 'C1', within: 0.7, ok: true },
      { level: 'C2', within: 0.3, ok: false },
      { level: 'C1', within: 0.6, ok: true },
      { level: 'B2', within: 0.5, ok: true },
      { level: 'C1', within: 0.4, ok: true },
      { level: 'C2', within: 0.4, ok: false },
      { level: 'C1', within: 0.8, ok: true },
      { level: 'B2', within: 0.8, ok: true },
      { level: 'C1', within: 0.5, ok: true },
      { level: 'C2', within: 0.5, ok: false },
    ],
  },
};

function fmtProbs(p: Record<string, number>): string {
  return (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const)
    .map((L) => `${L}:${(p[L] ?? 0).toFixed(3)}`)
    .join(' ');
}

function printProfileAudit(audit: ProfileAudit) {
  console.log(`\n======== ${audit.profileId} intended=${audit.intendedCefr} trueTheta=${audit.trueTheta} config=${audit.configId} ========`);
  for (const s of audit.steps) {
    console.log(
      `#${s.step} ${s.targetLevel}(w=${s.within}) a=${s.a.toFixed(2)} b=${s.b.toFixed(3)} c=${s.c.toFixed(2)} ` +
        `P(correct|θ*)=${s.pCorrectAtTrueTheta.toFixed(3)} resp=${s.syntheticCorrect ? '✓' : '✗'} ` +
        `consistent=${s.responseConsistentWithTrueTheta} → θ=${s.thetaAfter.toFixed(3)} ` +
        `stat=${s.statisticalEstimate} IG=${s.posteriorInformationGain.toFixed(4)}`,
    );
    console.log(`    probs ${fmtProbs(s.levelProbabilities)}`);
  }
  console.log(
    `FINAL θ=${audit.final.theta.toFixed(3)} statistical=${audit.final.statisticalEstimate} ` +
      `verified=${audit.final.verifiedPlacementLevel} conf=${audit.final.confidence.toFixed(3)}`,
  );
  console.log(
    `IRT-sampled replay (same items, θ*=${audit.trueTheta}): θ=${audit.irtSampledReplay.theta.toFixed(3)} ` +
      `stat=${audit.irtSampledReplay.statisticalEstimate} ver=${audit.irtSampledReplay.verifiedPlacementLevel}`,
  );
}

function inconsistencySummary(audit: ProfileAudit) {
  const inconsistent = audit.steps.filter((s) => !s.responseConsistentWithTrueTheta);
  const avgPWhenInconsistent =
    inconsistent.length === 0
      ? null
      : inconsistent.reduce((a, s) => a + (s.syntheticCorrect ? s.pCorrectAtTrueTheta : 1 - s.pCorrectAtTrueTheta), 0) /
        inconsistent.length;
  return {
    profileId: audit.profileId,
    intended: audit.intendedCefr,
    trueTheta: audit.trueTheta,
    nInconsistentWithTrueTheta: inconsistent.length,
    nSteps: audit.steps.length,
    avgLikelihoodOfInconsistentResponses: avgPWhenInconsistent,
    finalTheta: audit.final.theta,
    statisticalEstimate: audit.final.statisticalEstimate,
    verified: audit.final.verifiedPlacementLevel,
    biasVsTrueTheta: audit.final.theta - audit.trueTheta,
    irtSampledStatistical: audit.irtSampledReplay.statisticalEstimate,
    irtSampledTheta: audit.irtSampledReplay.theta,
  };
}

/** Sensitivity: shift band edges, b, a, c, prior; re-run P2–P5 under pure Bayes. */
function sensitivityOnProfiles() {
  const base = pureBayesConfig();
  const variants: { name: string; config: AssessmentConfig }[] = [
    { name: 'baseline_pure', config: base },
    {
      name: 'bands_shift_-0.25',
      config: {
        ...base,
        configId: 'sens-bands-m025',
        cefrBands: base.cefrBands.map((b) => ({
          ...b,
          lower: b.lower - 0.25,
          upper: b.upper - 0.25,
        })),
      },
    },
    {
      name: 'bands_shift_+0.25',
      config: {
        ...base,
        configId: 'sens-bands-p025',
        cefrBands: base.cefrBands.map((b) => ({
          ...b,
          lower: b.lower + 0.25,
          upper: b.upper + 0.25,
        })),
      },
    },
    {
      name: 'b_shift_+0.3',
      config: {
        ...base,
        configId: 'sens-b-p03',
        levelAnchors: Object.fromEntries(
          Object.entries(base.levelAnchors).map(([k, v]) => [k, v + 0.3]),
        ) as AssessmentConfig['levelAnchors'],
      },
    },
    {
      name: 'b_shift_-0.3',
      config: {
        ...base,
        configId: 'sens-b-m03',
        levelAnchors: Object.fromEntries(
          Object.entries(base.levelAnchors).map(([k, v]) => [k, v - 0.3]),
        ) as AssessmentConfig['levelAnchors'],
      },
    },
    {
      name: 'a=0.8',
      config: { ...base, configId: 'sens-a08', defaultDiscrimination: 0.8 },
    },
    {
      name: 'a=1.6',
      config: { ...base, configId: 'sens-a16', defaultDiscrimination: 1.6 },
    },
    {
      name: 'c=0.10',
      config: {
        ...base,
        configId: 'sens-c10',
        guessingDefaults: {
          ...base.guessingDefaults,
          singleChoiceByOptions: { ...base.guessingDefaults.singleChoiceByOptions, 4: 0.1 },
        },
      },
    },
    {
      name: 'c=0.33',
      config: {
        ...base,
        configId: 'sens-c33',
        guessingDefaults: {
          ...base.guessingDefaults,
          singleChoiceByOptions: { ...base.guessingDefaults.singleChoiceByOptions, 4: 1 / 3 },
        },
      },
    },
    {
      name: 'prior_sigma_1.0',
      config: { ...base, configId: 'sens-prior10', priorSigma: 1.0 },
    },
    {
      name: 'prior_sigma_2.0',
      config: { ...base, configId: 'sens-prior20', priorSigma: 2.0 },
    },
    {
      name: 'prior_flat',
      config: { ...base, configId: 'sens-prior-flat', priorSigma: 50 },
    },
  ];

  const rows: Record<string, unknown>[] = [];
  for (const v of variants) {
    for (const [pid, def] of Object.entries(PROFILE_PLANS)) {
      const audit = auditDeterministicProfile(pid, def.intended, def.trueTheta, def.plan, v.config);
      rows.push({
        variant: v.name,
        profile: pid,
        trueTheta: def.trueTheta,
        theta: Number(audit.final.theta.toFixed(3)),
        statistical: audit.final.statisticalEstimate,
        verified: audit.final.verifiedPlacementLevel,
        bias: Number((audit.final.theta - def.trueTheta).toFixed(3)),
      });
    }
  }
  return rows;
}

function printMonteCarloTable(report: MonteCarloReport, title: string) {
  console.log(`\n=== MONTE CARLO: ${title} (${report.mode}, n=${report.nSessionsPerTheta}, items=${report.nItems}) ===`);
  console.log(
    'trueθ\ttrueCEFR\tmeanEst\tbias\tRMSE\tmeanSD\tcov95\texact\t±1\tmeanConf\ttopStat',
  );
  for (const c of report.cells) {
    const topStat = Object.entries(c.statisticalDistribution).sort((a, b) => b[1] - a[1])[0];
    console.log(
      `${c.trueTheta.toFixed(2)}\t${c.trueCefr}\t${c.meanEstimatedTheta.toFixed(3)}\t${c.bias.toFixed(3)}\t` +
        `${c.rmse.toFixed(3)}\t${c.meanPosteriorSd.toFixed(3)}\t${c.coverage95.toFixed(3)}\t` +
        `${c.exactCefrRate.toFixed(3)}\t${c.within1CefrRate.toFixed(3)}\t${c.meanConfidence.toFixed(3)}\t` +
        `${topStat[0]}:${(topStat[1] * 100).toFixed(0)}%`,
    );
  }
}

function printConfusion(
  title: string,
  matrix: Record<CefrLevel, Record<CefrLevel, number>>,
) {
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
  console.log(`\n=== CONFUSION ${title} (rows=true, cols=pred) ===`);
  console.log(['true\\pred', ...levels].join('\t'));
  for (const t of levels) {
    console.log([t, ...levels.map((p) => String(matrix[t][p]))].join('\t'));
  }
}

function priorSensitivityMc(nSessions = 400) {
  const sigmas = [
    { name: 'N(0,1.0²)', priorSigma: 1.0 },
    { name: 'N(0,1.5²)', priorSigma: 1.5 },
    { name: 'N(0,2.0²)', priorSigma: 2.0 },
    { name: 'flat≈σ50', priorSigma: 50 },
  ];
  const out: unknown[] = [];
  for (const s of sigmas) {
    const config: AssessmentConfig = {
      ...pureBayesConfig(),
      configId: `prior-${s.name}`,
      priorSigma: s.priorSigma,
    };
    const report = runMonteCarlo({
      config,
      nSessionsPerTheta: nSessions,
      mode: 'fixed',
      seed: 77,
    });
    out.push({
      prior: s.name,
      meanAbsBias: mean(report.cells.map((c) => Math.abs(c.bias))),
      meanRmse: mean(report.cells.map((c) => c.rmse)),
      meanExact: mean(report.cells.map((c) => c.exactCefrRate)),
      meanCoverage: mean(report.cells.map((c) => c.coverage95)),
      cells: report.cells.map((c) => ({
        trueTheta: c.trueTheta,
        bias: Number(c.bias.toFixed(3)),
        rmse: Number(c.rmse.toFixed(3)),
        meanEst: Number(c.meanEstimatedTheta.toFixed(3)),
      })),
    });
  }
  return out;
}

function gridSensitivityMc(nSessions = 400) {
  const grids = [
    { name: '±3.5', thetaMin: -3.5, thetaMax: 3.5 },
    { name: '±4.5', thetaMin: -4.5, thetaMax: 4.5 },
  ];
  const out: unknown[] = [];
  const edgeThetas = [-2.75, -2.25, 2.25, 2.75];
  for (const g of grids) {
    const config: AssessmentConfig = {
      ...pureBayesConfig(),
      configId: `grid-${g.name}`,
      thetaMin: g.thetaMin,
      thetaMax: g.thetaMax,
      cefrBands: [
        { level: 'A1', lower: g.thetaMin, upper: -2.0 },
        { level: 'A2', lower: -2.0, upper: -1.0 },
        { level: 'B1', lower: -1.0, upper: 0.0 },
        { level: 'B2', lower: 0.0, upper: 1.0 },
        { level: 'C1', lower: 1.0, upper: 2.0 },
        { level: 'C2', lower: 2.0, upper: g.thetaMax },
      ],
    };
    const report = runMonteCarlo({
      config,
      trueThetas: edgeThetas,
      nSessionsPerTheta: nSessions,
      mode: 'fixed',
      seed: 88,
    });
    // Also check extreme deterministic P1/P6 style
    const grid = buildThetaGrid(config);
    out.push({
      grid: g.name,
      gridMin: grid[0],
      gridMax: grid[grid.length - 1],
      nGrid: grid.length,
      edgeCells: report.cells.map((c) => ({
        trueTheta: c.trueTheta,
        meanEst: Number(c.meanEstimatedTheta.toFixed(3)),
        bias: Number(c.bias.toFixed(3)),
        meanSd: Number(c.meanPosteriorSd.toFixed(3)),
        coverage95: Number(c.coverage95.toFixed(3)),
      })),
    });
  }
  return out;
}

function mean(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
}

function itemDistributionCheck() {
  // For each intended trueTheta, show mean b of items vs theta*, and expected score.
  const rows: unknown[] = [];
  for (const [pid, def] of Object.entries(PROFILE_PLANS)) {
    const bs = def.plan.map((p) => predictedDifficultyFromSpec(p.level, p.within));
    const meanB = mean(bs);
    let expectedCorrect = 0;
    let actualCorrect = 0;
    for (const p of def.plan) {
      const b = predictedDifficultyFromSpec(p.level, p.within);
      const a = DEFAULT_ASSESSMENT_CONFIG.defaultDiscrimination;
      const c = 0.25;
      expectedCorrect += probabilityCorrect(def.trueTheta, a, b, c);
      actualCorrect += p.ok ? 1 : 0;
    }
    rows.push({
      profile: pid,
      trueTheta: def.trueTheta,
      meanItemB: Number(meanB.toFixed(3)),
      meanBMinusTrueTheta: Number((meanB - def.trueTheta).toFixed(3)),
      expectedCorrectRate: Number((expectedCorrect / def.plan.length).toFixed(3)),
      actualCorrectRate: Number((actualCorrect / def.plan.length).toFixed(3)),
      scoreInflation: Number((actualCorrect / def.plan.length - expectedCorrect / def.plan.length).toFixed(3)),
    });
  }
  return rows;
}

async function main(): Promise<void> {
  console.log('TEARZ ASSESSMENT DIAGNOSTIC AUDIT');
  console.log('NOTE: model-recovery / synthetic only — not production Tearz accuracy.\n');

  // --- Problem 1: P2–P5 traces under pure Bayes (original observation regime) ---
  const pure = pureBayesConfig();
  const profileAudits: ProfileAudit[] = [];
  for (const [pid, def] of Object.entries(PROFILE_PLANS)) {
    const audit = auditDeterministicProfile(pid, def.intended, def.trueTheta, def.plan, pure);
    profileAudits.push(audit);
    printProfileAudit(audit);
  }

  console.log('\n=== P2–P5 INCONSISTENCY vs trueTheta (pure Bayes) ===');
  console.log(JSON.stringify(profileAudits.map(inconsistencySummary), null, 2));

  console.log('\n=== ITEM DISTRIBUTION vs trueTheta ===');
  console.log(JSON.stringify(itemDistributionCheck(), null, 2));

  console.log('\n=== SENSITIVITY (P2–P5 statistical under pure Bayes variants) ===');
  const sens = sensitivityOnProfiles();
  // Compact: only show when statistical != intended
  const sensCompact = sens.map((r) => {
    const row = r as {
      variant: string;
      profile: string;
      statistical: string;
      verified: string;
      theta: number;
      bias: number;
    };
    const intended = PROFILE_PLANS[row.profile].intended;
    return { ...row, intended, bandError: row.statistical !== intended };
  });
  console.log(JSON.stringify(sensCompact, null, 2));

  // --- Problem 2: robust models ---
  console.log('\n=== STRONG USER A2 MISS — MODEL COMPARISON ===');
  const models = robustnessConfigs(DEFAULT_ASSESSMENT_CONFIG);
  const missCompare: Record<string, unknown> = {};
  for (const [name, cfg] of Object.entries(models)) {
    // provisional AI item (default synthetic)
    missCompare[`${name}_provisional`] = runStrongUserA2Miss(cfg, 'provisional');
    // anchor item for contrast
    missCompare[`${name}_anchor`] = runStrongUserA2Miss(cfg, 'anchor');
  }
  console.log(JSON.stringify(missCompare, null, 2));

  // Negative IG demo
  {
    let state = createAssessmentState(pure);
    for (let i = 0; i < 8; i += 1) {
      const hi = createItemFromSpec({
        id: `neg-ig-${i}`,
        language: 'english',
        skill: 'grammar',
        construct: 'x',
        itemType: 'grammarForm',
        responseFormat: 'singleChoice',
        optionCount: 4,
        targetLevel: 'C2',
        difficultyWithinLevel: 0.4 + i * 0.05,
        calibrationStatus: 'anchor',
      });
      state = applyAnswer(state, hi, { correct: true }, pure).state;
    }
    const easy = createItemFromSpec({
      id: 'neg-ig-miss',
      language: 'english',
      skill: 'grammar',
      construct: 'x',
      itemType: 'grammarForm',
      responseFormat: 'singleChoice',
      optionCount: 4,
      targetLevel: 'A1',
      difficultyWithinLevel: 0.3,
      calibrationStatus: 'anchor',
    });
    const { record } = applyAnswer(state, easy, { correct: false }, pure);
    console.log('\n=== NEGATIVE IG DEMO (pure Bayes, surprising A1 miss after strong streak) ===');
    console.log(
      JSON.stringify({
        thetaBefore: record.thetaBefore,
        thetaAfter: record.thetaAfter,
        fisherInformation: record.fisherInformation,
        posteriorInformationGain: record.posteriorInformationGain,
        note: 'IG may be negative; Fisher remains a separate selector metric',
      }),
    );
  }

  // --- Monte Carlo (full 1000 — may take a bit) ---
  const N = Number(process.env.AUDIT_N ?? 1000);
  console.log(`\nRunning Monte Carlo with N=${N} per theta...`);

  const mcPureFixed = runMonteCarlo({
    config: pure,
    nSessionsPerTheta: N,
    mode: 'fixed',
    seed: 42,
    calibrationStatus: 'anchor', // isolate IRT recovery without provisional downweight
  });
  printMonteCarloTable(mcPureFixed, 'pure Bayes + fixed ladder (anchor items)');
  printConfusion('statistical (pure/fixed)', mcPureFixed.confusionStatistical);
  printConfusion('verified (pure/fixed)', mcPureFixed.confusionVerified);

  const mcPureAdapt = runMonteCarlo({
    config: pure,
    nSessionsPerTheta: Math.min(N, 1000),
    mode: 'adaptive',
    seed: 43,
    calibrationStatus: 'anchor',
  });
  printMonteCarloTable(mcPureAdapt, 'pure Bayes + adaptive selector (anchor items)');

  const mcRobustFixed = runMonteCarlo({
    config: DEFAULT_ASSESSMENT_CONFIG,
    nSessionsPerTheta: Math.min(N, 1000),
    mode: 'fixed',
    seed: 44,
    calibrationStatus: 'provisional',
  });
  printMonteCarloTable(mcRobustFixed, 'default robust (slip+rel) + fixed provisional');

  const priorSens = priorSensitivityMc(400);
  console.log('\n=== PRIOR SENSITIVITY (pure Bayes, fixed, N=400) ===');
  console.log(JSON.stringify(priorSens, null, 2));

  const gridSens = gridSensitivityMc(400);
  console.log('\n=== GRID SENSITIVITY (pure Bayes, edge thetas, N=400) ===');
  console.log(JSON.stringify(gridSens, null, 2));

  // Compact JSON artifact for the report
  const artifact = {
    note: 'Synthetic model-recovery audit only',
    problem1: {
      causeHint:
        'Deterministic pass-lower/fail-higher pins EAP near the upper band cut; prior + perfect within-band score inflate vs mid-band trueTheta',
      inconsistency: profileAudits.map(inconsistencySummary),
      itemDistribution: itemDistributionCheck(),
      sensitivity: sensCompact,
    },
    problem2: missCompare,
    monteCarlo: {
      pureFixed: summarizeMc(mcPureFixed),
      pureAdaptive: summarizeMc(mcPureAdapt),
      robustFixed: summarizeMc(mcRobustFixed),
    },
    priorSensitivity: priorSens,
    gridSensitivity: gridSens,
    recommendedModel: 'BC_combined',
    recommendedConfig: {
      slipEpsilon: DEFAULT_ASSESSMENT_CONFIG.robustness.slipEpsilon,
      slipNoiseMode: DEFAULT_ASSESSMENT_CONFIG.robustness.slipNoiseMode,
      reliabilityByCalibration: DEFAULT_ASSESSMENT_CONFIG.robustness.reliabilityByCalibration,
      thetaMin: DEFAULT_ASSESSMENT_CONFIG.thetaMin,
      thetaMax: DEFAULT_ASSESSMENT_CONFIG.thetaMax,
      priorSigma: DEFAULT_ASSESSMENT_CONFIG.priorSigma,
    },
  };

  // Write artifact
  const fs = await import('node:fs');
  const path = await import('node:path');
  const outPath = path.join(process.cwd(), 'scripts', 'audit-artifact.json');
  fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2));
  console.log(`\nWrote ${outPath}`);
}

function summarizeMc(report: MonteCarloReport) {
  return {
    mode: report.mode,
    configId: report.configId,
    nSessionsPerTheta: report.nSessionsPerTheta,
    meanAbsBias: Number(mean(report.cells.map((c) => Math.abs(c.bias))).toFixed(4)),
    meanRmse: Number(mean(report.cells.map((c) => c.rmse)).toFixed(4)),
    meanExact: Number(mean(report.cells.map((c) => c.exactCefrRate)).toFixed(4)),
    meanWithin1: Number(mean(report.cells.map((c) => c.within1CefrRate)).toFixed(4)),
    meanCoverage: Number(mean(report.cells.map((c) => c.coverage95)).toFixed(4)),
    cells: report.cells.map((c) => ({
      trueTheta: c.trueTheta,
      trueCefr: c.trueCefr,
      meanEstimatedTheta: Number(c.meanEstimatedTheta.toFixed(3)),
      bias: Number(c.bias.toFixed(3)),
      rmse: Number(c.rmse.toFixed(3)),
      meanPosteriorSd: Number(c.meanPosteriorSd.toFixed(3)),
      coverage95: Number(c.coverage95.toFixed(3)),
      exactCefrRate: Number(c.exactCefrRate.toFixed(3)),
      within1CefrRate: Number(c.within1CefrRate.toFixed(3)),
      meanConfidence: Number(c.meanConfidence.toFixed(3)),
      statisticalDistribution: c.statisticalDistribution,
      verifiedDistribution: c.verifiedDistribution,
    })),
    confusionStatistical: report.confusionStatistical,
    confusionVerified: report.confusionVerified,
  };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
