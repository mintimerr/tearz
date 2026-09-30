/**
 * Комментарий Tearz после проверки задания.
 * Текст должен учить пункт ЭТОГО задания, а не хвалить «смысл и тон» вообще.
 */

const CHECK_RETRY = {
  ru: 'Сверь с правильным вариантом и попробуй ещё раз.',
  en: 'Compare with the correct option and try again.',
  zh: '对照正确答案再试一次。',
};

const CHECK_OK = {
  ru: 'Ответ совпадает с ключом.',
  en: 'Your answer matches the key.',
  zh: '答案与标准一致。',
};

/** Виды, где без конкретного «почему» комментарий врёт про задание. */
const WHY_KINDS = new Set([
  'spot_error',
  'odd_one_out',
  'choose_reply',
  'what_do_you_say',
  'true_false',
  'identify_main_idea',
  'multiple_choice',
  'collocation_choice',
]);

const ORDER_KINDS = new Set(['sentence_order', 'build_from_meaning']);
const FORM_KINDS = new Set(['choose_word_form', 'pick_similar']);
const DRAG_BLANK_KINDS = new Set(['drag_word_to_blank', 'complete_dialogue', 'fill_blank']);
const TYPE_BLANK_KINDS = new Set(['type_word_in_blank', 'type_translation']);

export function hashExerciseSeed(seed) {
  let h = 2166136261;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function feedbackQuote(text, maxLen = 56) {
  const t = typeof text === 'string' ? text.trim().replace(/\s+/g, ' ') : '';
  if (!t) return '';
  if (t.length <= maxLen) return `«${t}»`;
  return `«${t.slice(0, maxLen - 1)}…»`;
}

function pickFeedbackVariant(seed, variants) {
  if (!Array.isArray(variants) || variants.length === 0) return '';
  const h = hashExerciseSeed(String(seed));
  const v = variants[h % variants.length];
  return typeof v === 'function' ? v : String(v);
}

function exerciseStimulus(item) {
  if (!item || typeof item !== 'object') return '';
  for (const key of ['checkText', 'prompt', 'passage', 'selectWord', 'sourceText']) {
    const v = item[key];
    if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 180);
  }
  return '';
}

export function readCoachNote(item) {
  if (!item || typeof item !== 'object') return '';
  for (const key of ['coachNote', 'why', 'rationale']) {
    const v = item[key];
    if (typeof v === 'string' && v.trim()) return v.trim().replace(/\s+/g, ' ').slice(0, 500);
  }
  return '';
}

/** Пустая похвала, которую нельзя показывать как объяснение задания. */
export function isVagueCoachNote(text) {
  const t = typeof text === 'string' ? text.trim() : '';
  if (t.length < 28) return true;
  if (
    /смысл и тон|meaning and tone|意思和语气|совпадают с заданием|matches the (prompt|assignment|task)|уловил[аие]?\s+смысл/i.test(
      t,
    )
  ) {
    return true;
  }
  if (/^(верно|правильно|отлично|молодец|вы молодец|correct|nice|well done|不错|做得好)[.!…\s]*$/i.test(t)) {
    return true;
  }
  return false;
}

/** Текст комментария без цитат изучаемого языка — по нему проверяем язык приложения. */
export function commentaryProse(text) {
  return String(text || '')
    .replace(/«[^»]*»/g, ' ')
    .replace(/“[^”]*”/g, ' ')
    .replace(/"[^"]*"/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scriptCounts(text) {
  return {
    cyr: (text.match(/[А-Яа-яЁё]/g) || []).length,
    han: (text.match(/\p{Script=Han}/gu) || []).length,
    lat: (text.match(/[A-Za-z]/g) || []).length,
  };
}

/** Проза комментария (вне «кавычек» с L2) написана на языке интерфейса. */
export function commentaryInUiLanguage(text, uiLanguage = 'ru') {
  const ui = uiLanguage === 'en' || uiLanguage === 'zh' ? uiLanguage : 'ru';
  const { cyr, han, lat } = scriptCounts(commentaryProse(text));
  if (ui === 'ru') return cyr >= 8 && cyr > han && cyr > lat;
  if (ui === 'en') return lat >= 8 && lat > cyr * 2 && lat > han;
  return han >= 4 && han >= cyr && han + 1 >= lat;
}

