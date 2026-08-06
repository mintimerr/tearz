import { Redirect } from 'expo-router';

import { DEMO_SKIP_AUTH } from '@/constants/demo';
import { useAuth } from '@/contexts/auth-context';

export default function Index() {
  const { isHydrated, isAuthenticated } = useAuth();

  if (!isHydrated) {
    return null;
  }

  if (DEMO_SKIP_AUTH || isAuthenticated) {
    return <Redirect href="/hub" />;
  }

  return <Redirect href="/(auth)/welcome" />;
}
