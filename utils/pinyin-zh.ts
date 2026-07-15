/**
 * Best-effort пиньинь для китайского текста.
 * Возвращает null если сервис недоступен.
 */

import { pinyin as toPinyin } from 'pinyin-pro';

function hasHan(text: string) {
  // CJK Unified Ideographs + extension A
  return /[\u3400-\u4DBF\u4E00-\u9FFF]/.test(text);
}

/** Синхронный пиньинь — без сети, для мгновенных подсказок при вводе. */
export function pinyinZhSync(text: string): string | null {
  const q = text.trim();
  if (!q || !hasHan(q)) return null;

  try {
    const py = toPinyin(q, {
      toneType: 'symbol',
      type: 'array',
      nonZh: 'consecutive',
    })
      .map((s) => String(s).trim())
      .filter(Boolean)
      .join(' ')
      .trim();
    return py || null;
  } catch {
    return null;
  }
}

export async function pinyinZh(text: string): Promise<string | null> {
  const q = text.trim();
  if (!q) return null;

  const local = pinyinZhSync(q);
  if (local) return local;

  // Простая публичная API-ручка (не требует ключей). Может быть недоступна — UI обработает.
  const url = `https://helloacm.com/api/pinyin/?cached&s=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, {
      headers: {
        accept: 'text/plain, application/json;q=0.9, */*;q=0.8',
      },
    });
    if (!res.ok) return null;
    const raw = (await res.text()).trim();
    if (!raw) return null;

    // Сервис иногда возвращает "error"/HTML/JSON. Нормализуем и отбрасываем заведомо плохие ответы.
    const lc = raw.toLowerCase();
    if (lc === 'error' || lc.includes('error:') || lc.startsWith('<!doctype') || lc.startsWith('<html')) return null;

    // Если это JSON — попробуем достать поле результата.
    if ((raw.startsWith('{') && raw.endsWith('}')) || (raw.startsWith('[') && raw.endsWith(']'))) {
      try {
        const j = JSON.parse(raw) as unknown;
        if (j && typeof j === 'object') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const err = (j as any).error ?? (j as any).message ?? null;
          if (typeof err === 'string' && err.trim()) return null;
        }
        const fromObj =
          typeof j === 'string'
            ? j
            : j && typeof j === 'object'
              ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ((j as any).result ?? (j as any).pinyin ?? (j as any).data ?? null)
              : null;
        if (typeof fromObj === 'string') {
          const t = fromObj.trim();
          const tlc = t.toLowerCase();
          if (!t || tlc === 'error' || tlc.includes('error:')) return null;
          return t;
        }
      } catch {
        // fall through to raw handling
      }
    }

    return raw;
  } catch {
    return null;
  }
}

