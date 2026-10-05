import type { CompanionChatApiLanguage, TeacherVocabWordCard } from '@/types/companion-chat-api';
import { extractPairsFromTeacherText } from '@/utils/learner-lexicon';
import { pinyinZhSync } from '@/utils/pinyin-zh';
import {
  isPhraseTitle,
  isVocabularyTitle,
  parseTeacherBlockLines,
  parseTeacherMessageBlocks,
} from '@/utils/teacher-message-sections';
import {
  filterVocabExamplesNotInExplanation,
  isHollowVocabExample,
} from '@/utils/teacher-vocab-examples-filter';

type UiLang = 'ru' | 'en' | 'zh';
type Sentence = { l2: string; translation: string; pinyin?: string };
/** Only senses we can template safely — never bare-verb slotting. */
type Sense = 'person_slang' | 'alone' | 'socialize' | 'awkward' | 'grit' | 'approval' | 'none';

function hasHan(text: string) {
  return /[\u4e00-\u9fff]/i.test(text);
}

function hasCyrillic(text: string) {
  return /[а-яё]/i.test(text);
}

function cleanHeadword(raw: string): { word: string; pinyin?: string } {
  const t = raw.trim();
  const withPy = t.match(/^(.+?)\s*[（(]\s*([^）)]+?)\s*[）)]\s*$/);
  if (withPy) {
    return { word: withPy[1].trim(), pinyin: withPy[2].trim() };
  }
  return { word: t };
}

