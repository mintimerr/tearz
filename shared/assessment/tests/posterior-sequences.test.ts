import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyAnswer, createAssessmentState, finalize } from '../src/index.js';
import { correct, itemAt, wrong } from './helpers.js';

type Trace = {
  step: number;
  label: string;
  theta: number;
  ci: { lower: number; upper: number };
  probs: Record<string, number>;
  statistical: string;
};

function traceState(step: number, label: string, state: ReturnType<typeof createAssessmentState>): Trace {
  return {
    step,
    label,
    theta: Number(state.theta.toFixed(4)),
    ci: {
      lower: Number(state.thetaCredibleInterval.lower.toFixed(4)),
      upper: Number(state.thetaCredibleInterval.upper.toFixed(4)),
    },
    probs: Object.fromEntries(
      (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map((L) => [
        L,
        Number(state.levelProbabilities[L].toFixed(4)),
      ]),
    ),
    statistical: Object.entries(state.levelProbabilities).sort((a, b) => b[1] - a[1])[0][0],
  };
}

export const SEQUENCE_TRACES: Record<string, Trace[]> = {};

describe('posterior sequences', () => {
  it('SEQ A: weak user + single lucky C2 correct — posterior does not collapse to C2', () => {
    let state = createAssessmentState();
    const traces: Trace[] = [traceState(0, 'prior', state)];

    const weakFails = [
      itemAt('A1', 0.4, 'w0'),
      itemAt('A1', 0.6, 'w1'),
      itemAt('A2', 0.3, 'w2'),
      itemAt('A1', 0.5, 'w3'),
      itemAt('A2', 0.5, 'w4'),
    ];
    weakFails.forEach((item, i) => {
      state = applyAnswer(state, item, wrong()).state;
      traces.push(traceState(i + 1, `fail ${item.targetLevel}`, state));
    });

    const beforeLucky = state.theta;
    state = applyAnswer(state, itemAt('C2', 0.5, 'lucky-c2'), correct()).state;
    traces.push(traceState(6, 'lucky C2 correct', state));

    // Continue failing easy items
    state = applyAnswer(state, itemAt('A2', 0.4, 'w5'), wrong()).state;
    traces.push(traceState(7, 'fail A2 after lucky', state));
    state = applyAnswer(state, itemAt('A1', 0.5, 'w6'), wrong()).state;
    traces.push(traceState(8, 'fail A1 after lucky', state));

    const result = finalize(state);
    SEQUENCE_TRACES['lucky_c2_weak'] = traces;

    assert.ok(state.theta < beforeLucky + 1.2, 'single C2 must not jump theta by >~1.2');
    assert.ok(result.levelProbabilities.C2 < 0.35, 'C2 mass must stay bounded');
    assert.notEqual(result.verifiedPlacementLevel, 'C2');
    assert.notEqual(result.verifiedPlacementLevel, 'C1');
  });

  it('SEQ B: strong user + single A2 miss — high posterior mass survives', () => {
    let state = createAssessmentState();
    const traces: Trace[] = [traceState(0, 'prior', state)];

    const strong = [
      itemAt('B2', 0.5, 's0'),
      itemAt('C1', 0.4, 's1'),
      itemAt('C1', 0.6, 's2'),
      itemAt('C1', 0.7, 's3'),
      itemAt('C2', 0.4, 's4'),
      itemAt('C2', 0.5, 's5'),
      itemAt('C2', 0.6, 's6'),
      itemAt('C2', 0.7, 's7'),
    ];
    strong.forEach((item, i) => {
      state = applyAnswer(state, item, correct()).state;
      traces.push(traceState(i + 1, `pass ${item.targetLevel}`, state));
    });

    const beforeMiss = state.theta;
    state = applyAnswer(state, itemAt('A2', 0.4, 'miss-a2'), wrong()).state;
    traces.push(traceState(9, 'miss A2', state));

    state = applyAnswer(state, itemAt('C1', 0.5, 's8'), correct()).state;
    traces.push(traceState(10, 'pass C1 recovery', state));

    const result = finalize(state);
    SEQUENCE_TRACES['strong_a2_miss'] = traces;

    assert.ok(state.theta > beforeMiss - 0.8, 'A2 miss must not crush theta');
    assert.ok(
      result.levelProbabilities.C1 + result.levelProbabilities.C2 > 0.45,
      'high-level mass should remain dominant',
    );
    assert.ok(
      result.verifiedPlacementLevel === 'C1' || result.verifiedPlacementLevel === 'C2',
      `expected C1/C2 verified, got ${result.verifiedPlacementLevel}`,
    );
  });

  it('SEQ C: borderline B2/C1 — both bands retain mass across steps', () => {
    let state = createAssessmentState();
    const traces: Trace[] = [traceState(0, 'prior', state)];

    const seq: { level: 'B2' | 'C1'; within: number; ok: boolean }[] = [
      { level: 'B2', within: 0.5, ok: true },
      { level: 'B2', within: 0.7, ok: true },
      { level: 'C1', within: 0.3, ok: true },
      { level: 'C1', within: 0.5, ok: false },
      { level: 'B2', within: 0.6, ok: true },
      { level: 'C1', within: 0.4, ok: true },
      { level: 'C1', within: 0.6, ok: false },
      { level: 'B2', within: 0.55, ok: true },
      { level: 'C1', within: 0.45, ok: true },
      { level: 'C1', within: 0.7, ok: false },
    ];

    seq.forEach((s, i) => {
      state = applyAnswer(
        state,
        itemAt(s.level, s.within, `border-${i}`),
        s.ok ? correct() : wrong(),
      ).state;
      traces.push(traceState(i + 1, `${s.ok ? 'pass' : 'fail'} ${s.level}`, state));
    });

    SEQUENCE_TRACES['border_b2_c1'] = traces;
    const pB2 = state.levelProbabilities.B2;
    const pC1 = state.levelProbabilities.C1;
    assert.ok(pB2 > 0.1 && pC1 > 0.1, `both B2 and C1 should keep mass (B2=${pB2}, C1=${pC1})`);
    const result = finalize(state);
    assert.ok(result.confidenceLabel !== 'high');
  });
});

process.on('exit', () => {
  if (Object.keys(SEQUENCE_TRACES).length === 0) return;
  // eslint-disable-next-line no-console
  console.log('\n=== POSTERIOR SEQUENCE TRACES ===');
  for (const [name, traces] of Object.entries(SEQUENCE_TRACES)) {
    // eslint-disable-next-line no-console
    console.log(`\n-- ${name} --`);
    for (const t of traces) {
      // eslint-disable-next-line no-console
      console.log(
        `#${t.step} ${t.label} θ=${t.theta} CI=[${t.ci.lower},${t.ci.upper}] top=${t.statistical}`,
        JSON.stringify(t.probs),
      );
    }
  }
});
