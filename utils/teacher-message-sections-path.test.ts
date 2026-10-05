/**
 * Run: node --experimental-strip-types --test utils/teacher-message-sections-path.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  parseTeacherBlockLines,
  parseTeacherMessageBlocks,
} from './teacher-message-sections.ts';

describe('placement path opening render', () => {
  it('does not shatter parenthetical slash lists into phrase cards', () => {
    const body =
      'Напиши 2–3 предложения и вставь связку (хотя / несмотря на / в то время как). Я поправлю.';
    const lines = parseTeacherBlockLines(body, { phrase: true });
    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.kind, 'phrase');
    assert.match(lines[0]?.text ?? '', /хотя \/ несмотря на/);
  });

  it('still splits a pure slash phrase list', () => {
    const lines = parseTeacherBlockLines('хотя / несмотря на / в то время как', {
      phrase: true,
    });
    assert.equal(lines.length, 3);
    assert.ok(lines.every((l) => l.kind === 'phrase'));
  });

  it('does not promote Skill focus into a section card', () => {
    const text =
      'Привет! Уровень HSK 2.\n\nSkill focus from placement: functional≈A2, reading≈A2.';
    const blocks = parseTeacherMessageBlocks(text);
    assert.ok(blocks);
    assert.ok(!blocks!.some((b) => /skill focus/i.test(b.title)));
  });

  it('keeps rewritten path opening as plain lead paragraphs', () => {
    const text =
      'Привет! Tearz-тест показал уровень HSK 2. Я сам веду тебя.\n\nСейчас первый шаг. Потренируем связки — например «хотя», «несмотря на» или «в то время как».';
    const blocks = parseTeacherMessageBlocks(text);
    assert.ok(blocks);
    assert.equal(blocks!.length, 1);
    assert.equal(blocks![0]?.title, '');
  });
});
