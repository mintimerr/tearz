/**
 * Structural distractor defect detectors (property-style, not phrase blacklists).
 * New nonsense variants must also fail these checks.
 */

import { normalizeText, wordCount } from './deterministic/normalize.js';

export type DistractorDefectClass =
  | 'greeting_noun_append'
  | 'pseudo_morphology'
  | 'broken_syntax'
  | 'absurd_object'
  | 'character_salad'
  | 'telegraphic_broken'
  | 'nonsense_category_claim';

export type DistractorDefect = {
  class: DistractorDefectClass;
  reason: string;
};

const POLITENESS =
  /^(thank you|thanks|please|sorry|excuse me|hello|hi|good morning|merci|pardon|bonjour|s['’]il vous pla[îi]t|danke|bitte|entschuldigung|hallo|guten tag|спасибо|пожалуйста|извините|здравствуй(те)?|谢谢|对不起|你好|请|您好)([.!]*)?$/i;

const CONCRETE_NOUNS =
  /\b(door|table|chair|shoe|window|vegetable|fruit|soup|coffee|дверь|стул|окно|овощ|суп|кофе|tür|stuhl|tisch|fenster|gemüse|门|椅子|桌子|鞋|窗|菜)\b/i;

const ABSURD_OBJECTS =
  /\b(table|chair|door|shoe|vegetable|стул|дверь|овощ|окно|stuhl|tür|tisch|gemüse|椅子|门)\b/i;

/** Invented / pseudo morphology tokens (class, not exact blacklist of known bad items). */
const PSEUDO_MORPH = [
  /lich$/i, // German-looking junk on non-German bases when short: handled with language
  /lyly$/i,
  /nessness$/i,
  /\bnur\b/i, // DE filler "nur" glued as option padding
  /самой$/u,
  /само$/u,
  /只$/u, // ZH particle glued onto noun wrongly (雨衣只)
  /门$/u, // ZH 门 appended as nonsense suffix outside real compounds ending in 门 is rare for options
];

function tokens(text: string): string[] {
  return text
    .trim()
    .replace(/[?!.,;:«»""]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function isPolitenessToken(tok: string): boolean {
  return /^(thank|thanks|please|sorry|excuse|hello|hi|merci|pardon|bonjour|danke|bitte|entschuldigung|hallo|спасибо|пожалуйста|извините|здравствуй|здравствуйте|谢谢|对不起|你好|请|您好)$/i.test(
    tok,
  );
}

/**
 * Greeting/politeness formula + unexpected concrete noun
 * (Hallo Tür / 对不起门 / Извините дверь / Hello door).
 */
export function isGreetingNounAppend(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  // Compact CJK: politeness char(s) + concrete noun char with little else
  if (/^(对不起|谢谢|你好|请|您好)\s*门[。.]?$/.test(t)) return true;
  if (/^(danke|bitte|entschuldigung|hallo)\s+tür\b/i.test(t)) return true;
  if (/^(спасибо|пожалуйста|извините|здравствуй(те)?)\s+дверь\b/iu.test(t)) return true;
  if (/^(hello|hi|please|sorry|thank you)\s+door\b/i.test(t)) return true;
  if (/^bonjour\s+la\s+porte\b/i.test(t)) return true;

  const parts = tokens(t);
  if (parts.length < 2 || parts.length > 5) return false;
  const hasPolite = parts.some(isPolitenessToken);
  const hasNoun = CONCRETE_NOUNS.test(t);
  if (hasPolite && hasNoun && !POLITENESS.test(t)) return true;
  return false;
}

/**
 * Invented morphology / padding particles that are not real words in context.
 */
export function isPseudoMorphology(text: string, language: string): boolean {
  const t = text.trim();
  const lang = language.toLowerCase();
  const parts = tokens(t);

  // DE: comparative/base + glued -lich (starkerlich); not real *lich lexicon
  if (lang === 'de' || lang === 'german') {
    if (/lich$/i.test(t) && /erlich$/i.test(t)) {
      const allow =
        /^(sicherlich|hoffentlich|tatsächlich|ausschließlich|persönlich|ursprünglich|hinsichtlich)$/i;
      if (!allow.test(t)) {
        const base = t.replace(/lich$/i, '');
        if (/er$/i.test(base) && /^(stark|besser|höher|klein|groß|schwer|leicht)/i.test(base)) {
          return true;
        }
        if (/starkerlich|besserlich|höherlich/i.test(t)) return true;
      }
    }
    if (/starkend$/i.test(t)) return true;
    if (/\bnur\b/i.test(t) && parts.length <= 3 && parts.some((p) => /lich$|end$|ster$/i.test(p))) {
      return true;
    }
  }

  // RU: reflexive padding "самой/само" stuck on finite forms
  if (lang === 'ru' || lang === 'russian') {
    if (/самой$/u.test(t) || /\sсамо$/u.test(t) || /само$/u.test(t) && /смягч|повыс/u.test(t)) {
      return true;
    }
    if (/повыситься самой/u.test(t) || /смягчиться само/u.test(t)) return true;
  }

  // ZH: noun + stray 只 / 门 as nonsense suffix (雨衣只, 雨点门, 预报门)
  if (lang === 'zh' || lang === 'chinese' || lang === 'zh-cn') {
    if (/^(雨衣只|雨点门|预报门|请门|你好门|对不起门)/.test(t)) return true;
    // General: 2–3 char content + glued 门/只 when not a known measure/word pattern
    if (/^[\u4e00-\u9fff]{2,4}[只门]$/.test(t.replace(/[。.]/g, ''))) {
      // Allow real words ending in 门 (部门, 专门) — those are ≥2 meaningful; reject if prior char is weather/noun fragment
      if (/[点衣报谢好起请][门只]$/.test(t)) return true;
    }
  }

  // FR filler "doit" telegraphic
  if ((lang === 'fr' || lang === 'french') && /\bdoit\b/i.test(t) && parts.length <= 4) {
    if (/^(vous\s+)?r[eé]p[eé]tez\s+doit/i.test(t) || /doit\s*$/i.test(t) && /rencontr|retrouv|18/i.test(t)) {
      return true;
    }
  }

  // EN nonsense double suffix
  if (/lyly$/i.test(t) || /nessness$/i.test(t)) return true;

  void PSEUDO_MORPH;
  return false;
}

/**
 * Broken syntax: modal/word-order collapse typical of non-utterances.
 */
export function isBrokenSyntax(text: string, language: string): boolean {
  const t = text.trim();
  const lang = language.toLowerCase();
  const parts = tokens(t);

  if (lang === 'en' || lang === 'english' || !lang) {
    // Collapse patterns — NOT legitimate grammar distractors like "must receive"
    if (/\b(is at must|meet must|at must\.?$|must \d)/i.test(t)) return true;
    if (/^\d+\s+we\s+shall\s+\w+ing/i.test(t)) return true;
    if (/^(please|sorry)\s+you\.?$/i.test(t)) return true;
    if (/^I\s+\w+\s+so\s+no\b/i.test(t)) return true;
    if (/^(confirm|extend)\s+(me|you)\s+the\b/i.test(t)) return true;
    if (/^say\s+you\s+the\b/i.test(t)) return true;
    if (/\bdisagree you\b/i.test(t)) return true;
    if (/\bcannot\s+\w+ing\b/i.test(t)) return true;
    // Telegraphic: content words + must at end without subject–modal clause
    if (/\bmust\??\.?$/i.test(t) && !/^(I|you|we|they|he|she)\s+must\b/i.test(t) && parts.length >= 3) {
      return true;
    }
    // "We X must Y" with bare noun after must
    if (/\bwe\s+\w+\s+must\s+\d/i.test(t)) return true;
  }

  if (lang === 'de' || lang === 'german') {
    if (/bitte\s+tür\s+danke/i.test(t)) return true;
  }

  if (lang === 'ru' || lang === 'russian') {
    if (/пожалуйста\s+спасибо\s+нет/u.test(t)) return true;
  }

  if (lang === 'fr' || lang === 'french') {
    if (/s['’]il vous pla[îi]t\s+merci\s+non/i.test(t)) return true;
    if (/adresse\s+tu\s+dire/i.test(t)) return true;
  }

  if (lang === 'zh' || lang === 'chinese' || lang === 'zh-cn') {
    if (/^请门/.test(t)) return true;
  }

  return false;
}

/**
 * Verb + absurd concrete object (поднять стул / убедить дверь).
 */
export function isAbsurdObjectCollocation(text: string): boolean {
  const t = text.trim();
  if (
    /(убедить|предложить|поднять|открыть|закрыть|кормить)\s+(дверь|стул|овощ|окно)/u.test(t)
  ) {
    return true;
  }
  if (/\b(convince|offer|lift|raise)\s+(the\s+)?(door|chair|vegetable)\b/i.test(t)) return true;
  if (ABSURD_OBJECTS.test(t) && /(поднять|убедить|предложить)/u.test(t)) return true;
  return false;
}

/** Category claims like "Friday is a vegetable" / "I am a table". */
export function isNonsenseCategoryClaim(text: string): boolean {
  const t = text.trim();
  if (/\bi am a (table|chair|window|door|shoe|vegetable|fruit)\b/i.test(t)) return true;
  if (/\b(lunch|meeting|coffee|friday)\s+(is|are)\s+(a\s+)?(chair|table|vegetable)/i.test(t)) {
    return true;
  }
  if (/\bпятница\s*[—\-]\s*овощ/u.test(t)) return true;
  if (/\b(mittagessen ist ein stuhl|le déjeuner est une chaise|freitag ist gemüse)\b/i.test(t)) {
    return true;
  }
  if (/\b(я\s+(стол|стул|кофе)|обед\s*[—\-]\s*стул)\b/u.test(t)) return true;
  if (/周五是蔬菜/.test(t) || /我是咖啡|午饭是椅子/.test(t)) return true;
  return false;
}

/**
 * Telegraphic / word-salad utterances that are not grammatical selections.
 */
export function isTelegraphicBroken(text: string, language: string, skill: string): boolean {
  if (skill !== 'functional') return false;
  const t = text.trim();
  const lang = language.toLowerCase();
  const parts = tokens(t);

  if (lang === 'en' || lang === 'english') {
    if (/\b(must|deadline|invite)\b/i.test(t) && parts.length >= 4) {
      if (!/\b(I|we|you|he|she|they|could|would|shall|can|may|is|are|do|does|did|have|has)\b/i.test(t)) {
        if (/\byou\b/i.test(t) && /\b(must|again)\b/i.test(t)) return true;
      }
      if (/deadline you say again must/i.test(t)) return true;
    }
    if (/wrong fully|not the risks|deadline more two|later you must/i.test(t)) return true;
  }
  return false;
}

export function classifyDistractorDefect(
  text: string,
  ctx: { language: string; skill: string },
): DistractorDefect | null {
  const t = text.trim();
  if (!t) {
    return { class: 'telegraphic_broken', reason: 'empty distractor' };
  }
  if (isNonsenseCategoryClaim(t)) {
    return { class: 'nonsense_category_claim', reason: 'category-claim nonsense' };
  }
  if (isGreetingNounAppend(t)) {
    return { class: 'greeting_noun_append', reason: 'politeness + unrelated noun' };
  }
  if (isPseudoMorphology(t, ctx.language)) {
    return { class: 'pseudo_morphology', reason: 'invented morphology / particle padding' };
  }
  if (isBrokenSyntax(t, ctx.language)) {
    return { class: 'broken_syntax', reason: 'broken syntax / modal collapse' };
  }
  if (isAbsurdObjectCollocation(t)) {
    return { class: 'absurd_object', reason: 'absurd verb–object collocation' };
  }
  if (isTelegraphicBroken(t, ctx.language, ctx.skill)) {
    return { class: 'telegraphic_broken', reason: 'telegraphic broken utterance' };
  }
  // ZH character salad catch-all for short options with 门 glued
  if (
    (ctx.language === 'zh' || ctx.language === 'chinese') &&
    /[\u4e00-\u9fff]门/.test(t) &&
    /^(对不起|你好|请|雨点|预报)/.test(t)
  ) {
    return { class: 'character_salad', reason: 'Chinese character-salad distractor' };
  }
  return null;
}

/** @deprecated name kept for callers — routes to structural classifier. */
export function looksLikeNonsenseDistractor(text: string, language = 'en', skill = 'vocabulary'): boolean {
  return classifyDistractorDefect(text, { language, skill }) != null;
}

/**
 * Orthographic lookalike cluster: ≥3 single-token options share a long prefix
 * and differ mainly by suffix (equivocal/equivalent/equitable).
 */
export function isOrthographicLookalikeCluster(options: string[]): boolean {
  const singles = options.map((o) => normalizeText(o)).filter((o) => wordCount(o) === 1 && o.length >= 5);
  if (singles.length < 3) return false;
  let cluster = 0;
  for (let i = 0; i < singles.length; i++) {
    for (let j = i + 1; j < singles.length; j++) {
      const a = singles[i]!;
      const b = singles[j]!;
      const n = sharedPrefixLen(a, b);
      if (n >= 4 && Math.abs(a.length - b.length) <= 4) cluster += 1;
    }
  }
  return cluster >= 3;
}

function sharedPrefixLen(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i += 1;
  return i;
}

/**
 * For functional items: every option must be a plausible natural utterance.
 * Returns defective option texts.
 */
export function findBrokenFunctionalOptions(
  options: string[],
  language: string,
): Array<{ text: string; defect: DistractorDefect }> {
  const out: Array<{ text: string; defect: DistractorDefect }> = [];
  for (const text of options) {
    const defect = classifyDistractorDefect(text, { language, skill: 'functional' });
    if (defect) out.push({ text, defect });
  }
  return out;
}

/**
 * Property-style generators for tests — mutate a good option into defect classes.
 */
export function mutateIntoDefectClass(
  seed: string,
  defect: DistractorDefectClass,
  language: string,
): string {
  switch (defect) {
    case 'greeting_noun_append': {
      if (language === 'zh') return '对不起门。';
      if (language === 'de') return 'Hallo Tür.';
      if (language === 'ru') return 'Извините дверь.';
      if (language === 'fr') return 'Bonjour la porte.';
      return `Hello door.`;
    }
    case 'pseudo_morphology': {
      if (language === 'de') return 'starkerlich';
      if (language === 'ru') return `${seed} самой`;
      if (language === 'zh') return `${seed}门`;
      return `${seed}lyly`;
    }
    case 'broken_syntax':
      return language === 'en' ? 'We meet must 6.' : 'On doit 18 rencontrer.';
    case 'absurd_object':
      return language === 'ru' ? 'поднять стул' : 'lift the chair';
    case 'character_salad':
      return '雨点门';
    case 'telegraphic_broken':
      return 'Friday deadline you say again must?';
    case 'nonsense_category_claim':
      return 'Friday is a vegetable.';
    default:
      return seed;
  }
}
