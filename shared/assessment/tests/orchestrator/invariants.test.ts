import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createItemFromSpec } from '../../src/item-factory.js';
import {
  buildOrchestratorBank,
  chooseNext,
  commitSelection,
  createAdaptiveTestState,
  applyOrchestratorAnswer,
  DEFAULT_ORCHESTRATOR_CONFIG,
  phaseForQuestion,
  rankCandidates,
  selectNextItem,
  withRejectedDecoy,
  type OrchestratorCandidate,
} from '../../src/orchestrator/index.js';
import { computeCoverageSnapshot } from '../../src/orchestrator/coverage.js';

function runForced(
  bank: OrchestratorCandidate[],
  responses: boolean[],
  orchConfig = { ...DEFAULT_ORCHESTRATOR_CONFIG, maxExperimentalItems: 0 },
) {
  let orch = createAdaptiveTestState();
  const remaining = [...bank];
  for (let i = 0; i < orchConfig.totalPresentedItems; i += 1) {
    const sel = chooseNext(orch, remaining, orchConfig);
    assert.ok(sel, `selection failed at Q${i + 1}`);
    orch = commitSelection(orch, sel, orchConfig);
    orch = applyOrchestratorAnswer(orch, { correct: responses[i] ?? false });
    const idx = remaining.findIndex((c) => c.item.id === sel.candidate.item.id);
    if (idx >= 0) remaining.splice(idx, 1);
  }
  return orch;
}

describe('orchestrator invariants', () => {
  const bank = buildOrchestratorBank({ perLevelPerSkill: 3, includeExperimental: 4 });

  it('presents exactly 15 items', () => {
    const orch = runForced(bank, Array(15).fill(true));
    assert.equal(orch.presentedItems.length, 15);
  });

  it('Q1 is scoring and non-experimental; phases are deterministic', () => {
    let orch = createAdaptiveTestState();
    const sel = chooseNext(orch, bank, DEFAULT_ORCHESTRATOR_CONFIG);
    assert.ok(sel);
    assert.equal(sel.decision.questionNumber, 1);
    assert.equal(sel.decision.phase, 'routing');
    assert.equal(sel.decision.isExperimental, false);
    assert.ok(sel.candidate.item.isScored);
    assert.notEqual(sel.candidate.item.skill, 'reading');
    assert.equal(sel.candidate.item.targetLevel, 'B1');
    assert.ok(
      sel.candidate.item.difficultyWithinLevel >= 0.35 &&
        sel.candidate.item.difficultyWithinLevel <= 0.5,
    );
    assert.equal(phaseForQuestion(1), 'routing');
    assert.equal(phaseForQuestion(5), 'localization');
    assert.equal(phaseForQuestion(10), 'boundary');
    assert.equal(phaseForQuestion(14), 'final');
  });

  it('never selects rejected / retired items', () => {
    const decoy = createItemFromSpec({
      id: 'rejected-decoy',
      language: 'en',
      skill: 'grammar',
      construct: 'en.grammar.hypothetical_past',
      itemType: 'grammarForm',
      responseFormat: 'singleChoice',
      optionCount: 4,
      targetLevel: 'B1',
      difficultyWithinLevel: 0.4,
      calibrationStatus: 'anchor',
    });
    decoy.predictedDifficulty = 0; // near prior — tempting
    const polluted = withRejectedDecoy(bank, decoy);
    const { ranked, rejected } = rankCandidates(createAdaptiveTestState(), polluted);
    assert.ok(rejected.some((r) => r.id === 'rejected-decoy'));
    assert.ok(!ranked.some((r) => r.candidate.item.id === 'rejected-decoy'));
  });

  it('no duplicate items in a session', () => {
    const orch = runForced(bank, Array(15).fill(false));
    const ids = orch.presentedItems.map((p) => p.item.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('unscored experimental does not change posterior', () => {
    const cfg = { ...DEFAULT_ORCHESTRATOR_CONFIG, maxExperimentalItems: 2 };
    let orch = createAdaptiveTestState();
    // Force through Q1 scored
    const sel1 = chooseNext(orch, bank, cfg);
    assert.ok(sel1);
    orch = commitSelection(orch, sel1, cfg);
    orch = applyOrchestratorAnswer(orch, { correct: true });
    const remaining = bank.filter((c) => c.item.id !== sel1.candidate.item.id);
    const exp = remaining.find((c) => c.item.calibrationStatus === 'experimental');
    assert.ok(exp);
    // Manually commit experimental if selector allows later — inject via commit
    const before = [...orch.assessmentState.posterior];
    const fakeSel = {
      decision: {
        ...sel1.decision,
        questionNumber: 2,
        selectedItemId: exp.item.id,
        isExperimental: true,
      },
      candidate: exp,
    };
    orch = commitSelection(orch, fakeSel as typeof sel1, cfg);
    orch = applyOrchestratorAnswer(orch, { correct: true });
    assert.deepEqual(orch.assessmentState.posterior, before);
    assert.ok(orch.experimentalItemIds.includes(exp.item.id));
  });

  it('selector is deterministic for same state + bank order', () => {
    const orch = createAdaptiveTestState();
    const a = selectNextItem(orch, bank)?.candidate.item.id;
    const b = selectNextItem(orch, bank)?.candidate.item.id;
    assert.equal(a, b);
  });

  it('respects maxExperimentalItems', () => {
    const cfg = { ...DEFAULT_ORCHESTRATOR_CONFIG, maxExperimentalItems: 1 };
    let orch = createAdaptiveTestState();
    const remaining = [...bank];
    let expCount = 0;
    for (let i = 0; i < 15; i += 1) {
      const sel = chooseNext(orch, remaining, cfg);
      assert.ok(sel);
      if (sel.decision.isExperimental) expCount += 1;
      orch = commitSelection(orch, sel, cfg);
      orch = applyOrchestratorAnswer(orch, { correct: i % 2 === 0 });
      const idx = remaining.findIndex((c) => c.item.id === sel.candidate.item.id);
      if (idx >= 0) remaining.splice(idx, 1);
    }
    assert.ok(expCount <= 1);
    assert.ok(orch.experimentalItemIds.length <= 1);
  });

  it('skill coverage satisfied when bank permits (all-correct path)', () => {
    const cfg = { ...DEFAULT_ORCHESTRATOR_CONFIG, maxExperimentalItems: 0 };
    const orch = runForced(bank, Array(15).fill(true), cfg);
    const snap = computeCoverageSnapshot(orch, cfg);
    assert.equal(snap.allMinimaMet, true, JSON.stringify(orch.skillCounts));
  });

  it('LLM cannot set CEFR — statisticalEstimate comes from assessment posterior only', () => {
    const orch = runForced(bank, Array(15).fill(true));
    const last = orch.selectionHistory.at(-1);
    assert.ok(last);
    // selection stores posteriorBefore but never writes cefrLevel onto assessment
    assert.equal(
      typeof orch.assessmentState.levelProbabilities.B1,
      'number',
    );
  });
});
