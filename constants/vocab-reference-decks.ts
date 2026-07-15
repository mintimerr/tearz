/** Справочные колоды: слово на языке → русский перевод. Две плашки: English · 中文 */

export type RefLexeme = {
  id: string;
  front: string;
  back: string;
  /** Пиньинь (для китайских карточек) */
  pinyin?: string;
};

export type VocabLangPair = {
  id: string;
  /** Текст на плашке выбора: English или 中文 */
  chipLabel: string;
  title: string;
  subtitle: string;
  /** Подпись на лицевой стороне карточки */
  frontLang: string;
  backLang: string;
  cards: RefLexeme[];
};

export const VOCAB_LANG_PAIRS: VocabLangPair[] = [
  {
    id: 'en-ru',
    chipLabel: 'English',
    title: 'English → Русский',
    subtitle: 'Частые слова и выражения',
    frontLang: 'English',
    backLang: 'Русский',
    cards: [
      { id: 'enru-1', front: 'hello', back: 'привет; здравствуйте; алло' },
      { id: 'enru-2', front: 'world', back: 'мир' },
      { id: 'enru-3', front: 'library', back: 'библиотека' },
      { id: 'enru-4', front: 'to learn', back: 'учиться; изучать' },
      { id: 'enru-5', front: 'memory', back: 'память; воспоминание' },
      { id: 'enru-6', front: 'practice', back: 'практика; упражнение' },
      { id: 'enru-7', front: 'sentence', back: 'предложение; фраза' },
      { id: 'enru-8', front: 'fluent', back: 'беглый (о речи)' },
    ],
  },
  {
    id: 'zh-ru',
    chipLabel: '中文',
    title: '中文 → Русский',
    subtitle: 'Базовые иероглифы',
    frontLang: '中文',
    backLang: 'Русский',
    cards: [
      { id: 'zhru-1', front: '你好', pinyin: 'nǐ hǎo', back: 'привет' },
      { id: 'zhru-2', front: '谢谢', pinyin: 'xiè xie', back: 'спасибо' },
      { id: 'zhru-3', front: '再见', pinyin: 'zài jiàn', back: 'до свидания' },
      { id: 'zhru-4', front: '水', pinyin: 'shuǐ', back: 'вода' },
      { id: 'zhru-5', front: '朋友', pinyin: 'péng yǒu', back: 'друг' },
      { id: 'zhru-6', front: '学习', pinyin: 'xué xí', back: 'учиться; изучать; учёба' },
      { id: 'zhru-7', front: '今天', pinyin: 'jīn tiān', back: 'сегодня' },
      { id: 'zhru-8', front: '明天', pinyin: 'míng tiān', back: 'завтра' },
      { id: 'zhru-9', front: '复习', pinyin: 'fù xí', back: 'повторение; повторять; закрепление материала' },
      { id: 'zhru-10', front: '练习', pinyin: 'liàn xí', back: 'упражнение; практика; тренировка' },
    ],
  },
];
