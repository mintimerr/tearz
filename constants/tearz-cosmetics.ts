/** Косметика Tearz — отдельный полный реф на каждый лук (не слои-наклейки). */

import type { ImageSource } from 'expo-image';

export type TearzCosmeticSlot = 'color' | 'hat' | 'accessory';

export type TearzCosmeticItem = {
  id: string;
  slot: TearzCosmeticSlot;
  nameRu: string;
  nameEn: string;
  /** Цена в монетах; 0 = бесплатно / стартовый. */
  price: number;
  /** Цвет для UI-сватча. */
  tint?: string;
  /** Ключ цвета в именах outfit-файлов (classic/mint/…). */
  colorKey?: string;
  /** Ключ шмотки для outfit-файлов (hat-crown / acc-shades). */
  outfitKey?: string;
  empty?: boolean;
  blurbRu: string;
};

export type TearzLoadout = {
  skinId: string;
  colorId: string | null;
  hatId: string | null;
  accessoryId: string | null;
};

export const DEFAULT_TEARZ_LOADOUT: TearzLoadout = {
  skinId: 'newbie',
  colorId: 'color-classic',
  hatId: null,
  accessoryId: null,
};

/** Полные спрайты: Tearz уже стоит в шмотке. */
const OUTFIT = {
  // base colors — плотный Mario-idle (не jelly wardrobe-body)
  'base--classic': require('../assets/images/tearz-mario/cosmetics/base-color-classic.png'),
  'base--mint': require('../assets/images/tearz-mario/cosmetics/base-color-mint.png'),
  'base--sunset': require('../assets/images/tearz-mario/cosmetics/base-color-sunset.png'),
  'base--grape': require('../assets/images/tearz-mario/cosmetics/base-color-grape.png'),
  'base--gold': require('../assets/images/tearz-mario/cosmetics/base-color-gold.png'),
  'base--rose': require('../assets/images/tearz-mario/cosmetics/base-color-rose.png'),
  // hats × colors
  'hat-grad--classic': require('../assets/images/tearz-mario/cosmetics/outfits/hat-grad--classic.png'),
  'hat-grad--mint': require('../assets/images/tearz-mario/cosmetics/outfits/hat-grad--mint.png'),
  'hat-grad--sunset': require('../assets/images/tearz-mario/cosmetics/outfits/hat-grad--sunset.png'),
  'hat-grad--grape': require('../assets/images/tearz-mario/cosmetics/outfits/hat-grad--grape.png'),
  'hat-grad--gold': require('../assets/images/tearz-mario/cosmetics/outfits/hat-grad--gold.png'),
  'hat-grad--rose': require('../assets/images/tearz-mario/cosmetics/outfits/hat-grad--rose.png'),
  'hat-crown--classic': require('../assets/images/tearz-mario/cosmetics/outfits/hat-crown--classic.png'),
  'hat-crown--mint': require('../assets/images/tearz-mario/cosmetics/outfits/hat-crown--mint.png'),
  'hat-crown--sunset': require('../assets/images/tearz-mario/cosmetics/outfits/hat-crown--sunset.png'),
  'hat-crown--grape': require('../assets/images/tearz-mario/cosmetics/outfits/hat-crown--grape.png'),
  'hat-crown--gold': require('../assets/images/tearz-mario/cosmetics/outfits/hat-crown--gold.png'),
  'hat-crown--rose': require('../assets/images/tearz-mario/cosmetics/outfits/hat-crown--rose.png'),
  'hat-cap--classic': require('../assets/images/tearz-mario/cosmetics/outfits/hat-cap--classic.png'),
  'hat-cap--mint': require('../assets/images/tearz-mario/cosmetics/outfits/hat-cap--mint.png'),
  'hat-cap--sunset': require('../assets/images/tearz-mario/cosmetics/outfits/hat-cap--sunset.png'),
  'hat-cap--grape': require('../assets/images/tearz-mario/cosmetics/outfits/hat-cap--grape.png'),
  'hat-cap--gold': require('../assets/images/tearz-mario/cosmetics/outfits/hat-cap--gold.png'),
  'hat-cap--rose': require('../assets/images/tearz-mario/cosmetics/outfits/hat-cap--rose.png'),
  'hat-beanie--classic': require('../assets/images/tearz-mario/cosmetics/outfits/hat-beanie--classic.png'),
  'hat-beanie--mint': require('../assets/images/tearz-mario/cosmetics/outfits/hat-beanie--mint.png'),
  'hat-beanie--sunset': require('../assets/images/tearz-mario/cosmetics/outfits/hat-beanie--sunset.png'),
  'hat-beanie--grape': require('../assets/images/tearz-mario/cosmetics/outfits/hat-beanie--grape.png'),
  'hat-beanie--gold': require('../assets/images/tearz-mario/cosmetics/outfits/hat-beanie--gold.png'),
  'hat-beanie--rose': require('../assets/images/tearz-mario/cosmetics/outfits/hat-beanie--rose.png'),
  'hat-party--classic': require('../assets/images/tearz-mario/cosmetics/outfits/hat-party--classic.png'),
  'hat-party--mint': require('../assets/images/tearz-mario/cosmetics/outfits/hat-party--mint.png'),
  'hat-party--sunset': require('../assets/images/tearz-mario/cosmetics/outfits/hat-party--sunset.png'),
  'hat-party--grape': require('../assets/images/tearz-mario/cosmetics/outfits/hat-party--grape.png'),
  'hat-party--gold': require('../assets/images/tearz-mario/cosmetics/outfits/hat-party--gold.png'),
  'hat-party--rose': require('../assets/images/tearz-mario/cosmetics/outfits/hat-party--rose.png'),
  // accessories × colors
  'acc-shades--classic': require('../assets/images/tearz-mario/cosmetics/outfits/acc-shades--classic.png'),
  'acc-shades--mint': require('../assets/images/tearz-mario/cosmetics/outfits/acc-shades--mint.png'),
  'acc-shades--sunset': require('../assets/images/tearz-mario/cosmetics/outfits/acc-shades--sunset.png'),
  'acc-shades--grape': require('../assets/images/tearz-mario/cosmetics/outfits/acc-shades--grape.png'),
  'acc-shades--gold': require('../assets/images/tearz-mario/cosmetics/outfits/acc-shades--gold.png'),
  'acc-shades--rose': require('../assets/images/tearz-mario/cosmetics/outfits/acc-shades--rose.png'),
  'acc-book--classic': require('../assets/images/tearz-mario/cosmetics/outfits/acc-book--classic.png'),
  'acc-book--mint': require('../assets/images/tearz-mario/cosmetics/outfits/acc-book--mint.png'),
  'acc-book--sunset': require('../assets/images/tearz-mario/cosmetics/outfits/acc-book--sunset.png'),
  'acc-book--grape': require('../assets/images/tearz-mario/cosmetics/outfits/acc-book--grape.png'),
  'acc-book--gold': require('../assets/images/tearz-mario/cosmetics/outfits/acc-book--gold.png'),
  'acc-book--rose': require('../assets/images/tearz-mario/cosmetics/outfits/acc-book--rose.png'),
  'acc-phone--classic': require('../assets/images/tearz-mario/cosmetics/outfits/acc-phone--classic.png'),
  'acc-phone--mint': require('../assets/images/tearz-mario/cosmetics/outfits/acc-phone--mint.png'),
  'acc-phone--sunset': require('../assets/images/tearz-mario/cosmetics/outfits/acc-phone--sunset.png'),
  'acc-phone--grape': require('../assets/images/tearz-mario/cosmetics/outfits/acc-phone--grape.png'),
  'acc-phone--gold': require('../assets/images/tearz-mario/cosmetics/outfits/acc-phone--gold.png'),
  'acc-phone--rose': require('../assets/images/tearz-mario/cosmetics/outfits/acc-phone--rose.png'),
  'acc-game--classic': require('../assets/images/tearz-mario/cosmetics/outfits/acc-game--classic.png'),
  'acc-game--mint': require('../assets/images/tearz-mario/cosmetics/outfits/acc-game--mint.png'),
  'acc-game--sunset': require('../assets/images/tearz-mario/cosmetics/outfits/acc-game--sunset.png'),
  'acc-game--grape': require('../assets/images/tearz-mario/cosmetics/outfits/acc-game--grape.png'),
  'acc-game--gold': require('../assets/images/tearz-mario/cosmetics/outfits/acc-game--gold.png'),
  'acc-game--rose': require('../assets/images/tearz-mario/cosmetics/outfits/acc-game--rose.png'),
  'acc-star--classic': require('../assets/images/tearz-mario/cosmetics/outfits/acc-star--classic.png'),
  'acc-star--mint': require('../assets/images/tearz-mario/cosmetics/outfits/acc-star--mint.png'),
  'acc-star--sunset': require('../assets/images/tearz-mario/cosmetics/outfits/acc-star--sunset.png'),
  'acc-star--grape': require('../assets/images/tearz-mario/cosmetics/outfits/acc-star--grape.png'),
  'acc-star--gold': require('../assets/images/tearz-mario/cosmetics/outfits/acc-star--gold.png'),
  'acc-star--rose': require('../assets/images/tearz-mario/cosmetics/outfits/acc-star--rose.png'),
} as const satisfies Record<string, ImageSource>;

