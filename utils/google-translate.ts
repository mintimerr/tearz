/** Lightweight Google Translate (gtx) — better word sense than MyMemory for FR/DE/ZH. */

const CACHE_LIMIT = 200;
const cache = new Map<string, string>();

function cacheKey(q: string, from: string, to: string) {
  return `${from}|${to}|${q.trim().toLowerCase()}`;
}

function readCache(key: string): string | null {
  const hit = cache.get(key);
  if (!hit) return null;
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

function writeCache(key: string, value: string) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

function parseGtxText(data: unknown): string | null {
  if (!Array.isArray(data) || !Array.isArray(data[0])) return null;
  const chunks: string[] = [];
  for (const row of data[0]) {
    if (Array.isArray(row) && typeof row[0] === 'string' && row[0].trim()) {
      chunks.push(row[0]);
    }
  }
  const out = chunks.join('').trim();
  return out || null;
}

export type GoogleLang = 'en' | 'ru' | 'zh-CN' | 'fr' | 'de';

export async function googleTranslateText(
  text: string,
  from: GoogleLang,
  to: GoogleLang,
  signal?: AbortSignal,
): Promise<string | null> {
  const q = text.trim();
  if (!q || from === to) return null;

  const key = cacheKey(q, from, to);
  const cached = readCache(key);
  if (cached) return cached;

  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx` +
    `&sl=${encodeURIComponent(from)}` +
    `&tl=${encodeURIComponent(to)}` +
    `&dt=t&q=${encodeURIComponent(q)}`;

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    const out = parseGtxText(data);
    if (!out) return null;
    // Reject obvious garbage / identical copy.
    if (out.toLowerCase() === q.toLowerCase() && from.slice(0, 2) !== to.slice(0, 2)) {
      return null;
    }
    writeCache(key, out);
    return out;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e;
    return null;
  }
}
