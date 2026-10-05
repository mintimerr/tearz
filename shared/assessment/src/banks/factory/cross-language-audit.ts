/**
 * Cross-language conceptual similarity audit.
 * Universal situations (shop closed) are allowed; near-literal bank cloning is not.
 */

import { createHash } from 'node:crypto';

import type { BankItemRecord, BankLanguage } from '../types.js';

export type CrossLangDuplicateGroup = {
  fingerprint: string;
  conceptHint: string;
  items: Array<{ language: BankLanguage; id: string; stem: string }>;
};

export type CrossLanguageAuditReport = {
  totalItems: number;
  crossLanguageNearDuplicateGroups: CrossLangDuplicateGroup[];
  /** Share of items that participate in a multi-language near-duplicate group. */
  crossLanguageConceptReuseRate: number;
  languagesCompared: BankLanguage[];
};

/** Strip diacritics / case for rough alignment. */
function fold(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Known clone families from pilot-v1 — if multiple languages match these patterns,
 * flag as near-duplicates.
 */
const CLONE_FAMILIES: Array<{ id: string; patterns: RegExp[] }> = [
  {
    id: 'opaque_wording',
    patterns: [/deliberately opaque|volontairement opaque|bewusst undurchsichtig|нарочно непрозрач|故意.*含混/i],
  },
  {
    id: 'patronising_praise',
    patterns: [/praise sounded|éloge sonnait|lob klang|похвала звучала|称赞听起来/i],
  },
  {
    id: 'interchangeable_near_synonyms',
    patterns: [/not fully interchangeable|pas pleinement interchangeables|nicht voll austauschbar|не полностью взаимозаменяемы|不能完全互换/i],
  },
  {
    id: 'glass_of_water',
    patterns: [/glass of water|verre d.eau|glas wasser|стакан воды|一点.*水/i],
  },
  {
    id: 'library_sunday',
    patterns: [/library.*sunday|bibliothèque.*dimanche|bibliothek.*sonntag|библиотека.*воскресенье|图书馆.*周日/i],
  },
  {
    id: 'limited_seats',
    patterns: [/seats? are limited|places limitées|begrenzte plätze|мест мало|座位有限/i],
  },
  {
    id: 'budget_delay_launch',
    patterns: [/budget.*delay.*launch|coupes.*retarder.*lancement|budget.*verzögern|бюджет.*отлож.*запуск|预算.*推迟.*上线/i],
  },
  {
    id: 'open_the_window',
    patterns: [/open the window|ouvre la fenêtre|öffne das fenster|открой.*окно|打开.*窗户/i],
  },
];

function familyFor(stem: string): string | null {
  for (const f of CLONE_FAMILIES) {
    if (f.patterns.some((p) => p.test(stem))) return f.id;
  }
  return null;
}

function structuralFingerprint(stem: string): string {
  // Very coarse: first 4 content tokens lengths — catches parallel calques
  const toks = fold(stem).split(' ').filter((t) => t.length > 2).slice(0, 6);
  return createHash('sha256').update(toks.map((t) => String(t.length)).join('-')).digest('hex').slice(0, 12);
}

export function auditCrossLanguageSimilarity(
  items: BankItemRecord[],
): CrossLanguageAuditReport {
  const byFamily = new Map<string, CrossLangDuplicateGroup>();
  const languages = [...new Set(items.map((i) => i.language))] as BankLanguage[];

  for (const it of items) {
    const fam = familyFor(it.stem) ?? familyFor(it.prompt);
    if (!fam) continue;
    const g = byFamily.get(fam) ?? {
      fingerprint: fam,
      conceptHint: fam,
      items: [],
    };
    g.items.push({ language: it.language, id: it.id, stem: it.stem });
    byFamily.set(fam, g);
  }

  // Also group exact structural clones across languages (same length signature + shared Latin digits etc.)
  const byStruct = new Map<string, BankItemRecord[]>();
  for (const it of items) {
    const fp = structuralFingerprint(it.stem);
    const arr = byStruct.get(fp) ?? [];
    arr.push(it);
    byStruct.set(fp, arr);
  }

  const groups: CrossLangDuplicateGroup[] = [];
  for (const g of byFamily.values()) {
    const langs = new Set(g.items.map((x) => x.language));
    if (langs.size >= 2) groups.push(g);
  }

  // Structural multi-lang groups with very similar folded stems (Jaccard on tokens)
  for (const [fp, arr] of byStruct) {
    const langs = new Set(arr.map((i) => i.language));
    if (langs.size < 2) continue;
    // require at least one shared high-signal token length pattern already; skip if already in family
    if (groups.some((g) => g.items.some((x) => arr.some((a) => a.id === x.id)))) continue;
    // only flag if stems share a digit or named day concept etc.
    const shared = arr.filter((a) => /\b(15|3|sunday|dimanche|sonntag|воскресенье|周日|friday|vendredi|freitag|пятниц)\b/i.test(a.stem));
    if (shared.length >= 2 && new Set(shared.map((s) => s.language)).size >= 2) {
      groups.push({
        fingerprint: `struct:${fp}`,
        conceptHint: 'structural_parallel',
        items: shared.map((i) => ({ language: i.language, id: i.id, stem: i.stem })),
      });
    }
  }

  const involved = new Set(groups.flatMap((g) => g.items.map((i) => i.id)));
  return {
    totalItems: items.length,
    crossLanguageNearDuplicateGroups: groups,
    crossLanguageConceptReuseRate: items.length ? involved.size / items.length : 0,
    languagesCompared: languages,
  };
}

/** True if adding `candidate` would create/extend a forbidden cross-lang clone with `existing`. */
export function wouldCreateCrossLanguageClone(
  candidate: { language: BankLanguage; stem: string; prompt: string },
  existing: BankItemRecord[],
): boolean {
  const fam = familyFor(candidate.stem) ?? familyFor(candidate.prompt);
  if (!fam) return false;
  return existing.some(
    (e) => e.language !== candidate.language && (familyFor(e.stem) === fam || familyFor(e.prompt) === fam),
  );
}
