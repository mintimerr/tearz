import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { APP_THEME } from '@/constants/theme';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { AuthProvider } from '@/contexts/auth-context';
import { EngagementProvider } from '@/contexts/engagement-context';
import { XpRewardOverlay } from '@/components/engagement/xp-reward-overlay';
import { LocaleProvider } from '@/contexts/locale-context';
import { CompanionChatsProvider } from '@/contexts/companion-chats-context';
import { TeacherJourneyProvider } from '@/contexts/teacher-journey-context';
import { UserProfileProvider } from '@/contexts/user-profile-context';
import { VocabularyProvider } from '@/contexts/vocabulary-context';
import { WordAddSheetProvider } from '@/components/word-add-sheet';
export const unstable_settings = {
  anchor: '(tabs)',
};

const NavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: APP_THEME.color.brand,
    background: APP_THEME.color.bg,
    card: APP_THEME.color.elevated,
    text: APP_THEME.color.text,
    border: APP_THEME.color.border,
    notification: APP_THEME.color.danger,
  },
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: APP_THEME.color.bg }}>
      <ThemeProvider value={NavigationTheme}>
        <AuthProvider>
          <LocaleProvider>
          <EngagementProvider>
          <CompanionChatsProvider>
            <TeacherJourneyProvider>
              <UserProfileProvider>
                <VocabularyProvider>
                  <WordAddSheetProvider>
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="(auth)" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="companion-chat" options={{ animation: 'fade' }} />
                    <Stack.Screen name="companion-find" options={{ animation: 'slide_from_right' }} />
                    <Stack.Screen name="vocab/[id]" options={{ animation: 'fade' }} />
                    <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal', headerShown: true }} />
                  </Stack>
                  <XpRewardOverlay />
                <StatusBar style="dark" />
                  </WordAddSheetProvider>
                </VocabularyProvider>
              </UserProfileProvider>
            </TeacherJourneyProvider>
          </CompanionChatsProvider>
          </EngagementProvider>
          </LocaleProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
