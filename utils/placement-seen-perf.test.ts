/**
 * Guard: isQuestionAlreadySeen must stay fast on large lifetime avoid-lists.
 * Run: npx tsx --test utils/placement-seen-perf.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildSeenQuestionKeys,
  isQuestionAlreadySeen,
  setPlacementSlotMaskTokens,
} from './placement-seen.ts';

describe('isQuestionAlreadySeen performance', () => {
  it('does not hang on large lifetime prompt lists', () => {
    setPlacementSlotMaskTokens(
      Array.from({ length: 200 }, (_, i) => `TokenName${i}`).concat([
        'the office',
        'on Tuesday evening',
        'survey',
      ]),
    );
    const history = Array.from({ length: 600 }, (_, i) => ({
      section: 'grammar',
      difficulty: 40,
      correct: true,
      prompt: `Alex went to place ${i} on Tuesday evening.`,
      questionId: `hist-${i}`,
      choices: ['a', 'b', 'c', 'd'],
    }));
    const seen = buildSeenQuestionKeys(history);
    const q = {
      id: 'fresh-1',
      prompt: 'Eden suggested that we ___ the survey before on Tuesday evening.',
      choices: ['review', 'reviews', 'reviewing', 'reviewed'],
    };
    const t0 = Date.now();
    const hit = isQuestionAlreadySeen(q, seen);
    const ms = Date.now() - t0;
    assert.equal(hit, false);
    assert.ok(ms < 50, `expected <50ms, got ${ms}ms`);
  });
});
