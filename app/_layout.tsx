import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { ApiWarmup } from '@/components/api-warmup';
import { APP_THEME } from '@/constants/theme';
import { GAME_THEME } from '@/constants/game-theme';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';

import { AuthProvider } from '@/contexts/auth-context';
import { PlacementProvider } from '@/contexts/placement-context';
import { EngagementProvider } from '@/contexts/engagement-context';
import { LocaleProvider } from '@/contexts/locale-context';
import { CompanionChatsProvider } from '@/contexts/companion-chats-context';
import { TeacherJourneyProvider } from '@/contexts/teacher-journey-context';
import { InstructorProvider } from '@/contexts/instructor-context';
import { OnboardingTipsProvider } from '@/contexts/onboarding-tips-context';
import { UserProfileProvider } from '@/contexts/user-profile-context';
import { VocabularyProvider } from '@/contexts/vocabulary-context';
import { LexiconProvider } from '@/contexts/lexicon-context';
import { WordAddSheetProvider } from '@/components/word-add-sheet';
import { TeacherDrillSessionProvider } from '@/components/teacher/teacher-drill-session';
import { SplashHideWhenReady } from '@/components/splash-hide-when-ready';
import { TearzCollectionSync } from '@/components/game/tearz-collection-sync';

// Держим splash с Tearz, пока JS не готов — без fade (без «перетекания»).
SplashScreen.setOptions({ duration: 0, fade: false });
void SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: 'index',
};

const GAME_VOID = { backgroundColor: GAME_THEME.color.void };
const GAME_VOID_DEEP = { backgroundColor: GAME_THEME.color.voidDeep };
const GAME_CREAM = { backgroundColor: GAME_THEME.color.cream };

const NavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: APP_THEME.color.brand,
    background: GAME_THEME.color.void,
    card: GAME_THEME.color.void,
    text: APP_THEME.color.text,
    border: APP_THEME.color.border,
    notification: APP_THEME.color.danger,
  },
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: GAME_THEME.color.void }}>
      <ThemeProvider value={NavigationTheme}>
        <AuthProvider>
          <PlacementProvider>
          <LocaleProvider>
          <EngagementProvider>
          <OnboardingTipsProvider>
          <CompanionChatsProvider>
            <TeacherJourneyProvider>
              <InstructorProvider>
              <UserProfileProvider>
                <VocabularyProvider>
                  <LexiconProvider>
                  <TeacherDrillSessionProvider rootOverlay={false}>
                  <WordAddSheetProvider>
                  <TearzCollectionSync />
                  <SplashHideWhenReady />
                  <ApiWarmup />
                  <Stack screenOptions={{ headerShown: false, contentStyle: GAME_VOID }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="(auth)" options={{ contentStyle: GAME_VOID_DEEP }} />
                    <Stack.Screen name="onboarding" options={{ animation: 'fade', contentStyle: GAME_CREAM }} />
                    <Stack.Screen
                      name="hub"
                      options={{
                        animation: 'fade',
                        contentStyle: GAME_VOID_DEEP,
                        gestureEnabled: false,
                        fullScreenGestureEnabled: false,
                      }}
                    />
                    <Stack.Screen name="arcade" options={{ animation: 'fade', contentStyle: GAME_VOID }} />
                    <Stack.Screen name="arcade-chats" options={{ animation: 'slide_from_right', contentStyle: GAME_CREAM }} />
                    <Stack.Screen name="arcade-lesson" options={{ animation: 'fade', contentStyle: GAME_CREAM }} />
                    <Stack.Screen name="dialogs" options={{ animation: 'fade', contentStyle: GAME_VOID }} />
                    <Stack.Screen name="cards" options={{ animation: 'fade', contentStyle: GAME_VOID }} />
                    <Stack.Screen name="me" options={{ animation: 'fade', contentStyle: GAME_VOID }} />
                    <Stack.Screen name="mistakes" options={{ animation: 'slide_from_right', contentStyle: GAME_VOID }} />
                    <Stack.Screen name="(tabs)" options={{ animation: 'fade', contentStyle: GAME_VOID }} />
                    <Stack.Screen
                      name="companion-chat"
                      options={{
                        animation: 'fade',
                        animationDuration: 420,
                        contentStyle: GAME_CREAM,
                      }}
                    />
                    <Stack.Screen name="companion-find" options={{ animation: 'slide_from_right', contentStyle: GAME_VOID }} />
                    <Stack.Screen name="vocab/[id]" options={{ animation: 'fade', contentStyle: GAME_VOID }} />
                    <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal', headerShown: true }} />
                  </Stack>
                <StatusBar style="light" />
                  </WordAddSheetProvider>
                  </TeacherDrillSessionProvider>
                  </LexiconProvider>
                </VocabularyProvider>
              </UserProfileProvider>
              </InstructorProvider>
            </TeacherJourneyProvider>
          </CompanionChatsProvider>
          </OnboardingTipsProvider>
          </EngagementProvider>
          </LocaleProvider>
          </PlacementProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
