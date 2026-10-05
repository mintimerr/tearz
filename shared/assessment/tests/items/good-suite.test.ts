import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { runItemQualityPipeline } from '../../src/items/pipeline.js';
import { GOOD_ITEMS } from './fixtures/good-items.js';

describe('good item suite — low false rejection', () => {
  it(`has at least 20 good cases (got ${GOOD_ITEMS.length})`, () => {
    assert.ok(GOOD_ITEMS.length >= 20, `expected ≥20, got ${GOOD_ITEMS.length}`);
  });

  for (const c of GOOD_ITEMS) {
    it(`accepts or revises (not reject) ${c.id} [${c.level}]`, () => {
      const { report, eligibility } = runItemQualityPipeline(c.item);
      assert.notEqual(
        report.qualityGate,
        'REJECT',
        `${c.id} false reject; critical=${JSON.stringify(report.criticalIssues)} det=${JSON.stringify(
          report.deterministic.checks.filter((x) => x.severity === 'fail'),
        )}`,
      );
      // Provisional + PASS should be score-eligible with weight from config reliability
      if (report.qualityGate === 'PASS') {
        assert.equal(eligibility.eligible, true);
        assert.ok(eligibility.evidenceWeight > 0);
        assert.equal(eligibility.calibrationStatus, 'provisional');
      }
    });
  }

  it('reports false rejection rate on good suite', () => {
    let fr = 0;
    for (const c of GOOD_ITEMS) {
      const { report } = runItemQualityPipeline(c.item);
      if (report.qualityGate === 'REJECT') fr += 1;
    }
    const rate = fr / GOOD_ITEMS.length;
    // eslint-disable-next-line no-console
    console.log(`\nGOOD SUITE: n=${GOOD_ITEMS.length} false_reject=${fr} rate=${rate.toFixed(3)}`);
    assert.ok(rate <= 0.1, `false rejection too high: ${rate}`);
  });
});
