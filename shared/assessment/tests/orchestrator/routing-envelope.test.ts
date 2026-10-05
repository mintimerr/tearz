import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applyOrchestratorAnswer,
  buildOrchestratorBank,
  chooseNext,
  commitSelection,
  computeRoutingEnvelope,
  createAdaptiveTestState,
  DEFAULT_ORCHESTRATOR_CONFIG,
  rankCandidates,
  runAdaptiveSession,
  type OrchestratorConfig,
} from '../../src/orchestrator/index.js';
import { mulberry32 } from '../../src/simulation.js';

const cfg: OrchestratorConfig = {
  ...DEFAULT_ORCHESTRATOR_CONFIG,
  maxExperimentalItems: 0,
};

function bank() {
  return buildOrchestratorBank({ perLevelPerSkill: 4, includeExperimental: 0 });
}

function pickThrough(responses: boolean[], stopAfterPresented: number, b = bank()) {
  let orch = createAdaptiveTestState();
  const remaining = [...b];
  const picks: Array<{ q: number; level: string; id: string }> = [];
  for (let i = 0; i < stopAfterPresented; i += 1) {
    const sel = chooseNext(orch, remaining, cfg);
    assert.ok(sel, `no selection at Q${i + 1}`);
    picks.push({
      q: i + 1,
      level: sel.candidate.item.targetLevel,
      id: sel.candidate.item.id,
    });
    orch = commitSelection(orch, sel, cfg);
    if (i < responses.length) {
      orch = applyOrchestratorAnswer(orch, { correct: responses[i]! });
    }
    const idx = remaining.findIndex((c) => c.item.id === sel.candidate.item.id);
    if (idx >= 0) remaining.splice(idx, 1);
  }
  return { orch, picks, remaining };
}

describe('early routing envelope', () => {
  it('B1 correct Q1 cannot produce C2 at Q2', () => {
    const { picks } = pickThrough([true], 2);
    assert.equal(picks[0]!.level, 'B1');
    assert.notEqual(picks[1]!.level, 'C2');
    assert.ok(
      picks[1]!.level === 'B1' || picks[1]!.level === 'B2',
      `Q2 after B1✓ should be B1/B2, got ${picks[1]!.level}`,
    );
  });

  it('B1 wrong Q1 cannot produce C1/C2 at Q2', () => {
    const { picks } = pickThrough([false], 2);
    assert.equal(picks[0]!.level, 'B1');
    assert.ok(
      picks[1]!.level !== 'C1' && picks[1]!.level !== 'C2',
      `Q2 after B1✗ must not be C1/C2, got ${picks[1]!.level}`,
    );
    assert.ok(
      picks[1]!.level === 'A2' || picks[1]!.level === 'B1',
      `Q2 after B1✗ should be A2/B1, got ${picks[1]!.level}`,
    );
  });

  it('B1 correct → B2 correct can reach C1 at Q3 (envelope allows; not rejected)', () => {
    const { orch, picks, remaining } = pickThrough([true, true], 2);
    assert.equal(picks[0]!.level, 'B1');
    assert.ok(picks[1]!.level === 'B1' || picks[1]!.level === 'B2', `Q2=${picks[1]!.level}`);

    const env = computeRoutingEnvelope(orch, 3, cfg);
    assert.ok(env, 'Q3 should have envelope');
    assert.ok(env!.allowedLevels.includes('C1'), `envelope should allow C1, got ${env!.allowedLevels}`);
    assert.ok(!env!.allowedLevels.includes('C2'), 'Q3 strong path still excludes C2');

    const { ranked, rejected } = rankCandidates(orch, remaining, cfg);
    const c1InRanked = ranked.filter((r) => r.candidate.item.targetLevel === 'C1');
    assert.ok(c1InRanked.length > 0, 'C1 candidates must remain selectable under envelope');

    const c1EnvelopeRejected = rejected.filter((r) => {
      const cand = remaining.find((c) => c.item.id === r.id);
      return (
        cand?.item.targetLevel === 'C1' &&
        r.reasons.some((x) => x.startsWith('ROUTING_ENVELOPE'))
      );
    });
    assert.equal(c1EnvelopeRejected.length, 0);

    // If bank is restricted to C1-only at Q3, selector must pick C1 (prove reachability).
    const onlyC1 = remaining.filter((c) => c.item.targetLevel === 'C1');
    const forced = chooseNext(orch, onlyC1, cfg);
    assert.ok(forced);
    assert.equal(forced!.candidate.item.targetLevel, 'C1');
  });

  it('consistently strong user can reach C2 probes by Q4', () => {
    let ok = false;
    for (let s = 0; s < 40 && !ok; s += 1) {
      const session = runAdaptiveSession(2.75, bank(), mulberry32(200 + s), cfg);
      assert.notEqual(session.sequence[1]?.targetLevel, 'C2', 'Q2 must not be C2');
      ok = session.sequence.some((r) => r.questionNumber >= 4 && r.targetLevel === 'C2');
    }
    assert.ok(ok, 'consistently strong user should reach C2 by Q4+');
  });

  it('consistently weak user reaches A1/A2 quickly', () => {
    // Forced misses: after Q1 B1 miss → Q2 A2/B1; after more misses envelope opens A1.
    const { picks } = pickThrough(Array(5).fill(false), 5);
    assert.equal(picks[0]!.level, 'B1');
    assert.ok(picks[1]!.level === 'A2' || picks[1]!.level === 'B1');
    const earlyLow = picks.filter((p) => p.level === 'A1' || p.level === 'A2');
    assert.ok(earlyLow.length >= 1, `expected A1/A2 within first 5, got ${picks.map((p) => p.level)}`);

    const session = runAdaptiveSession(-2.75, bank(), mulberry32(7), cfg);
    assert.ok(
      session.result.verifiedPlacementLevel === 'A1' ||
        session.result.verifiedPlacementLevel === 'A2',
      session.result.verifiedPlacementLevel,
    );
    const lowAny = session.sequence.filter(
      (r) => r.targetLevel === 'A1' || r.targetLevel === 'A2',
    );
    assert.ok(lowAny.length >= 3, `weak IRT user should accumulate A1/A2 probes, got ${lowAny.length}`);
  });
});
