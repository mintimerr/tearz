/**
 * Client-safe bundled bank loader (static JSON imports — no fs / no network).
 */

import type { PlacementContentItem } from '../placement/content-bank.js';
import { bankItemsToContentBank } from './to-content.js';
import type { BankItemRecord, BankManifest, BankVersion } from './types.js';
import { PLACEMENT_STACK_VERSIONS } from '../placement/versions.js';

import enManifest from '../../banks/v1/en/manifest.json';
import enItems from '../../banks/v1/en/items.json';
import frManifest from '../../banks/v1/fr/manifest.json';
import frItems from '../../banks/v1/fr/items.json';
import zhManifest from '../../banks/v1/zh/manifest.json';
import zhItems from '../../banks/v1/zh/items.json';
import deManifest from '../../banks/v1/de/manifest.json';
import deItems from '../../banks/v1/de/items.json';
import ruManifest from '../../banks/v1/ru/manifest.json';
import ruItems from '../../banks/v1/ru/items.json';

type Pack = { manifest: BankManifest; items: BankItemRecord[] };

const BUNDLED: Record<string, Pack> = {
  en: { manifest: enManifest as BankManifest, items: enItems as BankItemRecord[] },
  eng: { manifest: enManifest as BankManifest, items: enItems as BankItemRecord[] },
  english: { manifest: enManifest as BankManifest, items: enItems as BankItemRecord[] },
  fr: { manifest: frManifest as BankManifest, items: frItems as BankItemRecord[] },
  french: { manifest: frManifest as BankManifest, items: frItems as BankItemRecord[] },
  zh: { manifest: zhManifest as BankManifest, items: zhItems as BankItemRecord[] },
  'zh-cn': { manifest: zhManifest as BankManifest, items: zhItems as BankItemRecord[] },
  chinese: { manifest: zhManifest as BankManifest, items: zhItems as BankItemRecord[] },
  de: { manifest: deManifest as BankManifest, items: deItems as BankItemRecord[] },
  german: { manifest: deManifest as BankManifest, items: deItems as BankItemRecord[] },
  ru: { manifest: ruManifest as BankManifest, items: ruItems as BankItemRecord[] },
  russian: { manifest: ruManifest as BankManifest, items: ruItems as BankItemRecord[] },
};

export function normalizeBankLanguage(language: string): string {
  const k = language.trim().toLowerCase();
  if (k === 'eng' || k === 'english') return 'en';
  if (k === 'french') return 'fr';
  if (k === 'chinese' || k === 'zh-cn') return 'zh';
  if (k === 'german') return 'de';
  if (k === 'russian') return 'ru';
  return k;
}

export function loadBundledBank(language: string, _version: BankVersion = 'v1') {
  const pack = BUNDLED[language.trim().toLowerCase()];
  if (!pack) return null;
  const items = (pack.items ?? []).filter(
    (i) =>
      i.qualityGate === 'PASS' &&
      i.lifecycleState === 'approved_provisional' &&
      i.calibrationStatus === 'provisional',
  );
  return {
    manifest: {
      ...pack.manifest,
      itemQualityVersion:
        pack.manifest.itemQualityVersion || PLACEMENT_STACK_VERSIONS.itemQualityVersion,
    },
    items,
  };
}

export function loadBundledContentBank(
  language: string,
  version: BankVersion = 'v1',
): PlacementContentItem[] {
  const bank = loadBundledBank(language, version);
  if (!bank) return [];
  return bankItemsToContentBank(bank.items);
}
