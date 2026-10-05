/**
 * Content-quality hardening regression fixtures (must REJECT).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { runItemQualityPipeline } from '../../src/items/pipeline.js';
import { reviewDistractorQuality } from '../../src/items/distractor-quality.js';
import { reviewCefrDepth } from '../../src/items/cefr-depth.js';
import { reviewConstructFidelity } from '../../src/items/construct-fidelity.js';
import { reviewNaturalnessRu } from '../../src/items/naturalness.js';
import { auditCrossLanguageSimilarity } from '../../src/banks/factory/cross-language-audit.js';
import { generationPromptVersionForLanguage } from '../../src/items/prompt-versions.js';
import { mcq, spec } from '../items/fixtures/helpers.js';
import type { BankItemRecord } from '../../src/banks/types.js';

function bankStub(partial: Partial<BankItemRecord> & Pick<BankItemRecord, 'id' | 'language' | 'stem'>): BankItemRecord {
  return {
    skill: 'vocabulary',
    construct: 'x',
    itemType: 'vocabularyChoice',
    responseFormat: 'singleChoice',
    optionCount: 4,
    targetLevel: 'C1',
    difficultyWithinLevel: 0.5,
    predictedDifficulty: 1,
    predictedDiscrimination: 1.2,
    calibrationStatus: 'provisional',
    lifecycleState: 'approved_provisional',
    qualityGate: 'PASS',
    prompt: 'Choose',
    instruction: 'Choose',
    choices: ['a', 'b', 'c', 'd'],
    correctChoice: 'a',
    explanation: 'x',
    generationModel: 't',
    generationPromptVersion: 'en_item_generation_v2',
    itemQualityVersion: 'item-quality-gate-v1',
    createdAt: 1,
    ...partial,
  };
}

describe('content quality hardening — must reject', () => {
  it('rejects I am a table nonsense distractor', () => {
    const item = mcq({
      id: 'bad-table',
      specification: spec({
        construct: 'en.functional.basic_exchanges',
        targetLevel: 'A2',
        skill: 'functional',
        itemType: 'functionalPhrase',
        language: 'en',
      }),
      stem: 'You meet someone. What do you say?',
      options: ['Nice to meet you.', 'I am a table.', 'Open the window.', 'Where is my shoe?'],
      correctIndex: 0,
      explanation: 'Greeting.',
    });
    const d = reviewDistractorQuality(item);
    assert.equal(d.verdict, 'reject');
    assert.ok(d.issues.some((i) => i.code === 'NONSENSE_DISTRACTOR'));
    const { report, eligibility } = runItemQualityPipeline(item);
    assert.equal(report.qualityGate, 'REJECT');
    assert.equal(eligibility.eligible, false);
  });

  it('rejects Friday is a vegetable', () => {
    const item = mcq({
      id: 'bad-veg',
      specification: spec({
        construct: 'en.functional.basic_exchanges',
        targetLevel: 'B1',
        skill: 'functional',
        language: 'en',
      }),
      stem: 'Negotiate a deadline.',
      options: ['Could we push to Friday?', 'Friday is a vegetable.', 'Delete the project.', 'Deadlines never move.'],
      correctIndex: 0,
      explanation: 'Negotiation.',
    });
    const { report } = runItemQualityPipeline(item);
    assert.equal(report.qualityGate, 'REJECT');
  });

  it('rejects убедить дверь', () => {
    const item = mcq({
      id: 'bad-ru-door',
      specification: spec({
        construct: 'ru.vocab.collocations',
        targetLevel: 'B1',
        skill: 'vocabulary',
        language: 'ru',
      }),
      stem: 'Нужно ____ встречу на пятницу.',
      options: ['перенести', 'убедить дверь', 'предложить стул', 'иметь'],
      correctIndex: 0,
      explanation: 'Перенести.',
    });
    const { report } = runItemQualityPipeline(item);
    assert.equal(report.qualityGate, 'REJECT');
  });

  it('rejects unnatural Russian «здесь не есть»', () => {
    const item = mcq({
      id: 'bad-ru-nat',
      specification: spec({
        construct: 'ru.reading.signs',
        targetLevel: 'A1',
        skill: 'reading',
        language: 'ru',
        itemType: 'readingComprehension',
      }),
      stem: 'Табличка: «Здесь не есть». Что делать?',
      options: ['Не есть здесь', 'Купить еду', 'Готовить', 'Делиться'],
      correctIndex: 0,
      explanation: 'Запрет.',
    });
    const n = reviewNaturalnessRu(item);
    assert.equal(n.verdict, 'reject');
  });

  it('rejects construct mismatch futur proche vs relatives', () => {
    const item = mcq({
      id: 'bad-construct',
      specification: spec({
        construct: 'fr.grammar.relatives_conditional',
        targetLevel: 'B1',
        skill: 'grammar',
        language: 'fr',
      }),
      stem: 'Je ____ lui parler demain.',
      options: ['vais', 'suis', 'ai', 'fais'],
      correctIndex: 0,
      explanation: 'Futur proche.',
    });
    const c = reviewConstructFidelity(item);
    assert.equal(c.verdict, 'reject');
    assert.ok(c.issues.some((i) => i.code === 'CONSTRUCT_MISMATCH'));
  });

  it('rejects/revises C2 rare-word-only transparent vocab', () => {
    const item = mcq({
      id: 'bad-c2-rare',
      specification: spec({
        construct: 'en.vocab.fine_distinctions_c2',
        targetLevel: 'C2',
        skill: 'vocabulary',
        language: 'en',
        itemType: 'vocabularyChoice',
      }),
      stem: 'The wording is deliberately ____.',
      options: ['opaque', 'open', 'oral', 'ordinary'],
      correctIndex: 0,
      explanation: 'Opaque.',
    });
    const depth = reviewCefrDepth(item);
    assert.ok(depth.verdict === 'reject' || depth.verdict === 'revise');
    const { report } = runItemQualityPipeline(item);
    assert.notEqual(report.qualityGate, 'PASS');
  });

  it('detects cross-language near copies', () => {
    const items = [
      bankStub({
        id: '1',
        language: 'en',
        stem: 'The wording is deliberately opaque.',
      }),
      bankStub({
        id: '2',
        language: 'fr',
        stem: 'Le libellé est volontairement opaque.',
      }),
      bankStub({
        id: '3',
        language: 'de',
        stem: 'Die Formulierung ist bewusst undurchsichtig.',
      }),
    ];
    const audit = auditCrossLanguageSimilarity(items);
    assert.ok(audit.crossLanguageNearDuplicateGroups.length >= 1);
    assert.ok(audit.crossLanguageConceptReuseRate > 0);
  });

  it('language-specific prompt versions', () => {
    assert.equal(generationPromptVersionForLanguage('en'), 'en_item_generation_v2');
    assert.equal(generationPromptVersionForLanguage('fr'), 'fr_item_generation_v2');
    assert.equal(generationPromptVersionForLanguage('zh'), 'zh_item_generation_v2');
    assert.equal(generationPromptVersionForLanguage('de'), 'de_item_generation_v2');
    assert.equal(generationPromptVersionForLanguage('ru'), 'ru_item_generation_v2');
  });

  it('REVISE is never scoring-eligible', () => {
    const item = mcq({
      id: 'revise-case',
      specification: spec({
        construct: 'en.grammar.be_have_do',
        targetLevel: 'A1',
        language: 'en',
      }),
      stem: 'I ____ a teacher.',
      options: ['am', 'is', 'are', 'be'],
      correctIndex: 0,
      explanation: 'With I use am.',
    });
    // Force a warning-only path by using unknown registry-like construct without band hit
    item.specification.construct = 'en.grammar.nonexistent_construct_xyz';
    const { report, eligibility } = runItemQualityPipeline(item);
    if (report.qualityGate === 'REVISE') {
      assert.equal(eligibility.eligible, false);
      assert.equal(eligibility.evidenceWeight, 0);
    }
  });

  it('accepts realistic parallel distractors', () => {
    const item = mcq({
      id: 'good-dist',
      specification: spec({
        construct: 'en.grammar.be_have_do',
        targetLevel: 'A1',
        language: 'en',
      }),
      stem: 'She ____ from Canada.',
      options: ['is', 'are', 'am', 'be'],
      correctIndex: 0,
      explanation: 'She takes is.',
    });
    const { report, eligibility } = runItemQualityPipeline(item);
    assert.notEqual(report.qualityGate, 'REJECT');
    if (report.qualityGate === 'PASS') {
      assert.equal(eligibility.eligible, true);
      assert.ok(eligibility.evidenceWeight > 0);
    }
  });
});