type OutfitKey = keyof typeof OUTFIT;

/**
 * Прорисованные позы (не jelly-болванки из outfits/).
 * Аксессуары и корона — Tearz целиком в позе. Остальные шляпы — сам предмет.
 */
const DRAWN_POSE = {
  'acc-book': require('../assets/images/tearz-mario/cosmetics/drawn/tearz-acc-book.png'),
  'acc-phone': require('../assets/images/tearz-mario/cosmetics/drawn/tearz-acc-phone.png'),
  'acc-game': require('../assets/images/tearz-mario/cosmetics/drawn/tearz-acc-game.png'),
  'acc-star': require('../assets/images/tearz-mario/cosmetics/drawn/tearz-acc-star.png'),
  'acc-shades': require('../assets/images/tearz-mario/cosmetics/drawn/tearz-acc-shades.png'),
  'hat-crown': require('../assets/images/tearz-mario/cosmetics/drawn/tearz-hat-crown.png'),
} as const satisfies Record<string, ImageSource>;

const DRAWN_HAT = {
  'hat-grad': require('../assets/images/tearz-mario/cosmetics/drawn/tearz-hat-grad.png'),
  'hat-cap': require('../assets/images/tearz-mario/cosmetics/drawn/tearz-hat-cap.png'),
  'hat-beanie': require('../assets/images/tearz-mario/cosmetics/drawn/tearz-hat-beanie.png'),
  'hat-party': require('../assets/images/tearz-mario/cosmetics/drawn/tearz-hat-party.png'),
} as const satisfies Record<string, ImageSource>;

