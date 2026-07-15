import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import type { CompanionMsg } from '@/types/companion-message';
import { USER_SUFFIX, userDataKey } from '@/utils/user-data-storage';

/** Сообщение в треде (дублирует форму пузырьков в companion-chat) */
export type CompanionThreadMsg = CompanionMsg;

const THREAD_CAP = 200;

const PERSIST_DEBOUNCE_MS = 400;

function formatNowClock() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function parseChats(raw: string | null): CompanionChatRow[] | null {
  if (!raw) return null;
  try {
    const x = JSON.parse(raw) as unknown;
    if (!Array.isArray(x) || x.length === 0) return null;
    if (!x.every((row) => row && typeof row === 'object' && typeof (row as CompanionChatRow).id === 'string')) {
      return null;
    }
    return x as CompanionChatRow[];
  } catch {
    return null;
  }
}

function parseThreads(raw: string | null): Record<string, CompanionThreadMsg[]> | null {
  if (!raw) return null;
  try {
    const x = JSON.parse(raw) as unknown;
    if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
    const o = x as Record<string, unknown>;
    for (const key of Object.keys(o)) {
      if (!Array.isArray(o[key])) return null;
    }
    return o as Record<string, CompanionThreadMsg[]>;
  } catch {
    return null;
  }
}

function parseFavs(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const x = JSON.parse(raw) as unknown;
    if (!Array.isArray(x)) return null;
    if (!x.every((id) => typeof id === 'string')) return null;
    return x;
  } catch {
    return null;
  }
}

export type CompanionChatRow = {
  id: string;
  name: string;
  preview: string;
  time: string;
  unread: number;
  online: boolean;
  letter: string;
  color: string;
  /** Микро-статус «живого» собеседника в списке */
  presence?: string;
  /** Язык практики для AI-собеседника (маршрут в companion-chat) */
  companionLang?: 'english' | 'chinese' | 'russian';
  /** Личность для system prompt (хранится в памяти контекста, не в URL) */
  companionPersona?: string;
  /** Первая реплика собеседника (для старта треда и повторного открытия из списка) */
  companionOpeningLine?: string;
  /** Строка под именем в чате: «возраст · город · кратко» */
  profileMetaLine?: string;
};

type CompanionChatsContextValue = {
  chats: CompanionChatRow[];
  favoriteIds: string[];
  /** false до окончания загрузки из AsyncStorage — не показывать чат с устаревшим тредом */
  companionChatsHydrated: boolean;
  addChat: (row: CompanionChatRow) => void;
  removeChat: (id: string) => void;
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  getCompanionThread: (id: string) => CompanionThreadMsg[] | undefined;
  saveCompanionThread: (id: string, thread: CompanionThreadMsg[]) => void;
};

const CompanionChatsContext = createContext<CompanionChatsContextValue | null>(null);

