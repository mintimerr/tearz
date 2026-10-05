/**
 * Phase-2 smoke: bundled v1 banks load and convert to content items.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { loadBundledContentBank, loadBundledBank } from '../../src/banks/load.js';

const LANGS = ['english', 'russian', 'chinese', 'french', 'german'] as const;

describe('P0 v1 bundled banks', () => {
  for (const lang of LANGS) {
    it(`${lang}: loads PASS items into content bank`, () => {
      const pack = loadBundledBank(lang, 'v1');
      assert.ok(pack, `missing pack for ${lang}`);
      assert.ok(pack!.items.length >= 150, `${lang} too small: ${pack!.items.length}`);
      const bank = loadBundledContentBank(lang, 'v1');
      assert.equal(bank.length, pack!.items.length);
      const sample = bank[0]!;
      assert.ok(sample.payload.prompt.trim().length > 0);
      assert.ok(sample.payload.choices.length >= 2);
      assert.ok(sample.payload.choices.includes(sample.payload.correctChoice));
      assert.equal(sample.qualityGate, 'PASS');
      assert.equal(sample.eligible, true);
    });
  }
});