/** Short label safe to embed — keep light-verb + object («заводить знакомства»). */
function meaningLabel(gloss: string, ui: UiLang, sense: Sense): string {
  let g = gloss
    .trim()
    .replace(/^["“«]+|["”»]+$/g, '')
    .replace(/\s+/g, ' ');
  const quoted = g.match(/^["“](.+?)["”]/);
  if (quoted) g = quoted[1];
  g = (g.split(/[（(]/)[0] ?? g).trim();
  g = (g.split(/[,;，、/|]| или /i)[0] ?? g).trim();
  g = g.replace(/^["“«]+|["”»]+$/g, '').trim();
  g = g.replace(/^(то|и|или|с|of|to|the|a|an)\s+/i, '').trim();

  if (ui === 'ru') {
    if (sense === 'person_slang') {
      if (/dog|单身狗|пёс|пес/i.test(gloss)) return 'одинокий пёс';
      return 'одиночка';
    }
    if (sense === 'alone') return 'один';
    if (sense === 'socialize') return 'заводить знакомства';
    if (sense === 'awkward') return 'неловко';
    if (sense === 'grit') return 'через силу';
    if (sense === 'approval') return 'признание';
    if (/[а-яё]/i.test(g)) {
      const parts = g.split(/\s+/).filter(Boolean);
      const first = parts[0]?.replace(/[.…,;:]+$/g, '') ?? g;
      const LIGHT = /^(заводить|делать|быть|стать|иметь|давать|брать|to|make|get)$/i;
      if (LIGHT.test(first) && parts[1]) {
        const two = `${first} ${parts[1].replace(/[.…,;:]+$/g, '')}`;
        return two.length > 24 ? `${two.slice(0, 22)}…` : two;
      }
      if (first.length >= 3) return first.length > 18 ? `${first.slice(0, 16)}…` : first;
    }
  }

  if (g.length > 22) g = `${g.slice(0, 20)}…`;
  return g || 'это';
}

function isPlausibleHeadword(word: string, lang: CompanionChatApiLanguage): boolean {
  const w = word.trim();
  if (w.length < 1 || w.length > 24) return false;
  if (/^(то|и|или|нание|чьих|те|с|of|to)\b/i.test(w)) return false;
  if (/,|;|，|、/.test(w)) return false;
  if (lang === 'chinese') return hasHan(w) && !hasCyrillic(w);
  if (lang === 'russian') return hasCyrillic(w) && !hasHan(w);
  if (lang === 'french' || lang === 'german' || lang === 'english') {
    return /[A-Za-zÀ-ÿÄÖÜäöüß]/.test(w) && !hasHan(w) && !hasCyrillic(w);
  }
  return true;
}

function inferSense(word: string, gloss: string): Sense {
  const g = `${word} ${gloss}`.toLowerCase();
  if (/狗|dog|slang|单身|одиноч|single person|целик|девствен/i.test(g)) return 'person_slang';
  if (/(^|[^а-яё])один([^а-яё]|$)|alone|одино|single(?!\s*dog)|seul|allein|单身(?!狗)/i.test(g)) {
    return 'alone';
  }
  if (/结交|交友|结识|认识朋友|завод(ить|ить)?\s*знаком|друз|friend|acquaint|associate with|make friends/i.test(g)) {
    return 'socialize';
  }
  if (/别扭|awkward|неловк|неудобн|неуютн|напряжённ|напряженн/i.test(g)) return 'awkward';
  if (/硬着头皮|gritted|через силу|скрепя|нехотя|force oneself|brace oneself/i.test(g)) return 'grit';
  if (/认可|признан|одобр|approval|recognition|agree with|consent/i.test(g)) return 'approval';
  return 'none';
}

function hashPick(seed: string, n: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % Math.max(1, n);
}

function pickVariety(bank: Sentence[], word: string, count = 4): Sentence[] {
  if (bank.length <= count) return bank.slice();
  const start = hashPick(word, bank.length);
  const out: Sentence[] = [];
  for (let i = 0; i < bank.length && out.length < count; i++) {
    out.push(bank[(start + i) % bank.length]!);
  }
  return out;
}

function zhExamples(word: string, meaning: string, sense: Sense): Sentence[] {
  if (sense === 'person_slang') {
    const label = /пёс|пес|dog/i.test(meaning) ? '«одиноким псом»' : `«${meaning}»`;
    return pickVariety(
      [
        {
          l2: `过年回家，亲戚又问我怎么还是${word}。`,
          translation: `На праздники дома родственники снова спрашивают, почему я всё ещё ${label}.`,
        },
        {
          l2: `朋友开玩笑叫我${word}，我只能笑笑。`,
          translation: `Друзья в шутку зовут меня ${label} — мне остаётся только улыбнуться.`,
        },
        {
          l2: `别整天喊自己${word}，先去认识新朋友。`,
          translation: `Не называй себя весь день ${label} — лучше познакомься с новыми людьми.`,
        },
        {
          l2: `他发朋友圈自嘲：「又一个${word}的周五。」`,
          translation: `Он написал в ленту с самоиронией: «Опять пятница для ${label}.»`,
        },
      ],
      word,
    );
  }
  if (sense === 'alone' && [...word].length <= 2) {
    return pickVariety(
      [
        {
          l2: `餐厅只有${word}人座，我们得拼桌。`,
          translation: `В ресторане только места для одного — придётся подсаживаться.`,
        },
        {
          l2: `这张是${word}程票，回程要另买。`,
          translation: `Это билет в одну сторону — обратно нужно покупать отдельно.`,
        },
        {
          l2: `他点了${word}人套餐，自己慢慢吃。`,
          translation: `Он взял набор на одного и ест неторопливо.`,
        },
        {
          l2: `今晚就我${word}人在家，不想叫外卖。`,
          translation: `Сегодня вечером я один дома и не хочу заказывать доставку.`,
        },
      ],
      word,
    );
  }
  if (sense === 'socialize') {
    return pickVariety(
      [
        {
          l2: `到了新公司，他想多${word}一些靠谱的同事。`,
          translation: `На новой работе он хочет ${meaning} с нормальными коллегами.`,
        },
        {
          l2: `她不太敢主动${word}新朋友，总觉得尴尬。`,
          translation: `Ей неловко самой ${meaning} — всегда стесняется.`,
        },
        {
          l2: `留学那年，我${word}了好几个外国朋友。`,
          translation: `В год учёбы за границей я завёл(а) знакомства с несколькими иностранцами.`,
        },
        {
          l2: `别急着${word}酒肉朋友，先看看人靠不靠谱。`,
          translation: `Не спеши ${meaning} с кем попало — сначала посмотри, надёжный ли человек.`,
        },
        {
          l2: `通过兴趣班更容易${word}志同道合的人。`,
          translation: `Через кружки по интересам проще ${meaning} с людьми «на одной волне».`,
        },
      ],
      word,
    );
  }
  if (sense === 'awkward') {
    return pickVariety(
      [
        {
          l2: `气氛突然变得很${word}，谁也不说话。`,
          translation: `Атмосфера внезапно стала ${meaning} — все замолчали.`,
        },
        {
          l2: `我觉得跟他单独相处有点${word}。`,
          translation: `Мне немного ${meaning} оставаться с ним наедине.`,
        },
        {
          l2: `两人之间的关系越来越${word}了。`,
          translation: `Отношения между ними стали всё более ${meaning}.`,
        },
        {
          l2: `别${word}了，有话就直说吧。`,
          translation: `Хватит этой ${meaning === 'неловко' ? 'неловкости' : meaning} — говори прямо.`,
        },
      ],
      word,
    );
  }
  if (sense === 'grit') {
    return pickVariety(
      [
        {
          l2: `没办法，只好${word}去跟老板谈加薪。`,
          translation: `Деваться некуда — пришлось ${meaning} идти к боссу просить прибавку.`,
        },
        {
          l2: `他${word}答应了这个麻烦的差事。`,
          translation: `Он ${meaning} согласился на это неприятное поручение.`,
        },
        {
          l2: `她${word}走进面试房间。`,
          translation: `Она ${meaning} вошла в комнату на собеседование.`,
        },
        {
          l2: `这次只能${word}把话说清楚。`,
          translation: `В этот раз остаётся только ${meaning} всё проговорить вслух.`,
        },
      ],
      word,
    );
  }
  if (sense === 'approval') {
    return pickVariety(
      [
        {
          l2: `他的方案终于得到了老板的${word}。`,
          translation: `Его план наконец получил ${meaning} босса.`,
        },
        {
          l2: `我很${word}你这个想法。`,
          translation: `Я очень ${meaning === 'признание' ? 'одобряю' : meaning} эту твою идею.`,
        },
        {
          l2: `没有大家的${word}，计划很难推进。`,
          translation: `Без общего ${meaning === 'признание' ? 'одобрения' : meaning} план почти не сдвинуть.`,
        },
        {
          l2: `这份努力值得被${word}。`,
          translation: `Такие усилия заслуживают ${meaning === 'признание' ? 'признания' : meaning}.`,
        },
      ],
      word,
    );
  }
  return [];
}

/** Берём готовые фразы из ответа учителя — они уже с правильным употреблением. */
function extractLessonUsages(text: string, word: string): Sentence[] {
  const out: Sentence[] = [];
  const seen = new Set<string>();
  const lines = text.split(/\n/);

  const push = (l2: string, translation: string) => {
    const a = l2.trim().replace(/^[-•*\d.)\s]+/, '');
    const b = translation.trim();
    if (!a.includes(word) || !hasHan(a) || b.length < 3) return;
    if (/[—–]/.test(a) && a.replace(/\s/g, '').startsWith(word)) return; // definition line
    if (hasCyrillic(a)) return;
    if (a.length < word.length + 2 || a.length > 80) return;
    const key = a.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ l2: a, translation: b });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? '';
    if (!line || !line.includes(word) || !hasHan(line)) continue;

    const inline = line.match(/^(.+?[。！？])\s*[（(]([^）)]{3,160})[）)]\s*$/);
    if (inline) {
      push(inline[1], inline[2]);
      continue;
    }

    const next = lines[i + 1]?.trim() ?? '';
    const parenOnly = next.match(/^[（(]([^）)]{3,160})[）)]\s*$/);
    if (parenOnly && /[。！？]/.test(line)) {
      push(line.replace(/[（(][^）)]*[）)]\s*$/, '').trim(), parenOnly[1]);
    }
  }

  return out.slice(0, 4);
}

