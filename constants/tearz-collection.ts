import type { ImageSource } from 'expo-image';

import { TEARZ_MARIO } from '@/components/game/tearz-mario-source';

export type TearzRarity = 'common' | 'rare' | 'legendary';

export type TearzCatalogItem = {
  id: string;
  nameRu: string;
  nameEn: string;
  rarity: TearzRarity;
  blurbRu: string;
  /** Как открыть — одна короткая строка для полки */
  howToGetRu: string;
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
    howToGetRu: 'За тренировку карточек',
    source: TEARZ_MARIO.book,
  },
  {
    id: 'plaza',
    nameRu: 'Plaza',
    nameEn: 'Plaza',
    rarity: 'common',
    blurbRu: 'С телефоном в руках',
    howToGetRu: 'За сообщение в диалоге',
    source: TEARZ_MARIO.phone,
  },
  {
    id: 'builder',
    nameRu: 'Builder',
    nameEn: 'Builder',
    rarity: 'common',
    blurbRu: 'Строит слова',
    howToGetRu: 'За мини-тренировку',
    source: TEARZ_MARIO.build,
  },
  {
    id: 'arcade-spark',
    nameRu: 'Arcade Spark',
    nameEn: 'Arcade Spark',
    rarity: 'rare',
    blurbRu: 'Недельный редкий',
    howToGetRu: 'Скоро — за стрик',
    source: TEARZ_MARIO.jump,
  },
];

export const TEARZ_BY_ID = Object.fromEntries(TEARZ_CATALOG.map((t) => [t.id, t])) as Record<
  string,
  TearzCatalogItem
>;

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