/**
 * Поза с предметом в руке, перекрашенная в каждый цвет.
 * Предмет, глаза и контур не красятся — только тело.
 */
const ITEM_POSE = {
  'acc-book': {
    classic: require('../assets/images/tearz-mario/cosmetics/poses/acc-book--classic.png'),
    mint: require('../assets/images/tearz-mario/cosmetics/poses/acc-book--mint.png'),
    sunset: require('../assets/images/tearz-mario/cosmetics/poses/acc-book--sunset.png'),
    grape: require('../assets/images/tearz-mario/cosmetics/poses/acc-book--grape.png'),
    gold: require('../assets/images/tearz-mario/cosmetics/poses/acc-book--gold.png'),
    rose: require('../assets/images/tearz-mario/cosmetics/poses/acc-book--rose.png'),
  },
  'acc-phone': {
    classic: require('../assets/images/tearz-mario/cosmetics/poses/acc-phone--classic.png'),
    mint: require('../assets/images/tearz-mario/cosmetics/poses/acc-phone--mint.png'),
    sunset: require('../assets/images/tearz-mario/cosmetics/poses/acc-phone--sunset.png'),
    grape: require('../assets/images/tearz-mario/cosmetics/poses/acc-phone--grape.png'),
    gold: require('../assets/images/tearz-mario/cosmetics/poses/acc-phone--gold.png'),
    rose: require('../assets/images/tearz-mario/cosmetics/poses/acc-phone--rose.png'),
  },
  'acc-game': {
    classic: require('../assets/images/tearz-mario/cosmetics/poses/acc-game--classic.png'),
    mint: require('../assets/images/tearz-mario/cosmetics/poses/acc-game--mint.png'),
    sunset: require('../assets/images/tearz-mario/cosmetics/poses/acc-game--sunset.png'),
    grape: require('../assets/images/tearz-mario/cosmetics/poses/acc-game--grape.png'),
    gold: require('../assets/images/tearz-mario/cosmetics/poses/acc-game--gold.png'),
    rose: require('../assets/images/tearz-mario/cosmetics/poses/acc-game--rose.png'),
  },
  'acc-star': {
    classic: require('../assets/images/tearz-mario/cosmetics/poses/acc-star--classic.png'),
    mint: require('../assets/images/tearz-mario/cosmetics/poses/acc-star--mint.png'),
    sunset: require('../assets/images/tearz-mario/cosmetics/poses/acc-star--sunset.png'),
    grape: require('../assets/images/tearz-mario/cosmetics/poses/acc-star--grape.png'),
    gold: require('../assets/images/tearz-mario/cosmetics/poses/acc-star--gold.png'),
    rose: require('../assets/images/tearz-mario/cosmetics/poses/acc-star--rose.png'),
  },
  'acc-shades': {
    classic: require('../assets/images/tearz-mario/cosmetics/poses/acc-shades--classic.png'),
    mint: require('../assets/images/tearz-mario/cosmetics/poses/acc-shades--mint.png'),
    sunset: require('../assets/images/tearz-mario/cosmetics/poses/acc-shades--sunset.png'),
    grape: require('../assets/images/tearz-mario/cosmetics/poses/acc-shades--grape.png'),
    gold: require('../assets/images/tearz-mario/cosmetics/poses/acc-shades--gold.png'),
    rose: require('../assets/images/tearz-mario/cosmetics/poses/acc-shades--rose.png'),
  },
} as const satisfies Record<string, Record<string, ImageSource>>;

