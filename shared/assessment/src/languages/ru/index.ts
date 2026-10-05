import type { LanguagePack } from '../types.js';
import { RU_CEFR_MAP } from './cefr-map.js';
import { RU_CONSTRUCTS, getRuConstruct } from './constructs.js';

export { RU_CEFR_MAP, RU_CEFR_DESCRIPTOR_DISCLAIMER, ruLevelProfile } from './cefr-map.js';
export { RU_CONSTRUCTS, getRuConstruct } from './constructs.js';

export const russianLanguagePack: LanguagePack = {
  language: 'ru',
  displayName: 'Russian',
  status: 'implemented',
  cefrMap: RU_CEFR_MAP,
  constructs: RU_CONSTRUCTS,
  getConstruct: getRuConstruct,
};
