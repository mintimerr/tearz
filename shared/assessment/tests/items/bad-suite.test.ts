import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { runItemQualityPipeline } from '../../src/items/pipeline.js';
import { BAD_ITEMS } from './fixtures/bad-items.js';

describe('bad item suite — quality gate rejection', () => {
  it(`has at least 30 bad cases (got ${BAD_ITEMS.length})`, () => {
    assert.ok(BAD_ITEMS.length >= 30, `expected ≥30, got ${BAD_ITEMS.length}`);
  });

  let accepted = 0;
  const misses: string[] = [];

  for (const c of BAD_ITEMS) {
    it(`rejects ${c.id} (${c.category}) via ${c.expectedCatch}`, () => {
      const { report } = runItemQualityPipeline(c.item);
      if (report.qualityGate !== 'REJECT') {
        accepted += 1;
        misses.push(
          `${c.id} gate=${report.qualityGate} critical=${report.criticalIssues.map((i) => i.code).join(',')}`,
        );
      }
      assert.equal(
        report.qualityGate,
        'REJECT',
        `${c.id} should be REJECT; got ${report.qualityGate}; issues=${JSON.stringify(report.criticalIssues)}`,
      );

      if (c.expectedCatch === 'deterministic') {
        assert.equal(
          report.deterministic.passed,
          false,
          `${c.id} should fail deterministic; checks=${JSON.stringify(
            report.deterministic.checks.filter((x) => x.severity !== 'pass'),
          )}`,
        );
      }
    });
  }

  it('reports false acceptance rate on bad suite', () => {
    // Recompute for summary (per-test accepted counter is unreliable across isolation)
    let fa = 0;
    for (const c of BAD_ITEMS) {
      const { report } = runItemQualityPipeline(c.item);
      if (report.qualityGate !== 'REJECT') fa += 1;
    }
    const rate = fa / BAD_ITEMS.length;
    // eslint-disable-next-line no-console
    console.log(
      `\nBAD SUITE: n=${BAD_ITEMS.length} false_accept=${fa} rate=${rate.toFixed(3)} misses=${misses.join('; ')}`,
    );
    assert.ok(rate <= 0.1, `false acceptance too high: ${rate}`);
  });
});
