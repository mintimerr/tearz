/**
 * Deterministic choice shuffle for bank-first placement.
 * Same seed → same order. Correctness is by choice TEXT, not index.
 * Psychometric evidence is unaffected by display position.
 */

export type ShufflableChoices = {
  choices: string[];
  correctChoice: string;
};

/** FNV-1a 32-bit hash → mulberry32 PRNG seed. */
export function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic Fisher–Yates shuffle of choices.
 * Preserves correctChoice text; only reorders display.
 */
export function deterministicShuffleChoices<T extends ShufflableChoices>(
  q: T,
  seed: string,
): T {
  const choices = [...q.choices];
  const correctChoice = q.correctChoice;
  if (!choices.includes(correctChoice)) {
    throw new Error('correctChoice missing from choices before shuffle');
  }
  const rand = mulberry32(hashSeed(seed));
  for (let i = choices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [choices[i], choices[j]] = [choices[j]!, choices[i]!];
  }
  return { ...q, choices, correctChoice };
}

/** Build presentation seed from session + item + question number. */
export function presentationShuffleSeed(
  assessmentSessionId: string,
  itemId: string,
  questionNumber: number,
): string {
  return `${assessmentSessionId}|${itemId}|q${questionNumber}`;
}
