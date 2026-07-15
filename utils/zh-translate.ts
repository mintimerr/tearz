import type { AppLocale } from '@/constants/i18n/translations';
import { fetchZhDictionaryEnGlosses } from '@/utils/google-zh-dictionary';
import { studyEnSensesToRu } from '@/utils/study-sense-ru';
import { mergeTranslationVariants } from '@/utils/translation-variants';
import { lookupZhRuLexicon } from '@/utils/zh-ru-lexicon';
import { translateToLocaleDetailed } from '@/utils/translate-word';

export async function translateZhToLocale(
  word: string,
  target: AppLocale,
  options: { signal?: AbortSignal } = {},
): Promise<{ text: string | null; fromCache: boolean }> {
  const q = word.trim();
  if (!q) return { text: null, fromCache: false };

  const lexicon = lookupZhRuLexicon(q);
  if (lexicon && target === 'ru') {
    return { text: lexicon, fromCache: true };
  }

  const enGlosses = await fetchZhDictionaryEnGlosses(q, options.signal);
  if (enGlosses.length > 0) {
    if (target === 'en') {
      const text = mergeTranslationVariants(q, 'en', enGlosses.join('; '));
      if (text) return { text, fromCache: false };
    }

    if (target === 'ru') {
      const studyRu = studyEnSensesToRu(enGlosses);
      if (studyRu) return { text: studyRu, fromCache: false };

      const viaEn = await translateToLocaleDetailed(enGlosses[0]!, 'en', 'ru', options);
      if (viaEn.text) {
        const merged = mergeTranslationVariants(q, 'ru', viaEn.text);
        if (merged) return { text: merged, fromCache: viaEn.fromCache };
      }
    }
  }

  return translateToLocaleDetailed(q, 'zh', target, options);
}
