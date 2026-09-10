import type { CompanionChatApiLanguage } from '@/types/companion-chat-api';

const EXPLICIT_L2 = new Set<CompanionChatApiLanguage>(['english', 'chinese', 'german', 'french']);

/** Явный запрос сменить/учить другой L2 («хочу английские слова»). */
export function detectExplicitL2Switch(seed: string): CompanionChatApiLanguage | null {
  const t = seed.trim();
  if (t.length < 4) return null;

  const want = (langRe: string) =>
    new RegExp(
      `(?:` +
        `(?:хочу|хотел|хотела|давай|нужно|надо|помоги|научи|учить|выучить|изучать|учитьс\\w*|learn|study|want\\s+to\\s+learn|give\\s+me|дай).{0,56}${langRe}` +
        `|` +
        `${langRe}.{0,48}(?:слов\\w*|words?|язык\\w*|language|phrases?|лексик\\w*|vocabulary|грамматик\\w*|grammar)` +
        `)`,
      'iu',
    ).test(t);

  if (want('(?:английск\\w*|\\benglish\\b)')) return 'english';
  if (want('(?:китайск\\w*|\\bchinese\\b|中文|汉语)')) return 'chinese';
  if (want('(?:немецк\\w*|\\bgerman\\b|deutsch)')) return 'german';
  if (want('(?:французск\\w*|\\bfrench\\b|fran[cç]ais)')) return 'french';
  return null;
}

function detectStrongTargetLanguage(seed: string): CompanionChatApiLanguage | null {
  const t = seed.trim();
  if (!t) return null;

  const switched = detectExplicitL2Switch(t);
  if (switched) return switched;

  if (
    /[\u4e00-\u9fff]/.test(t) ||
    /点餐|中文|китай|\bchina\b|\bhsk\b|хск|汉语|医院|мандарин|上海|shanghai|bund|南京东路/iu.test(
      t,
    )
  ) {
    return 'chinese';
  }

  if (/[\uac00-\ud7af]/.test(t) || /сеул|seoul|hongdae|인생네컷|한국|корей/iu.test(t)) {
    return 'english';
  }

  if (
    /pin\s*eingeben|geld\s*abheben|geldautomat|deutsch|german|\bberlin\b|[äöüß]|немецк/iu.test(t) ||
    /\b(bitte|danke|entschuldigung|sprechen)\b/iu.test(t)
  ) {
    return 'german';
  }

  if (
    /billet\s*t\+|navigo|métro|metro|guimard|paris|français|francais|french|où\s*est|ou\s*est|французск/iu.test(
      t,
    ) ||
    /\b(bonjour|merci|s'il\s*vous\s*plaît|s'il\s*vous\s*plait)\b/iu.test(t)
  ) {
    return 'french';
  }

  if (/англи|english|airport\s*english/iu.test(t)) return 'english';

  if (/旅行|日本語|japan/iu.test(t)) return 'english';

  return null;
}

/**
 * Целевой язык урока (L2), не родной.
 * Родной (UI/объяснения) — отдельно; здесь только что учить.
 */
export function inferTeacherLessonLanguage(
  seed: string,
  fallback: CompanionChatApiLanguage = 'english',
): CompanionChatApiLanguage {
  const t = seed.trim();
  const sessionFallback = fallback === 'russian' ? 'english' : fallback;

  if (!t) return sessionFallback;

  const strong = detectStrongTargetLanguage(t);
  if (strong) return strong;

  if (EXPLICIT_L2.has(fallback)) {
    return sessionFallback;
  }

  return sessionFallback;
}

/** L2 для drill: явный switch из последнего вопроса ученика важнее языка сессии. */
export function resolveDrillTargetLanguage(
  sessionLanguage: CompanionChatApiLanguage,
  lastUserMessage: string,
): CompanionChatApiLanguage {
  const switched = detectExplicitL2Switch(lastUserMessage);
  if (switched) return switched;
  if (EXPLICIT_L2.has(sessionLanguage)) {
    return sessionLanguage;
  }
  return inferTeacherLessonLanguage(lastUserMessage, 'english');
}
