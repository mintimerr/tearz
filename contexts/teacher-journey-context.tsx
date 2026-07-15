import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAuth } from '@/contexts/auth-context';
import { USER_SUFFIX, userDataKey } from '@/utils/user-data-storage';

export type TeacherRecentLesson = {
  id: string;
  title: string;
  subtitle: string;
  createdAt: number;
  /** Секунды, проведённые в диалоге с преподавателем (накопление по сессиям). */
  spentSecondsTotal?: number;
};

type TeacherJourneyValue = {
  ready: boolean;
  hasAnyLesson: boolean;
  lessons: TeacherRecentLesson[];
  markLessonCreated: () => Promise<void>;
  addRecentLesson: (lesson: TeacherRecentLesson) => Promise<void>;
  removeRecentLesson: (id: string) => Promise<void>;
  renameRecentLesson: (id: string, title: string) => Promise<void>;
  addLessonSpentSeconds: (id: string, deltaSeconds: number) => Promise<void>;
};

const TeacherJourneyContext = createContext<TeacherJourneyValue | null>(null);

function parseLessons(raw: string | null): TeacherRecentLesson[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => {
        if (!row || typeof row !== 'object') return null;
        const o = row as Record<string, unknown>;
        if (typeof o.id !== 'string') return null;
        const spent =
          typeof o.spentSecondsTotal === 'number' && Number.isFinite(o.spentSecondsTotal)
            ? Math.max(0, Math.floor(o.spentSecondsTotal))
            : undefined;
        return {
          id: o.id,
          title: typeof o.title === 'string' ? o.title : '',
          subtitle: typeof o.subtitle === 'string' ? o.subtitle : '',
          createdAt: typeof o.createdAt === 'number' ? o.createdAt : 0,
          ...(spent !== undefined ? { spentSecondsTotal: spent } : {}),
        } as TeacherRecentLesson;
      })
      .filter((x): x is TeacherRecentLesson => x !== null);
  } catch {
    return [];
  }
}

export function TeacherJourneyProvider({ children }: { children: ReactNode }) {
  const { user, isHydrated: authHydrated } = useAuth();
  const userId = user?.id ?? null;

  const [ready, setReady] = useState(false);
  const [hasAnyLesson, setHasAnyLesson] = useState(false);
  const [lessons, setLessons] = useState<TeacherRecentLesson[]>([]);

  const persistLessons = useCallback(async (uid: string, next: TeacherRecentLesson[]) => {
    try {
      await AsyncStorage.setItem(userDataKey(uid, USER_SUFFIX.teacherLessons), JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const persistFlag = useCallback(async (uid: string, has: boolean) => {
    try {
      await AsyncStorage.setItem(userDataKey(uid, USER_SUFFIX.teacherFlag), has ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!authHydrated) return;

    let cancelled = false;
    setReady(false);

    if (!userId) {
      setHasAnyLesson(false);
      setLessons([]);
      setReady(true);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const [flag, rawLessons] = await Promise.all([
          AsyncStorage.getItem(userDataKey(userId, USER_SUFFIX.teacherFlag)),
          AsyncStorage.getItem(userDataKey(userId, USER_SUFFIX.teacherLessons)),
        ]);
        if (cancelled) return;
        setHasAnyLesson(flag === '1');
        setLessons(parseLessons(rawLessons));
      } catch {
        if (!cancelled) {
          setHasAnyLesson(false);
          setLessons([]);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authHydrated, userId]);

  const markLessonCreated = useCallback(async () => {
    if (!userId) return;
    setHasAnyLesson(true);
    await persistFlag(userId, true);
  }, [persistFlag, userId]);

  const addRecentLesson = useCallback(
    async (lesson: TeacherRecentLesson) => {
      if (!userId) return;
      setLessons((prev) => {
        const without = prev.filter((l) => l.id !== lesson.id);
        const next = [lesson, ...without].sort((a, b) => b.createdAt - a.createdAt);
        void persistLessons(userId, next);
        void persistFlag(userId, true);
        setHasAnyLesson(true);
        return next;
      });
    },
    [persistFlag, persistLessons, userId],
  );

  const removeRecentLesson = useCallback(
    async (id: string) => {
      if (!userId) return;
      setLessons((prev) => {
        const next = prev.filter((l) => l.id !== id);
        void persistLessons(userId, next);
        if (next.length === 0) {
          setHasAnyLesson(false);
          void persistFlag(userId, false);
        }
        return next;
      });
    },
    [persistFlag, persistLessons, userId],
  );

  const renameRecentLesson = useCallback(
    async (id: string, title: string) => {
      if (!userId) return;
      const trimmed = title.trim();
      if (!trimmed) return;
      setLessons((prev) => {
        const next = prev.map((l) => (l.id === id ? { ...l, title: trimmed } : l));
        void persistLessons(userId, next);
        return next;
      });
    },
    [persistLessons, userId],
  );

  const addLessonSpentSeconds = useCallback(
    async (id: string, deltaSeconds: number) => {
      if (!userId) return;
      const d = Math.max(0, Math.floor(deltaSeconds));
      if (d < 1) return;
      setLessons((prev) => {
        const next = prev.map((l) =>
          l.id === id
            ? {
                ...l,
                spentSecondsTotal: (l.spentSecondsTotal ?? 0) + d,
              }
            : l,
        );
        void persistLessons(userId, next);
        return next;
      });
    },
    [persistLessons, userId],
  );

  const value = useMemo(
    () => ({
      ready,
      hasAnyLesson,
      lessons,
      markLessonCreated,
      addRecentLesson,
      removeRecentLesson,
      renameRecentLesson,
      addLessonSpentSeconds,
    }),
    [
      ready,
      hasAnyLesson,
      lessons,
      markLessonCreated,
      addRecentLesson,
      removeRecentLesson,
      renameRecentLesson,
      addLessonSpentSeconds,
    ],
  );

  return <TeacherJourneyContext.Provider value={value}>{children}</TeacherJourneyContext.Provider>;
}

export function useTeacherJourney() {
  const ctx = useContext(TeacherJourneyContext);
  if (!ctx) throw new Error('useTeacherJourney must be used within TeacherJourneyProvider');
  return ctx;
}
