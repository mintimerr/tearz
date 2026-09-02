import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { warmCompanionApi } from '@/utils/companion-api-fetch';

const REWARM_MS = 7 * 60 * 1000;

/** Разбудить Render при старте и пока приложение открыто (free tier ~15 мин idle). */
export function ApiWarmup() {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void warmCompanionApi(8);

    timerRef.current = setInterval(() => {
      void warmCompanionApi(4);
    }, REWARM_MS);

    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') void warmCompanionApi(6);
    };
    const sub = AppState.addEventListener('change', onAppState);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      sub.remove();
    };
  }, []);

  return null;
}
