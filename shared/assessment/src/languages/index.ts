import { englishLanguagePack } from './en/index.js';
import { frenchLanguagePack } from './fr/index.js';
import { chineseLanguagePack } from './zh/index.js';
import type { LanguagePack } from './types.js';

export * from './types.js';
export { englishLanguagePack } from './en/index.js';
export { EN_CEFR_MAP, EN_CEFR_DESCRIPTOR_DISCLAIMER, enLevelProfile } from './en/cefr-map.js';
export { EN_CONSTRUCTS, getEnConstruct } from './en/constructs.js';
export { frenchLanguagePack } from './fr/index.js';
export { chineseLanguagePack } from './zh/index.js';

const PACKS: Record<string, LanguagePack> = {
  en: englishLanguagePack,
  eng: englishLanguagePack,
  english: englishLanguagePack,
  zh: chineseLanguagePack,
  'zh-cn': chineseLanguagePack,
  chinese: chineseLanguagePack,
  fr: frenchLanguagePack,
  french: frenchLanguagePack,
};

export function getLanguagePack(language: string): LanguagePack | undefined {
  return PACKS[language.trim().toLowerCase()];
}

export function requireLanguagePack(language: string): LanguagePack {
  const pack = getLanguagePack(language);
  if (!pack || pack.status === 'stub') {
    throw new Error(
      `Language pack not implemented for "${language}". Only English is fully specified in v1.`,
    );
  }
  return pack;
}
