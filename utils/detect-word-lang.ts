/** Эвристика: CJK → zh, кириллица → ru, иначе en. */

export type WordScriptLang = 'en' | 'zh' | 'ru';

const CJK = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
const CYR = /[\u0400-\u04FF]/;

export function detectWordLang(word: string): WordScriptLang {
  const w = word.trim();
  if (!w) return 'en';
  if (CJK.test(w)) return 'zh';
  if (CYR.test(w)) return 'ru';
  return 'en';
}

export function entryScriptLang(entry: { lang?: WordScriptLang; word: string }): WordScriptLang {
  return entry.lang ?? detectWordLang(entry.word);
}
