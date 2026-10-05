import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAuth } from '@/contexts/auth-context';
import type {
  InstructorClass,
  InstructorClassMembership,
  InstructorMaterial,
} from '@/types/instructor';
import { USER_SUFFIX, userDataKey } from '@/utils/user-data-storage';

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function inviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let body = '';
  for (let i = 0; i < 4; i++) body += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `TEARZ-${body}`;
}

function parseJsonArray<T>(raw: string | null, guard: (x: unknown) => x is T): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(guard);
  } catch {
    return [];
  }
}

function isClass(x: unknown): x is InstructorClass {
  return !!x && typeof x === 'object' && typeof (x as InstructorClass).id === 'string';
}
function isMaterial(x: unknown): x is InstructorMaterial {
  return !!x && typeof x === 'object' && typeof (x as InstructorMaterial).id === 'string';
}
function isMembership(x: unknown): x is InstructorClassMembership {
  return !!x && typeof x === 'object' && typeof (x as InstructorClassMembership).classId === 'string';
}

type InstructorValue = {
  ready: boolean;
  enabled: boolean;
  setEnabled: (on: boolean) => Promise<void>;
  classes: InstructorClass[];
  materials: InstructorMaterial[];
  memberships: InstructorClassMembership[];
  createClass: (title: string, language?: string) => Promise<InstructorClass>;
  publishNote: (classId: string, title: string, body: string) => Promise<InstructorMaterial>;
  materialsForClass: (classId: string) => InstructorMaterial[];
  /** Local join only — real cross-device share needs API (see docs/INSTRUCTOR_MODE.md). */
  joinWithCodeLocal: (code: string) => Promise<{ ok: true } | { ok: false; error: string }>;
};

const InstructorContext = createContext<InstructorValue | null>(null);

export function InstructorProvider({ children }: { children: ReactNode }) {
  const { user, isHydrated: authHydrated } = useAuth();
  const userId = user?.id ?? null;

  const [ready, setReady] = useState(false);
  const [enabled, setEnabledState] = useState(false);
  const [classes, setClasses] = useState<InstructorClass[]>([]);
  const [materials, setMaterials] = useState<InstructorMaterial[]>([]);
  const [memberships, setMemberships] = useState<InstructorClassMembership[]>([]);

  const persist = useCallback(async (uid: string, suffix: string, value: unknown) => {
    try {
      await AsyncStorage.setItem(userDataKey(uid, suffix), JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!authHydrated) return;
    let cancelled = false;
    setReady(false);

    if (!userId) {
      setEnabledState(false);
      setClasses([]);
      setMaterials([]);
      setMemberships([]);
      setReady(true);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const [en, rawC, rawM, rawMem] = await Promise.all([
          AsyncStorage.getItem(userDataKey(userId, USER_SUFFIX.instructorEnabled)),
          AsyncStorage.getItem(userDataKey(userId, USER_SUFFIX.instructorClasses)),
          AsyncStorage.getItem(userDataKey(userId, USER_SUFFIX.instructorMaterials)),
          AsyncStorage.getItem(userDataKey(userId, USER_SUFFIX.instructorMemberships)),
        ]);
        if (cancelled) return;
        setEnabledState(en === '1');
        setClasses(parseJsonArray(rawC, isClass));
        setMaterials(parseJsonArray(rawM, isMaterial));
        setMemberships(parseJsonArray(rawMem, isMembership));
      } catch {
        if (!cancelled) {
          setEnabledState(false);
          setClasses([]);
          setMaterials([]);
          setMemberships([]);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authHydrated, userId]);

  const setEnabled = useCallback(
    async (on: boolean) => {
      setEnabledState(on);
      if (!userId) return;
      try {
        await AsyncStorage.setItem(userDataKey(userId, USER_SUFFIX.instructorEnabled), on ? '1' : '0');
      } catch {
        /* ignore */
      }
    },
    [userId],
  );

  const createClass = useCallback(
    async (title: string, language?: string) => {
      const now = Date.now();
      const row: InstructorClass = {
        id: newId('class'),
        title: title.trim() || 'Мой класс',
        inviteCode: inviteCode(),
        language,
        createdAt: now,
        updatedAt: now,
        memberCount: 1,
      };
      const next = [row, ...classes];
      setClasses(next);
      if (userId) await persist(userId, USER_SUFFIX.instructorClasses, next);
      const mem: InstructorClassMembership = {
        classId: row.id,
        role: 'instructor',
        joinedAt: now,
        title: row.title,
        inviteCode: row.inviteCode,
      };
      const nextMem = [mem, ...memberships.filter((m) => m.classId !== row.id)];
      setMemberships(nextMem);
      if (userId) await persist(userId, USER_SUFFIX.instructorMemberships, nextMem);
      return row;
    },
    [classes, memberships, persist, userId],
  );

  const publishNote = useCallback(
    async (classId: string, title: string, body: string) => {
      const now = Date.now();
      const row: InstructorMaterial = {
        id: newId('mat'),
        classId,
        title: title.trim() || 'Материал',
        kind: 'note',
        body: body.trim(),
        createdAt: now,
        publishedAt: now,
      };
      const next = [row, ...materials];
      setMaterials(next);
      if (userId) await persist(userId, USER_SUFFIX.instructorMaterials, next);
      return row;
    },
    [materials, persist, userId],
  );

  const materialsForClass = useCallback(
    (classId: string) => materials.filter((m) => m.classId === classId),
    [materials],
  );

  const joinWithCodeLocal = useCallback(
    async (code: string) => {
      const normalized = code.trim().toUpperCase();
      if (!normalized) return { ok: false as const, error: 'Введи код класса' };
      const owned = classes.find((c) => c.inviteCode.toUpperCase() === normalized);
      if (owned) {
        return { ok: false as const, error: 'Это код твоего класса — нужен код от другого препода' };
      }
      // Without server, only re-join known memberships / demo: accept code shape and store stub membership
      if (!/^TEARZ-[A-Z0-9]{4}$/.test(normalized)) {
        return { ok: false as const, error: 'Код вида TEARZ-XXXX' };
      }
      const existing = memberships.find((m) => m.inviteCode.toUpperCase() === normalized);
      if (existing) return { ok: true as const };
      const now = Date.now();
      const mem: InstructorClassMembership = {
        classId: `remote_${normalized}`,
        role: 'learner',
        joinedAt: now,
        title: `Класс ${normalized}`,
        inviteCode: normalized,
      };
      const next = [mem, ...memberships];
      setMemberships(next);
      if (userId) await persist(userId, USER_SUFFIX.instructorMemberships, next);
      return { ok: true as const };
    },
    [classes, memberships, persist, userId],
  );

  const value = useMemo<InstructorValue>(
    () => ({
      ready,
      enabled,
      setEnabled,
      classes,
      materials,
      memberships,
      createClass,
      publishNote,
      materialsForClass,
      joinWithCodeLocal,
    }),
    [
      ready,
      enabled,
      setEnabled,
      classes,
      materials,
      memberships,
      createClass,
      publishNote,
      materialsForClass,
      joinWithCodeLocal,
    ],
  );

  return <InstructorContext.Provider value={value}>{children}</InstructorContext.Provider>;
}

export function useInstructor() {
  const ctx = useContext(InstructorContext);
  if (!ctx) throw new Error('useInstructor outside InstructorProvider');
  return ctx;
}
