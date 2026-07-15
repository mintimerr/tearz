import type { WordScriptLang } from '@/utils/detect-word-lang';

const CJK = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;

/** Латиница как отдельный «слой» (английский текст вперемешку с русским и т.д.) */
function hasEnglishLayer(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  return /[a-zA-Z]{2,}/.test(t);
}

function hasCyrillicLayer(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  return /[\u0400-\u04FF]{2,}/.test(t);
}

/**
 * Какие языки (en/zh/ru) прослеживаются в пользовательском запросе или сообщении.
 * Не добавляет язык за единичные символы латиницы без слова из 2+ букв.
 */
export function detectStudyLangsInText(text: string): WordScriptLang[] {
  const t = text.trim();
  if (!t) return [];
  const out = new Set<WordScriptLang>();
  if (CJK.test(t)) out.add('zh');
  if (hasEnglishLayer(t)) out.add('en');
  if (hasCyrillicLayer(t)) out.add('ru');
  return (['en', 'zh', 'ru'] as const).filter((l) => out.has(l));
}
