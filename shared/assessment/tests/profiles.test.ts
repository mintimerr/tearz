import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cefrRank } from '../src/scale.js';
import type { AssessmentResult, CefrLevel } from '../src/types.js';
import { itemAt, pathFromPlan, runSteps, snapshot, type Step } from './helpers.js';
import { correct, wrong } from './helpers.js';

function expectVerified(result: AssessmentResult, level: CefrLevel) {
  assert.equal(
    result.verifiedPlacementLevel,
    level,
    `verified=${result.verifiedPlacementLevel} statistical=${result.statisticalEstimate} theta=${result.theta.toFixed(3)} probs=${JSON.stringify(result.levelProbabilities)}`,
  );
}

function expectVerifiedAtMost(result: AssessmentResult, max: CefrLevel) {
  assert.ok(
    cefrRank(result.verifiedPlacementLevel) <= cefrRank(max),
    `expected verified ≤ ${max}, got ${result.verifiedPlacementLevel}`,
  );
}

/** Export snapshots for the reporting step. */
export const PROFILE_RESULTS: Record<string, ReturnType<typeof snapshot>> = {};

describe('Assessment Engine — synthetic profiles', () => {
  it('PROFILE 1: fails A1/A2 → A1', () => {
    const steps = pathFromPlan([
      { level: 'A1', within: 0.3, ok: false },
      { level: 'A1', within: 0.5, ok: false },
      { level: 'A1', within: 0.7, ok: false },
      { level: 'A2', within: 0.3, ok: false },
      { level: 'A1', within: 0.4, ok: false },
      { level: 'A2', within: 0.2, ok: false },
      { level: 'A1', within: 0.6, ok: true },
      { level: 'A1', within: 0.5, ok: false },
      { level: 'A2', within: 0.4, ok: false },
      { level: 'A1', within: 0.2, ok: false },
      { level: 'A1', within: 0.8, ok: false },
      { level: 'A2', within: 0.5, ok: false },
      { level: 'A1', within: 0.3, ok: false },
      { level: 'A1', within: 0.5, ok: false },
      { level: 'A2', within: 0.3, ok: false },
    ]);
    const { result } = runSteps(steps);
    PROFILE_RESULTS['P1'] = snapshot(result);
    expectVerified(result, 'A1');
    assert.ok(result.theta < -1.0, `theta should be low, got ${result.theta}`);
  });

  it('PROFILE 2: stable A1/A2, fails B1 → A2', () => {
    const steps = pathFromPlan([
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
    ]);
    const { result } = runSteps(steps);
    PROFILE_RESULTS['P2'] = snapshot(result);
    expectVerified(result, 'A2');
  });

  it('PROFILE 3: through B1, fails B2 → B1', () => {
    const steps = pathFromPlan([
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
    ]);
    const { result } = runSteps(steps);
    PROFILE_RESULTS['P3'] = snapshot(result);
    expectVerified(result, 'B1');
  });

  it('PROFILE 4: stable B2, fails C1 → B2', () => {
    const steps = pathFromPlan([
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
    ]);
    const { result } = runSteps(steps);
    PROFILE_RESULTS['P4'] = snapshot(result);
    expectVerified(result, 'B2');
  });

  it('PROFILE 5: stable through C1 → C1', () => {
    const steps = pathFromPlan([
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
    ]);
    const { result } = runSteps(steps);
    PROFILE_RESULTS['P5'] = snapshot(result);
    expectVerified(result, 'C1');
    assert.ok(result.theta > 0.8, `theta should be high-C1 region, got ${result.theta}`);
  });

  it('PROFILE 6: stable C2 → C2', () => {
    const steps = pathFromPlan([
      { level: 'B2', within: 0.5, ok: true },
      { level: 'C1', within: 0.4, ok: true },
      { level: 'C1', within: 0.7, ok: true },
      { level: 'C2', within: 0.3, ok: true },
      { level: 'C2', within: 0.5, ok: true },
      { level: 'C2', within: 0.6, ok: true },
      { level: 'C2', within: 0.8, ok: true },
      { level: 'C1', within: 0.5, ok: true },
      { level: 'C2', within: 0.4, ok: true },
      { level: 'B2', within: 0.8, ok: true },
      { level: 'C2', within: 0.7, ok: true },
      { level: 'C1', within: 0.8, ok: true },
      { level: 'C2', within: 0.5, ok: true },
      { level: 'C2', within: 0.3, ok: true },
      { level: 'C2', within: 0.9, ok: true },
    ]);
    const { result } = runSteps(steps);
    PROFILE_RESULTS['P6'] = snapshot(result);
    expectVerified(result, 'C2');
    assert.ok(result.theta > 1.5, `theta should be C2 region, got ${result.theta}`);
  });

  it('PROFILE 7: weak user one lucky C2 → not C1/C2 verified', () => {
    const steps = pathFromPlan([
      { level: 'A1', within: 0.4, ok: false },
      { level: 'A1', within: 0.6, ok: false },
      { level: 'A2', within: 0.3, ok: false },
      { level: 'A1', within: 0.5, ok: true },
      { level: 'A2', within: 0.5, ok: false },
      { level: 'A1', within: 0.7, ok: false },
      { level: 'C2', within: 0.5, ok: true }, // lucky
      { level: 'A2', within: 0.4, ok: false },
      { level: 'A1', within: 0.3, ok: false },
      { level: 'A2', within: 0.6, ok: false },
      { level: 'A1', within: 0.5, ok: false },
      { level: 'B1', within: 0.3, ok: false },
      { level: 'A2', within: 0.5, ok: false },
      { level: 'A1', within: 0.8, ok: false },
      { level: 'A2', within: 0.7, ok: false },
    ]);
    const { result } = runSteps(steps);
    PROFILE_RESULTS['P7'] = snapshot(result);
    expectVerifiedAtMost(result, 'A2');
    assert.ok(
      result.verification.applied || cefrRank(result.statisticalEstimate) <= cefrRank('A2'),
      'either verification caps high estimate, or posterior stays low',
    );
  });

  it('PROFILE 8: strong user one easy miss → keeps high level', () => {
    const steps: Step[] = [
      ...pathFromPlan([
        { level: 'B2', within: 0.4, ok: true },
        { level: 'C1', within: 0.3, ok: true },
        { level: 'C1', within: 0.5, ok: true },
        { level: 'C1', within: 0.7, ok: true },
        { level: 'C2', within: 0.3, ok: true },
        { level: 'C2', within: 0.5, ok: true },
        { level: 'C2', within: 0.6, ok: true },
        { level: 'C2', within: 0.7, ok: true },
      ]),
      { item: itemAt('A2', 0.4, 'easy-miss'), response: wrong() },
      ...pathFromPlan([
        { level: 'C1', within: 0.6, ok: true },
        { level: 'C2', within: 0.4, ok: true },
        { level: 'C1', within: 0.5, ok: true },
        { level: 'C2', within: 0.8, ok: true },
        { level: 'B2', within: 0.5, ok: true },
        { level: 'C2', within: 0.5, ok: true },
      ]).map((s, i) => ({
        item: { ...s.item, id: `after-${i}` },
        response: s.response,
      })),
    ];
    const { result } = runSteps(steps);
    PROFILE_RESULTS['P8'] = snapshot(result);
    assert.ok(
      cefrRank(result.verifiedPlacementLevel) >= cefrRank('C1'),
      `one A2 miss must not destroy high evidence; got ${result.verifiedPlacementLevel}`,
    );
  });

  it('PROFILE 9: chaotic answers → low confidence', () => {
    const pattern = [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true];
    const levels: CefrLevel[] = [
      'A1',
      'C2',
      'A2',
      'C1',
      'B1',
      'C2',
      'A1',
      'B2',
      'C1',
      'A2',
      'B1',
      'C2',
      'A1',
      'B2',
      'C1',
    ];
    const steps = levels.map((level, i) => ({
      item: itemAt(level, 0.5, `chaos-${i}`),
      response: pattern[i] ? correct() : wrong(),
    }));
    const { result } = runSteps(steps);
    PROFILE_RESULTS['P9'] = snapshot(result);
    assert.equal(result.confidenceLabel, 'low');
    assert.ok(result.confidence < 0.55, `confidence should be low, got ${result.confidence}`);
  });

  it('PROFILE 10: borderline B2/C1 → both mass, not artificially high confidence', () => {
    const steps = pathFromPlan([
      { level: 'B2', within: 0.4, ok: true },
      { level: 'B2', within: 0.6, ok: true },
      { level: 'B2', within: 0.8, ok: true },
      { level: 'C1', within: 0.3, ok: true },
      { level: 'C1', within: 0.4, ok: false },
      { level: 'B2', within: 0.5, ok: true },
      { level: 'C1', within: 0.5, ok: true },
      { level: 'C1', within: 0.6, ok: false },
      { level: 'B2', within: 0.7, ok: true },
      { level: 'C1', within: 0.35, ok: true },
      { level: 'C1', within: 0.7, ok: false },
      { level: 'B2', within: 0.55, ok: true },
      { level: 'C1', within: 0.45, ok: false },
      { level: 'B2', within: 0.65, ok: true },
      { level: 'C1', within: 0.55, ok: true },
    ]);
    const { result } = runSteps(steps);
    PROFILE_RESULTS['P10'] = snapshot(result);
    const pB2 = result.levelProbabilities.B2;
    const pC1 = result.levelProbabilities.C1;
    assert.ok(pB2 > 0.12, `B2 mass should be noticeable, got ${pB2}`);
    assert.ok(pC1 > 0.12, `C1 mass should be noticeable, got ${pC1}`);
    assert.ok(
      result.confidenceLabel !== 'high',
      `borderline should not be high confidence; got ${result.confidenceLabel} (${result.confidence})`,
    );
    assert.ok(
      result.verifiedPlacementLevel === 'B2' || result.verifiedPlacementLevel === 'C1',
      `expected B2 or C1 verified, got ${result.verifiedPlacementLevel}`,
    );
  });
});

// Print snapshots after suite for human report (node:test runs files as scripts too).
process.on('exit', () => {
  if (Object.keys(PROFILE_RESULTS).length === 0) return;
  // eslint-disable-next-line no-console
  console.log('\n=== PROFILE SNAPSHOTS ===');
  for (const [k, v] of Object.entries(PROFILE_RESULTS)) {
    // eslint-disable-next-line no-console
    console.log(k, JSON.stringify(v));
  }
});
