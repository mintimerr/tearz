import type { LanguagePack } from '../types.js';
import { DE_CEFR_MAP } from './cefr-map.js';
import { DE_CONSTRUCTS, getDeConstruct } from './constructs.js';

export { DE_CEFR_MAP, DE_CEFR_DESCRIPTOR_DISCLAIMER, deLevelProfile } from './cefr-map.js';
export { DE_CONSTRUCTS, getDeConstruct } from './constructs.js';

export const germanLanguagePack: LanguagePack = {
  language: 'de',
  displayName: 'German',
  status: 'implemented',
  cefrMap: DE_CEFR_MAP,
  constructs: DE_CONSTRUCTS,
  getConstruct: getDeConstruct,
};
