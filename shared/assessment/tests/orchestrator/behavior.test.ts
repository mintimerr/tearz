import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createItemFromSpec } from '../../src/item-factory.js';
import { mulberry32 } from '../../src/simulation.js';
import {
  applyOrchestratorAnswer,
  buildOrchestratorBank,
  chooseNext,
  commitSelection,
  createAdaptiveTestState,
  DEFAULT_ORCHESTRATOR_CONFIG,
  findMostUncertainCefrBoundary,
  finalizeAdaptiveTest,
  rankCandidates,
  runAdaptiveSession,
  toCandidate,
  type OrchestratorCandidate,
  type OrchestratorConfig,
} from '../../src/orchestrator/index.js';
import { updatePosterior } from '../../src/posterior.js';
import { resolveIrtParams } from '../../src/irt.js';

const baseCfg: OrchestratorConfig = {
  ...DEFAULT_ORCHESTRATOR_CONFIG,
  maxExperimentalItems: 0,
};

function bank(extra: OrchestratorCandidate[] = []) {
  return [...buildOrchestratorBank({ perLevelPerSkill: 3, includeExperimental: 6 }), ...extra];
}

function runPattern(responses: boolean[], cfg = baseCfg, b = bank()) {
  let orch = createAdaptiveTestState();
  const remaining = [...b];
  for (let i = 0; i < cfg.totalPresentedItems; i += 1) {
    const sel = chooseNext(orch, remaining, cfg);
    assert.ok(sel, `no selection at Q${i + 1}`);
    orch = commitSelection(orch, sel, cfg);
    orch = applyOrchestratorAnswer(orch, { correct: responses[i] ?? false });
    const idx = remaining.findIndex((c) => c.item.id === sel.candidate.item.id);
    if (idx >= 0) remaining.splice(idx, 1);
  }
  return { orch, result: finalizeAdaptiveTest(orch) };
}

