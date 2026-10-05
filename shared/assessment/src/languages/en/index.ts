import type { LanguagePack } from '../types.js';
import { EN_CEFR_MAP } from './cefr-map.js';
import { EN_CONSTRUCTS, getEnConstruct } from './constructs.js';

export { EN_CEFR_MAP, EN_CEFR_DESCRIPTOR_DISCLAIMER, enLevelProfile } from './cefr-map.js';
export { EN_CONSTRUCTS, getEnConstruct } from './constructs.js';

export const englishLanguagePack: LanguagePack = {
  language: 'en',
  displayName: 'English',
  status: 'implemented',
  cefrMap: EN_CEFR_MAP,
  constructs: EN_CONSTRUCTS,
  getConstruct: getEnConstruct,
};
