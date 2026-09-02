import { Stack } from 'expo-router';

import { GAME_THEME } from '@/constants/game-theme';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: GAME_THEME.color.cream } }}>
      <Stack.Screen name="placement" />
    </Stack>
  );
}
