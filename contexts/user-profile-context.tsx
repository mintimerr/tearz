import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '@/contexts/auth-context';
import { useTeacherJourney } from '@/contexts/teacher-journey-context';
import { detectStudyLangsInText } from '@/utils/detect-study-langs-in-text';
import { USER_SUFFIX, userDataKey } from '@/utils/user-data-storage';
import type { WordScriptLang } from '@/utils/detect-word-lang';

export type LifetimeStudyStats = { correct: number; wrong: number };

function clampNonNeg(n: unknown): number {
  const x = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0;
}

function normalizeLangList(x: unknown): WordScriptLang[] {
  if (!Array.isArray(x)) return [];
  const s = new Set<WordScriptLang>();
  for (const v of x) {
    if (v === 'en' || v === 'zh' || v === 'ru') s.add(v);
  }
  return (['en', 'zh', 'ru'] as const).filter((l) => s.has(l));
}

function mergeLangLists(a: WordScriptLang[], b: WordScriptLang[]): WordScriptLang[] {
  const s = new Set<WordScriptLang>([...a, ...b]);
  return (['en', 'zh', 'ru'] as const).filter((l) => s.has(l));
}

type UserProfileContextValue = {
  lifetimeStats: LifetimeStudyStats;
  recordStudySwipe: (gotIt: boolean) => void;
  avatarUri: string | null;
  setAvatarUri: (uri: string | null) => void;
  activityScriptLangs: WordScriptLang[];
  registerUserStudyText: (text: string) => void;
};

const UserProfileContext = createContext<UserProfileContextValue | null>(null);

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { user, isHydrated: authHydrated } = useAuth();
  const userId = user?.id ?? null;
  const teacher = useTeacherJourney();

  const [lifetimeStats, setLifetimeStats] = useState<LifetimeStudyStats>({ correct: 0, wrong: 0 });
  const [avatarUri, setAvatarUriState] = useState<string | null>(null);
  const [activityScriptLangs, setActivityScriptLangs] = useState<WordScriptLang[]>([]);
  const [storageHydrated, setStorageHydrated] = useState(false);

  useEffect(() => {
    if (!authHydrated) return;

    let cancelled = false;
    setStorageHydrated(false);

    if (!userId) {
      setLifetimeStats({ correct: 0, wrong: 0 });
      setAvatarUriState(null);
      setActivityScriptLangs([]);
      setStorageHydrated(true);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const [rawStats, rawAvatar, rawLangs] = await Promise.all([
          AsyncStorage.getItem(userDataKey(userId, USER_SUFFIX.profileStats)),
          AsyncStorage.getItem(userDataKey(userId, USER_SUFFIX.profileAvatar)),
          AsyncStorage.getItem(userDataKey(userId, USER_SUFFIX.profileLangs)),
        ]);
        if (cancelled) return;
        if (rawStats) {
          const p = JSON.parse(rawStats) as Partial<LifetimeStudyStats>;
          setLifetimeStats({
            correct: clampNonNeg(p.correct),
            wrong: clampNonNeg(p.wrong),
          });
        } else {
          setLifetimeStats({ correct: 0, wrong: 0 });
        }
        setAvatarUriState(rawAvatar && rawAvatar.length > 0 ? rawAvatar : null);
        if (rawLangs) {
          try {
            setActivityScriptLangs(normalizeLangList(JSON.parse(rawLangs)));
          } catch {
            setActivityScriptLangs([]);
          }
        } else {
          setActivityScriptLangs([]);
        }
      } catch {
        if (!cancelled) {
          setLifetimeStats({ correct: 0, wrong: 0 });
          setAvatarUriState(null);
          setActivityScriptLangs([]);
        }
      } finally {
        if (!cancelled) setStorageHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authHydrated, userId]);

  useEffect(() => {
    if (!storageHydrated || !userId) return;
    void AsyncStorage.setItem(userDataKey(userId, USER_SUFFIX.profileStats), JSON.stringify(lifetimeStats));
  }, [lifetimeStats, storageHydrated, userId]);

  useEffect(() => {
    if (!storageHydrated || !userId) return;
    void AsyncStorage.setItem(
      userDataKey(userId, USER_SUFFIX.profileLangs),
      JSON.stringify(activityScriptLangs),
    );
  }, [activityScriptLangs, storageHydrated, userId]);

  const lessonFingerprint = useMemo(
    () => teacher.lessons.map((l) => `${l.id}\t${l.title}`).join('\n'),
    [teacher.lessons],
  );

  useEffect(() => {
    if (!teacher.ready || !storageHydrated) return;
    const fromLessons: WordScriptLang[] = [];
    for (const l of teacher.lessons) {
      fromLessons.push(...detectStudyLangsInText(l.title));
    }
    if (!fromLessons.length) return;
    setActivityScriptLangs((prev) => mergeLangLists(prev, fromLessons));
  }, [teacher.ready, storageHydrated, lessonFingerprint]);

  const setAvatarUri = useCallback(
    (uri: string | null) => {
      setAvatarUriState(uri);
      if (!userId) return;
      void (async () => {
        try {
          const key = userDataKey(userId, USER_SUFFIX.profileAvatar);
          if (uri) await AsyncStorage.setItem(key, uri);
          else await AsyncStorage.removeItem(key);
        } catch {
          /* ignore */
        }
      })();
    },
    [userId],
  );

  const recordStudySwipe = useCallback((gotIt: boolean) => {
    setLifetimeStats((s) => ({
      correct: s.correct + (gotIt ? 1 : 0),
      wrong: s.wrong + (gotIt ? 0 : 1),
    }));
  }, []);

  const registerUserStudyText = useCallback((text: string) => {
    const d = detectStudyLangsInText(text);
    if (!d.length) return;
    setActivityScriptLangs((prev) => mergeLangLists(prev, d));
  }, []);

  const value = useMemo(
    () => ({
      lifetimeStats,
      recordStudySwipe,
      avatarUri,
      setAvatarUri,
      activityScriptLangs,
      registerUserStudyText,
    }),
    [lifetimeStats, recordStudySwipe, avatarUri, setAvatarUri, activityScriptLangs, registerUserStudyText],
  );

  return <UserProfileContext.Provider value={value}>{children}</UserProfileContext.Provider>;
}

export function useUserProfile() {
  const ctx = useContext(UserProfileContext);
  if (!ctx) throw new Error('useUserProfile must be used within UserProfileProvider');
  return ctx;
}
