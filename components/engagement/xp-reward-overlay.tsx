import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Modal, Platform, StyleSheet, Text, View } from 'react-native';
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

import { APP_THEME } from '@/constants/theme';
import { useEngagement } from '@/contexts/engagement-context';

const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_IN = Easing.bezier(0.4, 0, 1, 1);
const HOLD_MS = 1500;
const CARD_SPRING = { damping: 18, stiffness: 220, mass: 0.82 };

export function XpRewardOverlay() {
  const { xpReward, dismissXpReward } = useEngagement();
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetXp = xpReward?.xp ?? 0;
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

  return (
    <Modal visible={Boolean(xpReward)} transparent animationType="none" statusBarTranslucent>
      <View style={styles.root} pointerEvents="none">
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 24 : 16}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.scrim} />
        </Animated.View>

        <Animated.View style={[styles.card, cardStyle]}>
          <Animated.View style={[styles.medalOuter, medalStyle]}>
            <View style={styles.medalInner}>
              <Text style={styles.medalLabel}>XP</Text>
            </View>
              </Animated.View>

          <Animated.Text style={[styles.xpValue, xpStyle]}>+{displayXp}</Animated.Text>

            <Text style={styles.title} numberOfLines={2}>
              {xpReward?.title ?? ''}
            </Text>
            {xpReward?.subtitle ? (
              <Text style={styles.subtitle} numberOfLines={2}>
                {xpReward.subtitle}
              </Text>
            ) : null}

          <View style={styles.progressTrack} onLayout={onTrackLayout}>
            <Animated.View style={[styles.progressFill, progressFillStyle]} />
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
    paddingHorizontal: APP_THEME.space.xxl,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  card: {
    width: '100%',
    maxWidth: 268,
    alignItems: 'center',
    paddingTop: APP_THEME.space.xl,
    paddingBottom: APP_THEME.space.lg,
    paddingHorizontal: APP_THEME.space.xl,
    borderRadius: APP_THEME.radius.sheet,
    backgroundColor: APP_THEME.color.elevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.border,
  },
  medalOuter: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: APP_THEME.space.sm,
    backgroundColor: APP_THEME.color.successSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(48, 209, 88, 0.28)',
  },
  medalInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_THEME.color.text,
  },
  medalLabel: {
    ...APP_THEME.type.micro,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: APP_THEME.color.bg,
  },
  xpValue: {
    ...APP_THEME.type.display,
    color: APP_THEME.color.success,
    fontVariant: ['tabular-nums'],
  },
  title: {
    marginTop: APP_THEME.space.xs,
    ...APP_THEME.type.caption,
    fontWeight: '600',
    color: APP_THEME.color.textSoft,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: APP_THEME.space.xxs,
    ...APP_THEME.type.label,
    color: APP_THEME.color.muted,
    textAlign: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 3,
    marginTop: APP_THEME.space.lg,
    borderRadius: APP_THEME.radius.pill,
    overflow: 'hidden',
    backgroundColor: APP_THEME.color.accentSoft,
  },
  progressFill: {
    height: '100%',
    borderRadius: APP_THEME.radius.pill,
    backgroundColor: APP_THEME.color.success,
  },
});
