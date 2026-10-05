import { Redirect } from 'expo-router';

import { DEMO_SKIP_AUTH } from '@/constants/demo';
import { useAuth } from '@/contexts/auth-context';
import { useOnboardingTips } from '@/contexts/onboarding-tips-context';
import { usePlacement } from '@/contexts/placement-context';

export default function Index() {
  const { isHydrated, isAuthenticated } = useAuth();
  const { hydrated: placementHydrated, isComplete } = usePlacement();
  const { hydrated: tipsHydrated, hasSeen } = useOnboardingTips();

  if (!isHydrated || !placementHydrated || !tipsHydrated) {
    return null;
  }

  if (!DEMO_SKIP_AUTH && !isAuthenticated) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (!hasSeen('ink')) {
    return <Redirect href="/onboarding/intro" />;
  }

  if (!isComplete) {
    return <Redirect href="/onboarding/placement" />;
  }

  return <Redirect href="/hub" />;
}
