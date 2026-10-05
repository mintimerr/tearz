import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { DEMO_SKIP_AUTH } from '@/constants/demo';
import { useAuth } from '@/contexts/auth-context';
import { usePlacement } from '@/contexts/placement-context';
import {
  loadOnboardingTips,
  markOnboardingTipSeen,
  type OnboardingTipId,
  type OnboardingTipsState,
} from '@/utils/onboarding-tips';

type OnboardingTipsContextValue = {
  hydrated: boolean;
  seen: OnboardingTipsState;
  hasSeen: (tipId: OnboardingTipId) => boolean;
  markSeen: (tipId: OnboardingTipId) => Promise<void>;
};

const OnboardingTipsContext = createContext<OnboardingTipsContextValue | null>(null);

export function OnboardingTipsProvider({ children }: { children: ReactNode }) {
  const { user, isHydrated: authHydrated } = useAuth();
  const [hydrated, setHydrated] = useState(false);
  const [seen, setSeen] = useState<OnboardingTipsState>({});

  const userId = user?.id ?? (DEMO_SKIP_AUTH ? 'demo' : null);

  useEffect(() => {
    if (!authHydrated) return;
    let cancelled = false;
    (async () => {
      if (!userId) {
        if (!cancelled) {
          setSeen({});
          setHydrated(true);
        }
        return;
      }
      const next = await loadOnboardingTips(userId);
      if (!cancelled) {
        setSeen(next);
        setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authHydrated, userId]);

  const hasSeen = useCallback((tipId: OnboardingTipId) => Boolean(seen[tipId]), [seen]);

  const markSeen = useCallback(
    async (tipId: OnboardingTipId) => {
      if (!userId) {
        setSeen((prev) => ({ ...prev, [tipId]: true }));
        return;
      }
      const next = await markOnboardingTipSeen(userId, tipId);
      setSeen(next);
    },
    [userId],
  );

  const value = useMemo(
    () => ({ hydrated, seen, hasSeen, markSeen }),
    [hasSeen, hydrated, markSeen, seen],
  );

  return (
    <OnboardingTipsContext.Provider value={value}>{children}</OnboardingTipsContext.Provider>
  );
}

export function useOnboardingTips() {
  const ctx = useContext(OnboardingTipsContext);
  if (!ctx) throw new Error('useOnboardingTips must be used within OnboardingTipsProvider');
  return ctx;
}

/** true when tip should be shown — only after placement test, once per tip. */
export function useFirstVisitTip(tipId: OnboardingTipId) {
  const { hydrated, hasSeen, markSeen } = useOnboardingTips();
  const { hydrated: placementHydrated, isComplete } = usePlacement();
  const visible =
    hydrated && placementHydrated && isComplete && !hasSeen(tipId);
  return { visible, dismiss: () => markSeen(tipId), hydrated };
}
