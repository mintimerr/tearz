/**
 * Phase B.3 — Chinese discourse-unit depth + high-level PASS smoke.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  cefrContextMinUnits,
  discourseUnits,
  wordCount,
} from '../../src/items/deterministic/normalize.js';
import { runItemQualityPipeline } from '../../src/items/pipeline.js';
import { mcq, spec } from '../items/fixtures/helpers.js';

describe('Chinese discourse units (B.3)', () => {
  it('CJK stem is not under-counted as 1 whitespace word', () => {
    const stem =
      '会议纪要：「委员感谢作者分发草案。委员会对该提案表示兴趣并记录在案，随后未要求后续文件也未表决，便迅速转入其他议题。」最可能的语用解读是？';
    assert.equal(wordCount(stem), 1);
    assert.ok(discourseUnits(stem, 'zh') >= 55);
    assert.ok(discourseUnits(stem, 'zh') >= cefrContextMinUnits('zh', 'reading'));
  });

  it('English thresholds unchanged (still word-based)', () => {
    assert.equal(cefrContextMinUnits('en', 'reading'), 28);
    assert.equal(cefrContextMinUnits('en', 'vocabulary'), 14);
    assert.equal(discourseUnits('one two three four', 'en'), 4);
  });

  it('rich Chinese C1 reading can PASS without gate relaxation', () => {
    const item = mcq({
      id: 'zh-c1-smoke',
      specification: spec({
        construct: 'zh.reading.dense_discourse',
        targetLevel: 'C1',
        skill: 'reading',
        language: 'zh',
        itemType: 'readingComprehension',
      }),
      stem:
        '审稿意见：「文章结构清楚，文笔克制。不过核心论断依赖一个作者几乎未加检验的前提，这削弱了后文建议的力度。」主要批评是什么？',
      options: [
        '论断的基础检验不足',
        '文字混乱难读',
        '完全没有论点',
        '前提早已被证明',
      ],
      correctIndex: 0,
      explanation: '未检验的前提。',
    });
    const { report, eligibility } = runItemQualityPipeline(item);
    assert.equal(report.qualityGate, 'PASS');
    assert.equal(eligibility.eligible, true);
  });

  it('short Chinese C1 reading still REJECTS (gate not weakened)', () => {
    const item = mcq({
      id: 'zh-c1-short',
      specification: spec({
        construct: 'zh.reading.dense_discourse',
        targetLevel: 'C1',
        skill: 'reading',
        language: 'zh',
        itemType: 'readingComprehension',
      }),
      stem: '短句。什么意思？',
      options: ['A含义', 'B含义', 'C含义', 'D含义'],
      correctIndex: 0,
      explanation: '太短。',
    });
    const { report } = runItemQualityPipeline(item);
    assert.notEqual(report.qualityGate, 'PASS');
  });
});
