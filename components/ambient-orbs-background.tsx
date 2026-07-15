import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { APP_THEME } from '@/constants/theme';

type OrbSpec = {
  layout: ViewStyle;
  driftX: number;
  driftY: number;
  scaleMin: number;
  scaleMax: number;
  opacityMin: number;
  opacityMax: number;
  duration: number;
  delay?: number;
};

export type AmbientOrbsIntensity = 'calm' | 'focus' | 'playful';

const INTENSITY = {
  calm: { opacity: 0.42, drift: 0.55, speed: 1.35 },
  focus: { opacity: 0.58, drift: 0.68, speed: 1.15 },
  playful: { opacity: 0.72, drift: 0.82, speed: 1 },
} as const;

function DriftingOrb({ spec, intensity }: { spec: OrbSpec; intensity: AmbientOrbsIntensity }) {
  const phase = useSharedValue(0);
  const preset = INTENSITY[intensity];

  useEffect(() => {
    phase.value = withDelay(
      spec.delay ?? 0,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: (spec.duration * preset.speed) / 2,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0, {
            duration: (spec.duration * preset.speed) / 2,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        false,
      ),
    );
  }, [phase, preset.speed, spec.delay, spec.duration]);

  const motion = useAnimatedStyle(() => {
    const p = phase.value;
    return {
      opacity: interpolate(p, [0, 1], [spec.opacityMin * preset.opacity, spec.opacityMax * preset.opacity]),
      transform: [
        { translateX: interpolate(p, [0, 1], [-spec.driftX * preset.drift, spec.driftX * preset.drift]) },
        { translateY: interpolate(p, [0, 1], [spec.driftY * preset.drift, -spec.driftY * preset.drift]) },
        { scale: interpolate(p, [0, 1], [spec.scaleMin, spec.scaleMax]) },
      ],
    };
  });

  return <Animated.View pointerEvents="none" style={[styles.orb, spec.layout, motion]} />;
}

const ORBS: OrbSpec[] = [
  {
    layout: {
      width: 320,
      height: 320,
      top: -140,
      right: -100,
      backgroundColor: APP_THEME.color.accent,
    },
    driftX: 14,
    driftY: 10,
    scaleMin: 0.96,
    scaleMax: 1.04,
    opacityMin: 0.04,
    opacityMax: 0.08,
    duration: 14000,
    delay: 0,
  },
  {
    layout: {
      width: 240,
      height: 240,
      bottom: 80,
      left: -120,
      backgroundColor: APP_THEME.color.accent,
    },
    driftX: 10,
    driftY: 14,
    scaleMin: 0.94,
    scaleMax: 1.03,
    opacityMin: 0.03,
    opacityMax: 0.06,
    duration: 16800,
    delay: 600,
  },
];

/** Едва заметный ambient — без радуги и «игрушечности» */
export function AmbientOrbsBackground({ intensity = 'calm' }: { intensity?: AmbientOrbsIntensity }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {ORBS.map((spec, i) => (
        <DriftingOrb key={i} spec={spec} intensity={intensity} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
});
