import type { CompanionChatApiLanguage } from '@/types/companion-chat-api';

const EXPLICIT_L2 = new Set<CompanionChatApiLanguage>(['english', 'chinese', 'german', 'french']);

function detectStrongTargetLanguage(seed: string): CompanionChatApiLanguage | null {
  const t = seed.trim();
  if (!t) return null;

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
    /pin\s*eingeben|geld\s*abheben|geldautomat|deutsch|german|\bberlin\b|[äöüß]/iu.test(t) ||
    /\b(bitte|danke|entschuldigung|sprechen)\b/iu.test(t)
  ) {
    return 'german';
  }

  if (
    /billet\s*t\+|navigo|métro|metro|guimard|paris|français|francais|french|où\s*est|ou\s*est/iu.test(
      t,
    ) ||
    /\b(bonjour|merci|s'il\s*vous\s*plaît|s'il\s*vous\s*plait)\b/iu.test(t)
  ) {
    return 'french';
  }

  if (/airport\s*english|english\s*(lesson|for)?|\benglish\b/iu.test(t)) return 'english';

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

  // Явный L2 сессии (english/chinese/…) — не переопределяем по ответу учителя / старому topic.
  if (EXPLICIT_L2.has(fallback)) {
    const strong = detectStrongTargetLanguage(t);
    return strong ?? sessionFallback;
  }

  return detectStrongTargetLanguage(t) ?? sessionFallback;
}

/** L2 для drill: язык сессии, эвристика только по последнему вопросу ученика. */
export function resolveDrillTargetLanguage(
  sessionLanguage: CompanionChatApiLanguage,
  lastUserMessage: string,
): CompanionChatApiLanguage {
  if (EXPLICIT_L2.has(sessionLanguage)) {
    return sessionLanguage;
  }
  return inferTeacherLessonLanguage(lastUserMessage, 'english');
}
