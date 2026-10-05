import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HubAttractStage } from '@/components/game/hub-attract-stage';
import { HubLanguageSwitch } from '@/components/game/hub-language-switch';
import { HubTearzWordmark } from '@/components/game/hub-tearz-wordmark';
import { HubTriangleNav } from '@/components/game/hub-triangle-nav';
import { GAME_THEME } from '@/constants/game-theme';
import { pickTerminalLocation } from '@/constants/terminal-locations';
import { useEngagement } from '@/contexts/engagement-context';

const ROUTES: Record<'cards' | 'dialogs' | 'profile', Href> = {
  cards: '/cards',
  dialogs: '/dialogs',
  profile: '/me',
};

export function GameHubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: GAME_THEME.color.voidDeep,
  },
  foreground: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  topSpacer: {
    height: 36,
  },
  centerCluster: {
    alignItems: 'center',
    gap: 28,
  },
  bottomSpacer: {
    height: 24,
  },
});