/** Шляпа отдельно, чтобы надеть её на любую позу и любой цвет. */
const HAT_LAYER = {
  'hat-grad': require('../assets/images/tearz-mario/cosmetics/poses/hat-grad.png'),
  'hat-cap': require('../assets/images/tearz-mario/cosmetics/poses/hat-cap.png'),
  'hat-beanie': require('../assets/images/tearz-mario/cosmetics/poses/hat-beanie.png'),
  'hat-party': require('../assets/images/tearz-mario/cosmetics/poses/hat-party.png'),
  'hat-crown': require('../assets/images/tearz-mario/cosmetics/poses/hat-crown.png'),
} as const satisfies Record<string, ImageSource>;

export type PoseBodyMetrics = {
  aspect: number;
  head: number;
  cx: number;
  headW: number;
};

export type PoseHatMetrics = {
  aspect: number;
  scale: number;
  anchor: number;
  /** Доля ширины шляпы, которая садится на центр головы. */
  seatX: number;
};

const POSE_BODY_METRICS: Record<string, PoseBodyMetrics> = {
  'acc-book': { aspect: 0.9219, head: 0.086, cx: 0.482, headW: 0.5 },
  'acc-phone': { aspect: 1.1641, head: 0.068, cx: 0.582, headW: 0.42 },
  'acc-game': { aspect: 0.8906, head: 0.086, cx: 0.471, headW: 0.52 },
  'acc-star': { aspect: 1.0703, head: 0.172, cx: 0.48, headW: 0.42 },
  'acc-shades': { aspect: 1.0117, head: 0.102, cx: 0.52, headW: 0.5 },
  base: { aspect: 0.8848, head: 0.094, cx: 0.515, headW: 0.52 },
};

const POSE_HAT_METRICS: Record<string, PoseHatMetrics> = {
  'hat-grad': { aspect: 1.3457, scale: 1.55, anchor: 0.7, seatX: 0.51 },
  'hat-cap': { aspect: 1.3535, scale: 1.15, anchor: 0.62, seatX: 0.49 },
  'hat-beanie': { aspect: 1.0312, scale: 1.05, anchor: 0.86, seatX: 0.45 },
  'hat-party': { aspect: 0.7324, scale: 0.72, anchor: 0.94, seatX: 0.5 },
  'hat-crown': { aspect: 1.4627, scale: 0.92, anchor: 0.96, seatX: 0.5 },
};

/** Комбо шляпа+шмот — отдельный полный реф (подставляем по мере готовности файлов). */
const COMBO_OUTFIT: Record<string, Partial<Record<string, ImageSource>>> = {};

function tryRequireCombo(hatKey: string, accKey: string, colorKey: string): ImageSource | null {
  const mapKey = `${hatKey}--${accKey}`;
  const byColor = COMBO_OUTFIT[mapKey];
  if (byColor?.[colorKey]) return byColor[colorKey]!;
  if (byColor?.classic) return byColor.classic;
  return null;
}

