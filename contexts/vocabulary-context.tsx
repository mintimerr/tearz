import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useAuth } from '@/contexts/auth-context';
import { detectWordLang, type WordScriptLang } from '@/utils/detect-word-lang';
import { USER_SUFFIX, userDataKey } from '@/utils/user-data-storage';

export type VocabularyEntry = {
  id: string;
  word: string;
  lang: WordScriptLang;
  pinyin?: string;
  translation?: string;
  addedAt: number;
};

export type VocabCard = {
  id: string;
  front: string;
  back: string;
  pinyin?: string;
  isUser?: boolean;
  addedAt: number;
};

export type VocabCustomFolder = {
  id: string;
  name: string;
  cards: VocabCard[];
  createdAt: number;
};

function norm(w: string) {
  return w.trim().toLowerCase();
}

function parseEntries(raw: string | null): VocabularyEntry[] {
  if (!raw) return [];
  try {
    const x = JSON.parse(raw) as unknown;
    if (!Array.isArray(x)) return [];
    return x.filter((row): row is VocabularyEntry => {
      if (!row || typeof row !== 'object') return false;
      const o = row as VocabularyEntry;
      return typeof o.id === 'string' && typeof o.word === 'string' && typeof o.addedAt === 'number';
    });
  } catch {
    return [];
  }
}

function parseFolders(raw: string | null): VocabCustomFolder[] {
  if (!raw) return [];
  try {
    const x = JSON.parse(raw) as unknown;
    if (!Array.isArray(x)) return [];
    return x.filter((row): row is VocabCustomFolder => {
      if (!row || typeof row !== 'object') return false;
      const o = row as VocabCustomFolder;
      return typeof o.id === 'string' && typeof o.name === 'string' && Array.isArray(o.cards);
    });
  } catch {
    return [];
  }
}

type VocabularyContextValue = {
  entries: VocabularyEntry[];
  customFolders: VocabCustomFolder[];
  vocabularyHydrated: boolean;
  addWord: (word: string, extra?: { translation?: string; pinyin?: string; lang?: WordScriptLang }) => boolean;
  removeWord: (id: string) => void;
  hasWord: (word: string) => boolean;
  createFolder: (name: string) => string | null;
  renameFolder: (folderId: string, name: string) => boolean;
  deleteFolder: (folderId: string) => void;
  addCardToFolder: (
    folderId: string,
    card: { front: string; back: string; pinyin?: string },
  ) => boolean;
  removeCardFromFolder: (folderId: string, cardId: string) => void;
  hasCardInFolder: (folderId: string, front: string) => boolean;
  importSharedFolder: (payload: { name: string; cards: Array<{ front: string; back: string; pinyin?: string }> }) => string | null;
};

const VocabularyContext = createContext<VocabularyContextValue | null>(null);

