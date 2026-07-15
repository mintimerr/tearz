import type { AppLocale } from '@/constants/i18n/translations';
import { VOCAB_LANG_PAIRS } from '@/constants/vocab-reference-decks';
import type { VocabularyEntry } from '@/contexts/vocabulary-context';
import { detectWordLang } from '@/utils/detect-word-lang';
import { mergeTranslationVariants } from '@/utils/translation-variants';
import { pinyinZhSync } from '@/utils/pinyin-zh';
import { throwIfAborted } from '@/utils/abort-error';
import { translateToLocaleDetailed, type TranslateSource } from '@/utils/translate-word';
import { lookupZhRuLexicon } from '@/utils/zh-ru-lexicon';
import { translateZhToLocale } from '@/utils/zh-translate';

export type CardSuggestionCard = {
  front: string;
  back: string;
  pinyin?: string;
};

export type CardSuggestionResult = {
  translation: string | null;
  pinyin: string | null;
  translationSource: 'none' | 'local' | 'cache' | 'network';
};

type RefEntry = { back: string; pinyin?: string; lang: 'en' | 'zh' };

function normLatin(w: string) {
  return w.trim().toLowerCase();
}

function normZh(w: string) {
  return w.trim();
}

function wordKey(word: string, lang: ReturnType<typeof detectWordLang>) {
  return lang === 'zh' ? normZh(word) : normLatin(word);
}

const REF_INDEX = new Map<string, RefEntry>();
for (const pair of VOCAB_LANG_PAIRS) {
  const lang: RefEntry['lang'] = pair.id.startsWith('zh') ? 'zh' : 'en';
  for (const card of pair.cards) {
    REF_INDEX.set(wordKey(card.front, lang), {
      back: card.back,
      pinyin: card.pinyin,
      lang,
    });
  }
}

function lookupLocalTranslation(
  word: string,
  targetLocale: AppLocale,
  extra: { entries?: VocabularyEntry[]; folderCards?: CardSuggestionCard[] },
): string | null {
  const w = word.trim();
  if (!w) return null;
  const lang = detectWordLang(w);
  const key = wordKey(w, lang);

  for (const entry of extra.entries ?? []) {
    const entryLang = entry.lang ?? detectWordLang(entry.word);
    if (wordKey(entry.word, entryLang) === key && entry.translation?.trim()) {
      return normalizeTranslation(w, targetLocale, entry.translation.trim());
    }
  }

  for (const card of extra.folderCards ?? []) {
    const cardLang = detectWordLang(card.front);
    if (wordKey(card.front, cardLang) === key && card.back.trim()) {
      return normalizeTranslation(w, targetLocale, card.back.trim());
    }
  }

  const ref = REF_INDEX.get(key);
  if (ref && targetLocale === 'ru') {
    return normalizeTranslation(w, targetLocale, ref.back);
  }

  if (lang === 'zh' && targetLocale === 'ru') {
    const lex = lookupZhRuLexicon(w);
    if (lex) return normalizeTranslation(w, targetLocale, lex);
  }

  return null;
}

function normalizeTranslation(word: string, targetLocale: AppLocale, text: string | null): string | null {
  if (!text?.trim()) return null;
  return mergeTranslationVariants(word, targetLocale, text.trim());
}

function lookupLocalPinyin(
  word: string,
  extra: { entries?: VocabularyEntry[]; folderCards?: CardSuggestionCard[] },
): string | null {
  const w = word.trim();
  if (!w || detectWordLang(w) !== 'zh') return null;

  const key = wordKey(w, 'zh');
  const ref = REF_INDEX.get(key);
  if (ref?.pinyin) return ref.pinyin;

  for (const entry of extra.entries ?? []) {
    const entryLang = entry.lang ?? detectWordLang(entry.word);
    if (wordKey(entry.word, entryLang) === key && entry.pinyin?.trim()) {
      return entry.pinyin.trim();
    }
  }

  for (const card of extra.folderCards ?? []) {
    if (wordKey(card.front, detectWordLang(card.front)) === key && card.pinyin?.trim()) {
      return card.pinyin.trim();
    }
  }

  return pinyinZhSync(w);
}

/** Мгновенные поля без сети: локальный словарь + синхронный пиньинь. */
export function instantCardFields(
  word: string,
  targetLocale: AppLocale,
  extra: { entries?: VocabularyEntry[]; folderCards?: CardSuggestionCard[] } = {},
): Pick<CardSuggestionResult, 'translation' | 'pinyin'> {
  const w = word.trim();
  if (!w) return { translation: null, pinyin: null };

  const lang = detectWordLang(w);

  let pinyin: string | null = null;
  if (lang === 'zh') {
    pinyin = lookupLocalPinyin(w, extra);
  }

  return {
    translation: lookupLocalTranslation(w, targetLocale, extra),
    pinyin,
  };
}

/** Полное разрешение: локально → кэш/API перевода. */
export async function fetchCardSuggestion(
  word: string,
  targetLocale: AppLocale,
  extra: {
    entries?: VocabularyEntry[];
    folderCards?: CardSuggestionCard[];
    signal?: AbortSignal;
  } = {},
): Promise<CardSuggestionResult> {
  const w = word.trim();
  if (!w) {
    return { translation: null, pinyin: null, translationSource: 'none' };
  }

  const instant = instantCardFields(w, targetLocale, extra);
  if (instant.translation) {
    return { ...instant, translationSource: 'local' };
  }

  throwIfAborted(extra.signal);

  const source: TranslateSource = detectWordLang(w);
  const { text, fromCache } =
    source === 'zh'
      ? await translateZhToLocale(w, targetLocale, { signal: extra.signal })
      : await translateToLocaleDetailed(w, source, targetLocale, {
          signal: extra.signal,
        });

  throwIfAborted(extra.signal);

  return {
    translation: normalizeTranslation(w, targetLocale, text),
    pinyin: instant.pinyin,
    translationSource: text ? (fromCache ? 'cache' : 'network') : 'none',
  };
}
