/**
 * Old-user / skip-path / offline matrix coverage (app-layer + assessment).
 * Run: npx tsx --test services/placement-release-compat.test.ts
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildLearnerModel } from './learner-model';
import type { PlacementRecord } from '../types/placement-api';
import { isBankFirstProduction, getPlacementProductionFlags } from '../utils/placement-production-flags';

describe('P0 production flags hard-lock', () => {
  it('phase-2: v1 bank + no runtime LLM + no procedural mint', () => {
    const f = getPlacementProductionFlags();
    assert.equal(f.deliveryMode, 'bank_first');
    assert.equal(f.contentBankSource, 'v1');
    assert.equal(f.allowRuntimeLlmGeneration, false);
    assert.equal(f.allowProceduralMint, false);
    assert.equal(isBankFirstProduction(), true);
  });
});

describe('P0 old-user migration / skip path', () => {
  it('legacy score-based PlacementRecord without skillProfile builds LearnerModel', () => {
    const old: PlacementRecord = {
      completedAt: Date.now() - 86400000,
      language: 'english',
      level: 'B1',
      score: 62,
    };
    const model = buildLearnerModel({ placementRecord: old });
    assert.ok(model);
    assert.equal(model!.overallLevel, 'B1');
    assert.equal(model!.placement.skillProfile, undefined);
    assert.equal(model!.placement.assessmentSessionId, undefined);
  });

  it('skip-test A1 record builds LearnerModel (no crash)', () => {
    const skipped: PlacementRecord = {
      completedAt: Date.now(),
      language: 'english',
      level: 'A1',
      score: 0,
    };
    const model = buildLearnerModel({ placementRecord: skipped });
    assert.ok(model);
    assert.equal(model!.overallLevel, 'A1');
  });

  it('old user with TeacherGoal + legacy level keeps level', () => {
    const model = buildLearnerModel({
      placementRecord: {
        completedAt: 1,
        language: 'french',
        level: 'A2',
        score: 40,
      },
      teacherGoal: { title: 'Travel to Paris', targetDate: Date.now() + 1e8, createdAt: Date.now() },
    });
    assert.ok(model);
    assert.equal(model!.overallLevel, 'A2');
    assert.equal(model!.goal?.title, 'Travel to Paris');
  });

  it('invalid CEFR falls back to A1 without crash', () => {
    const model = buildLearnerModel({
      placementRecord: {
        completedAt: 1,
        language: 'german',
        level: 'XX' as never,
        score: 10,
      },
    });
    assert.ok(model);
    assert.equal(model!.overallLevel, 'A1');
  });

  it('null placement → null LearnerModel (skip incomplete)', () => {
    assert.equal(buildLearnerModel({ placementRecord: null }), null);
  });
});
