/** CEFR / HSK step above placement result — target for the first Tearz path chat. */

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export type CefrLevel = (typeof CEFR_ORDER)[number];

export function normalizeCefrLevel(level: string): CefrLevel | null {
  const key = level.trim().toUpperCase();
  return (CEFR_ORDER as readonly string[]).includes(key) ? (key as CefrLevel) : null;
}

export function nextCefrLevel(level: string): CefrLevel | null {
  const cur = normalizeCefrLevel(level);
  if (!cur) return null;
  const idx = CEFR_ORDER.indexOf(cur);
  if (idx < 0 || idx >= CEFR_ORDER.length - 1) return null;
  return CEFR_ORDER[idx + 1];
}

/** Accepts "HSK 2", "hsk2", "2". */
export function nextHskLevel(hskLevel: string): string | null {
  const match = hskLevel.trim().match(/(\d+)/);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n) || n < 1 || n >= 6) return null;
  return `HSK ${n + 1}`;
}

export function nextPlacementTarget(input: {
  level: string;
  hskLevel?: string;
  language: string;
}): { currentLabel: string; nextLabel: string; isMastery: boolean } {
  if (input.language === 'chinese' && input.hskLevel) {
    const next = nextHskLevel(input.hskLevel);
    return {
      currentLabel: input.hskLevel,
      nextLabel: next ?? input.hskLevel,
      isMastery: !next,
    };
  }
  const next = nextCefrLevel(input.level);
  return {
    currentLabel: normalizeCefrLevel(input.level) ?? input.level,
    nextLabel: next ?? (normalizeCefrLevel(input.level) ?? input.level),
    isMastery: !next,
  };
}

export function placementPathLessonId(language: string, nextLabel: string): string {
  const slug = nextLabel.trim().toLowerCase().replace(/\s+/g, '-');
  return `tl-path-${language}-${slug}`;
}
