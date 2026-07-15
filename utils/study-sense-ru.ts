/** Учебные значения английских глаголов/слов → русский (не общий MT). */
const STUDY_EN_RU: Record<string, string[]> = {
  review: ['повторение', 'повторять', 'закрепление материала'],
  'go over': ['проходить материал', 'повторять', 'просматривать'],
  revise: ['повторять', 'освежать в памяти', 'закреплять'],
  'brush up': ['освежить знания', 'повторить'],
  study: ['учиться', 'изучать', 'заниматься'],
  learn: ['учить', 'изучать', 'выучить'],
  memorize: ['запоминать', 'заучивать'],
  remember: ['помнить', 'вспоминать'],
  forget: ['забывать'],
  practice: ['практиковать', 'упражняться', 'тренироваться'],
  read: ['читать'],
  write: ['писать'],
  listen: ['слушать'],
  speak: ['говорить', 'разговаривать'],
  understand: ['понимать'],
  explain: ['объяснять'],
  translate: ['переводить'],
  pronounce: ['произносить'],
  repeat: ['повторять'],
  prepare: ['готовиться', 'подготавливать'],
  preview: ['предварительное изучение', 'просмотр материала'],
  exam: ['экзамен'],
  test: ['тест', 'проверка'],
  homework: ['домашнее задание'],
  lesson: ['урок', 'занятие'],
  vocabulary: ['лексика', 'словарный запас'],
  grammar: ['грамматика'],
  sentence: ['предложение', 'фраза'],
  word: ['слово'],
  meaning: ['значение', 'смысл'],
  pronunciation: ['произношение'],
  progress: ['прогресс'],
  mistake: ['ошибка'],
  correct: ['правильный', 'верный'],
  difficult: ['трудный', 'сложный'],
  easy: ['лёгкий', 'простой'],
  important: ['важный'],
  continue: ['продолжать'],
  begin: ['начинать'],
  finish: ['заканчивать', 'завершать'],
};

function normEn(s: string) {
  return s.trim().toLowerCase();
}

export function studyEnSensesToRu(senses: string[]): string | null {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const sense of senses) {
    const key = normEn(sense);
    const mapped = STUDY_EN_RU[key];
    if (!mapped) continue;
    for (const ru of mapped) {
      const k = ru.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(ru);
      if (out.length >= 5) break;
    }
    if (out.length >= 5) break;
  }

  return out.length ? out.join('; ') : null;
}
