import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CompanionChatApiLanguage } from '@/types/companion-chat-api';
import type { PlacementQuestion } from '@/types/placement-api';
import { normalizePlacementPrompt, questionContentKey } from '@/utils/placement-seen';

const STORAGE_KEY = '@tearz/placement/lifetime-seen.v2';
const ENTROPY_KEY = '@tearz/placement/user-entropy.v1';
/** Keep a very large history so the same prompt is never reused on this device. */
const MAX_PER_LANGUAGE = 8000;

export type LifetimeSeenRecord = {
  ids: string[];
  prompts: string[];
  contentKeys: string[];
};

type LifetimeSeenStore = Partial<Record<CompanionChatApiLanguage, LifetimeSeenRecord>>;

function emptyRecord(): LifetimeSeenRecord {
  return { ids: [], prompts: [], contentKeys: [] };
}

function trimRecord(record: LifetimeSeenRecord): LifetimeSeenRecord {
  const trim = (arr: string[]) => (arr.length > MAX_PER_LANGUAGE ? arr.slice(-MAX_PER_LANGUAGE) : arr);
  return {
    ids: trim(record.ids),
    prompts: trim(record.prompts),
    contentKeys: trim(record.contentKeys),
  };
}

function mergePromptLists(a: string[], b: string[]): string[] {
  const out = [...a];
  const seen = new Set(a.map(normalizePlacementPrompt));
  for (const prompt of b) {
    const n = normalizePlacementPrompt(prompt);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(prompt);
  }
  return out;
}

function mergeRecord(prev: LifetimeSeenRecord, extra: LifetimeSeenRecord): LifetimeSeenRecord {
  return trimRecord({
    ids: [...new Set([...prev.ids, ...extra.ids])],
    prompts: mergePromptLists(prev.prompts, extra.prompts),
    contentKeys: [...new Set([...prev.contentKeys, ...extra.contentKeys])],
  });
}

/** In-memory mirror — prevents lost updates from concurrent AsyncStorage RMW. */
let memoryStore: LifetimeSeenStore | null = null;
let persistChain: Promise<void> = Promise.resolve();

async function ensureMemoryStore(): Promise<LifetimeSeenStore> {
  if (memoryStore) return memoryStore;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    memoryStore = raw ? (JSON.parse(raw) as LifetimeSeenStore) : {};
    if (!memoryStore || typeof memoryStore !== 'object' || Array.isArray(memoryStore)) {
      memoryStore = {};
    }
  } catch {
    memoryStore = {};
  }
  return memoryStore;
}

function schedulePersist() {
  const snapshot = memoryStore;
  if (!snapshot) return;
  persistChain = persistChain
    .then(async () => {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    })
    .catch(() => {
      /* ignore disk errors — memory still holds truth for this session */
    });
}

/** Stable per-install entropy so different users/devices get different sequences. */
export async function getPlacementUserEntropy(): Promise<number> {
  try {
    const existing = await AsyncStorage.getItem(ENTROPY_KEY);
    if (existing) {
      const n = Number(existing);
      if (Number.isFinite(n) && n !== 0) return n >>> 0;
    }
    const entropy = (Date.now() ^ (Math.floor(Math.random() * 0xffffffff) >>> 0)) >>> 0;
    await AsyncStorage.setItem(ENTROPY_KEY, String(entropy));
    return entropy;
  } catch {
    return (Date.now() ^ 0x9e3779b9) >>> 0;
  }
}

export async function loadLifetimeSeen(
  lang: CompanionChatApiLanguage,
): Promise<LifetimeSeenRecord> {
  const store = await ensureMemoryStore();
  return store[lang] ?? emptyRecord();
}

export async function rememberLifetimeQuestion(
  lang: CompanionChatApiLanguage,
  q: Pick<PlacementQuestion, 'id' | 'prompt' | 'choices'>,
): Promise<LifetimeSeenRecord> {
  const store = await ensureMemoryStore();
  const prev = store[lang] ?? emptyRecord();
  const contentKey = questionContentKey(q);
  const normPrompt = normalizePlacementPrompt(q.prompt);
  const next = trimRecord({
    ids: prev.ids.includes(q.id) ? prev.ids : [...prev.ids, q.id],
    prompts: prev.prompts.some((p) => normalizePlacementPrompt(p) === normPrompt)
      ? prev.prompts
      : [...prev.prompts, q.prompt],
    contentKeys: prev.contentKeys.includes(contentKey)
      ? prev.contentKeys
      : [...prev.contentKeys, contentKey],
  });
  store[lang] = next;
  memoryStore = store;
  schedulePersist();
  return next;
}

/** Batch-safe remember — one merge + one persist. */
export async function rememberLifetimeQuestions(
  lang: CompanionChatApiLanguage,
  questions: Array<Pick<PlacementQuestion, 'id' | 'prompt' | 'choices'>>,
): Promise<LifetimeSeenRecord> {
  const store = await ensureMemoryStore();
  let next = store[lang] ?? emptyRecord();
  for (const q of questions) {
    const contentKey = questionContentKey(q);
    const normPrompt = normalizePlacementPrompt(q.prompt);
    next = trimRecord({
      ids: next.ids.includes(q.id) ? next.ids : [...next.ids, q.id],
      prompts: next.prompts.some((p) => normalizePlacementPrompt(p) === normPrompt)
        ? next.prompts
        : [...next.prompts, q.prompt],
      contentKeys: next.contentKeys.includes(contentKey)
        ? next.contentKeys
        : [...next.contentKeys, contentKey],
    });
  }
  store[lang] = next;
  memoryStore = store;
  schedulePersist();
  return next;
}

/** Full lifetime avoid-list — never drop recent uniqueness for convenience. */
export async function mergeLifetimeIntoSeen(
  lang: CompanionChatApiLanguage,
  current: {
    ids: string[];
    prompts: string[];
    contentKeys: string[];
  },
): Promise<{
  ids: string[];
  prompts: string[];
  contentKeys: string[];
}> {
  const lifetime = await loadLifetimeSeen(lang);
  const merged = mergeRecord(lifetime, {
    ids: current.ids,
    prompts: current.prompts,
    contentKeys: current.contentKeys,
  });
  return merged;
}

/** Await pending disk flush (e.g. before leaving the test). */
export async function flushLifetimeSeen(): Promise<void> {
  await persistChain;
}
