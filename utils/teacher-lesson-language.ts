import type { CompanionChatApiLanguage } from '@/types/companion-chat-api';

/**
 * Целевой язык урока (L2), не родной.
 * Родной (UI/объяснения) — отдельно; здесь только что учить.
 */
export function inferTeacherLessonLanguage(
  seed: string,
  fallback: CompanionChatApiLanguage = 'english',
): CompanionChatApiLanguage {
  const t = seed.trim();
  if (!t) return fallback === 'russian' ? 'english' : fallback;

  // Китайский: иероглифы / HSK / явные маркеры / Shanghai metro
  if (
    /[\u4e00-\u9fff]/.test(t) ||
    /点餐|中文|китай|\bhsk\b|хск|汉语|医院|больниц|мандарин|单程票|怎么走|上海|shanghai|bund|南京东路/iu.test(
      t,
    )
  ) {
    return 'chinese';
  }

  // Корейский вайб (пока нет L2=korean в API → english для туристов в Сеуле)
  if (/[\uac00-\ud7af]/.test(t) || /сеул|seoul|hongdae|인생네컷|한국|корей/iu.test(t)) {
    return fallback === 'russian' ? 'english' : fallback;
  }

  // Немецкий: ATM / Berlin / типичные фразы
  if (
    /pin\s*eingeben|geld\s*abheben|geldautomat|deutsch|german|\bberlin\b|[äöüß]/iu.test(t) ||
    /\b(bitte|danke|entschuldigung|sprechen)\b/iu.test(t)
  ) {
    return 'german';
  }

  // Французский: Métro / Navigo / Paris
  if (
    /billet\s*t\+|navigo|métro|metro|guimard|paris|français|francais|french|où\s*est|ou\s*est/iu.test(
      t,
    ) ||
    /\b(bonjour|merci|s'il\s*vous\s*plaît|s'il\s*vous\s*plait)\b/iu.test(t)
  ) {
    return 'french';
  }

  // Явно английский
  if (/airport\s*english|english\s*(lesson|for)?|\benglish\b/iu.test(t)) return 'english';

  // Японский travel — пока учим полезный English для поездки (нет jp в API)
  if (/旅行|日本語|japan/iu.test(t)) return 'english';

  if (fallback === 'russian') return 'english';
  return fallback;
}
