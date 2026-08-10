import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HubAttractStage } from '@/components/game/hub-attract-stage';
import { HubLanguageSwitch } from '@/components/game/hub-language-switch';
import { HubTearzWordmark } from '@/components/game/hub-tearz-wordmark';
import { HubTriangleNav } from '@/components/game/hub-triangle-nav';
import { GAME_THEME } from '@/constants/game-theme';
import { pickTerminalLocation } from '@/constants/terminal-locations';
import { useEngagement } from '@/contexts/engagement-context';
import { useTranslation } from '@/contexts/locale-context';

const ROUTES: Record<'cards' | 'dialogs' | 'profile', Href> = {
  cards: '/cards',
  dialogs: '/dialogs',
  profile: '/me',
};

export function GameHubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { hydrated, claimStarterPack } = useEngagement();

  useEffect(() => {
    if (hydrated) claimStarterPack();
  }, [claimStarterPack, hydrated]);

  const go = async (id: 'start' | 'cards' | 'dialogs' | 'profile') => {
    if (id === 'start') {
      const loc = await pickTerminalLocation(true);
      router.push({ pathname: '/arcade', params: { location: loc.id } } as Href);
      return;
    }
    router.push(ROUTES[id]);
  };

  return (
    <View style={styles.root}>
      <HubAttractStage />

      <HubLanguageSwitch top={insets.top + 10} />

      <View
        style={[
          styles.foreground,
          {
            paddingTop: insets.top + 12,
            paddingBottom: Math.max(insets.bottom, 14) + 10,
          },
        ]}
        pointerEvents="box-none">
        <View style={styles.topSpacer} pointerEvents="none" />

        <View style={styles.centerCluster} pointerEvents="box-none">
          <HubTearzWordmark />
          <HubTriangleNav onPress={go} />
        </View>

        <View style={styles.bottomSpacer} pointerEvents="none" />
      </View>

      <Pressable
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push('/play' as Href);
        }}
        style={[styles.playFab, { bottom: Math.max(insets.bottom, 12) + 14, right: 14 }]}
        accessibilityRole="button"
        accessibilityLabel={t('hub.asteroids')}
        hitSlop={8}>
        <Ionicons name="game-controller" size={22} color={GAME_THEME.color.ink} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: GAME_THEME.color.sky,
  },
  foreground: {
    flex: 1,
    paddingHorizontal: 16,
  },
  topSpacer: {
    flex: 1.15,
    minHeight: 24,
  },
  bottomSpacer: {
    flex: 0.85,
    minHeight: 24,
  },
  centerCluster: {
    alignItems: 'center',
    gap: 18,
    zIndex: 20,
  },
  playFab: {
    position: 'absolute',
    zIndex: 30,
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2.5,
    borderColor: GAME_THEME.color.ink,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
});
