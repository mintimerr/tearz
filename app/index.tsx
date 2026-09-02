import { Redirect } from 'expo-router';

import { DEMO_SKIP_AUTH } from '@/constants/demo';
import { useAuth } from '@/contexts/auth-context';
import { usePlacement } from '@/contexts/placement-context';

export default function Index() {
  const { isHydrated, isAuthenticated } = useAuth();
  const { hydrated: placementHydrated, isComplete } = usePlacement();

  if (!isHydrated || !placementHydrated) {
    return null;
  }

  if (!DEMO_SKIP_AUTH && !isAuthenticated) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (!isComplete) {
    return <Redirect href="/onboarding/placement" />;
  }

  return <Redirect href="/hub" />;
}
