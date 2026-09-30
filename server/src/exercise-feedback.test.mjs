import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildExerciseCheckFeedback,
  commentaryInUiLanguage,
  feedbackNeedsModelWhy,
  isAcceptableTaskComment,
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

test('spot_error uses a Russian note that explains the mistake', () => {
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
  assert.equal(isAcceptableTaskComment(note, 'ru'), true);
  assert.equal(feedbackNeedsModelWhy('spot_error', { ...SPOT, coachNote: note }, 'ru'), false);
});

test('russian app ignores a comment written in Chinese', () => {
  const note = '医嘱的意思是医嘱，不是有益。应该说按时吃饭对身体有益。这是用词错误。';
  const feedback = buildExerciseCheckFeedback({
    correct: true,
    kind: 'spot_error',
    item: { ...SPOT, coachNote: note },
    ideal: SPOT.correctChoice,
    uiLanguage: 'ru',
    answer: SPOT.correctChoice,
  });
  assert.notEqual(feedback, note);
  assert.equal(commentaryInUiLanguage(feedback, 'ru'), true);
  assert.match(feedback, /[А-Яа-яЁё]/);
  assert.equal(feedbackNeedsModelWhy('spot_error', { ...SPOT, coachNote: note }, 'ru'), true);
});

test('english app gets an English comment, not a Russian one', () => {
  const feedback = buildExerciseCheckFeedback({
    correct: true,
    kind: 'spot_error',
    item: { ...SPOT, checkText: 'Which sentence is wrong?' },
    ideal: SPOT.correctChoice,
    uiLanguage: 'en',
    answer: SPOT.correctChoice,
  });
  assert.equal(commentaryInUiLanguage(feedback, 'en'), true);
  assert.doesNotMatch(feedback, /[А-Яа-яЁё]/);
  assert.match(feedback, /mistake|wrong|grammar/i);
});

test('a line that only names the picked sentence is not enough', () => {
  const line = 'Да — ошибка в «吃饭规定的时间对身体有医嘱。». Остальные предложения написаны правильно.';
  assert.equal(isAcceptableTaskComment(line, 'ru'), false);
  assert.equal(feedbackNeedsModelWhy('spot_error', { ...SPOT, coachNote: line }, 'ru'), true);
});

test('spot_error without a note still asks the model for the actual error', () => {
  assert.equal(feedbackNeedsModelWhy('spot_error', SPOT, 'ru'), true);
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