/** Комментарий только называет выбранный вариант и не разбирает задание. */
export function isSuperficialChoiceComment(text) {
  const t = typeof text === 'string' ? text.trim() : '';
  if (!t) return true;
  return /остальн\w+.{0,48}(правильн|верн)|the other (sentences|options|lines) are (fine|correct|right)|其余.{0,12}(对的|正确)|выбрал[иа]?|you (chose|picked|selected)|你选了|ошибка (именно )?в «|the error is in «|^да\s*[—:-]\s*ошибка|это верный вариант|that (option|sentence) is correct|符合题目|верный вариант к заданию|matches the task/i.test(
    t,
  );
}

function hasTaskReason(text, ui) {
  const t = commentaryProse(text);
  if (ui === 'en') {
    return /because|means|should|instead|grammar|word order|belong|rule|rather|tense|situation|blank|not the|wrong word|correct (form|sentence|word)/i.test(
      t,
    );
  }
  if (ui === 'zh') {
    return /因为|意思|应该|而不是|语法|不属于|错误|要说|不是/.test(t);
  }
  return /потому|значит|нужно|надо|вместо|граммат|порядок|лишн|форма|время|сочета|уместн|группа|правило|ошиб|перевод|главн|реплик|ситуац|пропуск|пишется|это не|а не/i.test(
    t,
  );
}

/**
 * Комментарий можно показать: язык приложения, и он про пункт задания,
 * а не про сам факт выбора.
 */
export function isAcceptableTaskComment(text, uiLanguage = 'ru') {
  const t = typeof text === 'string' ? text.trim() : '';
  const ui = uiLanguage === 'en' || uiLanguage === 'zh' ? uiLanguage : 'ru';
  if (!t || isVagueCoachNote(t) || isSuperficialChoiceComment(t)) return false;
  if (!commentaryInUiLanguage(t, ui)) return false;
  if (!hasTaskReason(t, ui)) return false;
  return true;
}

function usableCoachNote(item, ui) {
  const note = readCoachNote(item);
  return isAcceptableTaskComment(note, ui) ? note : '';
}

function wrongPrefix(ui, note) {
  if (ui === 'en') return `Not this one. ${note}`;
  if (ui === 'zh') return `不是这个。${note}`;
  return `Не этот вариант. ${note}`;
}

function feedbackBucket(kind) {
  if (kind === 'read_and_select') return 'read_select';
  if (kind === 'fill_partial_word') return 'partial';
  if (kind === 'word_to_image') return 'image';
  if (kind === 'match_pairs') return 'match';
  if (ORDER_KINDS.has(kind)) return 'order';
  if (DRAG_BLANK_KINDS.has(kind) || TYPE_BLANK_KINDS.has(kind)) return 'blank';
  if (FORM_KINDS.has(kind)) return 'form';
  if (kind === 'spot_error') return 'spot';
  if (kind === 'odd_one_out') return 'odd';
  if (kind === 'choose_reply' || kind === 'what_do_you_say') return 'reply';
  if (kind === 'true_false') return 'truth';
  if (kind === 'identify_main_idea') return 'idea';
  if (kind === 'choose_translation' || kind === 'translate_sentence' || kind === 'reverse_translation') {
    return 'choice';
  }
  if (kind === 'select_missing_word' || kind === 'collocation_choice' || kind === 'multiple_choice') {
    return 'fit';
  }
  return 'generic';
}

/**
 * Нужен короткий вызов модели: в задании нет готового coachNote,
 * а локальный шаблон не называет саму ошибку / нюанс.
 */
export function feedbackNeedsModelWhy(kind, item, uiLanguage = 'ru') {
  if (!kind) return !isAcceptableTaskComment(readCoachNote(item), uiLanguage);
  return !isAcceptableTaskComment(readCoachNote(item), uiLanguage);
}

/**
 * @param {{ correct: boolean, kind?: string, item?: object, ideal?: string, uiLanguage?: string, answer?: string }} opts
 */
export function buildExerciseCheckFeedback(opts) {
  const { correct, kind = '', item, ideal = '', uiLanguage = 'ru', answer = '' } = opts ?? {};
  const ui = uiLanguage === 'en' || uiLanguage === 'zh' ? uiLanguage : 'ru';
  const note = usableCoachNote(item, ui);
  const bucket = feedbackBucket(kind);

  const chosenRaw = (typeof answer === 'string' && answer.trim()) || (typeof ideal === 'string' && ideal.trim()) || '';
  const stimulusRaw = exerciseStimulus(item);
  const seed = `${kind}|${item?.id ?? ''}|${ideal}|${answer}|${correct ? 1 : 0}`;
  chosen = feedbackQuote(chosenRaw);
  stim = feedbackQuote(stimulusRaw);
  firstIdealBit = feedbackQuote(
    String(ideal || chosenRaw)
      .split(/[,;]/)[0]
      ?.trim() || '',
  );

  if (!correct) {
    if (note) return wrongPrefix(ui, note);
    const wrong = wrongPools[ui]?.[bucket];
    if (wrong) return pickFeedbackVariant(seed, wrong)({ item });
    return CHECK_RETRY[ui];
  }

  if (note) return note;

  const langPools = pools[ui] ?? pools.ru;
  const variants = langPools[bucket] ?? langPools.generic;
  return pickFeedbackVariant(seed, variants)({ item });
}

