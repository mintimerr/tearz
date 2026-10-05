import { useEffect, useRef } from 'react';
import * as SplashScreen from 'expo-splash-screen';

import { useAuth } from '@/contexts/auth-context';
import { usePlacement } from '@/contexts/placement-context';

/** Минимум на экране, чтобы Tearz успел читаться. */
const MIN_SPLASH_MS = 650;

/**
 * Живёт в root layout — не размонтируется на Redirect,
 * поэтому hideAsync не отменяется при переходе в hub.
 */
export function SplashHideWhenReady() {
  const { isHydrated } = useAuth();
  const { hydrated: placementHydrated } = usePlacement();
  const mountedAtRef = useRef(Date.now());
  const hiddenRef = useRef(false);

  const bootReady = isHydrated && placementHydrated;

  useEffect(() => {
    if (!bootReady || hiddenRef.current) return;
    const wait = Math.max(0, MIN_SPLASH_MS - (Date.now() - mountedAtRef.current));
    const t = setTimeout(() => {
      if (hiddenRef.current) return;
      hiddenRef.current = true;
      void SplashScreen.hideAsync();
    }, wait);
    return () => clearTimeout(t);
  }, [bootReady]);

  return null;
}