function enExamples(word: string, meaning: string, sense: Sense): Sentence[] {
  if (sense === 'person_slang') {
    return pickVariety(
      [
        { l2: `My cousins still call me a ${word} at family dinners.`, translation: `Родственники до сих пор называют меня ${meaning} за семейным ужином.` },
        { l2: `He posted a joke about being a ${word} again this Friday.`, translation: `Он снова пошутил в посте, что он ${meaning} в эту пятницу.` },
        { l2: `Stop labeling yourself a ${word} — go meet people.`, translation: `Хватит называть себя ${meaning} — иди знакомиться.` },
      ],
      word,
    );
  }
  if (sense === 'alone') {
    return pickVariety(
      [
        { l2: `I spent the weekend ${word} and actually liked the quiet.`, translation: `Я провёл(а) выходные ${meaning} и мне даже понравилась тишина.` },
        { l2: `She prefers to travel ${word} rather than join a tour group.`, translation: `Она предпочитает путешествовать ${meaning}, а не с группой.` },
      ],
      word,
    );
  }
  if (sense === 'socialize') {
    return pickVariety(
      [
        { l2: `At the new job he wants to ${word} a few solid coworkers.`, translation: `На новой работе он хочет ${meaning} с нормальными коллегами.` },
        { l2: `She's shy about trying to ${word} new people.`, translation: `Ей неловко ${meaning} с новыми людьми.` },
        { l2: `Study abroad made it easier to ${word} friends from other countries.`, translation: `Учёба за границей помогла ${meaning} с иностранцами.` },
      ],
      word,
    );
  }
  return [];
}

