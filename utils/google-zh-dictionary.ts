type BdRow = unknown;

function parseBdGlosses(data: unknown): string[] {
  if (!Array.isArray(data) || data.length < 2) return [];
  const block = data[1];
  if (!Array.isArray(block) || !block[0]) return [];

  const row = block[0] as BdRow;
  if (!Array.isArray(row) || row.length < 2) return [];

  const glosses = row[1];
  if (!Array.isArray(glosses)) return [];

  return glosses
    .filter((g): g is string => typeof g === 'string')
    .map((g) => g.trim())
    .filter(Boolean);
}

/** Словарные значения китайского слова через Google Dictionary (dt=bd). */
export async function fetchZhDictionaryEnGlosses(
  word: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const q = word.trim();
  if (!q) return [];

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=en&dt=bd&q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    return parseBdGlosses(data);
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e;
    return [];
  }
}
