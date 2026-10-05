/**
 * Factory construct catalogs — prefer full LanguagePack registries.
 */

import { EN_CONSTRUCTS } from '../../languages/en/constructs.js';
import { FR_CONSTRUCTS } from '../../languages/fr/constructs.js';
import { ZH_CONSTRUCTS } from '../../languages/zh/constructs.js';
import { DE_CONSTRUCTS } from '../../languages/de/constructs.js';
import { RU_CONSTRUCTS } from '../../languages/ru/constructs.js';
import type { ConstructEntry } from '../../languages/types.js';
import type { BankLanguage } from '../types.js';

const BY_LANG: Record<BankLanguage, ConstructEntry[]> = {
  en: EN_CONSTRUCTS,
  fr: FR_CONSTRUCTS,
  zh: ZH_CONSTRUCTS,
  de: DE_CONSTRUCTS,
  ru: RU_CONSTRUCTS,
};

export function factoryConstructsFor(language: BankLanguage): ConstructEntry[] {
  return BY_LANG[language] ?? [];
}