/** Регистрируем комбо-рефы (require должен быть статическим для Metro). */
function registerCombos() {
  const colors = ['classic', 'mint', 'sunset', 'grape', 'gold', 'rose'] as const;
  const pairs: [string, string, Record<string, ImageSource>][] = [
    [
      'hat-crown',
      'acc-shades',
      {
        classic: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-crown--acc-shades--classic.png'),
        mint: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-crown--acc-shades--mint.png'),
        sunset: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-crown--acc-shades--sunset.png'),
        grape: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-crown--acc-shades--grape.png'),
        gold: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-crown--acc-shades--gold.png'),
        rose: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-crown--acc-shades--rose.png'),
      },
    ],
    [
      'hat-crown',
      'acc-game',
      {
        classic: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-crown--acc-game--classic.png'),
        mint: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-crown--acc-game--mint.png'),
        sunset: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-crown--acc-game--sunset.png'),
        grape: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-crown--acc-game--grape.png'),
        gold: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-crown--acc-game--gold.png'),
        rose: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-crown--acc-game--rose.png'),
      },
    ],
    [
      'hat-crown',
      'acc-book',
      {
        classic: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-crown--acc-book--classic.png'),
        mint: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-crown--acc-book--mint.png'),
        sunset: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-crown--acc-book--sunset.png'),
        grape: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-crown--acc-book--grape.png'),
        gold: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-crown--acc-book--gold.png'),
        rose: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-crown--acc-book--rose.png'),
      },
    ],
    [
      'hat-crown',
      'acc-phone',
      {
        classic: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-crown--acc-phone--classic.png'),
        mint: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-crown--acc-phone--mint.png'),
        sunset: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-crown--acc-phone--sunset.png'),
        grape: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-crown--acc-phone--grape.png'),
        gold: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-crown--acc-phone--gold.png'),
        rose: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-crown--acc-phone--rose.png'),
      },
    ],
    [
      'hat-crown',
      'acc-star',
      {
        classic: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-crown--acc-star--classic.png'),
        mint: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-crown--acc-star--mint.png'),
        sunset: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-crown--acc-star--sunset.png'),
        grape: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-crown--acc-star--grape.png'),
        gold: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-crown--acc-star--gold.png'),
        rose: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-crown--acc-star--rose.png'),
      },
    ],
    [
      'hat-grad',
      'acc-book',
      {
        classic: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-grad--acc-book--classic.png'),
        mint: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-grad--acc-book--mint.png'),
        sunset: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-grad--acc-book--sunset.png'),
        grape: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-grad--acc-book--grape.png'),
        gold: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-grad--acc-book--gold.png'),
        rose: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-grad--acc-book--rose.png'),
      },
    ],
    [
      'hat-grad',
      'acc-shades',
      {
        classic: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-grad--acc-shades--classic.png'),
        mint: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-grad--acc-shades--mint.png'),
        sunset: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-grad--acc-shades--sunset.png'),
        grape: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-grad--acc-shades--grape.png'),
        gold: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-grad--acc-shades--gold.png'),
        rose: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-grad--acc-shades--rose.png'),
      },
    ],
    [
      'hat-grad',
      'acc-phone',
      {
        classic: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-grad--acc-phone--classic.png'),
        mint: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-grad--acc-phone--mint.png'),
        sunset: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-grad--acc-phone--sunset.png'),
        grape: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-grad--acc-phone--grape.png'),
        gold: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-grad--acc-phone--gold.png'),
        rose: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-grad--acc-phone--rose.png'),
      },
    ],
    [
      'hat-grad',
      'acc-game',
      {
        classic: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-grad--acc-game--classic.png'),
        mint: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-grad--acc-game--mint.png'),
        sunset: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-grad--acc-game--sunset.png'),
        grape: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-grad--acc-game--grape.png'),
        gold: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-grad--acc-game--gold.png'),
        rose: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-grad--acc-game--rose.png'),
      },
    ],
    [
      'hat-grad',
      'acc-star',
      {
        classic: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-grad--acc-star--classic.png'),
        mint: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-grad--acc-star--mint.png'),
        sunset: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-grad--acc-star--sunset.png'),
        grape: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-grad--acc-star--grape.png'),
        gold: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-grad--acc-star--gold.png'),
        rose: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-grad--acc-star--rose.png'),
      },
    ],
    [
      'hat-cap',
      'acc-game',
      {
        classic: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-cap--acc-game--classic.png'),
        mint: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-cap--acc-game--mint.png'),
        sunset: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-cap--acc-game--sunset.png'),
        grape: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-cap--acc-game--grape.png'),
        gold: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-cap--acc-game--gold.png'),
        rose: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-cap--acc-game--rose.png'),
      },
    ],
    [
      'hat-cap',
      'acc-shades',
      {
        classic: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-cap--acc-shades--classic.png'),
        mint: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-cap--acc-shades--mint.png'),
        sunset: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-cap--acc-shades--sunset.png'),
        grape: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-cap--acc-shades--grape.png'),
        gold: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-cap--acc-shades--gold.png'),
        rose: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-cap--acc-shades--rose.png'),
      },
    ],
    [
      'hat-cap',
      'acc-book',
      {
        classic: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-cap--acc-book--classic.png'),
        mint: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-cap--acc-book--mint.png'),
        sunset: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-cap--acc-book--sunset.png'),
        grape: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-cap--acc-book--grape.png'),
        gold: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-cap--acc-book--gold.png'),
        rose: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-cap--acc-book--rose.png'),
      },
    ],
    [
      'hat-cap',
      'acc-phone',
      {
        classic: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-cap--acc-phone--classic.png'),
        mint: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-cap--acc-phone--mint.png'),
        sunset: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-cap--acc-phone--sunset.png'),
        grape: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-cap--acc-phone--grape.png'),
        gold: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-cap--acc-phone--gold.png'),
        rose: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-cap--acc-phone--rose.png'),
      },
    ],
    [
      'hat-cap',
      'acc-star',
      {
        classic: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-cap--acc-star--classic.png'),
        mint: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-cap--acc-star--mint.png'),
        sunset: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-cap--acc-star--sunset.png'),
        grape: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-cap--acc-star--grape.png'),
        gold: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-cap--acc-star--gold.png'),
        rose: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-cap--acc-star--rose.png'),
      },
    ],
    [
      'hat-beanie',
      'acc-phone',
      {
        classic: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-beanie--acc-phone--classic.png'),
        mint: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-beanie--acc-phone--mint.png'),
        sunset: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-beanie--acc-phone--sunset.png'),
        grape: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-beanie--acc-phone--grape.png'),
        gold: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-beanie--acc-phone--gold.png'),
        rose: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-beanie--acc-phone--rose.png'),
      },
    ],
    [
      'hat-beanie',
      'acc-shades',
      {
        classic: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-beanie--acc-shades--classic.png'),
        mint: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-beanie--acc-shades--mint.png'),
        sunset: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-beanie--acc-shades--sunset.png'),
        grape: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-beanie--acc-shades--grape.png'),
        gold: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-beanie--acc-shades--gold.png'),
        rose: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-beanie--acc-shades--rose.png'),
      },
    ],
    [
      'hat-beanie',
      'acc-book',
      {
        classic: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-beanie--acc-book--classic.png'),
        mint: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-beanie--acc-book--mint.png'),
        sunset: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-beanie--acc-book--sunset.png'),
        grape: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-beanie--acc-book--grape.png'),
        gold: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-beanie--acc-book--gold.png'),
        rose: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-beanie--acc-book--rose.png'),
      },
    ],
    [
      'hat-beanie',
      'acc-game',
      {
        classic: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-beanie--acc-game--classic.png'),
        mint: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-beanie--acc-game--mint.png'),
        sunset: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-beanie--acc-game--sunset.png'),
        grape: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-beanie--acc-game--grape.png'),
        gold: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-beanie--acc-game--gold.png'),
        rose: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-beanie--acc-game--rose.png'),
      },
    ],
    [
      'hat-beanie',
      'acc-star',
      {
        classic: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-beanie--acc-star--classic.png'),
        mint: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-beanie--acc-star--mint.png'),
        sunset: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-beanie--acc-star--sunset.png'),
        grape: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-beanie--acc-star--grape.png'),
        gold: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-beanie--acc-star--gold.png'),
        rose: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-beanie--acc-star--rose.png'),
      },
    ],
    [
      'hat-party',
      'acc-star',
      {
        classic: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-party--acc-star--classic.png'),
        mint: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-party--acc-star--mint.png'),
        sunset: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-party--acc-star--sunset.png'),
        grape: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-party--acc-star--grape.png'),
        gold: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-party--acc-star--gold.png'),
        rose: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-party--acc-star--rose.png'),
      },
    ],
    [
      'hat-party',
      'acc-shades',
      {
        classic: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-party--acc-shades--classic.png'),
        mint: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-party--acc-shades--mint.png'),
        sunset: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-party--acc-shades--sunset.png'),
        grape: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-party--acc-shades--grape.png'),
        gold: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-party--acc-shades--gold.png'),
        rose: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-party--acc-shades--rose.png'),
      },
    ],
    [
      'hat-party',
      'acc-book',
      {
        classic: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-party--acc-book--classic.png'),
        mint: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-party--acc-book--mint.png'),
        sunset: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-party--acc-book--sunset.png'),
        grape: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-party--acc-book--grape.png'),
        gold: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-party--acc-book--gold.png'),
        rose: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-party--acc-book--rose.png'),
      },
    ],
    [
      'hat-party',
      'acc-phone',
      {
        classic: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-party--acc-phone--classic.png'),
        mint: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-party--acc-phone--mint.png'),
        sunset: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-party--acc-phone--sunset.png'),
        grape: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-party--acc-phone--grape.png'),
        gold: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-party--acc-phone--gold.png'),
        rose: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-party--acc-phone--rose.png'),
      },
    ],
    [
      'hat-party',
      'acc-game',
      {
        classic: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-party--acc-game--classic.png'),
        mint: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-party--acc-game--mint.png'),
        sunset: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-party--acc-game--sunset.png'),
        grape: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-party--acc-game--grape.png'),
        gold: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-party--acc-game--gold.png'),
        rose: require('../assets/images/tearz-mario/cosmetics/outfits/combo-hat-party--acc-game--rose.png'),
      },
    ],
  ];

  for (const [hat, acc, sources] of pairs) {
    COMBO_OUTFIT[`${hat}--${acc}`] = sources;
  }
  void colors;
}

