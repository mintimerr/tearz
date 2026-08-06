import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import { GAME_THEME } from '@/constants/game-theme';
import { useTranslation } from '@/contexts/locale-context';
import { buildStudyShareMessage, shareText } from '@/utils/viral-share';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

const CX = 110;
const CY = 110;
const R = 92;
const HOLE = 52;

function polar(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function pieSlicePath(cx: number, cy: number, r: number, a0: number, a1: number) {
  if (a1 - a0 < 0.0001) return '';
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  return `M ${cx} ${cy} L ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y} Z`;
}

type Props = {
  correct: number;
  wrong: number;
  total: number;
  onClose: () => void;
  onRestart: () => void;
};

export function StudySessionResult({ correct, wrong, total, onClose, onRestart }: Props) {
  const { t } = useTranslation();
  const intro = useSharedValue(0);
  const barW = useSharedValue(0);
  const btnPulse = useSharedValue(0);
  const trackW = useSharedValue(0);

  useEffect(() => {
    intro.value = 0;
    intro.value = withDelay(40, withSpring(1, { damping: 13, stiffness: 88 }));
    btnPulse.value = 0;
    btnPulse.value = withDelay(
      980,
      withSequence(withTiming(1, { duration: 220 }), withSpring(0, { damping: 12, stiffness: 140 })),
    );
  }, [intro, btnPulse, correct, wrong, total]);

  const onBarTrackLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      trackW.value = w;
      barW.value = 0;
      barW.value = withDelay(80, withTiming(1, { duration: 720, easing: Easing.out(Easing.cubic) }));
    },
    [barW, trackW],
  );

  const chartGroupStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(intro.value, [0, 1], [0.45, 1]) }],
    opacity: interpolate(intro.value, [0, 0.12, 1], [0, 1, 1]),
  }));

  const legendStyle = useAnimatedStyle(() => ({
    opacity: interpolate(intro.value, [0, 0.35, 1], [0, 0, 1]),
    transform: [{ translateY: interpolate(intro.value, [0, 1], [18, 0]) }],
  }));

  const actionsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(intro.value, [0, 0.5, 1], [0, 0, 1]),
    transform: [{ translateY: interpolate(intro.value, [0, 1], [26, 0]) }],
  }));

  const retryGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(btnPulse.value, [0, 1], [0.35, 0]),
    transform: [{ scale: interpolate(btnPulse.value, [0, 1], [1, 1.06]) }],
  }));

  const start = -Math.PI / 2;
  const greenSweep = total > 0 ? (correct / total) * Math.PI * 2 : 0;
  const redSweep = total > 0 ? (wrong / total) * Math.PI * 2 : 0;
  const aGreen0 = start;
  const aGreen1 = start + greenSweep;
  const aRed0 = aGreen1;
  const aRed1 = aRed0 + redSweep;

  const greenPath =
    correct === total && total > 0 ? '' : correct > 0 ? pieSlicePath(CX, CY, R, aGreen0, aGreen1) : '';
  const redPath = wrong === total && total > 0 ? '' : wrong > 0 ? pieSlicePath(CX, CY, R, aRed0, aRed1) : '';

  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  const greenBarStyle = useAnimatedStyle(() => {
    const w = trackW.value * barW.value * (total > 0 ? correct / total : 0);
    return { width: Math.max(0, w) };
  });
  const redBarStyle = useAnimatedStyle(() => {
    const w = trackW.value * barW.value * (total > 0 ? wrong / total : 0);
    return { width: Math.max(0, w) };
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.panel}>
        <Text style={styles.title}>Готово!</Text>
        <Text style={styles.subtitle}>как прошла сессия</Text>

        <View style={styles.chartBlock}>
          <Animated.View style={[styles.svgWrap, chartGroupStyle]}>
            <Svg width={220} height={220} viewBox="0 0 220 220">
              <Circle cx={CX} cy={CY} r={R} fill="rgba(26,26,26,0.08)" stroke={GAME_THEME.color.ink} strokeWidth={3} />
              {correct === total && total > 0 ? (
                <Circle cx={CX} cy={CY} r={R} fill={GAME_THEME.color.phosphor} />
              ) : null}
              {wrong === total && total > 0 ? (
                <Circle cx={CX} cy={CY} r={R} fill={GAME_THEME.color.danger} />
              ) : null}
              {correct > 0 && correct < total ? <Path d={greenPath} fill={GAME_THEME.color.phosphor} /> : null}
              {wrong > 0 && wrong < total ? <Path d={redPath} fill={GAME_THEME.color.danger} /> : null}
              <Circle cx={CX} cy={CY} r={HOLE} fill={GAME_THEME.color.paper} />
              <Circle cx={CX} cy={CY} r={HOLE + 2} stroke={GAME_THEME.color.ink} strokeWidth={2} fill="none" />
            </Svg>
            <View style={styles.centerLabel} pointerEvents="none">
              <Text style={styles.pct}>{pct}%</Text>
              <Text style={styles.pctHint}>выучено</Text>
            </View>
          </Animated.View>

          <Animated.View style={[styles.barTrack, legendStyle]} onLayout={onBarTrackLayout}>
            <Animated.View style={[styles.barSeg, styles.barGreen, greenBarStyle]} />
            <Animated.View style={[styles.barSeg, styles.barRed, redBarStyle]} />
          </Animated.View>
        </View>

        <Animated.View style={[styles.legendRow, legendStyle]}>
          <View style={styles.legendItem}>
            <View style={[styles.iconBubble, styles.iconBubbleGreen]}>
              <Ionicons name="checkmark" size={24} color={GAME_THEME.color.ink} />
            </View>
            <Text style={styles.legendCount}>{correct}</Text>
            <Text style={styles.legendLabel}>выучил</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.iconBubble, styles.iconBubbleRed]}>
              <Ionicons name="close" size={24} color={GAME_THEME.color.cream} />
            </View>
            <Text style={styles.legendCount}>{wrong}</Text>
            <Text style={styles.legendLabel}>не выучил</Text>
          </View>
        </Animated.View>
      </View>

      <Animated.View style={[styles.actions, actionsStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Закрыть тренировку"
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onClose();
          }}
          style={({ pressed }) => [styles.closePress, pressed && styles.closePressIn]}>
          <Ionicons name="chevron-back" size={20} color={GAME_THEME.color.ink} />
          <Text style={styles.closeText}>Закрыть</Text>
        </Pressable>

        <View style={styles.retryWrap}>
          <Animated.View style={[styles.retryGlow, retryGlowStyle]} pointerEvents="none" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Пройти ещё раз"
            onPress={() => {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onRestart();
            }}
            style={({ pressed }) => [styles.retryPress, pressed && styles.retryPressIn]}>
            <View style={styles.retryInner}>
              <Ionicons name="refresh" size={20} color={GAME_THEME.color.ink} />
              <Text style={styles.retryText}>Ещё раз</Text>
            </View>
          </Pressable>
        </View>

        {total > 0 && pct >= 50 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('viral.shareResult')}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              const msg = buildStudyShareMessage({
                pct,
                correct,
                total,
                lines: {
                  title: t('viral.studyShareTitle'),
                  score: t('viral.studyShareScore'),
                  cta: t('viral.studyShareCta'),
                },
              });
              void shareText(msg, t('viral.shareResult'));
            }}
            style={({ pressed }) => [styles.sharePress, pressed && styles.sharePressIn]}>
            <Ionicons name="share-social-outline" size={18} color={GAME_THEME.color.ink} />
            <Text style={styles.shareText}>{t('viral.shareResult')}</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingTop: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  panel: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 4,
    backgroundColor: GAME_THEME.color.paper,
    borderWidth: 3,
    borderColor: GAME_THEME.color.ink,
    shadowColor: GAME_THEME.color.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: GAME_THEME.color.ink,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(26,26,26,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  chartBlock: {
    marginTop: 18,
    alignItems: 'center',
    width: '100%',
  },
  svgWrap: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pct: {
    fontSize: 34,
    fontWeight: '900',
    color: GAME_THEME.color.ink,
    letterSpacing: -0.5,
  },
  pctHint: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(26,26,26,0.45)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  barTrack: {
    marginTop: 18,
    width: '100%',
    maxWidth: 300,
    height: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: 'rgba(26,26,26,0.1)',
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  barGreen: {
    backgroundColor: GAME_THEME.color.phosphor,
    borderRightWidth: 2,
    borderRightColor: GAME_THEME.color.ink,
  },
  barRed: {
    backgroundColor: GAME_THEME.color.danger,
  },
  barSeg: {
    height: '100%',
  },
  legendRow: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    width: '100%',
  },
  legendItem: {
    alignItems: 'center',
    minWidth: 90,
  },
  iconBubble: {
    width: 48,
    height: 48,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
  },
  iconBubbleGreen: {
    backgroundColor: GAME_THEME.color.phosphor,
  },
  iconBubbleRed: {
    backgroundColor: GAME_THEME.color.danger,
  },
  legendCount: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: '900',
    color: GAME_THEME.color.ink,
  },
  legendLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(26,26,26,0.45)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  actions: {
    marginTop: 'auto',
    paddingTop: 20,
    paddingBottom: 8,
    width: '100%',
    maxWidth: 360,
    gap: 10,
  },
  retryWrap: {
    position: 'relative',
    borderRadius: 4,
    overflow: 'hidden',
  },
  retryGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 4,
    backgroundColor: GAME_THEME.color.paperWarm,
  },
  closePress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 4,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    borderBottomWidth: 4,
    borderBottomColor: GAME_THEME.color.goldLip,
  },
  closePressIn: {
    opacity: 0.88,
    transform: [{ translateY: 2 }],
    borderBottomWidth: 2,
  },
  closeText: {
    fontSize: 15,
    fontWeight: '900',
    color: GAME_THEME.color.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  retryPress: {
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: 3,
    borderColor: GAME_THEME.color.ink,
    borderBottomWidth: 5,
    borderBottomColor: GAME_THEME.color.goldLip,
  },
  retryPressIn: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 3,
  },
  retryInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 15,
    paddingHorizontal: 22,
  },
  retryText: {
    fontSize: 16,
    fontWeight: '900',
    color: GAME_THEME.color.ink,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  sharePress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    backgroundColor: 'rgba(253,248,238,0.85)',
  },
  sharePressIn: {
    opacity: 0.88,
    transform: [{ translateY: 1 }],
  },
  shareText: {
    fontSize: 13,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
});
