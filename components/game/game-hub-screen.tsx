import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HubAttractStage } from '@/components/game/hub-attract-stage';
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
  const {
    hydrated,
    coins,
    dailyStreak,
    dailyDoneCount,
    dailyGoalTarget,
    dailyTasks,
    claimStarterPack,
  } = useEngagement();

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

      <View style={[styles.hud, { paddingTop: insets.top + 10 }]} pointerEvents="box-none">
        <View style={styles.stat}>
          <Text style={styles.statLabel}>◉ {t('hub.coins')}</Text>
          <Text style={styles.statValue}>{coins}</Text>
        </View>
        <View style={[styles.stat, styles.statCenter]}>
          <Text style={styles.statLabel}>{t('hub.dailyGoal')}</Text>
          <Text style={styles.statValue}>
            {dailyDoneCount}/{dailyGoalTarget}
          </Text>
          <View style={styles.taskDots}>
            <View style={[styles.taskDot, dailyTasks.lesson && styles.taskDotOn]} />
            <View style={[styles.taskDot, dailyTasks.vocab && styles.taskDotOn]} />
            <View style={[styles.taskDot, dailyTasks.drill && styles.taskDotOn]} />
          </View>
        </View>
        <View style={[styles.stat, styles.statRight]}>
          <Text style={styles.statLabel}>🔥 {t('hub.streak')}</Text>
          <Text style={styles.statValue}>{dailyStreak}</Text>
        </View>
      </View>

      <View
        style={[
          styles.foreground,
          {
            paddingTop: insets.top + 56,
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
  hud: {
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
    zIndex: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  stat: {
    minWidth: 72,
  },
  statCenter: {
    alignItems: 'center',
    minWidth: 88,
  },
  statRight: {
    alignItems: 'flex-end',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: GAME_THEME.color.cream,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statValue: {
    marginTop: 2,
    fontSize: 22,
    fontWeight: '900',
    color: GAME_THEME.color.cream,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    fontVariant: ['tabular-nums'],
  },
  taskDots: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 5,
  },
  taskDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: GAME_THEME.color.cream,
    backgroundColor: 'transparent',
  },
  taskDotOn: {
    backgroundColor: GAME_THEME.color.gold,
    borderColor: GAME_THEME.color.gold,
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
