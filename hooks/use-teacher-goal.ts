import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/contexts/auth-context';
import { USER_SUFFIX, userDataKey } from '@/utils/user-data-storage';

export type TeacherGoal = {
  /** Что хочет освоить пользователь, напр. «Поездка в Китай». */
  title: string;
  /** Дедлайн (ms epoch) или null, если без срока. */
  targetDate: number | null;
  /** Когда цель поставлена (ms epoch) — для прогресса. */
  createdAt: number;
};

function parseGoal(raw: string | null): TeacherGoal | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (typeof o.title !== 'string' || !o.title.trim()) return null;
    return {
      title: o.title,
      targetDate:
        typeof o.targetDate === 'number' && Number.isFinite(o.targetDate) ? o.targetDate : null,
      createdAt: typeof o.createdAt === 'number' ? o.createdAt : Date.now(),
    };
  } catch {
    return null;
  }
}

/** Лёгкая «цель обучения» пользователя: название + опциональный дедлайн. */
export function useTeacherGoal() {
  const { user, isHydrated } = useAuth();
  const userId = user?.id ?? null;
  const [goal, setGoalState] = useState<TeacherGoal | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isHydrated) return;
    let cancelled = false;
    setReady(false);
    if (!userId) {
      setGoalState(null);
      setReady(true);
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(userDataKey(userId, USER_SUFFIX.teacherGoal));
        if (!cancelled) setGoalState(parseGoal(raw));
      } catch {
        if (!cancelled) setGoalState(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isHydrated, userId]);

  const setGoal = useCallback(
    (title: string, targetDate: number | null) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      const next: TeacherGoal = { title: trimmed, targetDate, createdAt: Date.now() };
      setGoalState(next);
      if (userId) {
        void AsyncStorage.setItem(
          userDataKey(userId, USER_SUFFIX.teacherGoal),
          JSON.stringify(next),
        );
      }
    },
    [userId],
  );

  const clearGoal = useCallback(() => {
    setGoalState(null);
    if (userId) void AsyncStorage.removeItem(userDataKey(userId, USER_SUFFIX.teacherGoal));
  }, [userId]);

  return { goal, ready, setGoal, clearGoal };
}
