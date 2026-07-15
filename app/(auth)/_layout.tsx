import { Stack } from 'expo-router';

import { APP_THEME } from '@/constants/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: APP_THEME.color.bg },
      }}>
      <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      <Stack.Screen name="verify-code" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}
