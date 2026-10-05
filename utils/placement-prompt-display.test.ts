/**
 * Run: node --experimental-strip-types --test utils/placement-prompt-display.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  splitClozeRuns,
  splitPlacementPromptForDisplay,
} from './placement-prompt-display.ts';

describe('splitPlacementPromptForDisplay', () => {
  it('keeps cloze stems as a single ask', () => {
    const parts = splitPlacementPromptForDisplay('Eden suggested that we ___ the survey.');
    assert.equal(parts.passage, null);
    assert.match(parts.ask, /___/);
  });

  it('splits Chinese scenario + short ask', () => {
    const parts = splitPlacementPromptForDisplay(
      '相关方要求今天就试点范围公开发表声。你需要法务审阅。你说？',
    );
    assert.ok(parts.passage);
    assert.match(parts.passage!, /法务审阅/);
    assert.equal(parts.ask, '你说？');
  });

  it('splits quote passage + trailing question', () => {
    const parts = splitPlacementPromptForDisplay(
      '告示：「午餐休息 13:00–14:00 不营业。」什么时候可以买东西？',
    );
    assert.ok(parts.passage?.includes('告示'));
    assert.match(parts.ask, /什么时候/);
  });
});

describe('splitClozeRuns', () => {
  it('marks blank runs', () => {
    const runs = splitClozeRuns('I ____ water.');
    assert.deepEqual(
      runs.map((r) => r.type),
      ['text', 'blank', 'text'],
    );
  });
});
