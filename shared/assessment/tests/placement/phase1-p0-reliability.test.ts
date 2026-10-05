/**
 * Phase-1 P0 placement reliability — synthetic bank only (no v1 package required).
 * Covers: Q15 resume, stale itemId, finalize idempotency, corrupt session recovery.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  PlacementOrchestrationService,
  contentFromLegacyBankQuestion,
  recoverPlacementSession,
  serializeSnapshot,
  type PlacementContentItem,
} from '../../src/placement/index.js';

function fatBank(): PlacementContentItem[] {
  const out: PlacementContentItem[] = [];
  for (let i = 0; i < 48; i += 1) {
    const c = contentFromLegacyBankQuestion(
      {
        id: `synth-${i}`,
        kind: 'multiple_choice',
        section: 'grammar',
        difficulty: 1 + (i % 25),
        instruction: 'Choose',
        prompt: `Synthetic prompt ${i}?`,
        choices: ['a', 'b', 'c', 'd'],
        correctChoice: 'a',
        language: 'english',
      },
      { qualityGate: 'PASS' },
    );
    if (c) out.push(c);
  }
  return out;
}

describe('P0 Q15 resume before finalize', () => {
  it('kill on unanswered Q15 re-presents that item instead of finalizing', () => {
    const bank = fatBank();
    let svc = new PlacementOrchestrationService({ language: 'en', contentBank: bank });
    let step = svc.start();
    for (let i = 0; i < 14; i += 1) {
      assert.equal(step.done, false);
      step = svc.answer({ answer: step.question.choices[0], itemId: step.question.id });
    }
    assert.equal(step.done, false);
    const q15Id = step.question.id;
    const snap = svc.getSnapshot();
    svc = PlacementOrchestrationService.fromSnapshot(snap, { language: 'en', contentBank: bank });
    step = svc.presentNext();
    assert.equal(step.done, false);
    assert.equal(step.question.id, q15Id);
    step = svc.answer({ answer: step.question.choices[0], itemId: q15Id });
    assert.equal(step.done, true);
  });
});

describe('P0 stale itemId / double-submit', () => {
  it('stale itemId does not score the next question', () => {
    const bank = fatBank();
    const svc = new PlacementOrchestrationService({ language: 'en', contentBank: bank });
    let step = svc.start();
    assert.equal(step.done, false);
    const firstId = step.question.id;
    step = svc.answer({ answer: step.question.choices[0], itemId: firstId });
    assert.equal(step.done, false);
    const secondId = step.question.id;
    const beforeLen = svc.getSnapshot().canonicalResponses.length;
    const stale = svc.answer({ answer: step.question.choices[0], itemId: firstId });
    assert.equal(stale.done, false);
    assert.equal(stale.question.id, secondId);
    assert.equal(svc.getSnapshot().canonicalResponses.length, beforeLen);
    step = svc.answer({ answer: step.question.choices[0], itemId: secondId });
    assert.equal(svc.getSnapshot().canonicalResponses.length, beforeLen + 1);
  });

  it('Q15 finalize is idempotent', () => {
    const bank = fatBank();
    const svc = new PlacementOrchestrationService({ language: 'en', contentBank: bank });
    let step = svc.start();
    while (!step.done) {
      step = svc.answer({ answer: step.question.choices[0], itemId: step.question.id });
    }
    const again = svc.answer({ answer: 'a', itemId: 'whatever' });
    assert.equal(again.done, true);
    assert.equal(again.result.level, step.result.level);
  });
});

describe('P0 session recovery', () => {
  it('clears corrupt JSON', () => {
    const r = recoverPlacementSession('{not json', {
      language: 'en',
      knownItemIds: new Set(['a']),
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.clearSession, true);
  });

  it('accepts a valid active snapshot', () => {
    const bank = fatBank();
    const svc = new PlacementOrchestrationService({ language: 'en', contentBank: bank });
    let step = svc.start();
    step = svc.answer({ answer: step.question.choices[0], itemId: step.question.id });
    const raw = serializeSnapshot(svc.getSnapshot());
    const ids = new Set(bank.map((c) => c.item.id));
    const r = recoverPlacementSession(raw, { language: 'en', knownItemIds: ids });
    assert.equal(r.ok, true);
  });

  it('rejects completed status for mid-flow resume', () => {
    const bank = fatBank();
    const svc = new PlacementOrchestrationService({ language: 'en', contentBank: bank });
    let step = svc.start();
    while (!step.done) {
      step = svc.answer({ answer: step.question.choices[0], itemId: step.question.id });
    }
    const raw = serializeSnapshot(svc.getSnapshot());
    const ids = new Set(bank.map((c) => c.item.id));
    const r = recoverPlacementSession(raw, { language: 'en', knownItemIds: ids });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.reason, /status_completed/);
  });
});
