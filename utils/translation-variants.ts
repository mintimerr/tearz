const CYR = /[\u0400-\u04FF]/;
const CJK = /[\u3400-\u4DBF\u4E00-\u9FFF]/;

const MAX_VARIANTS = 5;

function normKey(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Разбивает строку на отдельные варианты перевода. */
export function splitTranslationVariants(text: string): string[] {
  return text
    .split(/[;|/]|(?:\s+или\s+)/gi)
    .flatMap((chunk) => chunk.split(',').map((s) => s.trim()))
    .map((s) => s.replace(/^\(+|\)+$/g, '').trim())
    .filter(Boolean);
}

export function isBadTranslation(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 120) return true;
  const lc = t.toLowerCase();
  return (
    lc.includes('mymemory warning') ||
    lc.includes('query length') ||
    lc.startsWith('error') ||
    lc.includes('invalid email')
  );
}

function looksLikeWrongTarget(translation: string, target: 'en' | 'zh' | 'ru'): boolean {
  const t = translation.trim();
  if (!t) return true;
  if (target === 'ru') return !CYR.test(t) && /[a-z]/i.test(t);
  if (target === 'zh') return !CJK.test(t) && !/[a-z]/i.test(t);
  if (target === 'en') return !/[a-z]/i.test(t);
  return false;
}

function isSameAsSource(translation: string, source: string): boolean {
  return normKey(translation) === normKey(source);
}

/** Объединяет варианты в одну строку через «; » без дублей. */
export function mergeTranslationVariants(
  sourceWord: string,
  targetLang: 'en' | 'zh' | 'ru',
  ...groups: (string | null | undefined)[]
): string | null {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const group of groups) {
    if (!group) continue;
    for (const part of splitTranslationVariants(group)) {
      if (isBadTranslation(part)) continue;
      if (isSameAsSource(part, sourceWord)) continue;
      if (looksLikeWrongTarget(part, targetLang)) continue;
      const key = normKey(part);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(part);
      if (out.length >= MAX_VARIANTS) break;
    }
    if (out.length >= MAX_VARIANTS) break;
  }

  return out.length ? out.join('; ') : null;
}

export type MyMemoryMatch = {
  segment?: unknown;
  translation?: unknown;
  quality?: unknown;
  match?: unknown;
};

export type MyMemoryResponse = {
  responseData?: { translatedText?: unknown };
  matches?: MyMemoryMatch[];
};

function targetLangFromCode(code: string): 'en' | 'zh' | 'ru' {
  if (code.startsWith('zh')) return 'zh';
  if (code.startsWith('ru')) return 'ru';
  return 'en';
}

function segmentMatchesQuery(segment: string, query: string): boolean {
  const s = segment.trim();
  const q = query.trim();
  if (!s || !q) return false;
  if (s === q) return true;
  return normKey(s) === normKey(q);
}

function matchScore(entry: MyMemoryMatch): number {
  const quality = Number(entry.quality ?? 0);
  const match = Number(entry.match ?? 0);
  return quality * 0.65 + match * 35;
}

/** Собирает основной перевод и альтернативы из ответа MyMemory. */
export function variantsFromMyMemory(
  query: string,
  targetCode: string,
  data: MyMemoryResponse,
): string | null {
  const targetLang = targetLangFromCode(targetCode);
  const primary =
    typeof data.responseData?.translatedText === 'string'
      ? data.responseData.translatedText.trim()
      : null;

  const ranked = [...(data.matches ?? [])].sort((a, b) => matchScore(b) - matchScore(a));
  const candidates: string[] = [];

  const primaryRow = data.matches?.[0];
  const primaryIsWeakMt =
    primary &&
    typeof primaryRow === 'object' &&
    primaryRow !== null &&
    String((primaryRow as MyMemoryMatch & { reference?: unknown }).reference ?? '').includes(
      'Machine Translation',
    ) &&
    Number(primaryRow.quality ?? 0) < 85;

  if (primary && !isBadTranslation(primary) && !primaryIsWeakMt) candidates.push(primary);

  for (const row of ranked) {
    const segment = typeof row.segment === 'string' ? row.segment : '';
    const translation = typeof row.translation === 'string' ? row.translation.trim() : '';
    if (!translation || isBadTranslation(translation)) continue;
    if (!segmentMatchesQuery(segment, query)) continue;

    const quality = Number(row.quality ?? 0);
    const match = Number(row.match ?? 0);
    if (quality <= 0 && match < 1) continue;
    if (quality > 0 && quality < 60 && match < 0.98) continue;

    candidates.push(translation);
  }

  return mergeTranslationVariants(query, targetLang, ...candidates);
}