function frExamples(word: string, meaning: string, sense: Sense): Sentence[] {
  if (sense === 'person_slang' || sense === 'alone') {
    return pickVariety(
      [
        { l2: `Mes cousins me traitent encore de ${word} aux repas de famille.`, translation: `Двоюродные на семейных ужинах всё ещё называют меня ${meaning}.` },
        { l2: `Elle préfère voyager ${word} plutôt qu'en groupe.`, translation: `Она предпочитает путешествовать ${meaning}, а не группой.` },
      ],
      word,
    );
  }
  return [];
}

function deExamples(word: string, meaning: string, sense: Sense): Sentence[] {
  if (sense === 'person_slang' || sense === 'alone') {
    return pickVariety(
      [
        { l2: `Meine Verwandten nennen mich immer noch ${word}.`, translation: `Родственники до сих пор называют меня ${meaning}.` },
        { l2: `Sie reist lieber ${word} als in einer Gruppe.`, translation: `Она предпочитает путешествовать ${meaning}, а не в группе.` },
      ],
      word,
    );
  }
  return [];
}

function ruExamples(word: string, meaning: string, sense: Sense): Sentence[] {
  if (sense === 'person_slang' || sense === 'alone') {
    return pickVariety(
      [
        { l2: `Родственники снова спрашивают, почему я ${word}.`, translation: `Relatives ask again why I'm ${meaning}.` },
        { l2: `Друзья в шутку зовут меня ${word}.`, translation: `Friends jokingly call me ${meaning}.` },
      ],
      word,
    );
  }
  return [];
}

function buildSentences(
  lang: CompanionChatApiLanguage,
  word: string,
  gloss: string,
  ui: UiLang,
  explanation: string,
): Sentence[] {
  const fromLesson =
    lang === 'chinese' ? extractLessonUsages(explanation, word) : [];
  const sense = inferSense(word, gloss);
  const meaning = meaningLabel(gloss, ui, sense);

  let templated: Sentence[] = [];
  if (sense !== 'none') {
    if (lang === 'chinese') templated = zhExamples(word, meaning, sense);
    else if (lang === 'french') templated = frExamples(word, meaning, sense);
    else if (lang === 'german') templated = deExamples(word, meaning, sense);
    else if (lang === 'russian') templated = ruExamples(word, meaning, sense);
    else templated = enExamples(word, meaning, sense);
  }

  const merged: Sentence[] = [];
  const seen = new Set<string>();
  for (const s of [...fromLesson, ...templated]) {
    if (!s.l2.includes(word) || isHollowVocabExample(s.l2, s.translation)) continue;
    const key = s.l2.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(s);
  }
  return merged.slice(0, 4);
}

