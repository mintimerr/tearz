import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Modal, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { GAME_THEME } from '@/constants/game-theme';
import { APP_THEME } from '@/constants/theme';
import { useEngagement } from '@/contexts/engagement-context';

const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_IN = Easing.bezier(0.4, 0, 1, 1);
const HOLD_MS = 1800;
const CARD_SPRING = { damping: 18, stiffness: 220, mass: 0.82 };

export function XpRewardOverlay() {
  const { xpReward, dismissXpReward } = useEngagement();
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetXp = xpReward?.xp ?? 0;
  const rewardCoins = xpReward?.coins ?? 0;
  const rewardStreak = xpReward?.streak;
  const [displayXp, setDisplayXp] = useState(0);

  const scene = useSharedValue(0);
  const card = useSharedValue(0);
  const xpCount = useSharedValue(0);
  const medalPulse = useSharedValue(0);
  const barFill = useSharedValue(0);
  const trackW = useSharedValue(0);

  useEffect(() => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }

    if (!xpReward) {
      setDisplayXp(0);
      scene.value = 0;
      card.value = 0;
      xpCount.value = 0;
      medalPulse.value = 0;
      barFill.value = 0;
      return;
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    scene.value = 0;
    card.value = 0;
    xpCount.value = 0;
    medalPulse.value = 0;
    barFill.value = 0;

    scene.value = withTiming(1, { duration: APP_THEME.motion.base, easing: EASE_OUT });
    card.value = withDelay(30, withSpring(1, CARD_SPRING));
    xpCount.value = withDelay(
      90,
      withTiming(targetXp, { duration: APP_THEME.motion.slow, easing: EASE_OUT }, (finished) => {
        if (finished) {
          medalPulse.value = withSequence(
            withTiming(1, { duration: APP_THEME.motion.fast }),
            withSpring(0, { damping: 14, stiffness: 180 }),
          );
        }
      }),
    );
    barFill.value = withDelay(
      120,
      withTiming(1, { duration: APP_THEME.motion.slow + 40, easing: EASE_OUT }),
    );

    dismissTimer.current = setTimeout(() => {
      scene.value = withTiming(0, { duration: APP_THEME.motion.base, easing: EASE_IN }, (finished) => {
        if (finished) runOnJS(dismissXpReward)();
      });
      card.value = withTiming(0, { duration: APP_THEME.motion.base, easing: EASE_IN });
    }, HOLD_MS);

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [barFill, card, dismissXpReward, medalPulse, scene, targetXp, xpCount, xpReward]);

  useAnimatedReaction(
    () => Math.round(xpCount.value),
    (v) => {
      runOnJS(setDisplayXp)(v);
    },
  );

  const onTrackLayout = useCallback(
    (e: LayoutChangeEvent) => {
      trackW.value = e.nativeEvent.layout.width;
    },
    [trackW],
  );

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scene.value, [0, 1], [0, 1]),
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: interpolate(card.value, [0, 0.35, 1], [0, 1, 1]),
    transform: [
      { scale: interpolate(card.value, [0, 1], [0.96, 1]) },
      { translateY: interpolate(card.value, [0, 1], [10, 0]) },
    ],
  }));

  const medalStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(medalPulse.value, [0, 1], [1, 1.04]) }],
  }));

  const xpStyle = useAnimatedStyle(() => ({
    opacity: interpolate(xpCount.value, [0, Math.max(targetXp * 0.2, 1)], [0.4, 1], 'clamp'),
  }));

  const progressFillStyle = useAnimatedStyle(() => ({
    width: trackW.value * barFill.value * 0.68,
  }));

  const showXp = targetXp > 0;
  const titleBar = showXp ? 'LEVEL UP' : rewardCoins > 0 ? 'REWARD' : 'BONUS';

  return (
    <Modal visible={Boolean(xpReward)} transparent animationType="none" statusBarTranslucent>
      <View style={styles.root} pointerEvents="none">
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <View style={styles.scrim} />
        </Animated.View>

        <Animated.View style={[styles.card, cardStyle]}>
          <View style={styles.titleBar}>
            <Text style={styles.titleBarText}>{titleBar}</Text>
          </View>

          <View style={styles.cardBody}>
            <Animated.View style={[styles.medalOuter, medalStyle]}>
              <View style={styles.medalInner}>
                <Text style={styles.medalLabel}>{showXp ? 'XP' : '◉'}</Text>
              </View>
            </Animated.View>

            {showXp ? (
              <Animated.Text style={[styles.xpValue, xpStyle]}>+{displayXp}</Animated.Text>
            ) : rewardCoins > 0 ? (
              <Text style={styles.xpValue}>+{rewardCoins}</Text>
            ) : null}

            <Text style={styles.title} numberOfLines={2}>
              {xpReward?.title ?? ''}
            </Text>
            {xpReward?.subtitle ? (
              <Text style={styles.subtitle} numberOfLines={2}>
                {xpReward.subtitle}
              </Text>
            ) : null}

            {(rewardCoins > 0 && showXp) || rewardStreak != null ? (
              <View style={styles.metaRow}>
                {rewardCoins > 0 && showXp ? (
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>◉ +{rewardCoins}</Text>
                  </View>
                ) : null}
                {rewardStreak != null && rewardStreak > 0 ? (
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>🔥 {rewardStreak}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={styles.progressTrack} onLayout={onTrackLayout}>
              <Animated.View style={[styles.progressFill, progressFillStyle]} />
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 20, 48, 0.72)',
  },
  card: {
    width: '100%',
    maxWidth: 280,
    overflow: 'hidden',
    borderWidth: GAME_THEME.border.thick,
    borderColor: GAME_THEME.color.ink,
    borderRadius: 6,
    backgroundColor: GAME_THEME.color.cream,
  },
  titleBar: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: GAME_THEME.border.thin,
    borderBottomColor: GAME_THEME.color.ink,
    backgroundColor: GAME_THEME.color.gold,
  },
  titleBarText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: GAME_THEME.color.ink,
  },
  cardBody: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 18,
    paddingHorizontal: 20,
  },
  medalOuter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    backgroundColor: GAME_THEME.color.gold,
    borderWidth: GAME_THEME.border.thin,
    borderColor: GAME_THEME.color.ink,
  },
  medalInner: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GAME_THEME.color.ink,
  },
  medalLabel: {
    fontSize: GAME_THEME.type.micro,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: GAME_THEME.color.sky,
  },
  xpValue: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: GAME_THEME.color.goldLip,
    fontVariant: ['tabular-nums'],
  },
  title: {
    marginTop: 6,
    fontSize: GAME_THEME.type.body,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.55)',
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  metaChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: GAME_THEME.border.thin,
    borderColor: GAME_THEME.color.ink,
    backgroundColor: 'rgba(26,26,26,0.06)',
  },
  metaChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    width: '100%',
    height: 6,
    marginTop: 16,
    borderRadius: GAME_THEME.radius.pill,
    overflow: 'hidden',
    backgroundColor: 'rgba(26,26,26,0.1)',
    borderWidth: 1,
    borderColor: GAME_THEME.color.ink,
  },
  progressFill: {
    height: '100%',
    borderRadius: GAME_THEME.radius.pill,
    backgroundColor: GAME_THEME.color.gold,
  },
});
