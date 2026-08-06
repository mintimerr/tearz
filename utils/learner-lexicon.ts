import type { VocabCard, VocabCustomFolder, VocabularyEntry } from '@/contexts/vocabulary-context';
import type { LexiconPair } from '@/types/lexicon';

function norm(s: string) {
  return s.trim().toLowerCase();
}

/** Seed, чтобы игру можно было открыть до первых карточек. */
export const LEXICON_SEED_PAIRS: LexiconPair[] = [
  { id: 'seed-1', front: 'hello', back: 'привет', source: 'seed' },
  { id: 'seed-2', front: 'thanks', back: 'спасибо', source: 'seed' },
  { id: 'seed-3', front: 'water', back: 'вода', source: 'seed' },
  { id: 'seed-4', front: 'food', back: 'еда', source: 'seed' },
  { id: 'seed-5', front: 'friend', back: 'друг', source: 'seed' },
  { id: 'seed-6', front: 'today', back: 'сегодня', source: 'seed' },
  { id: 'seed-7', front: 'please', back: 'пожалуйста', source: 'seed' },
  { id: 'seed-8', front: 'good', back: 'хороший', source: 'seed' },
];

export function pairsFromVocabulary(entries: VocabularyEntry[]): LexiconPair[] {
  const out: LexiconPair[] = [];
  for (const e of entries) {
    const front = e.word.trim();
    const back = (e.translation || '').trim();
    if (!front || !back) continue;
    out.push({
      id: `v-${e.id}`,
      front,
      back,
      pinyin: e.pinyin,
      source: 'vocab',
    });
  }
  return out;
}

export function pairsFromFolders(folders: VocabCustomFolder[]): LexiconPair[] {
  const out: LexiconPair[] = [];
  for (const f of folders) {
    for (const c of f.cards) {
      const front = c.front.trim();
      const back = c.back.trim();
      if (!front || !back) continue;
      out.push({
        id: `f-${f.id}-${c.id}`,
        front,
        back,
        pinyin: c.pinyin,
        source: 'folder',
      });
    }
  }
  return out;
}

export function mergeLexiconPairs(...lists: LexiconPair[][]): LexiconPair[] {
  const seen = new Set<string>();
  const out: LexiconPair[] = [];
  for (const list of lists) {
    for (const p of list) {
      const key = `${norm(p.front)}|${norm(p.back)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}

/**
 * Достаёт пары «слово — перевод» из ответа учителя.
 * Тихие эвристики: тире, стрелки, «слово (перевод)».
 */
export function extractPairsFromTeacherText(text: string): LexiconPair[] {
  if (!text || text.length < 4) return [];
  const out: LexiconPair[] = [];
  const seen = new Set<string>();
  const push = (front: string, back: string) => {
    const f = front.trim().replace(/^[-•*\d.)\s]+/, '').trim();
    const b = back.trim().replace(/^[-•*\d.)\s]+/, '').trim();
    if (f.length < 2 || b.length < 2) return;
    if (f.length > 48 || b.length > 64) return;
    if (norm(f) === norm(b)) return;
    if (/^(определение|примеры|фразы|диалог|практика|объясняю|коротко|чем могу)/i.test(f)) return;
    const key = `${norm(f)}|${norm(b)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      id: `t-${Date.now()}-${out.length}-${Math.random().toString(36).slice(2, 6)}`,
      front: f,
      back: b,
      source: 'teacher',
    });
  };

  const dashRe =
    /([A-Za-zÀ-ÿ\u0400-\u04FF\u4e00-\u9fff][^:\n]{0,40}?)\s*[—–→\-]\s*([^\n]{2,48})/g;
  let m: RegExpExecArray | null;
  while ((m = dashRe.exec(text)) !== null) {
    push(m[1], m[2].split(/[.;]/)[0] ?? m[2]);
  }

  const parenRe =
    /([A-Za-zÀ-ÿ\u4e00-\u9fff][A-Za-zÀ-ÿ\u4e00-\u9fff\s']{1,36})\s*\(([^)]{2,40})\)/g;
  while ((m = parenRe.exec(text)) !== null) {
    const inner = m[2].trim();
    if (/^[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü\s]+$/i.test(inner) && /[\u4e00-\u9fff]/.test(m[1])) {
      continue;
    }
    push(m[1], inner);
  }

  return out.slice(0, 24);
}

/** Для раунда: 1 правильный + decoys из других пар. */
export function pickRoundOptions(
  pairs: LexiconPair[],
  count = 4,
): { target: LexiconPair; options: string[] } | null {
  if (pairs.length === 0) return null;
  const target = pairs[Math.floor(Math.random() * pairs.length)]!;
  const decoys = pairs
    .filter((p) => norm(p.back) !== norm(target.back))
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.max(0, count - 1))
    .map((p) => p.back);

  let guard = 0;
  while (decoys.length < count - 1 && guard < 20) {
    guard += 1;
    const s = LEXICON_SEED_PAIRS[decoys.length % LEXICON_SEED_PAIRS.length]!;
    if (norm(s.back) !== norm(target.back) && !decoys.some((d) => norm(d) === norm(s.back))) {
      decoys.push(s.back);
    } else {
      decoys.push(`${s.back}·`);
      break;
    }
  }

  const options = [target.back, ...decoys].sort(() => Math.random() - 0.5);
  return { target, options };
}

export function cardsToPairs(cards: VocabCard[]): LexiconPair[] {
  return cards
    .filter((c) => c.front.trim() && c.back.trim())
    .map((c) => ({
      id: `c-${c.id}`,
      front: c.front.trim(),
      back: c.back.trim(),
      pinyin: c.pinyin,
      source: (c.isUser ? 'vocab' : 'seed') as LexiconPair['source'],
    }));
}
