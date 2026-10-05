import type { PlacementHistoryItem } from '@/types/placement-api';

/**
 * Strip internal uniqueness decorations that must never reach the learner UI
 * (legacy local fallback used to append «épisode / episode / 场景 / вариант …»).
 */
export function stripPlacementPromptDecorations(prompt: string): string {
  return prompt
    .replace(
      /\s*[—–\-·•]\s*(épisode|episode|эпизод|сцена|场景|référence|ref\.?|код|variante|variant|вариант)\s*[a-z0-9]+/gi,
      '',
    )
    .replace(/\s*[·•]\s*[a-z0-9]{4,}$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Slot tokens (names/places/times/…) registered by the local factory — longest first. */
let slotMaskTokens: string[] = [];

export function setPlacementSlotMaskTokens(tokens: string[]): void {
  const uniq = [...new Set(tokens.map((t) => t.trim()).filter((t) => t.length >= 2))];
  uniq.sort((a, b) => b.length - a.length);
  slotMaskTokens = uniq;
}

/** Canonical form for duplicate detection (pinyin/noise stripped). */
export function normalizePlacementPrompt(prompt: string): string {
  return stripPlacementPromptDecorations(prompt)
    .replace(/\([^)]*[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüa-z\s]{2,}[^)]*\)/gi, '')
    .replace(/（[^）]*[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüa-z\s]{2,}[^）]*）/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Template skeleton: same frame with different name/place/time → same key.
 * Catches «identical sentences with one slot swapped».
 */
export function placementTemplateKey(prompt: string): string {
  let s = stripPlacementPromptDecorations(prompt);
  s = s.replace(/___+/g, '#');
  s = s.replace(/\([^)]*\)/g, ' ');
  s = s.replace(/（[^）]*）/g, ' ');
  s = s.replace(/\b[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ''-]*\b/g, '#');
  s = s.replace(/\d+/g, '#');
  let out = s.toLowerCase();
  for (const token of slotMaskTokens) {
    const t = token.toLowerCase();
    if (t.length < 2) continue;
    if (out.includes(t)) out = out.split(t).join('#');
  }
  return out.replace(/#+/g, '#').replace(/[^\p{L}\p{N}#]+/gu, '').trim();
}

const LATIN_STOP = new Set([
  'a', 'an', 'the', 'to', 'of', 'in', 'on', 'at', 'for', 'by', 'with', 'from', 'and', 'or',
  'but', 'if', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'has', 'have', 'had', 'do',
  'does', 'did', 'will', 'would', 'can', 'could', 'should', 'may', 'might', 'not', 'no',
  'so', 'than', 'then', 'that', 'this', 'these', 'those', 'it', 'its', 'he', 'she', 'they',
  'we', 'you', 'i', 'me', 'him', 'her', 'them', 'my', 'your', 'his', 'our', 'their',
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'en', 'au', 'aux', 'ce', 'cette',
  'der', 'die', 'das', 'den', 'dem', 'ein', 'eine', 'und', 'im', 'am', 'zu', 'von',
  'и', 'в', 'на', 'с', 'по', 'к', 'у', 'о', 'из', 'за', 'от', 'до', 'не', 'но', 'а', 'же',
]);

const CJK_PARTICLES = new Set('的了着过吗呢吧把被让给在和与及或而就又还才是有'.split(''));

export function placementSignificantTokens(text: string): string[] {
  const cleaned = normalizePlacementPrompt(text)
    .replace(/___+/g, ' ')
    .replace(/[^\p{L}\p{N}\s\u4e00-\u9fff]/gu, ' ');
  const out: string[] = [];
  const latin = cleaned.match(/[a-zà-öø-ÿа-яё]{2,}/gi) ?? [];
  for (const w of latin) {
    const low = w.toLowerCase();
    if (!LATIN_STOP.has(low)) out.push(low);
  }
  const cjk = cleaned.match(/[\u4e00-\u9fff]/g) ?? [];
  for (const ch of cjk) {
    if (!CJK_PARTICLES.has(ch)) out.push(ch);
  }
  return out;
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter += 1;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function sortedMultisetKey(tokens: string[]): string {
  return [...tokens].sort().join('\u0001');
}

/** Correct choice is basically the stem with words/chars reshuffled or lightly synonym-swapped. */
export function isTrivialParaphraseChoice(stem: string, choice: string): boolean {
  const clean = (text: string) =>
    text.replace(/\([^)]*\)/g, ' ').replace(/（[^）]*）/g, ' ');
  const a = placementSignificantTokens(clean(stem));
  const b = placementSignificantTokens(clean(choice));
  if (a.length < 3 || b.length < 3) return false;

  if (sortedMultisetKey(a) === sortedMultisetKey(b)) return true;

  const j = jaccard(a, b);
  if (j >= 0.82 && Math.abs(a.length - b.length) <= 2) return true;
  if (j >= 0.9) return true;

  // Chinese content chars only — catches 把会议推迟了 ↔ 推迟了会议
  const ca = a.filter((t) => /[\u4e00-\u9fff]/.test(t));
  const cb = b.filter((t) => /[\u4e00-\u9fff]/.test(t));
  if (ca.length >= 4 && sortedMultisetKey(ca) === sortedMultisetKey(cb)) return true;
  if (ca.length >= 4 && jaccard(ca, cb) >= 0.88) return true;

  return false;
}

export function stemsTooSimilar(a: string, b: string): boolean {
  if (placementTemplateKey(a) && placementTemplateKey(a) === placementTemplateKey(b)) return true;
  const ta = placementSignificantTokens(a);
  const tb = placementSignificantTokens(b);
  if (ta.length >= 4 && tb.length >= 4 && jaccard(ta, tb) >= 0.78) return true;
  return false;
}

export function questionContentKey(q: { prompt: string; choices: string[] }) {
  const prompt = normalizePlacementPrompt(q.prompt);
  const choices = [...q.choices]
    .map((c) => normalizePlacementPrompt(c))
    .filter(Boolean)
    .sort()
    .join('|');
  return `${prompt}::${choices}`;
}

export function buildSeenQuestionKeys(
  history: PlacementHistoryItem[],
  extra?: { id?: string; prompt?: string; choices?: string[] },
) {
  const ids = new Set<string>();
  const prompts = new Set<string>();
  const contents = new Set<string>();
  const templates = new Set<string>();

  const rememberPrompt = (prompt: string) => {
    prompts.add(normalizePlacementPrompt(prompt));
    const key = placementTemplateKey(prompt);
    if (key) templates.add(key);
  };

  for (const item of history) {
    if (item.questionId) ids.add(item.questionId);
    if (item.prompt) rememberPrompt(item.prompt);
    if (item.prompt && item.choices?.length) {
      contents.add(questionContentKey({ prompt: item.prompt, choices: item.choices }));
    }
  }
  if (extra?.id) ids.add(extra.id);
  if (extra?.prompt) rememberPrompt(extra.prompt);
  if (extra?.prompt && extra?.choices?.length) {
    contents.add(questionContentKey({ prompt: extra.prompt, choices: extra.choices }));
  }
  return { ids, prompts, contents, templates };
}

export function isQuestionAlreadySeen(
  q: { id: string; prompt: string; choices: string[] },
  seen: ReturnType<typeof buildSeenQuestionKeys>,
) {
  if (
    seen.ids.has(q.id) ||
    seen.prompts.has(normalizePlacementPrompt(q.prompt)) ||
    seen.contents.has(questionContentKey(q))
  ) {
    return true;
  }
  const template = placementTemplateKey(q.prompt);
  if (template && seen.templates.has(template)) return true;

  for (const prev of seen.prompts) {
    if (stemsTooSimilar(q.prompt, prev)) return true;
  }
  return false;
}

/** Детерминированный выбор из оставшихся — без повтора подряд. */
export function pickFromPoolWithoutRepeat<
  T extends { id: string; prompt: string; choices: string[] },
>(
  pool: T[],
  seen: ReturnType<typeof buildSeenQuestionKeys>,
  salt: number,
): T | null {
  const fresh = pool.filter((q) => !isQuestionAlreadySeen(q, seen));
  if (fresh.length > 0) {
    const idx = Math.abs(salt) % fresh.length;
    return fresh[idx] ?? fresh[0];
  }
  return null;
}
