import type { ImageSource } from 'expo-image';

import { TEARZ_MARIO } from '@/components/game/tearz-mario-source';
import { studyLevelFromXp } from '@/utils/study-level';

export type TearzRarity = 'common' | 'rare' | 'legendary';

export type TearzCatalogItem = {
  id: string;
  nameRu: string;
  nameEn: string;
  rarity: TearzRarity;
  blurbRu: string;
  /** Как открыть — одна короткая строка для полки */
  howToGetRu: string;
  /** С этого уровня профиля. Если не задано — смотри unlockXp. */
  unlockLevel?: number;
  /** С этого количества XP. */
  unlockXp?: number;
  source: ImageSource;
};

/** Каталог Tearz — только Mario pixel sprites. */
export const TEARZ_CATALOG: TearzCatalogItem[] = [
  {
    id: 'newbie',
    nameRu: 'Newbie',
    nameEn: 'Newbie',
    rarity: 'common',
    blurbRu: 'Первый день в мире',
    howToGetRu: 'Даётся при старте',
    source: TEARZ_MARIO.idle,
  },
  {
    id: 'bookworm',
    nameRu: 'Bookworm',
    nameEn: 'Bookworm',
    rarity: 'common',
    blurbRu: 'Читает учебники',
    howToGetRu: 'С 5 уровня',
    unlockLevel: 5,
    source: TEARZ_MARIO.book,
  },
  {
    id: 'plaza',
    nameRu: 'Plaza',
    nameEn: 'Plaza',
    rarity: 'common',
    blurbRu: 'С телефоном в руках',
    howToGetRu: 'С 15 уровня',
    unlockLevel: 15,
    source: TEARZ_MARIO.phone,
  },
  {
    id: 'builder',
    nameRu: 'Builder',
    nameEn: 'Builder',
    rarity: 'common',
    blurbRu: 'Строит слова',
    howToGetRu: 'С 8 000 XP',
    unlockXp: 8000,
    source: TEARZ_MARIO.build,
  },
  {
    id: 'arcade-spark',
    nameRu: 'Arcade Spark',
    nameEn: 'Arcade Spark',
    rarity: 'rare',
    blurbRu: 'Недельный редкий',
    howToGetRu: 'С 20 000 XP',
    unlockXp: 20000,
    source: TEARZ_MARIO.jump,
  },
];

export const TEARZ_BY_ID = Object.fromEntries(TEARZ_CATALOG.map((t) => [t.id, t])) as Record<
  string,
  TearzCatalogItem
>;

export function tearzMeetsProgress(item: TearzCatalogItem, xp: number): boolean {
  if (item.unlockXp != null) return xp >= item.unlockXp;
  if (item.unlockLevel != null) return studyLevelFromXp(xp) >= item.unlockLevel;
  return true;
}

/** Кого уже можно держать в коллекции при таком XP. Чужие id не выкидываем. */
export function ownedTearzIdsForXp(xp: number, current: string[]): string[] {
  const earned = TEARZ_CATALOG.filter((item) => tearzMeetsProgress(item, xp)).map((item) => item.id);
  const extra = current.filter((id) => !TEARZ_BY_ID[id]);
  return Array.from(new Set([...earned, ...extra]));
}

export const STARTER_TEARZ_ID = 'newbie';
export const STARTER_COINS = 50;

export function rarityLabel(rarity: TearzRarity, lang: 'ru' | 'en' | 'zh' = 'ru'): string {
  if (lang === 'en') {
    if (rarity === 'rare') return 'Rare';
    if (rarity === 'legendary') return 'Legendary';
    return 'Common';
  }
  if (rarity === 'rare') return 'Редкий';
  if (rarity === 'legendary') return 'Легенда';
  return 'Обычный';
}