registerCombos();

export const TEARZ_COSMETICS: TearzCosmeticItem[] = [
  {
    id: 'color-classic',
    slot: 'color',
    nameRu: 'Классика',
    nameEn: 'Classic',
    price: 0,
    tint: '#3DDCFF',
    colorKey: 'classic',
    blurbRu: 'Стандартный голубой Tearz',
  },
  {
    id: 'color-mint',
    slot: 'color',
    nameRu: 'Мята',
    nameEn: 'Mint',
    price: 40,
    tint: '#5CFFB0',
    colorKey: 'mint',
    blurbRu: 'Свежий мятный оттенок',
  },
  {
    id: 'color-sunset',
    slot: 'color',
    nameRu: 'Закат',
    nameEn: 'Sunset',
    price: 60,
    tint: '#FF8A5C',
    colorKey: 'sunset',
    blurbRu: 'Тёплый оранжевый',
  },
  {
    id: 'color-grape',
    slot: 'color',
    nameRu: 'Виноград',
    nameEn: 'Grape',
    price: 80,
    tint: '#B388FF',
    colorKey: 'grape',
    blurbRu: 'Фиолетовый оттенок',
  },
  {
    id: 'color-gold',
    slot: 'color',
    nameRu: 'Золото',
    nameEn: 'Gold',
    price: 120,
    tint: '#FFD24A',
    colorKey: 'gold',
    blurbRu: 'Редкий золотой окрас',
  },
  {
    id: 'color-rose',
    slot: 'color',
    nameRu: 'Роза',
    nameEn: 'Rose',
    price: 70,
    tint: '#FF6B9D',
    colorKey: 'rose',
    blurbRu: 'Розовый оттенок',
  },
  {
    id: 'hat-none',
    slot: 'hat',
    nameRu: 'Без шляпы',
    nameEn: 'No hat',
    price: 0,
    empty: true,
    blurbRu: 'Без шляпы',
  },
  {
    id: 'hat-grad',
    slot: 'hat',
    nameRu: 'Выпускник',
    nameEn: 'Graduate',
    price: 90,
    outfitKey: 'hat-grad',
    blurbRu: 'За учёбу',
  },
  {
    id: 'hat-crown',
    slot: 'hat',
    nameRu: 'Корона',
    nameEn: 'Crown',
    price: 150,
    outfitKey: 'hat-crown',
    blurbRu: 'Чувствуй себя королём',
  },
  {
    id: 'hat-cap',
    slot: 'hat',
    nameRu: 'Кепка',
    nameEn: 'Cap',
    price: 50,
    outfitKey: 'hat-cap',
    blurbRu: 'Уличная классика',
  },
  {
    id: 'hat-beanie',
    slot: 'hat',
    nameRu: 'Шапка',
    nameEn: 'Beanie',
    price: 45,
    outfitKey: 'hat-beanie',
    blurbRu: 'Уютно и тепло',
  },
  {
    id: 'hat-party',
    slot: 'hat',
    nameRu: 'Праздник',
    nameEn: 'Party',
    price: 100,
    outfitKey: 'hat-party',
    blurbRu: 'Для праздника',
  },
  {
    id: 'acc-none',
    slot: 'accessory',
    nameRu: 'Пусто',
    nameEn: 'None',
    price: 0,
    empty: true,
    blurbRu: 'Без предмета',
  },
  {
    id: 'acc-book',
    slot: 'accessory',
    nameRu: 'Книга',
    nameEn: 'Book',
    price: 55,
    outfitKey: 'acc-book',
    blurbRu: 'Всегда с учебником',
  },
  {
    id: 'acc-phone',
    slot: 'accessory',
    nameRu: 'Телефон',
    nameEn: 'Phone',
    price: 55,
    outfitKey: 'acc-phone',
    blurbRu: 'С телефоном',
  },
  {
    id: 'acc-star',
    slot: 'accessory',
    nameRu: 'Звезда',
    nameEn: 'Star',
    price: 110,
    outfitKey: 'acc-star',
    blurbRu: 'За длинную серию',
  },
  {
    id: 'acc-game',
    slot: 'accessory',
    nameRu: 'Геймпад',
    nameEn: 'Gamepad',
    price: 95,
    outfitKey: 'acc-game',
    blurbRu: 'Для игры',
  },
  {
    id: 'acc-shades',
    slot: 'accessory',
    nameRu: 'Очки',
    nameEn: 'Shades',
    price: 85,
    outfitKey: 'acc-shades',
    blurbRu: 'Для уверенного вида',
  },
];

