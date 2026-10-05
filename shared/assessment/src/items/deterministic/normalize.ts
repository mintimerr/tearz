/** Normalization helpers for option/stem comparison. */

export function normalizeText(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/\u200b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function wordCount(s: string): number {
  const t = s.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

export function hasMalformedUnicode(s: string): boolean {
  // Lone surrogates / replacement char spam
  if (/\uFFFD/.test(s)) return true;
  for (let i = 0; i < s.length; i += 1) {
    const code = s.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = s.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      i += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

const PLACEHOLDER_RE =
  /\b(TODO|TBD|FIXME|XXX|INSERT_ANSWER|OPTION_HERE|lorem ipsum|\[blank\]|\{answer\})\b/i;

export function hasForbiddenPlaceholder(s: string): boolean {
  return PLACEHOLDER_RE.test(s);
}

/** Obvious instruction / metadata leakage in untrusted generated content. */
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /disregard\s+(all\s+)?(previous|prior)\s+instructions/i,
  /system\s*prompt/i,
  /you\s+are\s+chatgpt/i,
  /<\/?(?:system|assistant|user)>/i,
  /\[\[?\s*targetLevel\s*[=:]/i,
  /calibrationStatus\s*=\s*(?:calibrated|anchor)/i,
  /do\s+not\s+follow\s+tear[sz]/i,
];

export function detectPromptInjection(s: string): string | null {
  for (const re of INJECTION_PATTERNS) {
    if (re.test(s)) return re.source;
  }
  return null;
}

export function stripPunct(s: string): string {
  return normalizeText(s).replace(/[^\p{L}\p{N}\s']/gu, '');
}
