import type { AppLocale } from '@/constants/i18n/translations';
import { variantsFromMyMemory, type MyMemoryResponse } from '@/utils/translation-variants';

export type TranslateSource = 'en' | 'zh' | 'ru';

const CACHE_LIMIT = 256;
const translationCache = new Map<string, string>();

function langToMyMemory(lang: TranslateSource | AppLocale): string {
  if (lang === 'zh') return 'zh-CN';
  if (lang === 'ru') return 'ru';
  return 'en';
}

function cacheKey(q: string, from: string, to: string) {
  return `${from}|${to}|${q.trim().toLowerCase()}`;
}

function readCache(key: string): string | null {
  const hit = translationCache.get(key);
  if (!hit) return null;
  translationCache.delete(key);
  translationCache.set(key, hit);
  return hit;
}

function writeCache(key: string, value: string) {
  if (translationCache.has(key)) translationCache.delete(key);
  translationCache.set(key, value);
  while (translationCache.size > CACHE_LIMIT) {
    const oldest = translationCache.keys().next().value;
    if (oldest) translationCache.delete(oldest);
  }
}

async function fetchLangPair(
  q: string,
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<{ text: string | null; fromCache: boolean }> {
  const key = cacheKey(q, from, to);
  const cached = readCache(key);
  if (cached) return { text: cached, fromCache: true };

  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${encodeURIComponent(
    `${from}|${to}`,
  )}`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return { text: null, fromCache: false };
    const data = (await res.json()) as MyMemoryResponse;
    const out = variantsFromMyMemory(q, to, data);
    if (!out) return { text: null, fromCache: false };
    writeCache(key, out);
    return { text: out, fromCache: false };
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e;
    return { text: null, fromCache: false };
  }
}

function pivotLang(source: TranslateSource, target: AppLocale): AppLocale {
  if (source !== 'en' && target !== 'en') return 'en';
  if (source !== 'ru' && target !== 'ru') return 'ru';
  return 'zh';
}

/**
 * Перевод слова/фразы на язык интерфейса приложения (родной язык пользователя).
 * Если исходник уже на целевом языке — pivot через третий язык для пояснения на карточке.
 */
export async function translateToLocale(
  text: string,
  source: TranslateSource,
  target: AppLocale,
  options: { signal?: AbortSignal } = {},
): Promise<string | null> {
  const result = await translateToLocaleDetailed(text, source, target, options);
  return result.text;
}

export async function translateToLocaleDetailed(
  text: string,
  source: TranslateSource,
  target: AppLocale,
  options: { signal?: AbortSignal } = {},
): Promise<{ text: string | null; fromCache: boolean }> {
  const q = text.trim();
  if (!q) return { text: null, fromCache: false };

  const { signal } = options;
  const from = langToMyMemory(source);
  const to = langToMyMemory(target);

  if (source === target) {
    const pivot = pivotLang(source, target);
    const pivotFrom = langToMyMemory(source);
    const pivotMid = langToMyMemory(pivot);
    const pivotTo = langToMyMemory(target);

    const via = await fetchLangPair(q, pivotFrom, pivotMid, signal);
    if (!via.text) return { text: null, fromCache: false };

    const back = await fetchLangPair(via.text, pivotMid, pivotTo, signal);
    return {
      text: back.text?.trim() ? back.text.trim() : null,
      fromCache: via.fromCache && back.fromCache,
    };
  }

  const translated = await fetchLangPair(q, from, to, signal);
  return { text: translated.text, fromCache: translated.fromCache };
}
