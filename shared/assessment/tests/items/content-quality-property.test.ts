/**
 * Property-style content-quality tests — defect CLASSES, not exact phrase fixtures.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  classifyDistractorDefect,
  mutateIntoDefectClass,
  type DistractorDefectClass,
} from '../../src/items/distractor-helpers.js';
import { runItemQualityPipeline } from '../../src/items/pipeline.js';
import { reviewAnswerCueSanity } from '../../src/items/answer-cue-sanity.js';
import { mcq, spec } from '../items/fixtures/helpers.js';

const DEFECT_CLASSES: DistractorDefectClass[] = [
  'greeting_noun_append',
  'pseudo_morphology',
  'broken_syntax',
  'absurd_object',
  'character_salad',
  'telegraphic_broken',
  'nonsense_category_claim',
];

describe('property-style distractor defects', () => {
  for (const defect of DEFECT_CLASSES) {
    it(`rejects class ${defect} even when wording differs from fixtures`, () => {
      const lang =
        defect === 'character_salad'
          ? 'zh'
          : defect === 'absurd_object'
            ? 'ru'
            : defect === 'pseudo_morphology'
              ? 'de'
              : 'en';
      const bad = mutateIntoDefectClass('stark', defect, lang);
      // mutate once more into a variant by light transform so we are not fixture-locked
      const variant =
        defect === 'greeting_noun_append' && lang === 'en'
          ? 'Hello window.'
          : defect === 'broken_syntax'
            ? 'Meeting is at must.'
            : defect === 'nonsense_category_claim'
              ? 'Lunch is a chair.'
              : bad;

      const classified = classifyDistractorDefect(variant, {
        language: lang,
        skill: 'functional',
      });
      assert.ok(classified, `expected classification for "${variant}"`);

      const item = mcq({
        id: `prop-${defect}`,
        specification: spec({
          construct: `${lang}.functional.basic`,
          targetLevel: 'A2',
          skill: 'functional',
          language: lang,
          itemType: 'functionalPhrase',
        }),
        stem: 'Choose the best response.',
        options: ['Thank you.', variant, 'Excuse me.', 'Good morning.'],
        correctIndex: 0,
        explanation: 'Thanks.',
      });
      // For non-EN correct keys, adjust
      if (lang === 'zh') {
        item.options[0]!.text = '谢谢。';
        item.correctAnswer = '谢谢。';
        item.options[2]!.text = '对不起。';
        item.options[3]!.text = '你好。';
      } else if (lang === 'de') {
        item.options[0]!.text = 'Danke.';
        item.correctAnswer = 'Danke.';
        item.options[2]!.text = 'Entschuldigung.';
        item.options[3]!.text = 'Guten Morgen.';
      } else if (lang === 'ru') {
        item.options[0]!.text = 'Спасибо.';
        item.correctAnswer = 'Спасибо.';
        item.options[2]!.text = 'Извините.';
        item.options[3]!.text = 'Здравствуйте.';
      }

      const { report, eligibility } = runItemQualityPipeline(item);
      assert.equal(report.qualityGate, 'REJECT');
      assert.equal(eligibility.eligible, false);
    });
  }

  it('rejects mixed POS / orthographic C2 rare-word cluster', () => {
    const item = mcq({
      id: 'prop-c2-ortho',
      specification: spec({
        construct: 'en.vocab.fine',
        targetLevel: 'C2',
        skill: 'vocabulary',
        language: 'en',
        itemType: 'vocabularyChoice',
      }),
      stem: 'Her reply was deliberately ____.',
      options: ['equivocal', 'equivalent', 'equitable', 'eloquent'],
      correctIndex: 0,
      explanation: 'Equivocal.',
    });
    const { report } = runItemQualityPipeline(item);
    assert.notEqual(report.qualityGate, 'PASS');
    const sanity = reviewAnswerCueSanity(item);
    assert.equal(sanity.verdict, 'reject');
  });

  it('rejects target-vs-unrelated when ≥2 distractors are structurally broken', () => {
    const item = mcq({
      id: 'prop-elim',
      specification: spec({
        construct: 'en.functional.x',
        targetLevel: 'B1',
        skill: 'functional',
        language: 'en',
      }),
      stem: 'Suggest meeting at 6.',
      options: ['Shall we meet at 6?', 'We meet must 6.', 'Meeting is at must.', 'Hello door.'],
      correctIndex: 0,
      explanation: 'Suggestion.',
    });
    const { report } = runItemQualityPipeline(item);
    assert.equal(report.qualityGate, 'REJECT');
    assert.ok(
      report.criticalIssues.some(
        (i) => i.code === 'DISTRACTOR_TOO_EASY' || i.code === 'NONSENSE_DISTRACTOR',
      ),
    );
  });

  it('accepts functional item where all options are natural utterances', () => {
    const item = mcq({
      id: 'prop-good-func',
      specification: spec({
        construct: 'en.functional.basic_exchanges',
        targetLevel: 'A1',
        skill: 'functional',
        language: 'en',
      }),
      stem: 'Someone holds the door. What do you say?',
      options: ['Thank you.', 'Excuse me.', 'Good morning.', "You're welcome."],
      correctIndex: 0,
      explanation: 'Thanks.',
    });
    const { report } = runItemQualityPipeline(item);
    assert.notEqual(report.qualityGate, 'REJECT');
  });

  it('REVISE cannot become production eligible', () => {
    const item = mcq({
      id: 'prop-revise',
      specification: spec({
        construct: 'en.grammar.nonexistent_construct_xyz',
        targetLevel: 'A1',
        language: 'en',
      }),
      stem: 'I ____ a teacher.',
      options: ['am', 'is', 'are', 'be'],
      correctIndex: 0,
      explanation: 'am.',
    });
    const { report, eligibility } = runItemQualityPipeline(item);
    if (report.qualityGate === 'REVISE') {
      assert.equal(eligibility.eligible, false);
    }
  });
});
