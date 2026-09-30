import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildExerciseCheckFeedback,
  feedbackNeedsModelWhy,
  isGenericCheckOkFeedback,
  isVagueCoachNote,
} from './exercise-feedback.js';

const SPOT = {
  id: 'ex-6',
  kind: 'spot_error',
  checkText: 'Выбери предложение с ошибкой.',
  choices: [
    '按时吃饭对身体有益。',
    '吃饭规定的时间对身体有医嘱。',
    '医生说要按时吃饭。',
  ],
  correctChoice: '吃饭规定的时间对身体有医嘱。',
};

test('spot_error does not praise meaning and tone', () => {
  for (let i = 0; i < 12; i++) {
    const feedback = buildExerciseCheckFeedback({
      correct: true,
      kind: 'spot_error',
      item: { ...SPOT, id: `ex-${i}` },
      ideal: SPOT.correctChoice,
      uiLanguage: 'ru',
      answer: SPOT.correctChoice,
    });
    assert.doesNotMatch(feedback, /смысл и тон|совпадают с заданием/);
    assert.match(feedback, /ошибк/i);
    assert.match(feedback, /医嘱|吃饭规定/);
  }
});

test('spot_error uses coachNote instead of a generic line', () => {
  const note =
    '«医嘱» значит «назначение врача», а не «польза». Нужно: «按时吃饭对身体有益。»';
  const feedback = buildExerciseCheckFeedback({
    correct: true,
    kind: 'spot_error',
    item: { ...SPOT, coachNote: note },
    ideal: SPOT.correctChoice,
    uiLanguage: 'ru',
    answer: SPOT.correctChoice,
  });
  assert.equal(feedback, note);
  assert.equal(feedbackNeedsModelWhy('spot_error', { ...SPOT, coachNote: note }), false);
});

test('spot_error without a note still asks the model for the actual error', () => {
  assert.equal(feedbackNeedsModelWhy('spot_error', SPOT), true);
});

test('vague praise is rejected even when it quotes the answer', () => {
  const line = 'Именно «吃饭规定的时间对身体有医嘱。」 — смысл и тон совпадают с заданием.';
  assert.equal(isVagueCoachNote(line), true);
  assert.equal(isGenericCheckOkFeedback(line, 'ru'), true);
});

test('wrong spot_error points at the task, not a retry slogan only', () => {
  const feedback = buildExerciseCheckFeedback({
    correct: false,
    kind: 'spot_error',
    item: SPOT,
    ideal: SPOT.correctChoice,
    uiLanguage: 'ru',
    answer: '按时吃饭对身体有益。',
  });
  assert.match(feedback, /ошибк/i);
  assert.doesNotMatch(feedback, /Сверь с правильным вариантом/);
});

test('translation feedback stays about the translation', () => {
  const feedback = buildExerciseCheckFeedback({
    correct: true,
    kind: 'choose_translation',
    item: { id: 't1', kind: 'choose_translation', checkText: 'hospital', correctChoice: 'больница' },
    ideal: 'больница',
    uiLanguage: 'ru',
    answer: 'больница',
  });
  assert.match(feedback, /перевод/i);
  assert.doesNotMatch(feedback, /смысл и тон/);
});
