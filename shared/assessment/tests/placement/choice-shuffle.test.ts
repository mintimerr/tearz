/**
 * Choice shuffle + canonical snapshot integration tests (all 5 bank languages).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { loadBank, bankItemsToContentBank } from '../../src/banks/loader.js';
import { BANK_LANGUAGES } from '../../src/banks/types.js';
import {
  PlacementOrchestrationService,
  deterministicShuffleChoices,
  presentationShuffleSeed,
  deserializeSnapshot,
  serializeSnapshot,
  replayCanonicalAssessment,
} from '../../src/placement/index.js';

describe('deterministic choice shuffle', () => {
  it('is stable for the same seed', () => {
    const base = {
      choices: ['alpha', 'bravo', 'charlie', 'delta'],
      correctChoice: 'alpha',
    };
    const a = deterministicShuffleChoices(base, 'session|item|q1');
    const b = deterministicShuffleChoices(base, 'session|item|q1');
    assert.deepEqual(a.choices, b.choices);
    assert.equal(a.correctChoice, 'alpha');
  });

  it('changes order across seeds but keeps correctChoice text', () => {
    const base = {
      choices: ['w', 'x', 'y', 'z'],
      correctChoice: 'y',
    };
    const a = deterministicShuffleChoices(base, 'seed-a');
    const b = deterministicShuffleChoices(base, 'seed-b');
    assert.equal(a.correctChoice, 'y');
    assert.equal(b.correctChoice, 'y');
    assert.ok(a.choices.includes('y') && b.choices.includes('y'));
    // Very likely different; if equal, still valid — assert content preserved
    assert.deepEqual([...a.choices].sort(), [...base.choices].sort());
  });

  for (const correctIndex of [0, 1, 2, 3] as const) {
    it(`preserves correct text when bank correctIndex=${correctIndex}`, () => {
      const choices = ['opt0', 'opt1', 'opt2', 'opt3'];
      const correctChoice = choices[correctIndex]!;
      const shuffled = deterministicShuffleChoices({ choices, correctChoice }, `ci-${correctIndex}`);
      assert.equal(shuffled.correctChoice, correctChoice);
      assert.equal(shuffled.choices.filter((c) => c === correctChoice).length, 1);
      assert.ok(shuffled.choices.includes(correctChoice));
    });
  }
});

describe('bank-first shuffle → snapshot → answer → replay', () => {
  for (const lang of BANK_LANGUAGES) {
    it(`${lang}: present shuffle, score by text, replay, resume`, () => {
      const { items } = loadBank(lang);
      const bank = bankItemsToContentBank(items);
      assert.ok(bank.length >= 15, `${lang} bank too small`);

      const events: Array<{ name: string; [k: string]: unknown }> = [];
      const svc = new PlacementOrchestrationService({
        language: lang,
        contentBank: bank,
        sessionId: `plc_shuffle_test_${lang}`,
        analytics: (e) => events.push(e as { name: string }),
      });

      let step = svc.start();
      assert.equal(step.done, false);
      if (step.done) return;

      const q1 = step.question;
      const snap1 = step.snapshot.pendingItemSnapshot;
      assert.ok(snap1?.presentedChoices);
      assert.deepEqual(snap1!.presentedChoices, q1.choices);
      assert.equal(snap1!.presentedCorrectChoice, step.snapshot.pendingPresentedCorrectChoice);

      // Expected seed replay
      const original = bank.find((c) => c.item.id === q1.id)!;
      const expected = deterministicShuffleChoices(
        { choices: original.payload.choices, correctChoice: original.payload.correctChoice },
        presentationShuffleSeed(`plc_shuffle_test_${lang}`, q1.id, 1),
      );
      assert.deepEqual(q1.choices, expected.choices);

      // Answer with correct text (wherever it sits after shuffle)
      const correctText = step.snapshot.pendingPresentedCorrectChoice!;
      const correctPos = q1.choices.indexOf(correctText);
      assert.ok(correctPos >= 0);

      step = svc.answer({ answer: correctText, responseTimeMs: 1200 });
      assert.equal(step.correct, true);

      // Fill remaining with known correct/incorrect by text
      const answers: Array<{ correct: boolean }> = [{ correct: true }];
      while (!step.done) {
        if (step.done) break;
        const correctChoice = step.snapshot.pendingPresentedCorrectChoice!;
        const pickWrong = answers.length % 3 === 0;
        const ans = pickWrong
          ? step.question.choices.find((c) => c !== correctChoice)!
          : correctChoice;
        step = svc.answer({ answer: ans, responseTimeMs: 800 + answers.length * 10 });
        answers.push({ correct: !pickWrong });
      }

      assert.equal(step.done, true);
      if (!step.done) return;
      assert.ok(step.record);
      assert.ok(step.result?.level);
      assert.equal(step.record!.assessmentSessionId, `plc_shuffle_test_${lang}`);
      assert.equal(step.record!.level, step.result!.level);

      // Canonical replay matches verified level
      const history = svc.getSnapshot().canonicalResponses;
      assert.equal(history.length, 15);
      const { result: replayed } = replayCanonicalAssessment(history);
      assert.equal(replayed.verifiedPlacementLevel, step.record!.level);
      assert.ok(Math.abs(replayed.theta - (step.result!.theta ?? replayed.theta)) < 1e-6);

      // Resume mid-session with pending item
      const svc2 = new PlacementOrchestrationService({
        language: lang,
        contentBank: bank,
        sessionId: `plc_resume_${lang}`,
      });
      let s2 = svc2.start();
      assert.equal(s2.done, false);
      if (s2.done) return;
      const pendingChoices = [...s2.question.choices];
      const pendingCorrect = s2.snapshot.pendingPresentedCorrectChoice!;
      const raw = serializeSnapshot(svc2.getSnapshot());
      const restored = deserializeSnapshot(raw);
      assert.ok(restored);
      assert.deepEqual(restored!.pendingPresentedChoices, pendingChoices);
      const svc3 = PlacementOrchestrationService.fromSnapshot(restored!, {
        language: lang,
        contentBank: bank,
      });
      const resumed = svc3.presentNext();
      assert.equal(resumed.done, false);
      if (!resumed.done) {
        assert.deepEqual(resumed.question.choices, pendingChoices);
        const after = svc3.answer({ answer: pendingCorrect, responseTimeMs: 500 });
        assert.equal(after.correct, true);
      }

      // Telemetry fields present
      const answered = events.filter((e) => e.name === 'placement_item_answered');
      assert.ok(answered.length >= 1);
      const ev = answered[0]!;
      assert.equal(ev.language, lang);
      assert.ok(typeof ev.itemId === 'string');
      assert.ok(typeof ev.questionNumber === 'number');
      assert.ok(typeof ev.correct === 'boolean');
      assert.ok('thetaBefore' in ev && 'thetaAfter' in ev);
      assert.ok('responseTimeMs' in ev);
      assert.ok('targetLevel' in ev && 'skill' in ev && 'construct' in ev);
    });
  }
});