export function VocabularyProvider({ children }: { children: ReactNode }) {
  const { user, isHydrated: authHydrated } = useAuth();
  const userId = user?.id ?? null;

  const [entries, setEntries] = useState<VocabularyEntry[]>([]);
  const [customFolders, setCustomFolders] = useState<VocabCustomFolder[]>([]);
  const [vocabularyHydrated, setVocabularyHydrated] = useState(false);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistFoldersTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!authHydrated) return;

    let cancelled = false;
    setVocabularyHydrated(false);

    if (!userId) {
      setEntries([]);
      setCustomFolders([]);
      setVocabularyHydrated(true);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const [rawEntries, rawFolders] = await Promise.all([
          AsyncStorage.getItem(userDataKey(userId, USER_SUFFIX.vocabulary)),
          AsyncStorage.getItem(userDataKey(userId, USER_SUFFIX.vocabularyFolders)),
        ]);
        if (cancelled) return;
        setEntries(parseEntries(rawEntries));
        setCustomFolders(parseFolders(rawFolders));
      } catch {
        if (!cancelled) {
          setEntries([]);
          setCustomFolders([]);
        }
      } finally {
        if (!cancelled) setVocabularyHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authHydrated, userId]);

  useEffect(() => {
    if (!vocabularyHydrated || !userId) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      persistTimer.current = null;
      void AsyncStorage.setItem(userDataKey(userId, USER_SUFFIX.vocabulary), JSON.stringify(entries));
    }, 300);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [entries, vocabularyHydrated, userId]);

  useEffect(() => {
    if (!vocabularyHydrated || !userId) return;
    if (persistFoldersTimer.current) clearTimeout(persistFoldersTimer.current);
    persistFoldersTimer.current = setTimeout(() => {
      persistFoldersTimer.current = null;
      void AsyncStorage.setItem(
        userDataKey(userId, USER_SUFFIX.vocabularyFolders),
        JSON.stringify(customFolders),
      );
    }, 300);
    return () => {
      if (persistFoldersTimer.current) clearTimeout(persistFoldersTimer.current);
    };
  }, [customFolders, vocabularyHydrated, userId]);

  const hasWord = useCallback(
    (word: string) => entries.some((e) => norm(e.word) === norm(word)),
    [entries],
  );

  const addWord = useCallback(
    (word: string, extra?: { translation?: string; pinyin?: string; lang?: WordScriptLang }) => {
      const w = word.trim();
      if (!w) return false;
      if (hasWord(w)) return false;
      const id = `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const lang = extra?.lang ?? detectWordLang(w);
      const translation = extra?.translation?.trim();
      const pinyin = extra?.pinyin?.trim();
      setEntries((prev) => [
        {
          id,
          word: w,
          lang,
          pinyin: pinyin || undefined,
          translation: translation || undefined,
          addedAt: Date.now(),
        },
        ...prev,
      ]);
      return true;
    },
    [hasWord],
  );

  const removeWord = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const createFolder = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const id = `vf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const folder: VocabCustomFolder = { id, name: trimmed, cards: [], createdAt: Date.now() };
    setCustomFolders((prev) => [folder, ...prev]);
    return id;
  }, []);

  const renameFolder = useCallback((folderId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    setCustomFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, name: trimmed } : f)),
    );
    return true;
  }, []);

  const deleteFolder = useCallback((folderId: string) => {
    setCustomFolders((prev) => prev.filter((f) => f.id !== folderId));
  }, []);

  const hasCardInFolder = useCallback(
    (folderId: string, front: string) => {
      const folder = customFolders.find((f) => f.id === folderId);
      if (!folder) return false;
      return folder.cards.some((c) => norm(c.front) === norm(front));
    },
    [customFolders],
  );

  const addCardToFolder = useCallback(
    (folderId: string, card: { front: string; back: string; pinyin?: string }) => {
      const front = card.front.trim();
      const back = card.back.trim();
      if (!front || !back) return false;
      let ok = false;
      setCustomFolders((prev) =>
        prev.map((f) => {
          if (f.id !== folderId) return f;
          if (f.cards.some((c) => norm(c.front) === norm(front))) return f;
          ok = true;
          const newCard: VocabCard = {
            id: `vc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            front,
            back,
            pinyin: card.pinyin?.trim() || undefined,
            isUser: true,
            addedAt: Date.now(),
          };
          return { ...f, cards: [newCard, ...f.cards] };
        }),
      );
      return ok;
    },
    [],
  );

  const removeCardFromFolder = useCallback((folderId: string, cardId: string) => {
    setCustomFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, cards: f.cards.filter((c) => c.id !== cardId) } : f)),
    );
  }, []);

  const importSharedFolder = useCallback(
    (payload: { name: string; cards: Array<{ front: string; back: string; pinyin?: string }> }) => {
      const trimmedName = payload.name.trim().slice(0, 80);
      if (!trimmedName || payload.cards.length === 0) return null;

      let createdId: string | null = null;

      setCustomFolders((prev) => {
        let folderName = trimmedName;
        const taken = new Set(prev.map((f) => f.name.trim().toLowerCase()));
        if (taken.has(folderName.toLowerCase())) {
          let n = 2;
          while (taken.has(`${trimmedName} (${n})`.toLowerCase())) n += 1;
          folderName = `${trimmedName} (${n})`;
        }

        const seen = new Set<string>();
        const cards: VocabCard[] = [];
        for (const raw of payload.cards) {
          const front = raw.front.trim();
          const back = raw.back.trim();
          if (!front || !back) continue;
          const key = norm(front);
          if (seen.has(key)) continue;
          seen.add(key);
          cards.push({
            id: `vc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            front,
            back,
            pinyin: raw.pinyin?.trim() || undefined,
            isUser: true,
            addedAt: Date.now(),
          });
        }
        if (cards.length === 0) return prev;

        const id = `vf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        createdId = id;
        return [{ id, name: folderName, cards, createdAt: Date.now() }, ...prev];
      });

      return createdId;
    },
    [],
  );

  const value = useMemo(
    () => ({
      entries,
      customFolders,
      vocabularyHydrated,
      addWord,
      removeWord,
      hasWord,
      createFolder,
      renameFolder,
      deleteFolder,
      addCardToFolder,
      removeCardFromFolder,
      hasCardInFolder,
      importSharedFolder,
    }),
    [
      entries,
      customFolders,
      vocabularyHydrated,
      addWord,
      removeWord,
      hasWord,
      createFolder,
      renameFolder,
      deleteFolder,
      addCardToFolder,
      removeCardFromFolder,
      hasCardInFolder,
      importSharedFolder,
    ],
  );

  return <VocabularyContext.Provider value={value}>{children}</VocabularyContext.Provider>;
}

export function useVocabulary() {
  const ctx = useContext(VocabularyContext);
  if (!ctx) throw new Error('useVocabulary must be used within VocabularyProvider');
  return ctx;
}