export function CompanionChatsProvider({ children }: { children: React.ReactNode }) {
  const { user, isHydrated: authHydrated } = useAuth();
  const userId = user?.id ?? null;

  const [chats, setChats] = useState<CompanionChatRow[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [threadsByChatId, setThreadsByChatId] = useState<Record<string, CompanionThreadMsg[]>>({});
  const [companionChatsHydrated, setCompanionChatsHydrated] = useState(false);

  const persistSnapshot = useRef({ chats, threadsByChatId, favoriteIds, userId });
  persistSnapshot.current = { chats, threadsByChatId, favoriteIds, userId };

  const persistForUser = useCallback(
    async (uid: string, c: CompanionChatRow[], t: Record<string, CompanionThreadMsg[]>, f: string[]) => {
      await AsyncStorage.multiSet([
        [userDataKey(uid, USER_SUFFIX.companionChats), JSON.stringify(c)],
        [userDataKey(uid, USER_SUFFIX.companionThreads), JSON.stringify(t)],
        [userDataKey(uid, USER_SUFFIX.companionFavs), JSON.stringify(f)],
      ]);
    },
    [],
  );

  useEffect(() => {
    if (!companionChatsHydrated || !userId) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'background' && state !== 'inactive') return;
      const snap = persistSnapshot.current;
      if (!snap.userId) return;
      void persistForUser(snap.userId, snap.chats, snap.threadsByChatId, snap.favoriteIds);
    });
    return () => sub.remove();
  }, [companionChatsHydrated, userId, persistForUser]);

  useEffect(() => {
    if (!authHydrated) return;

    let cancelled = false;
    setCompanionChatsHydrated(false);

    if (!userId) {
      setChats([]);
      setThreadsByChatId({});
      setFavoriteIds([]);
      setCompanionChatsHydrated(true);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const [rawChats, rawThreads, rawFavs] = await Promise.all([
          AsyncStorage.getItem(userDataKey(userId, USER_SUFFIX.companionChats)),
          AsyncStorage.getItem(userDataKey(userId, USER_SUFFIX.companionThreads)),
          AsyncStorage.getItem(userDataKey(userId, USER_SUFFIX.companionFavs)),
        ]);
        if (cancelled) return;
        setChats(parseChats(rawChats) ?? []);
        setThreadsByChatId(parseThreads(rawThreads) ?? {});
        setFavoriteIds(parseFavs(rawFavs) ?? []);
      } catch {
        if (!cancelled) {
          setChats([]);
          setThreadsByChatId({});
          setFavoriteIds([]);
        }
      } finally {
        if (!cancelled) setCompanionChatsHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authHydrated, userId]);

  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!companionChatsHydrated || !userId) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      persistTimer.current = null;
      void persistForUser(userId, chats, threadsByChatId, favoriteIds).catch(() => {
        /* ignore disk errors */
      });
    }, PERSIST_DEBOUNCE_MS);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [chats, threadsByChatId, favoriteIds, companionChatsHydrated, userId, persistForUser]);

  const addChat = useCallback((row: CompanionChatRow) => {
    setChats((prev) => {
      if (prev.some((c) => c.id === row.id)) return prev;
      return [row, ...prev];
    });
  }, []);

  const getCompanionThread = useCallback(
    (id: string) => {
      const t = threadsByChatId[id];
      return t && t.length > 0 ? t : undefined;
    },
    [threadsByChatId],
  );

  const saveCompanionThread = useCallback((id: string, thread: CompanionThreadMsg[]) => {
    if (thread.length === 0) return;
    const capped = thread.slice(-THREAD_CAP);
    setThreadsByChatId((prev) => ({ ...prev, [id]: capped }));
    const last = capped[capped.length - 1];
    const previewRaw =
      last?.text?.trim() ||
      (last?.audioUri || last?.kind === 'voice' ? '🎤 Голосовое' : '');
    if (previewRaw) {
      const previewSlice = previewRaw.length > 90 ? `${previewRaw.slice(0, 87)}…` : previewRaw;
      const clock = formatNowClock();
      setChats((prev) =>
        prev.map((c) => (c.id === id ? { ...c, preview: previewSlice, time: clock } : c)),
      );
    }
  }, []);

  const removeChat = useCallback((id: string) => {
    setChats((prev) => prev.filter((c) => c.id !== id));
    setFavoriteIds((prev) => prev.filter((x) => x !== id));
    setThreadsByChatId((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavoriteIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const isFavorite = useCallback(
    (id: string) => favoriteIds.includes(id),
    [favoriteIds],
  );

  const value = useMemo(
    () => ({
      chats,
      favoriteIds,
      companionChatsHydrated,
      addChat,
      removeChat,
      toggleFavorite,
      isFavorite,
      getCompanionThread,
      saveCompanionThread,
    }),
    [
      chats,
      favoriteIds,
      companionChatsHydrated,
      addChat,
      removeChat,
      toggleFavorite,
      isFavorite,
      getCompanionThread,
      saveCompanionThread,
    ],
  );

  return <CompanionChatsContext.Provider value={value}>{children}</CompanionChatsContext.Provider>;
}

export function useCompanionChats() {
  const ctx = useContext(CompanionChatsContext);
  if (!ctx) {
    throw new Error('useCompanionChats must be used within CompanionChatsProvider');
  }
  return ctx;
}