export const TEARZ_COSMETIC_BY_ID = Object.fromEntries(
  TEARZ_COSMETICS.map((c) => [c.id, c]),
) as Record<string, TearzCosmeticItem>;

export const STARTER_COSMETIC_IDS = TEARZ_COSMETICS.filter((c) => c.price === 0).map((c) => c.id);

export function cosmeticsForSlot(slot: TearzCosmeticSlot): TearzCosmeticItem[] {
  return TEARZ_COSMETICS.filter((c) => c.slot === slot);
}

export function normalizeLoadout(raw: Partial<TearzLoadout> | null | undefined): TearzLoadout {
  return {
    skinId: typeof raw?.skinId === 'string' && raw.skinId ? raw.skinId : DEFAULT_TEARZ_LOADOUT.skinId,
    colorId: raw?.colorId ?? DEFAULT_TEARZ_LOADOUT.colorId,
    hatId: raw?.hatId ?? null,
    accessoryId: raw?.accessoryId ?? null,
  };
}

export function applyCosmeticToLoadout(loadout: TearzLoadout, item: TearzCosmeticItem): TearzLoadout {
  const next = { ...loadout };
  if (item.slot === 'color') next.colorId = item.id;
  else if (item.slot === 'hat') next.hatId = item.empty ? null : item.id;
  else next.accessoryId = item.empty ? null : item.id;
  return next;
}

