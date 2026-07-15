import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect } from 'react';
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { APP_THEME } from '@/constants/theme';
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
    transform: [{ scale: interpolate(btnPulse.value, [0, 1], [1, 1.08]) }],
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
      <Text style={styles.title}>Готово</Text>
      <Text style={styles.subtitle}>как прошла сессия</Text>

      <View style={styles.chartBlock}>
        <Animated.View style={[styles.svgWrap, chartGroupStyle]}>
          <Svg width={220} height={220} viewBox="0 0 220 220">
            <Circle cx={CX} cy={CY} r={R} fill="rgba(0,0,0,0.06)" />
            {correct === total && total > 0 ? <Circle cx={CX} cy={CY} r={R} fill="rgba(34, 197, 94, 0.92)" /> : null}
            {wrong === total && total > 0 ? <Circle cx={CX} cy={CY} r={R} fill="rgba(220, 53, 69, 0.9)" /> : null}
            {correct > 0 && correct < total ? <Path d={greenPath} fill="rgba(34, 197, 94, 0.92)" /> : null}
            {wrong > 0 && wrong < total ? <Path d={redPath} fill="rgba(220, 53, 69, 0.9)" /> : null}
            <Circle cx={CX} cy={CY} r={HOLE} fill="#050816" />
            <Circle cx={CX} cy={CY} r={HOLE + 2} stroke="rgba(0,0,0,0.08)" strokeWidth={2} fill="none" />
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
            <Ionicons name="checkmark" size={26} color="#052e16" />
          </View>
          <Text style={styles.legendCount}>{correct}</Text>
          <Text style={styles.legendLabel}>выучил</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.iconBubble, styles.iconBubbleRed]}>
            <Ionicons name="close" size={28} color="#fff5f5" />
          </View>
          <Text style={styles.legendCount}>{wrong}</Text>
          <Text style={styles.legendLabel}>не выучил</Text>
        </View>
      </Animated.View>

      <Animated.View style={[styles.actions, actionsStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Закрыть тренировку"
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onClose();
          }}
          style={({ pressed }) => [styles.closePress, pressed && styles.closePressIn]}>
          <BlurView intensity={Platform.OS === 'ios' ? 50 : 36} tint="dark" style={StyleSheet.absoluteFillObject} />
          <Ionicons name="chevron-back" size={20} color="rgba(242,242,247,0.85)" />
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
              <Ionicons name="refresh" size={22} color="#fff" />
              <Text style={styles.retryText}>Ещё раз</Text>
              <Ionicons name="arrow-forward" size={18} color={APP_THEME.color.textSoft} />
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
            <Ionicons name="share-social-outline" size={18} color="rgba(168, 148, 255, 0.95)" />
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
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -1,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(139, 146, 178, 0.95)',
  },
  chartBlock: {
    marginTop: 22,
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
    fontSize: 36,
    fontWeight: '900',
    color: '#F2F2F7',
    letterSpacing: -1.2,
  },
  pctHint: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
    color: APP_THEME.color.mutedSoft,
    letterSpacing: 0.2,
  },
  barTrack: {
    marginTop: 22,
    width: '100%',
    maxWidth: 320,
    height: 14,
    borderRadius: 999,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: APP_THEME.color.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.border,
  },
  barGreen: {
    backgroundColor: 'rgba(34, 197, 94, 0.95)',
    borderRadius: 999,
  },
  barRed: {
    backgroundColor: 'rgba(220, 53, 69, 0.92)',
    borderRadius: 999,
  },
  barSeg: {
    height: '100%',
  },
  legendRow: {
    marginTop: 28,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 36,
    width: '100%',
  },
  legendItem: {
    alignItems: 'center',
    minWidth: 100,
  },
  iconBubble: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  iconBubbleGreen: {
    backgroundColor: 'rgba(134, 239, 172, 0.95)',
    borderColor: 'rgba(21, 128, 61, 0.55)',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 6,
  },
  iconBubbleRed: {
    backgroundColor: 'rgba(220, 53, 69, 0.95)',
    borderColor: 'rgba(254, 202, 202, 0.45)',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5,
  },
  legendCount: {
    marginTop: 10,
    fontSize: 22,
    fontWeight: '800',
    color: '#F2F2F7',
  },
  legendLabel: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
    color: APP_THEME.color.mutedSoft,
  },
  actions: {
    marginTop: 'auto',
    paddingTop: 28,
    paddingBottom: 8,
    width: '100%',
    maxWidth: 360,
    gap: 12,
  },
  retryWrap: {
    position: 'relative',
    borderRadius: 18,
    overflow: 'hidden',
  },
  retryGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    backgroundColor: 'rgba(124, 92, 255, 0.55)',
  },
  closePress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: APP_THEME.color.borderStrong,
  },
  closePressIn: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  closeText: {
    fontSize: 17,
    fontWeight: '700',
    color: 'rgba(242,242,247,0.92)',
  },
  retryPress: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(124, 92, 255, 0.98)',
    borderWidth: 1,
    borderColor: 'rgba(200, 188, 255, 0.55)',
    shadowColor: '#7C5CFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.42,
    shadowRadius: 22,
    elevation: 10,
  },
  retryPressIn: {
    transform: [{ scale: 0.97 }],
    opacity: 0.95,
  },
  retryInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 17,
    paddingHorizontal: 22,
  },
  retryText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  sharePress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: APP_THEME.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(168, 148, 255, 0.35)',
    backgroundColor: 'rgba(124, 92, 255, 0.12)',
  },
  sharePressIn: {
    opacity: 0.88,
  },
  shareText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(168, 148, 255, 0.95)',
    letterSpacing: -0.2,
  },
});