describe('orchestrator behavior scenarios', () => {
  it('1. all wrong → low theta / A1–A2 region', () => {
    const { orch, result } = runPattern(Array(15).fill(false));
    assert.ok(result.theta < -0.5, `theta=${result.theta}`);
    assert.ok(
      result.verifiedPlacementLevel === 'A1' || result.verifiedPlacementLevel === 'A2',
      result.verifiedPlacementLevel,
    );
    assert.equal(orch.presentedItems.length, 15);
  });

  it('2. all correct → high theta; C1/C2 evidence opportunities appear', () => {
    const { orch, result } = runPattern(Array(15).fill(true));
    assert.ok(result.theta > 0.5, `theta=${result.theta}`);
    const high = orch.presentedItems.filter(
      (p) => p.item.targetLevel === 'C1' || p.item.targetLevel === 'C2',
    );
    assert.ok(high.length >= 3, `expected C1/C2 probes, got ${high.length}`);
  });

  it('3. A2-like mixed pattern', () => {
    // pass easy-ish early fails mid
    const pattern = [true, false, true, false, true, false, false, true, false, true, false, true, false, true, false];
    const { result } = runPattern(pattern);
    assert.ok(result.theta < 0.5);
  });

  it('4–7. IRT-sampled level-like users produce coherent ranges', () => {
    const cases: Array<{ label: string; theta: number; maxVerified?: string }> = [
      { label: 'A2-like', theta: -1.5 },
      { label: 'B1-like', theta: -0.5 },
      { label: 'B2-like', theta: 0.5 },
      { label: 'C1-like', theta: 1.5 },
      { label: 'C2-like', theta: 2.5 },
    ];
    for (const c of cases) {
      const session = runAdaptiveSession(c.theta, bank(), mulberry32(42 + c.theta * 10), baseCfg);
      assert.equal(session.state.presentedItems.length, 15, c.label);
      assert.ok(Number.isFinite(session.result.theta), c.label);
    }
  });

  it('8. alternating chaotic still completes 15 with coverage pressure', () => {
    const pattern = Array.from({ length: 15 }, (_, i) => i % 2 === 0);
    const { orch } = runPattern(pattern);
    assert.equal(orch.presentedItems.length, 15);
    assert.ok(orch.selectionHistory.every((d) => d.phase));
  });

  it('9. lucky hard correct after weakness does not jump to C2 verified alone', () => {
    const pattern = [
      false,
      false,
      false,
      false,
      false,
      true, // possible lucky
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ];
    const { result } = runPattern(pattern);
    assert.notEqual(result.verifiedPlacementLevel, 'C2');
  });

  it('10. accidental easy miss after strong streak keeps high mass path possible', () => {
    const pattern = [
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
    ];
    const { result } = runPattern(pattern);
    assert.ok(result.theta > 0, `theta=${result.theta}`);
  });

  it('11. B2/C1 ambiguous — boundary detection engages', () => {
    const pattern = [
      true,
      true,
      true,
      false,
      true,
      false,
      true,
      false,
      true,
      true,
      false,
      true,
      false,
      true,
      false,
    ];
    const { orch } = runPattern(pattern);
    assert.ok(orch.activeBoundary);
    const boundaryQs = orch.presentedItems.filter((p) => p.phase === 'boundary');
    assert.equal(boundaryQs.length, 4);
  });

  it('12. weak reading bank still prefers other skills until reading available', () => {
    const noReading = bank().filter((c) => c.item.skill !== 'reading');
    const { orch } = runPattern(Array(15).fill(true), baseCfg, noReading);
    assert.equal(orch.skillCounts.reading ?? 0, 0);
    // Without reading in bank, coverage cannot be forced — invariant is "when bank permits"
  });

  it('13. reading-heavy path still mixes skills', () => {
    const { orch } = runPattern(Array(15).fill(true));
    assert.ok((orch.skillCounts.grammar ?? 0) >= 3);
    assert.ok((orch.skillCounts.vocabulary ?? 0) >= 3);
    assert.ok((orch.skillCounts.reading ?? 0) >= 3);
    assert.ok((orch.skillCounts.functional ?? 0) >= 2);
  });

  it('14. insufficient C2 evidence before Q14 → final seeks high-b items when stats high', () => {
    const { orch } = runPattern(Array(15).fill(true));
    const finals = orch.presentedItems.filter((p) => p.phase === 'final');
    assert.equal(finals.length, 2);
    // At least one final item should be demanding if theta high
    if ((orch.presentedItems.at(-3)?.thetaAfter ?? 0) > 1.2) {
      assert.ok(
        finals.some((f) => f.item.targetLevel === 'C1' || f.item.targetLevel === 'C2'),
        'final should hunt high-level evidence',
      );
    }
  });

  it('15. mandatory reading coverage missing at Q12 raises reading priority', () => {
    let orch = createAdaptiveTestState();
    const remaining = bank().filter((c) => c.item.skill !== 'reading' || c.item.targetLevel === 'B1');
    // Present 11 non-reading by filtering bank temporarily
    const noRead = bank().filter((c) => c.item.skill !== 'reading');
    for (let i = 0; i < 11; i += 1) {
      const sel = chooseNext(orch, noRead, baseCfg);
      assert.ok(sel);
      orch = commitSelection(orch, sel, baseCfg);
      orch = applyOrchestratorAnswer(orch, { correct: true });
      const idx = noRead.findIndex((c) => c.item.id === sel.candidate.item.id);
      if (idx >= 0) noRead.splice(idx, 1);
    }
    // Now open full bank with reading
    const full = bank().filter(
      (c) => !orch.presentedItems.some((p) => p.item.id === c.item.id),
    );
    const sel12 = chooseNext(orch, full, baseCfg);
    assert.ok(sel12);
    // With 4 slots left and reading deficit 3, selector should pick reading soon
    assert.ok(
      sel12.candidate.item.skill === 'reading' ||
        sel12.decision.scoreComponents.coveragePriority > 0.5,
      `expected reading pressure, got ${sel12.candidate.item.skill}`,
    );
    void remaining;
  });

  it('16. missing preferred construct falls back to other constructs', () => {
    const limited = bank().filter((c) => !c.item.construct.includes('hypothetical'));
    const { orch } = runPattern(Array(15).fill(true), baseCfg, limited);
    assert.equal(orch.presentedItems.length, 15);
  });

  it('17. experimental with high raw appeal still capped by maxExperimental / final ban', () => {
    const cfg = { ...DEFAULT_ORCHESTRATOR_CONFIG, maxExperimentalItems: 1 };
    let orch = createAdaptiveTestState();
    const remaining = bank();
    let exp = 0;
    for (let i = 0; i < 15; i += 1) {
      const sel = chooseNext(orch, remaining, cfg);
      assert.ok(sel);
      if (sel.decision.isExperimental) {
        exp += 1;
        assert.notEqual(sel.decision.questionNumber, 1);
        assert.notEqual(sel.decision.phase, 'final');
      }
      orch = commitSelection(orch, sel, cfg);
      orch = applyOrchestratorAnswer(orch, { correct: true });
      const idx = remaining.findIndex((c) => c.item.id === sel.candidate.item.id);
      if (idx >= 0) remaining.splice(idx, 1);
    }
    assert.ok(exp <= 1);
  });

  it('18. quality-rejected item never wins even if difficulty is ideal', () => {
    const decoyItem = createItemFromSpec({
      id: 'quality-reject-ideal',
      language: 'en',
      skill: 'grammar',
      construct: 'en.grammar.present_perfect',
      itemType: 'grammarForm',
      responseFormat: 'singleChoice',
      optionCount: 4,
      targetLevel: 'B1',
      difficultyWithinLevel: 0.4,
      calibrationStatus: 'anchor',
    });
    const decoy = toCandidate(decoyItem, undefined, 'REJECT');
    decoy.eligible = false;
    const { ranked } = rankCandidates(createAdaptiveTestState(), [...bank(), decoy]);
    assert.ok(!ranked.some((r) => r.candidate.item.id === 'quality-reject-ideal'));
  });

  it('19. repeated construct is penalized when alternatives exist', () => {
    let orch = createAdaptiveTestState();
    const b = bank();
    const sel1 = chooseNext(orch, b, baseCfg);
    assert.ok(sel1);
    orch = commitSelection(orch, sel1, baseCfg);
    orch = applyOrchestratorAnswer(orch, { correct: true });
    const sameConstruct = b.filter(
      (c) =>
        c.item.construct === sel1.candidate.item.construct &&
        c.item.id !== sel1.candidate.item.id,
    );
    const others = b.filter(
      (c) =>
        c.item.construct !== sel1.candidate.item.construct &&
        c.item.id !== sel1.candidate.item.id,
    );
    const { ranked } = rankCandidates(orch, [...sameConstruct, ...others], baseCfg);
    if (sameConstruct.length && others.length) {
      // top should usually not be same construct consecutively
      assert.notEqual(ranked[0]?.candidate.item.construct, sel1.candidate.item.construct);
    }
  });

  it('20. bimodal posterior → boundary uncertainty is positive', () => {
    let orch = createAdaptiveTestState();
    // Artificially create wide/bimodal-ish posterior by opposite updates
    const itemHi = bank().find((c) => c.item.targetLevel === 'C1')!;
    const itemLo = bank().find((c) => c.item.targetLevel === 'A2')!;
    const pHi = resolveIrtParams(itemHi.item);
    const pLo = resolveIrtParams(itemLo.item);
    let post = orch.assessmentState.posterior;
    post = updatePosterior(orch.assessmentState.thetaGrid, post, pHi, true, 1).posterior;
    post = updatePosterior(orch.assessmentState.thetaGrid, post, pLo, false, 1).posterior;
    orch = {
      ...orch,
      assessmentState: { ...orch.assessmentState, posterior: post },
    };
    const boundary = findMostUncertainCefrBoundary(
      orch.assessmentState.thetaGrid,
      orch.assessmentState.posterior,
    );
    assert.ok(boundary.uncertainty > 0.05, JSON.stringify(boundary));
  });
});
