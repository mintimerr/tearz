import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_ASSESSMENT_CONFIG,
  applyAnswer,
  createAssessmentState,
  createItemFromSpec,
  defaultGuessingProbability,
  fisherInformation,
  probabilityCorrect,
  reliabilityForItem,
} from '../src/index.js';
import { correct, itemAt, timeout, wrong } from './helpers.js';

describe('unit basics', () => {
  it('prior EAP is near 0 and level probs sum to 1', () => {
    const state = createAssessmentState();
    assert.ok(Math.abs(state.theta) < 0.15);
    const sum = Object.values(state.levelProbabilities).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-6);
    assert.equal(DEFAULT_ASSESSMENT_CONFIG.cefrBandCalibrationStatus, 'provisional');
  });

  it('guessing defaults follow responseFormat + optionCount', () => {
    assert.equal(defaultGuessingProbability('singleChoice', 4), 0.25);
    assert.ok(Math.abs(defaultGuessingProbability('singleChoice', 3) - 1 / 3) < 1e-9);
    assert.ok(defaultGuessingProbability('freeText', undefined) < 0.05);
  });

  it('timeout uses soft weight and does not equal full incorrect jump', () => {
    let soft = createAssessmentState();
    let hard = createAssessmentState();
    const item = itemAt('A2', 0.5, 't1');
    soft = applyAnswer(soft, item, timeout()).state;
    hard = applyAnswer(hard, item, { correct: false, timedOut: false }).state;
    // Soft timeout should move theta less than a hard wrong (toward negative less aggressively).
    assert.ok(soft.theta > hard.theta, `timeout θ=${soft.theta} vs wrong θ=${hard.theta}`);
    assert.equal(soft.answerHistory[0].timedOut, true);
    const expectedWeight =
      DEFAULT_ASSESSMENT_CONFIG.timeoutResponseWeight *
      reliabilityForItem(item.calibrationStatus);
    assert.ok(
      Math.abs(soft.answerHistory[0].responseWeight - expectedWeight) < 1e-9,
      `responseWeight=${soft.answerHistory[0].responseWeight} expected=${expectedWeight}`,
    );
  });

  it('unscored experimental item does not change posterior', () => {
    let state = createAssessmentState();
    const before = [...state.posterior];
    const item = itemAt('C1', 0.5, 'exp', { isScored: false });
    state = applyAnswer(state, item, correct()).state;
    assert.deepEqual(state.posterior, before);
    assert.equal(state.answerHistory[0].posteriorInformationGain, 0);
    assert.equal(state.scoredAnswerCount, 0);
  });

  it('AnswerRecord separates fisherInformation and posteriorInformationGain', () => {
    let state = createAssessmentState();
    const item = itemAt('B1', 0.5, 'ig');
    const { record } = applyAnswer(state, item, correct());
    assert.ok(typeof record.fisherInformation === 'number');
    assert.ok(typeof record.posteriorInformationGain === 'number');
    // Fisher at prior mean for a B1 item should be positive.
    assert.ok(record.fisherInformation > 0);
  });

  it('posteriorInformationGain may be negative for a surprising response', () => {
    let state = createAssessmentState();
    // Build a high posterior, then miss an easy item — entropy can increase.
    for (let i = 0; i < 8; i += 1) {
      state = applyAnswer(state, itemAt('C2', 0.4 + i * 0.05, `hi-${i}`), correct()).state;
    }
    const beforeH = state.answerHistory.at(-1)?.posteriorInformationGain;
    assert.ok(typeof beforeH === 'number');
    const { record } = applyAnswer(state, itemAt('A1', 0.3, 'surprise-miss'), wrong());
    // Surprising miss often increases entropy → negative IG. Do not clamp.
    assert.ok(
      record.posteriorInformationGain < 0.05,
      `expected low/negative IG on surprise miss, got ${record.posteriorInformationGain}`,
    );
  });

  it('uses empirical when sampleSize met', async () => {
    const { resolveIrtParams } = await import('../src/irt.js');
    const item = createItemFromSpec({
      id: 'emp2',
      language: 'english',
      skill: 'grammar',
      construct: 'x',
      itemType: 'grammarForm',
      responseFormat: 'singleChoice',
      optionCount: 4,
      targetLevel: 'B1',
      difficultyWithinLevel: 0.5,
    });
    item.empiricalDifficulty = 1.8;
    item.empiricalDiscrimination = 1.5;
    item.sampleSize = 200;
    const params = resolveIrtParams(item);
    assert.equal(params.source, 'empirical');
    assert.equal(params.b, 1.8);
  });
});

describe('IRT sanity', () => {
  it('P(correct) increases with theta', () => {
    const low = probabilityCorrect(-2, 1.2, 0, 0.25);
    const high = probabilityCorrect(2, 1.2, 0, 0.25);
    assert.ok(high > low);
  });

  it('fisher peaks near b', () => {
    const near = fisherInformation(0.5, 1.2, 0.5, 0.25);
    const far = fisherInformation(-2.5, 1.2, 0.5, 0.25);
    assert.ok(near > far);
  });
});