function colorKeyFromLoadout(loadout: TearzLoadout): string {
  const c = loadout.colorId ? TEARZ_COSMETIC_BY_ID[loadout.colorId] : null;
  return c?.colorKey ?? 'classic';
}

function poseKeys(loadout: TearzLoadout): { colorKey: string; hatKey: string | null; accKey: string | null } {
  const L = normalizeLoadout(loadout);
  const hat = L.hatId ? TEARZ_COSMETIC_BY_ID[L.hatId] : null;
  const acc = L.accessoryId ? TEARZ_COSMETIC_BY_ID[L.accessoryId] : null;
  return {
    colorKey: colorKeyFromLoadout(L),
    hatKey: hat && !hat.empty ? (hat.outfitKey ?? null) : null,
    accKey: acc && !acc.empty ? (acc.outfitKey ?? null) : null,
  };
}

/**
 * Тело в позе выбранного предмета и цвета. Шляпа рисуется отдельно поверх.
 */
export function resolveTearzOutfitSource(loadout: TearzLoadout): ImageSource {
  const { colorKey, accKey } = poseKeys(loadout);

  if (accKey && accKey in ITEM_POSE) {
    const byColor = ITEM_POSE[accKey as keyof typeof ITEM_POSE];
    return byColor[colorKey as keyof typeof byColor] ?? byColor.classic;
  }

  const baseKey = `base--${colorKey}` as OutfitKey;
  if (baseKey in OUTFIT) return OUTFIT[baseKey];
  return OUTFIT['base--classic'];
}

export function poseBodyMetricsFor(loadout: TearzLoadout): PoseBodyMetrics {
  const { accKey } = poseKeys(loadout);
  if (accKey && accKey in POSE_BODY_METRICS) return POSE_BODY_METRICS[accKey]!;
  return POSE_BODY_METRICS.base!;
}

export function poseHatMetricsFor(loadout: TearzLoadout): PoseHatMetrics | null {
  const { hatKey } = poseKeys(loadout);
  if (!hatKey || !(hatKey in POSE_HAT_METRICS)) return null;
  return POSE_HAT_METRICS[hatKey]!;
}

/** Шляпа поверх позы с предметом — включая корону. */
export function resolveHatOverlaySource(loadout: TearzLoadout): ImageSource | null {
  const { hatKey } = poseKeys(loadout);
  if (!hatKey || !(hatKey in HAT_LAYER)) return null;
  return HAT_LAYER[hatKey as keyof typeof HAT_LAYER];
}

/** Превью карточки айтема: прорисованный реф, не jelly-болванка. */
export function resolveCosmeticThumbSource(item: TearzCosmeticItem): ImageSource | null {
  if (item.empty) return null;
  if (item.outfitKey && item.outfitKey in ITEM_POSE) {
    return ITEM_POSE[item.outfitKey as keyof typeof ITEM_POSE].classic;
  }
  if (item.outfitKey && item.outfitKey in HAT_LAYER) {
    return HAT_LAYER[item.outfitKey as keyof typeof HAT_LAYER];
  }
  if (item.outfitKey && item.outfitKey in DRAWN_POSE) {
    return DRAWN_POSE[item.outfitKey as keyof typeof DRAWN_POSE];
  }
  if (item.outfitKey && item.outfitKey in DRAWN_HAT) {
    return DRAWN_HAT[item.outfitKey as keyof typeof DRAWN_HAT];
  }
  if (item.slot === 'color' && item.colorKey) {
    const key = `base--${item.colorKey}` as OutfitKey;
    return OUTFIT[key] ?? OUTFIT['base--classic'];
  }
  if (item.outfitKey) {
    const key = `${item.outfitKey}--classic` as OutfitKey;
    return OUTFIT[key] ?? null;
  }
  return null;
}
