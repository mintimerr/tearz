/**
 * FINAL RELEASE HARDENING — P0 matrix + bank invariants + chaos harness.
 * Engineering reliability only — not psychometric calibration.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { loadBank, bankItemsToContentBank, verifyBankIntegrity } from '../../src/banks/loader.js';
import { validateBankManifestAndItems } from '../../src/banks/validate-invariants.js';
import { BANK_LANGUAGES, type BankLanguage } from '../../src/banks/types.js';
import {
  PlacementOrchestrationService,
  createMemoryAnalyticsSink,
  deterministicShuffleChoices,
  presentationShuffleSeed,
  recoverPlacementSession,
  replayFromSnapshot,
  serializeSnapshot,
  type PlacementContentItem,
} from '../../src/placement/index.js';

const CEFR = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

function contentFor(lang: BankLanguage): PlacementContentItem[] {
  return bankItemsToContentBank(loadBank(lang, 'v1').items);
}

function runSession(
  lang: BankLanguage,
  opts: {
    answer?: (q: { choices: string[]; id: string }, i: number) => { answer?: string; correct?: boolean; timedOut?: boolean };
    resumeAt?: number;
    doubleSubmitAt?: number;
    killAfterQ?: number;
  } = {},
) {
  const bank = contentFor(lang);
  const analytics = createMemoryAnalyticsSink();
  const throwingSink = (e: { name?: string }) => {
    analytics.sink(e as never);
    if (e?.name === 'placement_item_answered') {
      throw new Error('telemetry boom');
    }
  };
  let svc = new PlacementOrchestrationService({
    language: lang,
    contentBank: bank,
    analytics: throwingSink as never,
  });
  let step = svc.start();
  const presented: string[] = [];
  let i = 0;
  let killed = false;
  while (!step.done && i < 20) {
    if (!step.done) presented.push(step.question.id);
    if (opts.killAfterQ != null && i === opts.killAfterQ && !killed) {
      killed = true;
      const snap = svc.getSnapshot();
      svc = PlacementOrchestrationService.fromSnapshot(snap, {
        language: lang,
        contentBank: bank,
        analytics: throwingSink as never,
      });
      step = svc.presentNext();
      // fall through to answer the restored pending item
    }
    if (opts.resumeAt != null && i === opts.resumeAt) {
      const snap = serializeSnapshot(svc.getSnapshot());
      const restored = JSON.parse(snap);
      svc = PlacementOrchestrationService.fromSnapshot(restored, {
        language: lang,
        contentBank: bank,
        analytics: throwingSink as never,
      });
      step = svc.presentNext();
    }
    const ans =
      opts.answer?.(step.question, i) ??
      ({ answer: step.question.choices[0] } as const);
    const payload = { ...ans, itemId: step.question.id };
    const first = svc.answer(payload);
    if (opts.doubleSubmitAt === i) {
      const second = svc.answer(payload);
      assert.equal(
        first.snapshot.canonicalResponses?.length,
        second.snapshot.canonicalResponses?.length,
      );
      step = second;
    } else {
      step = first;
    }
    i += 1;
  }
  return { step, presented, svc, analytics };
}

describe('P0 bank integrity — all 1123 items', () => {
  let total = 0;
  for (const lang of BANK_LANGUAGES) {
    it(`${lang}: manifest + checksum + item invariants`, () => {
      const { manifest, items } = loadBank(lang, 'v1');
      total += items.length;
      const integrity = verifyBankIntegrity(manifest, items);
      assert.equal(integrity.ok, true, !integrity.ok ? integrity.reason : '');
      const inv = validateBankManifestAndItems(manifest, items);
      assert.equal(inv.ok, true, inv.issues.slice(0, 5).map((i) => `${i.code}:${i.itemId}`).join('; '));
      assert.ok(items.length >= 15);
      const ids = new Set(items.map((i) => i.id));
      assert.equal(ids.size, items.length);
    });
  }
  it('aggregate unique approved count is 1123', () => {
    let n = 0;
    for (const lang of BANK_LANGUAGES) n += loadBank(lang, 'v1').items.length;
    assert.equal(n, 1123);
  });
});

describe('P0 production path per language', () => {
  for (const lang of BANK_LANGUAGES) {
    it(`${lang}: fresh 15Q offline completes, mint=0`, () => {
      let mint = 0;
      const svc = new PlacementOrchestrationService({
        language: lang,
        contentBank: contentFor(lang),
        mintFallback: () => {
          mint += 1;
          return null;
        },
      });
      let step = svc.start();
      const seen = new Set<string>();
      for (let i = 0; i < 15 && !step.done; i += 1) {
        assert.equal(step.done, false);
        assert.ok(!seen.has(step.question.id));
        seen.add(step.question.id);
        step = svc.answer({ answer: step.question.choices[0] });
      }
      assert.equal(step.done, true);
      assert.equal(mint, 0);
      if (step.done) {
        assert.equal(step.snapshot.canonicalResponses.length, 15);
        assert.ok(CEFR.has(step.result.level));
        assert.ok(Number.isFinite(step.result.theta ?? NaN) || step.result.theta == null);
        assert.ok(step.record.level);
        assert.equal(step.snapshot.status, 'completed');
      }
    });

    it(`${lang}: all-correct + all-wrong + timeouts finite`, () => {
      for (const mode of ['allCorrect', 'allWrong', 'timeouts'] as const) {
        const { step } = runSession(lang, {
          answer: (_q, _i) => {
            if (mode === 'timeouts') return { timedOut: true };
            if (mode === 'allCorrect') return { correct: true };
            return { correct: false };
          },
        });
        assert.equal(step.done, true);
        if (step.done) {
          assert.ok(CEFR.has(step.result.level));
          assert.ok(Number.isFinite(step.result.score));
          const probs = step.result.levelProbabilities;
          if (probs) {
            const sum = Object.values(probs).reduce((a, b) => a + (b as number), 0);
            assert.ok(Math.abs(sum - 1) < 0.05 || sum === 0);
            for (const v of Object.values(probs)) assert.ok(Number.isFinite(v as number));
          }
        }
      }
    });
  }
});

describe('P0 double-submit / Q15 idempotency', () => {
  for (const lang of ['en', 'zh'] as BankLanguage[]) {
    it(`${lang}: double answer mid-session does not double canonical`, () => {
      const { step } = runSession(lang, { doubleSubmitAt: 3 });
      assert.equal(step.done, true);
      if (step.done) {
        assert.equal(step.snapshot.canonicalResponses.length, 15);
        const qns = step.snapshot.canonicalResponses.map((r) => r.questionNumber);
        assert.equal(new Set(qns).size, qns.length);
      }
    });

    it(`${lang}: Q15 double finalize returns same record`, () => {
      const bank = contentFor(lang);
      const svc = new PlacementOrchestrationService({ language: lang, contentBank: bank });
      let step = svc.start();
      for (let i = 0; i < 14 && !step.done; i += 1) {
        step = svc.answer({ correct: i % 2 === 0, itemId: step.question.id });
      }
      assert.equal(step.done, false);
      const a = svc.answer({ correct: true, itemId: step.question.id });
      assert.equal(a.done, true);
      const b = svc.answer({ correct: false, itemId: step.question.id });
      assert.equal(b.done, true);
      if (a.done && b.done) {
        assert.equal(a.record.level, b.record.level);
        assert.equal(a.snapshot.canonicalResponses.length, 15);
        assert.equal(b.snapshot.canonicalResponses.length, 15);
        assert.equal(a.result.level, b.result.level);
      }
    });

    it(`${lang}: kill/restart after Q14 then finish once`, () => {
      const { step } = runSession(lang, { killAfterQ: 14 });
      assert.equal(step.done, true);
      if (step.done) assert.equal(step.snapshot.canonicalResponses.length, 15);
    });
  }
});

describe('P0 corrupt session recovery', () => {
  const bank = contentFor('en');
  const ids = new Set(bank.map((c) => c.item.id));

  it('invalid JSON → clearSession', () => {
    const r = recoverPlacementSession('{not json', { language: 'en', knownItemIds: ids });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.clearSession, true);
  });

  it('missing fields → clearSession', () => {
    const r = recoverPlacementSession(JSON.stringify({ sessionId: 'x' }), {
      language: 'en',
      knownItemIds: ids,
    });
    assert.equal(r.ok, false);
  });

  it('item missing from bank → clearSession', () => {
    const svc = new PlacementOrchestrationService({ language: 'en', contentBank: bank });
    let step = svc.start();
    step = svc.answer({ correct: true });
    const snap = svc.getSnapshot();
    snap.pendingItemId = 'ghost-item-gone';
    snap.presentedItemIds = [...snap.presentedItemIds, 'ghost-item-gone'];
    const r = recoverPlacementSession(serializeSnapshot(snap), {
      language: 'en',
      knownItemIds: ids,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.reason, /missing_from_bank/);
  });

  it('impossible questionNumber → clearSession', () => {
    const svc = new PlacementOrchestrationService({ language: 'en', contentBank: bank });
    svc.start();
    const snap = svc.getSnapshot();
    snap.questionNumber = 99;
    const r = recoverPlacementSession(serializeSnapshot(snap), {
      language: 'en',
      knownItemIds: ids,
    });
    assert.equal(r.ok, false);
  });

  it('valid active session recovers', () => {
    const svc = new PlacementOrchestrationService({ language: 'en', contentBank: bank });
    svc.start();
    const snap = svc.getSnapshot();
    const r = recoverPlacementSession(serializeSnapshot(snap), {
      language: 'en',
      knownItemIds: ids,
    });
    assert.equal(r.ok, true);
  });

  it('completed status not treated as active resume', () => {
    const { step } = runSession('en');
    assert.equal(step.done, true);
    if (!step.done) return;
    const r = recoverPlacementSession(serializeSnapshot(step.snapshot), {
      language: 'en',
      knownItemIds: ids,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'status_completed');
  });
});

describe('P0 bank exhaustion fail-safe', () => {
  it('empty bank fails without mint/LLM', () => {
    const svc = new PlacementOrchestrationService({ language: 'en', contentBank: [] });
    assert.throws(() => svc.start(), /no selectable candidate/);
  });

  it('tiny bank (5 items) fails safely after exhaustion', () => {
    const thin = contentFor('en').slice(0, 5);
    const svc = new PlacementOrchestrationService({ language: 'en', contentBank: thin });
    let answered = 0;
    let failed = false;
    try {
      let step = svc.start();
      while (!step.done && answered < 20) {
        step = svc.answer({ correct: true });
        answered += 1;
      }
    } catch (e) {
      failed = true;
      assert.match(String(e), /no selectable candidate|bank|selectable/i);
    }
    assert.ok(failed || answered <= 5);
  });
});

describe('P0 choice shuffle property', () => {
  it('many seeds: deterministic + preserves choices', () => {
    const items = loadBank('en', 'v1').items.slice(0, 40);
    let varied = 0;
    for (const item of items) {
      const base = { choices: item.choices, correctChoice: item.correctChoice };
      const orders = new Set<string>();
      for (let s = 0; s < 20; s += 1) {
        const seed = presentationShuffleSeed(`sess_${s}`, item.id, (s % 15) + 1);
        const a = deterministicShuffleChoices(base, seed);
        const b = deterministicShuffleChoices(base, seed);
        assert.deepEqual(a.choices, b.choices);
        assert.equal(a.correctChoice, base.correctChoice);
        assert.equal(a.choices.length, base.choices.length);
        assert.equal(new Set(a.choices).size, new Set(base.choices).size);
        assert.ok(a.choices.includes(a.correctChoice));
        // Correctness independent of index
        const idx = a.choices.indexOf(a.correctChoice);
        assert.ok(idx >= 0);
        orders.add(a.choices.join('|'));
      }
      if (orders.size > 1) varied += 1;
    }
    assert.ok(varied > 0, 'different seeds should vary order for some items');
  });
});

describe('P0 telemetry never blocks', () => {
  it('throwing analytics still completes session', () => {
    const { step } = runSession('fr');
    assert.equal(step.done, true);
  });
});

describe('P0 result replay idempotent', () => {
  it('replayFromSnapshot matches finalize', () => {
    const { step } = runSession('de');
    assert.equal(step.done, true);
    if (!step.done) return;
    const replayed = replayFromSnapshot(step.snapshot);
    assert.equal(replayed.record.level, step.record.level);
    assert.equal(replayed.result.verifiedPlacementLevel, step.record.level);
  });
});

describe('P1 synthetic result sanity (no retune)', () => {
  const profiles: Array<{ name: string; fn: (i: number) => boolean | 'timeout' }> = [
    { name: 'veryWeak', fn: () => false },
    { name: 'veryStrong', fn: () => true },
    { name: 'random', fn: (i) => i % 3 !== 0 },
    { name: 'timeouts', fn: () => 'timeout' },
  ];
  for (const p of profiles) {
    it(`profile ${p.name}`, () => {
      const { step } = runSession('en', {
        answer: (_q, i) => {
          const v = p.fn(i);
          if (v === 'timeout') return { timedOut: true };
          return { correct: v };
        },
      });
      assert.equal(step.done, true);
      if (step.done) {
        assert.ok(CEFR.has(step.result.level));
        assert.ok(Number.isFinite(step.result.score));
        assert.ok(!Number.isNaN(step.result.score));
      }
    });
  }
});

describe('P0 chaos 5000 sessions (1000×5 langs)', () => {
  it('deterministic fuzz — 0 critical failures', () => {
    const PER_LANG = 1000;
    let critical = 0;
    const firstErrors: string[] = [];
    const report: Record<string, { ok: number; fail: number }> = {};
    for (const lang of BANK_LANGUAGES) {
      report[lang] = { ok: 0, fail: 0 };
      const bank = contentFor(lang);
      for (let s = 0; s < PER_LANG; s += 1) {
        try {
          const seed = (s * 1103515245 + lang.charCodeAt(0) * 12345) >>> 0;
          let svc = new PlacementOrchestrationService({
            language: lang,
            contentBank: bank,
            sessionId: `chaos_${lang}_${s}`,
          });
          let step = svc.start();
          const answeredIds = new Set<string>();
          for (let q = 0; q < 20 && !step.done; q += 1) {
            if (step.done) break;
            const qid = step.question.id;
            if (answeredIds.has(qid)) throw new Error('duplicate presentation of answered item');

            const roll = (seed + q * 9973) % 100;
            if (roll === 7 && q > 0 && q < 12) {
              svc = PlacementOrchestrationService.fromSnapshot(svc.getSnapshot(), {
                language: lang,
                contentBank: bank,
              });
              step = svc.presentNext();
              if (step.done) break;
            }

            const ans =
              roll % 11 === 0
                ? { timedOut: true as const, itemId: step.question.id }
                : { correct: ((seed >> (q % 16)) & 1) === 1, itemId: step.question.id };
            const a1 = svc.answer(ans);
            if (roll % 17 === 0) {
              const a2 = svc.answer(ans);
              if (
                a1.snapshot.canonicalResponses.length !==
                a2.snapshot.canonicalResponses.length
              ) {
                throw new Error('double-submit changed canonical length');
              }
              step = a2;
            } else {
              step = a1;
            }
            answeredIds.add(qid);
          }
          if (!step.done) throw new Error('did not complete');
          if (step.snapshot.canonicalResponses.length !== 15) {
            throw new Error(`scored=${step.snapshot.canonicalResponses.length}`);
          }
          const qns = step.snapshot.canonicalResponses.map((r) => r.questionNumber);
          if (new Set(qns).size !== qns.length) throw new Error('dup questionNumber');
          if (!CEFR.has(step.result.level)) throw new Error('bad CEFR');
          if (!Number.isFinite(step.result.score)) throw new Error('NaN score');
          if (step.snapshot.status !== 'completed') throw new Error('not completed');
          const again = svc.answer({ correct: true, itemId: 'already-done' });
          if (!again.done || again.result.level !== step.result.level) {
            throw new Error('finalize not idempotent');
          }
          report[lang]!.ok += 1;
        } catch (e) {
          report[lang]!.fail += 1;
          critical += 1;
          if (firstErrors.length < 8) {
            firstErrors.push(`${lang}#${s}:${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }
    }
    const total = BANK_LANGUAGES.length * PER_LANG;
    assert.equal(
      critical,
      0,
      `critical=${critical}/${total} report=${JSON.stringify(report)} errors=${firstErrors.join(' | ')}`,
    );
  });
});