function pairsFromLessonVocab(
  text: string,
  language: CompanionChatApiLanguage,
): { word: string; gloss: string; pinyin?: string }[] {
  const blocks = parseTeacherMessageBlocks(text) ?? [];
  const out: { word: string; gloss: string; pinyin?: string }[] = [];
  const seen = new Set<string>();

  const pushPair = (wordRaw: string, gloss: string, pinyin?: string) => {
    const cleaned = cleanHeadword(wordRaw);
    let w = cleaned.word;
    let g = gloss.trim();
    if (language === 'chinese' && !hasHan(w) && hasHan(g)) {
      const swap = w;
      w = cleanHeadword(g).word;
      g = swap;
    }
    if (!isPlausibleHeadword(w, language)) return;
    if (g.length < 1) return;
    if (g.length > 80) g = `${g.slice(0, 78)}…`;
    const key = w.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      word: w,
      gloss: g,
      pinyin: pinyin ?? cleaned.pinyin ?? (language === 'chinese' ? pinyinZhSync(w) ?? undefined : undefined),
    });
  };

  for (const block of blocks) {
    const titleOk =
      isVocabularyTitle(block.title) ||
      isPhraseTitle(block.title) ||
      /простым\s+языком|plain\s+english|简单说明|лексик|vocab/i.test(block.title);
    if (!titleOk) continue;
    const lines = parseTeacherBlockLines(block.body, {
      vocabulary: true,
      phrase: isPhraseTitle(block.title),
    });
    for (const line of lines) {
      if (line.kind === 'vocab') {
        pushPair(line.word, line.gloss);
        continue;
      }
      if (line.kind === 'dialogue') continue;
      const textLine = line.text;
      const dash = textLine.match(/^(.+?)\s*[—–→]\s*(.+)$/) ?? textLine.match(/^(.+?)\s+-\s+(.+)$/);
      if (dash) {
        pushPair(dash[1], dash[2].split(/[.;]/)[0] ?? dash[2]);
        continue;
      }
      const paren = textLine.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      if (paren) {
        const inner = paren[2].trim();
        if (/^[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü\s]+$/i.test(inner) && hasHan(paren[1])) {
          pushPair(paren[1], paren[1], inner);
        } else {
          pushPair(paren[1], inner);
        }
        continue;
      }
      if (line.kind === 'phrase') pushPair(textLine, textLine);
    }
  }

  if (out.length === 0) {
    for (const p of extractPairsFromTeacherText(text).slice(0, 8)) {
      pushPair(p.front, p.back, p.pinyin);
    }
  }

  return out.slice(0, 6);
}

/**
 * Instant offline examples: lesson sentences first, then safe sense templates.
 * AI may upgrade later — never block the learner on a cold server.
 */
export function buildLocalVocabExamples(
  explanation: string,
  language: CompanionChatApiLanguage,
  uiLanguage: UiLang,
): TeacherVocabWordCard[] {
  const pairs = pairsFromLessonVocab(explanation, language);
  if (pairs.length === 0) return [];

  const cards: TeacherVocabWordCard[] = pairs.map(({ word, gloss, pinyin }) => {
    const sentences = buildSentences(language, word, gloss, uiLanguage, explanation)
      .map((s) => ({
        l2: s.l2,
        translation: s.translation,
        pinyin: s.pinyin ?? (language === 'chinese' ? pinyinZhSync(s.l2) ?? undefined : undefined),
      }))
      .filter((s) => {
        if (language === 'chinese' && hasCyrillic(s.l2)) return false;
        if (language === 'chinese' && !hasHan(s.l2)) return false;
        return true;
      });
    return {
      word,
      gloss,
      pinyin: pinyin ?? (language === 'chinese' ? pinyinZhSync(word) ?? undefined : undefined),
      sentences,
    };
  });

  return filterVocabExamplesNotInExplanation(
    cards.filter((c) => c.sentences.length > 0),
    explanation,
    language,
    { allowFromExplanation: true },
  );
}