/** Заполняются в buildExerciseCheckFeedback перед вызовом шаблонов. */
let chosen = '';
let stim = '';
let firstIdealBit = '';

const wrongPools = {
  ru: {
    spot: [
      () =>
        chosen
          ? `Задание — найти предложение с ошибкой, и ${chosen} как раз без ошибки. Смотри слово или грамматику в других вариантах.`
          : 'Задание — найти предложение, где сломаны слово или грамматика.',
    ],
    odd: [
      () =>
        chosen
          ? `${chosen} как раз из той же группы. Лишнее — слово из другой темы.`
          : 'Лишнее слово — то, что выпадает из общей группы.',
    ],
    reply: [
      () =>
        stim && chosen
          ? `${chosen} не отвечает на ${stim}.`
          : chosen
            ? `${chosen} не подходит к этой ситуации.`
            : 'Эта реплика не к этой ситуации.',
    ],
  },
  en: {
    spot: [
      () =>
        chosen
          ? `The task is to find the sentence with a mistake, and ${chosen} is grammatical. Look at the word or the grammar in the other lines.`
          : 'The task is to find the sentence where a word or the grammar is wrong.',
    ],
    odd: [
      () =>
        chosen
          ? `${chosen} belongs with the others. The odd one is from another group.`
          : 'The odd word is the one outside the shared group.',
    ],
    reply: [
      () =>
        stim && chosen
          ? `${chosen} does not answer ${stim}.`
          : chosen
            ? `${chosen} does not fit this situation.`
            : 'That line does not fit this situation.',
    ],
  },
  zh: {
    spot: [
      () =>
        chosen
          ? `题目是找出有错误的句子，而 ${chosen} 没有错误。看其他句子里的用词或语法。`
          : '题目是找出用词或语法出错的那一句。',
    ],
    odd: [
      () => (chosen ? `${chosen} 和其他词是一类。多余的是另一组的词。` : '多余的是不属于同一组的词。'),
    ],
    reply: [
      () =>
        stim && chosen
          ? `${chosen} 没有回应 ${stim}。`
          : chosen
            ? `${chosen} 不适合这个情景。`
            : '这句不适合这个情景。',
    ],
  },
};

