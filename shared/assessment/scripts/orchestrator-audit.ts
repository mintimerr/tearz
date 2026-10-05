/**
 * Orchestrator audit: sequences + Monte Carlo fixed vs adaptive.
 * Run: ORCH_MC_N=1000 npx tsx scripts/orchestrator-audit.ts
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { mulberry32 } from '../src/simulation.js';
import {
  DEFAULT_ORCHESTRATOR_CONFIG,
  buildOrchestratorBank,
  runAdaptiveSession,
  runOrchestratorMonteCarlo,
} from '../src/orchestrator/index.js';

async function main() {
  const n = Number(process.env.ORCH_MC_N ?? 1000);
  const bank = buildOrchestratorBank({
    perLevelPerSkill: 4,
    includeExperimental: 0,
    calibrationStatus: 'calibrated',
  });
  const cfg = { ...DEFAULT_ORCHESTRATOR_CONFIG, maxExperimentalItems: 0 };

  const demos = [
    { name: 'very_weak', theta: -2.75 },
    { name: 'B1', theta: -0.5 },
    { name: 'B2_C1_border', theta: 1.0 },
    { name: 'C2', theta: 2.5 },
  ];

  console.log('=== DEMO SEQUENCES (IRT-sampled) ===');
  const sequences: Record<string, unknown> = {};
  for (const d of demos) {
    const session = runAdaptiveSession(d.theta, bank, mulberry32(1000 + d.theta * 100), cfg);
    sequences[d.name] = {
      trueTheta: d.theta,
      finalTheta: session.result.theta,
      statistical: session.result.statisticalEstimate,
      verified: session.result.verifiedPlacementLevel,
      skillCounts: session.state.skillCounts,
      wouldStopEarly: session.state.wouldStopEarly,
      stopReason: session.state.stopReason,
      sequence: session.sequence,
    };
    console.log(`\n-- ${d.name} trueθ=${d.theta} → θ=${session.result.theta.toFixed(3)} stat=${session.result.statisticalEstimate} ver=${session.result.verifiedPlacementLevel}`);
    for (const row of session.sequence) {
      console.log(
        `Q${row.questionNumber} ${row.phase} ${row.skill}/${row.construct.split('.').pop()} ${row.targetLevel} b=${row.difficulty.toFixed(2)} resp=${row.response ? '✓' : '✗'} θ=${row.thetaAfter?.toFixed(3)} boundary=${row.activeBoundary}`,
      );
    }
  }

  console.log(`\n=== MONTE CARLO N=${n} (synthetic model-recovery) ===`);
  const mc = runOrchestratorMonteCarlo({
    nSessionsPerTheta: n,
    seed: 101,
    orchestratorConfig: cfg,
  });

  console.log('trueθ\tadaptBias\tadaptRMSE\tadaptExact\tadapt±1\tfixedBias\tfixedRMSE\tfixedExact\tfixed±1');
  for (let i = 0; i < mc.adaptive.length; i += 1) {
    const a = mc.adaptive[i];
    const f = mc.fixed[i];
    console.log(
      `${a.trueTheta}\t${a.bias.toFixed(3)}\t${a.rmse.toFixed(3)}\t${a.exactCefrRate.toFixed(3)}\t${a.within1CefrRate.toFixed(3)}\t${f.bias.toFixed(3)}\t${f.rmse.toFixed(3)}\t${f.exactCefrRate.toFixed(3)}\t${f.within1CefrRate.toFixed(3)}`,
    );
  }

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  console.log('\nSummary adaptive |bias|', mean(mc.adaptive.map((c) => Math.abs(c.bias))).toFixed(3));
  console.log('Summary fixed |bias|', mean(mc.fixed.map((c) => Math.abs(c.bias))).toFixed(3));
  console.log('Summary adaptive RMSE', mean(mc.adaptive.map((c) => c.rmse)).toFixed(3));
  console.log('Summary fixed RMSE', mean(mc.fixed.map((c) => c.rmse)).toFixed(3));
  console.log('Summary adaptive exact', mean(mc.adaptive.map((c) => c.exactCefrRate)).toFixed(3));
  console.log('Summary fixed exact', mean(mc.fixed.map((c) => c.exactCefrRate)).toFixed(3));

  const artifact = { note: mc.note, sequences, monteCarlo: mc };
  const out = join(process.cwd(), 'scripts', 'orchestrator-artifact.json');
  writeFileSync(out, JSON.stringify(artifact, null, 2));
  console.log('\nWrote', out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
