import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_ORCHESTRATOR_CONFIG,
  runOrchestratorMonteCarlo,
} from '../../src/orchestrator/index.js';

describe('orchestrator monte carlo (smoke, synthetic model-recovery)', () => {
  it('adaptive completes comparison cells vs fixed ladder', () => {
    const n = Number(process.env.ORCH_MC_N ?? 40);
    const report = runOrchestratorMonteCarlo({
      nSessionsPerTheta: n,
      seed: 3,
      orchestratorConfig: { ...DEFAULT_ORCHESTRATOR_CONFIG, maxExperimentalItems: 0 },
    });
    assert.equal(report.adaptive.length, 12);
    assert.equal(report.fixed.length, 12);
    for (const cell of report.adaptive) {
      assert.ok(Number.isFinite(cell.rmse));
      assert.ok(cell.coverage95 >= 0 && cell.coverage95 <= 1);
    }
    // eslint-disable-next-line no-console
    console.log(
      '\nORCH MC smoke adaptive mean |bias|',
      (
        report.adaptive.reduce((a, c) => a + Math.abs(c.bias), 0) / report.adaptive.length
      ).toFixed(3),
      'fixed',
      (report.fixed.reduce((a, c) => a + Math.abs(c.bias), 0) / report.fixed.length).toFixed(3),
    );
  });
});