const pools = {
  ru: {
    choice: [
      () =>
        stim && chosen
          ? `Да: ${chosen} — это перевод ${stim}, а не соседнее слово.`
          : chosen
            ? `Верный перевод — ${chosen}.`
            : 'Перевод выбран верно.',
      () =>
        stim && chosen
          ? `${chosen} точнее передаёт ${stim}, чем остальные варианты.`
          : chosen
            ? `Правильно: ${chosen}. Остальные переводят иначе.`
            : 'Правильный перевод выбран.',
    ],
    fit: [
      () =>
        stim && chosen
          ? `${chosen} встаёт именно в эту фразу: ${stim}.`
          : chosen
            ? `${chosen} здесь подходит по сочетаемости, не просто «похожее слово».`
            : 'Этот вариант подходит к фразе.',
      () =>
        chosen
          ? `Да, ${chosen}: так фраза звучит естественно. Соседние варианты ломают сочетание или смысл.`
          : 'Слово подходит к этой фразе.',
    ],
    spot: [
      () =>
        stim && chosen
          ? `Задание ${stim} Ошибочное предложение — ${chosen}: здесь не то слово или не та форма.`
          : chosen
            ? `Нужно было найти предложение с ошибкой. Сломано ${chosen}: не то слово или не та форма.`
            : 'Нужно было найти предложение, где сломаны слово или грамматика.',
    ],
    odd: [
      () =>
        chosen
          ? `${chosen} лишнее: остальные слова из одной группы, это — из другой.`
          : 'Лишнее слово выбрано верно.',
    ],
    reply: [
      () =>
        stim && chosen
          ? `${chosen} отвечает именно на это: ${stim}.`
          : chosen
            ? `${chosen} — реплика к этой ситуации, а не к соседней.`
            : 'Реплика подходит к ситуации.',
    ],
    truth: [
      () =>
        chosen
          ? `Оценка верная: ${chosen}. Смотри на само правило, не на «звучит знакомо».`
          : 'Верно оценили утверждение.',
    ],
    idea: [
      () =>
        chosen
          ? `Главная мысль — ${chosen}, а не отдельная деталь текста.`
          : 'Главная мысль выбрана верно.',
    ],
    form: [
      () => (chosen ? `Форма верная: ${chosen}.` : 'Формы слов подобраны верно.'),
      () =>
        firstIdealBit
          ? `Да, ${firstIdealBit} — здесь сходится именно грамматика.`
          : 'Нужные формы стоят на местах.',
    ],
    image: [
      () => (chosen ? `Подписи верны: ${chosen}.` : 'Каждое слово на своей картинке.'),
      () => (chosen ? `Да — ${chosen} совпали с образами.` : 'Слова и картинки совпали.'),
    ],
    match: [
      () => (chosen ? `Пары верны: ${chosen}.` : 'Все пары сопоставлены правильно.'),
      () => (chosen ? `Связки ${chosen} — лексика держится.` : 'Связки верные.'),
    ],
    order: [
      () =>
        chosen ? `Порядок верный — ${chosen} звучит естественно.` : 'Порядок слов правильный.',
      () => (chosen ? `Да: ${chosen} — так и говорят.` : 'Фраза собрана верно.'),
    ],
    blank: [
      () => (chosen ? `В пропуск подходит ${chosen}.` : 'Слова в контексте стоят правильно.'),
      () =>
        firstIdealBit
          ? `${firstIdealBit} — естественный выбор для этой фразы.`
          : 'Слова ложатся в предложение как надо.',
    ],
    partial: [
      () => (chosen ? `Да, ${chosen} — так и пишется.` : 'Буквы восстановлены верно.'),
      () => (chosen ? `Слово собралось: ${chosen}.` : 'Пропущенные части угаданы правильно.'),
    ],
    read_select: [
      ({ item: it }) => {
        const word =
          typeof it?.selectWord === 'string' && it.selectWord.trim()
            ? feedbackQuote(it.selectWord.trim())
            : 'это слово';
        return it?.selectIsReal
          ? `${word} — настоящее слово, вы верно определили.`
          : `${word} — выдумка, вы верно заметили.`;
      },
    ],
    generic: [
      () =>
        stim && chosen
          ? `Верно: ${chosen} к заданию ${stim}.`
          : chosen
            ? `Верно — ваш ответ ${chosen}.`
            : 'Ответ верный.',
    ],
  },
  en: {
    choice: [
      () =>
        stim && chosen
          ? `Yes: ${chosen} translates ${stim}, not a nearby word.`
          : chosen
            ? `The right translation is ${chosen}.`
            : 'You picked the right translation.',
      () =>
        stim && chosen
          ? `${chosen} renders ${stim} more precisely than the other options.`
          : chosen
            ? `Correct: ${chosen}. The others mean something else.`
            : 'Correct translation.',
    ],
    fit: [
      () =>
        stim && chosen
          ? `${chosen} is what fits this line: ${stim}.`
          : chosen
            ? `${chosen} fits the phrase, not just a similar word.`
            : 'That option fits the phrase.',
    ],
    spot: [
      () =>
        stim && chosen
          ? `The task ${stim} asks for the sentence with a mistake. That sentence is ${chosen}: a word or a grammar form is wrong.`
          : chosen
            ? `The task is to find the sentence with a mistake. The broken one is ${chosen}: a word or a grammar form is wrong.`
            : 'The task is to find the sentence where a word or the grammar is wrong.',
    ],
    odd: [
      () =>
        chosen
          ? `${chosen} is the odd one: the rest share a group, this one does not.`
          : 'You picked the word that does not belong.',
    ],
    reply: [
      () =>
        stim && chosen
          ? `${chosen} answers this specifically: ${stim}.`
          : chosen
            ? `${chosen} fits this situation, not a neighbouring one.`
            : 'That line fits the situation.',
    ],
    truth: [
      () =>
        chosen
          ? `Right call: ${chosen}. Judge the rule, not whether it sounds familiar.`
          : 'You judged the statement correctly.',
    ],
    idea: [
      () =>
        chosen
          ? `The main idea is ${chosen}, not a side detail.`
          : 'You picked the main idea.',
    ],
    form: [() => (chosen ? `Word form is right: ${chosen}.` : 'The word forms are correct.')],
    image: [() => (chosen ? `Labels match: ${chosen}.` : 'Every picture is labeled correctly.')],
    match: [() => (chosen ? `Pairs are right: ${chosen}.` : 'All pairs match correctly.')],
    order: [
      () => (chosen ? `Order works — ${chosen} reads naturally.` : 'The sentence order is correct.'),
    ],
    blank: [() => (chosen ? `The blank takes ${chosen}.` : 'The words fit the context.')],
    partial: [() => (chosen ? `Yes — ${chosen} is how it’s spelled.` : 'Missing letters restored.')],
    read_select: [
      ({ item: it }) => {
        const word =
          typeof it?.selectWord === 'string' && it.selectWord.trim()
            ? feedbackQuote(it.selectWord.trim())
            : 'this word';
        return it?.selectIsReal
          ? `${word} is a real word — you got it.`
          : `${word} is made-up — you spotted the fake.`;
      },
    ],
    generic: [
      () =>
        stim && chosen
          ? `Correct: ${chosen} for ${stim}.`
          : chosen
            ? `Correct — your answer ${chosen}.`
            : 'Correct answer.',
    ],
  },
  zh: {
    choice: [
      () =>
        stim && chosen
          ? `对：${chosen} 是 ${stim} 的翻译，不是近义词。`
          : chosen
            ? `正确的翻译是 ${chosen}。`
            : '翻译选对了。',
    ],
    fit: [
      () =>
        stim && chosen
          ? `${chosen} 正好放进这句：${stim}。`
          : chosen
            ? `${chosen} 符合这句的搭配，不只是“像”的词。`
            : '这个选项符合句子。',
    ],
    spot: [
      () =>
        stim && chosen
          ? `题目${stim}要找有错误的句子。错句是 ${chosen}：用词或语法不对。`
          : chosen
            ? `题目是找出有错误的句子。错句是 ${chosen}：用词或语法不对。`
            : '题目是找出用词或语法出错的那一句。',
    ],
    odd: [
      () => (chosen ? `${chosen} 是多余的：其余是一类，它是另一类。` : '多余的词选对了。'),
    ],
    reply: [
      () =>
        stim && chosen
          ? `${chosen} 回应的是：${stim}。`
          : chosen
            ? `${chosen} 适合这个情景，不是旁边那个。`
            : '这句适合情景。',
    ],
    truth: [() => (chosen ? `判断对了：${chosen}。看规则本身，不是“听着熟”。` : '判断正确。')],
    idea: [() => (chosen ? `主旨是 ${chosen}，不是文中的一个细节。` : '主旨选对了。')],
    form: [() => (chosen ? `词形正确：${chosen}。` : '词形都对。')],
    image: [() => (chosen ? `标注正确：${chosen}。` : '每张图都标对了。')],
    match: [() => (chosen ? `配对正确：${chosen}。` : '所有配对都正确。')],
    order: [() => (chosen ? `语序正确——${chosen} 读起来自然。` : '词序对了。')],
    blank: [() => (chosen ? `空处填 ${chosen} 合适。` : '词放进上下文很合适。')],
    partial: [() => (chosen ? `对，${chosen} 写法正确。` : '字母补全正确。')],
    read_select: [
      ({ item: it }) => {
        const word =
          typeof it?.selectWord === 'string' && it.selectWord.trim()
            ? feedbackQuote(it.selectWord.trim())
            : '这个词';
        return it?.selectIsReal ? `${word} 是真词——判断对了。` : `${word} 是假词——你看出来了。`;
      },
    ],
    generic: [
      () =>
        stim && chosen
          ? `正确：${chosen} 对应 ${stim}。`
          : chosen
            ? `正确——你的答案是 ${chosen}。`
            : '答对了。',
    ],
  },
};

export function isGenericCheckOkFeedback(text, uiLanguage) {
  const t = typeof text === 'string' ? text.trim() : '';
  if (!t) return true;
  const ui = uiLanguage === 'en' || uiLanguage === 'zh' ? uiLanguage : 'ru';
  if (t === CHECK_OK[ui]) return true;
  if (isVagueCoachNote(t) || isSuperficialChoiceComment(t)) return true;
  if (!commentaryInUiLanguage(t, ui)) return true;
  const hasConcreteQuote = /[«»“”"]/.test(t);
  const vagueRe =
    /уловил[аие]?\s+смысл|материал\s+усваивается|двигаемся\s+дальше|caught\s+the\s+(nuance|meaning)|keep\s+going|wording\s+fits\s+here|эта\s+формулировка\s+здесь\s+уместна|то,\s*что\s+нужно|就是这样|继续下一题/i;
  if (vagueRe.test(t) && !hasConcreteQuote) return true;
  if (!hasConcreteQuote && t.length < 36 && /^(верно|правильно|отлично|correct|right|没错|对的?)[.!…]*$/i.test(t)) {
    return true;
  }
  return false;
}
