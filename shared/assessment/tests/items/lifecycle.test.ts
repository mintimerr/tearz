import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assertAiCalibrationPolicy,
  canTransition,
  transition,
} from '../../src/items/lifecycle.js';
import { parseGeneratorOutput } from '../../src/items/generator-contract.js';
import { decideScoringEligibility } from '../../src/items/scoring-eligibility.js';
import { buildQualityReport } from '../../src/items/quality-report.js';
import { runDeterministicChecks } from '../../src/items/deterministic/validators.js';
import { GOOD_ITEMS } from './fixtures/good-items.js';

describe('item lifecycle + calibration policy', () => {
  it('forbids draft → calibrated', () => {
    const r = canTransition('draft', 'calibrated');
    assert.equal(r.ok, false);
    assert.ok(r.reasonCodes.includes('LIFECYCLE_VIOLATION'));
  });

  it('forbids generated → anchor', () => {
    assert.equal(transition('generated', 'anchor').ok, false);
  });

  it('allows generated → deterministic_checked → … → approved_provisional', () => {
    assert.equal(canTransition('generated', 'deterministic_checked').ok, true);
    assert.equal(canTransition('deterministic_checked', 'semantic_reviewed').ok, true);
    assert.equal(canTransition('semantic_reviewed', 'adversarial_reviewed').ok, true);
    assert.equal(canTransition('adversarial_reviewed', 'approved_provisional').ok, true);
  });

  it('AI cannot claim calibrated/anchor', () => {
    assert.equal(assertAiCalibrationPolicy('calibrated', 'ai').ok, false);
    assert.equal(assertAiCalibrationPolicy('anchor', 'ai').ok, false);
    assert.equal(assertAiCalibrationPolicy('provisional', 'ai').ok, true);
  });

  it('generator schema rejects calibrated claim and targetLevel mutation', () => {
    const spec = GOOD_ITEMS[0].item.specification;
    const badCal = parseGeneratorOutput(
      spec,
      {
        stem: 'x',
        prompt: 'y',
        options: [
          { id: 'A', text: 'a', isCorrect: true },
          { id: 'B', text: 'b', isCorrect: false },
          { id: 'C', text: 'c', isCorrect: false },
          { id: 'D', text: 'd', isCorrect: false },
        ],
        correctAnswer: 'a',
        explanation: 'e',
        calibrationStatus: 'calibrated',
      },
      { id: 'g1', generationModel: 'test' },
    );
    assert.equal(badCal.ok, false);

    const badLevel = parseGeneratorOutput(
      spec,
      {
        stem: 'x',
        prompt: 'y',
        options: [
          { id: 'A', text: 'a', isCorrect: true },
          { id: 'B', text: 'b', isCorrect: false },
          { id: 'C', text: 'c', isCorrect: false },
          { id: 'D', text: 'd', isCorrect: false },
        ],
        correctAnswer: 'a',
        explanation: 'e',
        targetLevel: 'C2',
      },
      { id: 'g2', generationModel: 'test' },
    );
    assert.equal(badLevel.ok, false);
  });

  it('quality PASS + provisional → scored with evidenceWeight; experimental unscored by default', () => {
    const item = GOOD_ITEMS[0].item;
    const checks = runDeterministicChecks(item);
    const report = buildQualityReport({
      itemId: item.id,
      specificationId: item.specificationId,
      deterministicChecks: checks,
      semantic: {
        promptVersion: 'en_semantic_review_v1',
        verdict: 'pass',
        scores: {
          correctness: 0.9,
          unambiguity: 0.9,
          constructValidity: 0.9,
          levelPlausibility: 0.9,
          distractorQuality: 0.9,
          naturalness: 0.9,
          cueResistance: 0.9,
          contextIndependence: 0.9,
        },
        issues: [],
        suggestedAction: 'accept',
      },
      adversarial: {
        promptVersion: 'en_adversarial_review_v1',
        verdict: 'pass',
        broken: false,
        issues: [],
        attackNotes: [],
        suggestedAction: 'accept',
      },
    });
    assert.equal(report.qualityGate, 'PASS');
    const prov = decideScoringEligibility(report, 'provisional');
    assert.equal(prov.eligible, true);
    assert.ok(Math.abs(prov.evidenceWeight - 0.55) < 1e-9);

    const exp = decideScoringEligibility(report, 'experimental');
    assert.equal(exp.eligible, false);
    assert.equal(exp.isScored, false);
  });
});
