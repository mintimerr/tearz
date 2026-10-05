/**
 * LearnerModel bridge tests — run:
 *   npx tsx --test services/learner-model.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { TeacherGoal } from '../hooks/use-teacher-goal';
import type { PlacementRecord } from '../types/placement-api';
import {
  buildLearnerModel,
  compactLearnerContextHasForbiddenKeys,
  formatLearnerContextForAI,
  toCompactLearnerContext,
  updateLearnerModelFromActivity,
} from './learner-model';

function baseRecord(overrides: Partial<PlacementRecord> = {}): PlacementRecord {
  return {
    completedAt: 1,
    language: 'english',
    level: 'B1',
    score: 55,
    ...overrides,
  };
}

describe('LearnerModel bridge', () => {
  it('1. B1 PlacementRecord → overallLevel B1', () => {
    const model = buildLearnerModel({ placementRecord: baseRecord({ level: 'B1' }) });
    assert.ok(model);
    assert.equal(model!.overallLevel, 'B1');
  });

  it('2. statisticalEstimate B2 + verified level B1 → overallLevel B1', () => {
    const model = buildLearnerModel({
      placementRecord: baseRecord({
        level: 'B1',
        statisticalEstimate: 'B2',
        score: 80,
      }),
    });
    assert.ok(model);
    assert.equal(model!.overallLevel, 'B1');
    assert.notEqual(model!.overallLevel, 'B2');
  });

  it('3. skillProfile persists into LearnerModel', () => {
    const model = buildLearnerModel({
      placementRecord: baseRecord({
        skillProfile: {
          grammar: { attempts: 3, correct: 2, estimatedTheta: -0.4, evidenceStrength: 0.6 },
          vocabulary: { attempts: 1, correct: 1, estimatedTheta: 0.2, evidenceStrength: 0.2 },
        },
      }),
    });
    assert.ok(model?.placement.skillProfile?.grammar);
    assert.equal(model!.placement.skillProfile!.grammar.evidenceCount, 3);
    assert.equal(model!.placement.skillProfile!.grammar.levelEstimate, 'B1');
    // Weak vocab evidence: count only, no false band claim required
    assert.equal(model!.placement.skillProfile!.vocabulary.evidenceCount, 1);
    assert.equal(model!.placement.skillProfile!.vocabulary.levelEstimate, undefined);
  });

  it('4. missing skillProfile works', () => {
    const model = buildLearnerModel({ placementRecord: baseRecord() });
    assert.ok(model);
    assert.equal(model!.placement.skillProfile, undefined);
  });

  it('5. missing confidence works', () => {
    const model = buildLearnerModel({
      placementRecord: baseRecord({ confidence: undefined, confidenceLabel: undefined }),
    });
    assert.ok(model);
    assert.equal(model!.placement.confidence, undefined);
    const text = formatLearnerContextForAI(model);
    assert.match(text, /Starting overall level: B1/);
  });

  it('6. TeacherGoal included', () => {
    const goal: TeacherGoal = {
      title: 'study at university in China',
      targetDate: Date.parse('2027-02-01T00:00:00.000Z'),
      createdAt: 1,
    };
    const model = buildLearnerModel({ placementRecord: baseRecord(), teacherGoal: goal });
    assert.equal(model!.goal?.title, 'study at university in China');
    assert.equal(model!.goal?.targetDate, '2027-02-01');
  });

  it('7. missing TeacherGoal works', () => {
    const model = buildLearnerModel({ placementRecord: baseRecord(), teacherGoal: null });
    assert.ok(model);
    assert.equal(model!.goal, undefined);
  });

  it('8. learner AI context contains level', () => {
    const model = buildLearnerModel({ placementRecord: baseRecord({ level: 'B1' }) });
    const text = formatLearnerContextForAI(model);
    assert.match(text, /Starting overall level: B1/);
  });

  it('9. learner AI context contains available skills', () => {
    const model = buildLearnerModel({
      placementRecord: baseRecord({
        confidenceLabel: 'medium',
        skillProfile: {
          grammar: { attempts: 3, correct: 2, estimatedTheta: -0.4, evidenceStrength: 0.6 },
          functional: { attempts: 2, correct: 2, estimatedTheta: 0.6, evidenceStrength: 0.5 },
        },
      }),
    });
    const text = formatLearnerContextForAI(model);
    assert.match(text, /Skill evidence:/);
    assert.match(text, /grammar: B1/);
    assert.match(text, /functional communication/);
  });

  it('10. learner AI context contains goal', () => {
    const model = buildLearnerModel({
      placementRecord: baseRecord(),
      teacherGoal: {
        title: 'Prepare for university study in China',
        targetDate: Date.parse('2027-02-01T00:00:00.000Z'),
        createdAt: 1,
      },
    });
    const text = formatLearnerContextForAI(model);
    assert.match(text, /Current goal:/);
    assert.match(text, /Prepare for university study in China/);
    assert.match(text, /2027-02-01/);
  });

  it('11. learner AI context does not contain posterior grid', () => {
    const model = buildLearnerModel({
      placementRecord: baseRecord({
        levelProbabilities: { A1: 0.1, A2: 0.1, B1: 0.5, B2: 0.2, C1: 0.05, C2: 0.05 },
      }),
    });
    const text = formatLearnerContextForAI(model);
    const compact = toCompactLearnerContext(model)!;
    assert.equal(text.includes('posterior'), false);
    assert.equal(text.includes('thetaGrid'), false);
    assert.equal('levelProbabilities' in compact, false);
    assert.deepEqual(compactLearnerContextHasForbiddenKeys(compact), []);
  });

  it('12. learner AI context does not contain canonical responses', () => {
    const model = buildLearnerModel({ placementRecord: baseRecord() });
    const text = formatLearnerContextForAI(model);
    const compact = toCompactLearnerContext(model)!;
    assert.equal(text.includes('canonical'), false);
    assert.equal('canonicalResponses' in compact, false);
  });

  it('13. old PlacementRecord remains compatible', () => {
    const old: PlacementRecord = {
      completedAt: 1,
      language: 'chinese',
      level: 'A2',
      score: 30,
    };
    const model = buildLearnerModel({ placementRecord: old });
    assert.ok(model);
    assert.equal(model!.overallLevel, 'A2');
    assert.equal(model!.targetLanguage, 'chinese');
    assert.equal(model!.placement.theta, undefined);
    assert.equal(model!.placement.confidence, undefined);
    assert.equal(model!.placement.skillProfile, undefined);
    assert.equal(model!.placement.assessmentSessionId, undefined);
  });

  it('14. teacher request receives learner context (compact shape)', () => {
    const model = buildLearnerModel({
      placementRecord: baseRecord({
        confidenceLabel: 'medium',
        skillProfile: {
          grammar: { attempts: 3, correct: 2, estimatedTheta: -0.4, evidenceStrength: 0.6 },
        },
      }),
      teacherGoal: { title: 'HSK', targetDate: null, createdAt: 1 },
    });
    const learnerContext = toCompactLearnerContext(model);
    const teacherRequest = {
      message: 'hello',
      conversationHistory: [],
      learnerLevel: model!.overallLevel,
      learnerContext,
    };
    assert.equal(teacherRequest.learnerLevel, 'B1');
    assert.equal(teacherRequest.learnerContext?.overallLevel, 'B1');
    assert.equal(teacherRequest.learnerContext?.confidenceLabel, 'medium');
    assert.ok(teacherRequest.learnerContext?.skillProfile?.grammar);
    assert.equal(teacherRequest.learnerContext?.goal?.title, 'HSK');
    assert.deepEqual(compactLearnerContextHasForbiddenKeys(teacherRequest.learnerContext), []);
  });

  it('15. exercise request receives starting level', () => {
    const model = buildLearnerModel({ placementRecord: baseRecord({ level: 'B2' }) });
    const exerciseRequest = {
      explanation: '…',
      conversationHistory: [],
      learnerLevel: model!.overallLevel,
      learnerContext: toCompactLearnerContext(model),
    };
    assert.equal(exerciseRequest.learnerLevel, 'B2');
    assert.equal(exerciseRequest.learnerContext?.overallLevel, 'B2');
  });

  it('updateLearnerModelFromActivity is a no-op stub', () => {
    const model = buildLearnerModel({ placementRecord: baseRecord() })!;
    const next = updateLearnerModelFromActivity(model, { kind: 'drill', correct: true });
    assert.equal(next.overallLevel, model.overallLevel);
    assert.equal(next, model);
  });
});
