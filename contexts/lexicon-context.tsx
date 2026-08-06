import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '@/contexts/auth-context';
import { useVocabulary } from '@/contexts/vocabulary-context';
import type { LexiconPair } from '@/types/lexicon';
import { LEXICON_HARVEST_MAX } from '@/types/lexicon';
import {
  extractPairsFromTeacherText,
  LEXICON_SEED_PAIRS,
  mergeLexiconPairs,
  pairsFromFolders,
  pairsFromVocabulary,
} from '@/utils/learner-lexicon';
import { USER_SUFFIX, userDataKey } from '@/utils/user-data-storage';

type LexiconContextValue = {
  hydrated: boolean;
  pairs: LexiconPair[];
  /** Только пользовательский контент (без seed). */
  personalCount: number;
  ingestTeacherText: (text: string) => number;
};

const LexiconContext = createContext<LexiconContextValue | null>(null);

function parseHarvest(raw: string | null): LexiconPair[] {
  if (!raw) return [];
  try {
    const x = JSON.parse(raw) as unknown;
    if (!Array.isArray(x)) return [];
    return x.filter((row): row is LexiconPair => {
      if (!row || typeof row !== 'object') return false;
      const o = row as LexiconPair;
      return (
        typeof o.id === 'string' &&
        typeof o.front === 'string' &&
        typeof o.back === 'string' &&
        o.source === 'teacher'
      );
    });
  } catch {
    return [];
  }
}

export function LexiconProvider({ children }: { children: ReactNode }) {
  const { user, isHydrated: authHydrated } = useAuth();
  const userId = user?.id ?? null;
  const { entries, customFolders, vocabularyHydrated } = useVocabulary();

  const [harvest, setHarvest] = useState<LexiconPair[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const harvestRef = useRef(harvest);
  harvestRef.current = harvest;
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!authHydrated) return;
    let cancelled = false;
    (async () => {
      if (!userId) {
        if (!cancelled) {
          setHarvest([]);
          setHydrated(true);
        }
        return;
      }
      const raw = await AsyncStorage.getItem(userDataKey(userId, USER_SUFFIX.lexiconHarvest));
      if (!cancelled) {
        setHarvest(parseHarvest(raw));
        setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authHydrated, userId]);

  useEffect(() => {
    if (!hydrated || !userId) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      void AsyncStorage.setItem(
        userDataKey(userId, USER_SUFFIX.lexiconHarvest),
        JSON.stringify(harvestRef.current.slice(0, LEXICON_HARVEST_MAX)),
      );
    }, 400);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [harvest, hydrated, userId]);

  const ingestTeacherText = useCallback((text: string) => {
    const found = extractPairsFromTeacherText(text);
    if (found.length === 0) return 0;
    let added = 0;
    setHarvest((prev) => {
      const map = new Map(prev.map((p) => [`${p.front.toLowerCase()}|${p.back.toLowerCase()}`, p]));
      for (const p of found) {
        const key = `${p.front.toLowerCase()}|${p.back.toLowerCase()}`;
        if (map.has(key)) continue;
        map.set(key, p);
        added += 1;
      }
      return Array.from(map.values()).slice(0, LEXICON_HARVEST_MAX);
    });
    return added;
  }, []);

  const pairs = useMemo(() => {
    if (!vocabularyHydrated && !hydrated) return LEXICON_SEED_PAIRS;
    const personal = mergeLexiconPairs(
      pairsFromVocabulary(entries),
      pairsFromFolders(customFolders),
      harvest,
    );
    if (personal.length >= 4) return personal;
    return mergeLexiconPairs(personal, LEXICON_SEED_PAIRS);
  }, [customFolders, entries, harvest, hydrated, vocabularyHydrated]);

  const personalCount = useMemo(() => {
    return mergeLexiconPairs(
      pairsFromVocabulary(entries),
      pairsFromFolders(customFolders),
      harvest,
    ).length;
  }, [customFolders, entries, harvest]);

  const value = useMemo(
    () => ({
      hydrated: hydrated && vocabularyHydrated,
      pairs,
      personalCount,
      ingestTeacherText,
    }),
    [hydrated, ingestTeacherText, pairs, personalCount, vocabularyHydrated],
  );

  return <LexiconContext.Provider value={value}>{children}</LexiconContext.Provider>;
}

export function useLexicon() {
  const ctx = useContext(LexiconContext);
  if (!ctx) throw new Error('useLexicon must be used within LexiconProvider');
  return ctx;
}
