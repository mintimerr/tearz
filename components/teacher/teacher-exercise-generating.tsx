import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Image as RNImage,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Animated, {
  Easing,
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { TEARZ_MARIO } from '@/components/game/tearz-mario-source';
import { useTranslation } from '@/contexts/locale-context';

const STEP_MS = 900;
const STATION_KEYS = [
  'teacher.drillStationParse',
  'teacher.drillStationVocab',
  'teacher.drillStationExercises',
  'teacher.drillStationChoices',
  'teacher.drillStationDone',
] as const;

type NormBox = { left: number; top: number; width: number; height: number };

/** Зоны глаз в долях спрайта — только тонкие веки при моргании. */
const NPC_IDLE: { eyes: NormBox }[] = [
  { eyes: { left: 0.38, top: 0.112, width: 0.26, height: 0.018 } },
  { eyes: { left: 0.42, top: 0.108, width: 0.14, height: 0.016 } },
  { eyes: { left: 0.36, top: 0.118, width: 0.3, height: 0.02 } },
  { eyes: { left: 0.34, top: 0.122, width: 0.28, height: 0.018 } },
];

function mirrorBox(box: NormBox): NormBox {
  return { ...box, left: 1 - box.left - box.width };
}

function boxStyle(box: NormBox): ViewStyle {
  return {
    position: 'absolute',
    left: `${box.left * 100}%`,
    top: `${box.top * 100}%`,
    width: `${box.width * 100}%`,
    height: `${box.height * 100}%`,
  };
}

/** Вагон на весь экран без боковых «полей» от сидений — cover кропает края. */
const METRO_IMG_W = 1024;
const METRO_IMG_H = 1536;

const GLASS = {
  doorL: { left: 0.298, top: 0.2, width: 0.162, height: 0.222 },
  doorR: { left: 0.54, top: 0.2, width: 0.162, height: 0.222 },
  winL: { left: 0.05, top: 0.29, width: 0.12, height: 0.2 },
  winR: { left: 0.83, top: 0.29, width: 0.12, height: 0.2 },
} as const;

/** Ниша над дверями в арте вагона — табло сидит в ней как железо салона. */
const LED_BOARD = { left: 0.2, top: 0.038, width: 0.6, height: 0.145 };

/** Интервал между «станциями» на табло (для часов прибытия). */
const STATION_GAP_MS = 60_000;

function formatClock(date: Date) {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

type Props = { visible: boolean };
type NormRect = { left: number; top: number; width: number; height: number };

// eslint-disable-next-line @typescript-eslint/no-require-imports
const NPC_SPRITES = [
  require('../../assets/images/tearz-mario/metro-npc-0.png'),
  require('../../assets/images/tearz-mario/metro-npc-1.png'),
  require('../../assets/images/tearz-mario/metro-npc-2.png'),
  require('../../assets/images/tearz-mario/metro-npc-3.png'),
] as const;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const NPC_SPRITES_FLIP = [
  require('../../assets/images/tearz-mario/metro-npc-0-flip.png'),
  require('../../assets/images/tearz-mario/metro-npc-1-flip.png'),
  require('../../assets/images/tearz-mario/metro-npc-2-flip.png'),
  require('../../assets/images/tearz-mario/metro-npc-3-flip.png'),
] as const;

/**
 * Плотная толпа: ряд у дверей сзади + бока.
 * Tearz впереди в центре, полностью видимый.
 */
const CROWD: {
  sprite: number;
  cx: number;
  heightFrac: number;
  flip?: boolean;
  z: number;
  depth: 'back' | 'mid';
}[] = [
  // сзади у дверей
  { sprite: 1, cx: 0.34, heightFrac: 0.58, flip: true, z: 1, depth: 'back' },
  { sprite: 3, cx: 0.5, heightFrac: 0.56, z: 1, depth: 'back' },
  { sprite: 0, cx: 0.66, heightFrac: 0.58, z: 1, depth: 'back' },
  // средний ряд по бокам от Tearz
  { sprite: 1, cx: 0.12, heightFrac: 0.66, flip: true, z: 3, depth: 'mid' },
  { sprite: 0, cx: 0.22, heightFrac: 0.7, z: 4, depth: 'mid' },
  { sprite: 2, cx: 0.78, heightFrac: 0.7, flip: true, z: 4, depth: 'mid' },
  { sprite: 3, cx: 0.88, heightFrac: 0.66, z: 3, depth: 'mid' },
];

/** Tearz в просвете, полностью впереди. */
const TEARZ = { cx: 0.5, heightFrac: 0.3 };
const TEARZ_ASPECT = 0.95;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const METRO_CAR = require('../../assets/images/tearz-mario/tearz-metro-doors-v3.png');

const AnimatedExpoImage = Animated.createAnimatedComponent(ExpoImage);

const STREAK_W = 72;
const STREAK_N = 24;

/** Доли PNG → px с учётом contentFit:cover (кроп сидений по бокам). */
function coverMap(viewW: number, viewH: number) {
  const viewAspect = viewW / Math.max(viewH, 1);
  const imgAspect = METRO_IMG_W / METRO_IMG_H;
  let drawW: number;
  let drawH: number;
  let ox: number;
  let oy: number;
  if (viewAspect > imgAspect) {
    drawW = viewW;
    drawH = viewW / imgAspect;
    ox = 0;
    oy = (viewH - drawH) / 2;
  } else {
    drawH = viewH;
    drawW = viewH * imgAspect;
    ox = (viewW - drawW) / 2;
    oy = 0;
  }
  const toStyle = (r: NormRect): ViewStyle => ({
    position: 'absolute',
    left: ox + r.left * drawW,
    top: oy + r.top * drawH,
    width: r.width * drawW,
    height: r.height * drawH,
  });
  /** Целый масштаб от нативного размера спрайта — меньше мыла, чем fractional contain. */
  const npcStyle = (cx: number, heightFrac: number, source: number): ViewStyle => {
    const resolved = RNImage.resolveAssetSource(source);
    const nativeW = resolved?.width || 280;
    const nativeH = resolved?.height || 640;
    const targetH = heightFrac * drawH;
    const scale = Math.max(1, Math.round(targetH / nativeH));
    const h = nativeH * scale;
    const w = nativeW * scale;
    // если 1× всё ещё выше цели — один раз даунскейлим к ближайшему int, без дробного contain
    const finalH = h > targetH * 1.15 ? Math.round(targetH) : h;
    const finalW = h > targetH * 1.15 ? Math.round(targetH * (nativeW / nativeH)) : w;
    return {
      position: 'absolute',
      left: Math.round(ox + cx * drawW - finalW / 2),
      top: Math.round(oy + drawH - finalH),
      width: finalW,
      height: finalH,
    };
  };
  const tearzStyle = (cx: number, heightFrac: number): ViewStyle => {
    const h = Math.round(heightFrac * drawH);
    const w = Math.round(h * TEARZ_ASPECT);
    return {
      position: 'absolute',
      left: Math.round(ox + cx * drawW - w / 2),
      top: Math.round(oy + drawH - h),
      width: w,
      height: h,
    };
  };
  return { toStyle, npcStyle, tearzStyle };
}

function TunnelMotion({ style }: { style?: StyleProp<ViewStyle> }) {
  const scroll = useSharedValue(0);
  const streaks = useMemo(() => Array.from({ length: STREAK_N }, (_, i) => i), []);

  useEffect(() => {
    scroll.value = withRepeat(withTiming(1, { duration: 520, easing: Easing.linear }), -1, false);
  }, [scroll]);

  const stripStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(scroll.value, [0, 1], [0, -STREAK_W * 2]) }],
  }));

  return (
    <View style={[styles.tunnelClip, style]} pointerEvents="none">
      <Animated.View style={[styles.tunnelStrip, stripStyle]}>
        {streaks.map((i) => (
          <View key={i} style={styles.tunnelCol}>
            <View style={[styles.hStreak, styles.hStreakHi, i % 2 === 0 && styles.hStreakLong]} />
            <View style={[styles.hStreak, styles.hStreakMid, i % 3 === 0 && styles.hStreakBright]} />
            <View style={[styles.hStreak, styles.hStreakLo]} />
            <View style={[styles.hStreak, styles.hStreakThin, i % 4 === 0 && styles.hStreakLong]} />
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

function DoorBoard({ activeStep }: { activeStep: number }) {
  const { t } = useTranslation();
  const steps = useMemo(
    () => STATION_KEYS.map((key) => t(key)),
    [t],
  );
  const pulse = useSharedValue(0);
  const current = steps[Math.min(activeStep, steps.length - 1)];
  const progress = activeStep / Math.max(steps.length - 1, 1);

  const stationTimes = useMemo(() => {
    const start = Date.now();
    return STATION_KEYS.map((_, i) => formatClock(new Date(start + (i + 1) * STATION_GAP_MS)));
  }, []);

  const eta = stationTimes[Math.min(activeStep, stationTimes.length - 1)];

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [pulse]);

  const titleGlow = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.75, 1]),
  }));

  const activeGlow = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.75, 1]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.97, 1.04]) }],
  }));

  return (
    <View style={styles.boardHousing}>
      {/* Бежевая панель стены вагона под корпус */}
      <View style={styles.boardWallPlate} />
      <View style={styles.boardWallPlateEdgeL} />
      <View style={styles.boardWallPlateEdgeR} />

      {/* Потолочный бортик вагона */}
      <View style={styles.boardCeilingBar}>
        <View style={styles.boardCeilingBolt} />
        <View style={[styles.boardCeilingBolt, { left: '22%' }]} />
        <View style={[styles.boardCeilingBolt, { left: '78%' }]} />
        <View style={[styles.boardCeilingBolt, styles.boardCeilingBoltRight]} />
      </View>

      {/* Тёмно-зелёная металлическая рамка как в арте дверей */}
      <View style={styles.boardMetalFrame}>
        <View style={styles.boardMetalRimTop} />
        <View style={styles.boardMetalRimBot} />
        <View style={styles.boardRivet} />
        <View style={[styles.boardRivet, styles.boardRivetTR]} />
        <View style={[styles.boardRivet, styles.boardRivetBL]} />
        <View style={[styles.boardRivet, styles.boardRivetBR]} />

        <View style={styles.boardRecess}>
          <View style={styles.boardGlassEdge} />
          <View style={styles.boardScreen}>
            <View style={styles.boardScan} />

            <View style={styles.boardTopRow}>
              <View style={styles.boardTitleBlock}>
                <Text style={styles.boardEyebrow}>{t('teacher.drillMetroRoute').toUpperCase()}</Text>
                <Animated.Text style={[styles.boardTitle, titleGlow]} numberOfLines={1}>
                  {current.toUpperCase()}
                </Animated.Text>
              </View>
              <View style={styles.boardEtaBlock}>
                <Text style={styles.boardEtaLabel}>{t('teacher.drillMetroArrival').toUpperCase()}</Text>
                <Animated.Text style={[styles.boardEtaTime, titleGlow]}>{eta}</Animated.Text>
              </View>
            </View>

            <View style={styles.boardTrack}>
              <View style={styles.boardRail} />
              <View style={[styles.boardRailFill, { width: `${Math.max(progress, 0.04) * 100}%` }]} />
              <View style={styles.boardStations}>
                {steps.map((label, i) => {
                  const done = i < activeStep;
                  const active = i === activeStep;
                  return (
                    <View key={STATION_KEYS[i]} style={styles.stationCol}>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.stationLabel,
                          done && styles.stationLabelOn,
                          active && styles.stationLabelActive,
                        ]}>
                        {label}
                      </Text>
                      <Text
                        style={[
                          styles.stationTime,
                          done && styles.stationTimeOn,
                          active && styles.stationTimeActive,
                        ]}>
                        {stationTimes[i]}
                      </Text>
                      <Animated.View
                        style={[
                          styles.stationDot,
                          done && styles.stationDotDone,
                          active && styles.stationDotActive,
                          active && activeGlow,
                        ]}>
                        {done ? <Ionicons name="checkmark" size={10} color="#14120A" /> : null}
                        {active ? <View style={styles.stationPulse} /> : null}
                      </Animated.View>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Нижний молдинг в перемычку дверей */}
      <View style={styles.boardDoorHeader}>
        <View style={styles.boardDoorHeaderLine} />
      </View>
    </View>
  );
}

/** Моргание: тонкие веки на долю секунды. */
function useBlink(phase: number) {
  const blink = useSharedValue(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      const wait = 1800 + phase * 280 + Math.random() * 3200;
      timer = setTimeout(() => {
        if (cancelled) return;
        const double = Math.random() > 0.7;
        if (double) {
          blink.value = withSequence(
            withTiming(1, { duration: 40 }),
            withTiming(1, { duration: 60 }),
            withTiming(0, { duration: 45 }),
            withDelay(100, withTiming(1, { duration: 35 })),
            withTiming(1, { duration: 45 }),
            withTiming(0, { duration: 40 }),
          );
        } else {
          blink.value = withSequence(
            withTiming(1, { duration: 40 }),
            withTiming(1, { duration: 65 }),
            withTiming(0, { duration: 45 }),
          );
        }
        schedule();
      }, wait);
    };

    schedule();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [blink, phase]);

  return useAnimatedStyle(() => ({
    opacity: blink.value,
  }));
}

/** Пассажир: дыхание + моргание. */
function SpritePassenger({
  style,
  source,
  sprite,
  flip,
  phase = 0,
  depth = 'mid',
}: {
  style?: StyleProp<ViewStyle>;
  source: number;
  sprite: number;
  flip?: boolean;
  phase?: number;
  depth?: 'back' | 'mid';
}) {
  const bob = useSharedValue(0);
  const idle = NPC_IDLE[sprite] ?? NPC_IDLE[0];
  const eyes = flip ? mirrorBox(idle.eyes) : idle.eyes;
  const blinkStyle = useBlink(phase);

  useEffect(() => {
    bob.value = withRepeat(
      withTiming(1, { duration: 2200 + phase * 260, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [bob, phase]);

  const bobStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(bob.value, [0, 1], [0, depth === 'back' ? 2 : 3.2]) },
      {
        rotate: `${interpolate(bob.value, [0, 1], [phase % 2 === 0 ? -0.4 : 0.35, phase % 2 === 0 ? 0.35 : -0.4])}deg`,
      },
    ],
  }));

  return (
    <View style={[styles.npc, style]} pointerEvents="none" collapsable={false}>
      <Animated.View style={[styles.npcBob, bobStyle]}>
        <View style={[styles.floorShadow, depth === 'back' ? styles.floorShadowBack : null]} />
        <RNImage source={source} resizeMode="contain" style={styles.npcSprite} fadeDuration={0} />
        <Animated.View style={[boxStyle(eyes), styles.eyeLids, blinkStyle]} />
      </Animated.View>
    </View>
  );
}

function TearzCommuter({ size }: { size: number }) {
  const bob = useSharedValue(0);
  const blinkStyle = useBlink(1);
  const eyesBox: NormBox = { left: 0.34, top: 0.3, width: 0.32, height: 0.028 };

  useEffect(() => {
    bob.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [bob]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(bob.value, [0, 1], [0, 2.8]) },
      { rotate: `${interpolate(bob.value, [0, 1], [-0.35, 0.35])}deg` },
    ],
  }));

  return (
    <Animated.View style={[{ width: size, height: size * 1.05 }, styles.tearzWrap, style]}>
      <View style={styles.tearzFloorShadow} />
      <View style={{ width: size, height: size }}>
        <AnimatedExpoImage
          source={TEARZ_MARIO.phoneMetro}
          contentFit="contain"
          contentPosition="bottom"
          style={{ width: size, height: size }}
          cachePolicy="none"
        />
        <Animated.View style={[boxStyle(eyesBox), styles.tearzLids, blinkStyle]} />
      </View>
    </Animated.View>
  );
}

export function TeacherExerciseGenerating({ visible }: Props) {
  const { width: screenW } = useWindowDimensions();
  const [activeStep, setActiveStep] = useState(0);
  const [wagonSize, setWagonSize] = useState({ width: 0, height: 0 });

  const sway = useSharedValue(0);
  const drift = useSharedValue(0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      setActiveStep(0);
      return;
    }
    const timer = setInterval(() => {
      setActiveStep((i) => Math.min(i + 1, STATION_KEYS.length - 1));
    }, STEP_MS);
    return () => clearInterval(timer);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    // Медленное киношное покачивание вагона + лёгкий drift и «дыхание» камеры
    sway.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    drift.value = withRepeat(
      withTiming(1, { duration: 6700, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    breathe.value = withRepeat(
      withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [breathe, drift, sway, visible]);

  const wagonStyle = useAnimatedStyle(() => {
    const x =
      interpolate(sway.value, [0, 1], [-3.2, 3.2]) + interpolate(drift.value, [0, 1], [-1.6, 1.6]);
    const y =
      interpolate(sway.value, [0, 1], [0, 2.4]) + interpolate(drift.value, [0, 1], [0.4, -0.8]);
    const rot =
      interpolate(sway.value, [0, 1], [-0.42, 0.42]) +
      interpolate(drift.value, [0, 1], [-0.18, 0.18]);
    const scale = interpolate(breathe.value, [0, 1], [1.035, 1.055]);
    return {
      transform: [
        { scale },
        { translateX: x },
        { translateY: y },
        { rotate: `${rot}deg` },
      ],
    };
  });

  if (!visible) return null;

  const map = coverMap(wagonSize.width || screenW, wagonSize.height || 1);
  const tearzBox = map.tearzStyle(TEARZ.cx, TEARZ.heightFrac);
  const tearzSize = typeof tearzBox.width === 'number' ? tearzBox.width : Math.round(screenW * 0.16);

  return (
    <View style={styles.overlay}>
      <View style={styles.root}>
        <View
          style={styles.wagonShell}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setWagonSize((prev) =>
              prev.width === width && prev.height === height ? prev : { width, height },
            );
          }}>
          {wagonSize.height > 0 ? (
            <Animated.View
              entering={FadeIn.duration(240)}
              style={[
                styles.wagon,
                { width: wagonSize.width, height: wagonSize.height },
                wagonStyle,
              ]}>
              <View
                style={[
                  styles.sceneZoom,
                  { width: wagonSize.width, height: wagonSize.height },
                ]}>
                {/* Вагон + стёкла — один слой, качаются вместе */}
                <ExpoImage
                  source={METRO_CAR}
                  contentFit="cover"
                  contentPosition="center"
                  style={{ width: wagonSize.width, height: wagonSize.height }}
                  priority="high"
                />

                <TunnelMotion style={[map.toStyle(GLASS.winL), styles.glassBack]} />
                <TunnelMotion style={[map.toStyle(GLASS.winR), styles.glassBack]} />
                <TunnelMotion style={[map.toStyle(GLASS.doorL), styles.glassDoor]} />
                <TunnelMotion style={[map.toStyle(GLASS.doorR), styles.glassDoor]} />

                {/* Грейд под персонажами — иначе мылит спрайты */}
                <View style={styles.gradeWarm} pointerEvents="none" />
                <View style={styles.gradeCool} pointerEvents="none" />

                {CROWD.map((p, i) => {
                  const source = p.flip ? NPC_SPRITES_FLIP[p.sprite] : NPC_SPRITES[p.sprite];
                  return (
                    <SpritePassenger
                      key={`p-${i}`}
                      style={[map.npcStyle(p.cx, p.heightFrac, source), { zIndex: p.z }]}
                      source={source}
                      sprite={p.sprite}
                      flip={p.flip}
                      phase={i}
                      depth={p.depth}
                    />
                  );
                })}

                {/* Tearz полностью впереди в просвете между людьми */}
                <View style={[tearzBox, styles.tearzSlot]} pointerEvents="none">
                  <TearzCommuter size={tearzSize} />
                </View>

                <View style={[styles.boardSlot, map.toStyle(LED_BOARD)]} pointerEvents="none">
                  <DoorBoard activeStep={activeStep} />
                </View>
              </View>
            </Animated.View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  root: {
    flex: 1,
    backgroundColor: '#2A2A2A',
  },
  wagonShell: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  wagon: {
    overflow: 'hidden',
    position: 'relative',
  },
  sceneZoom: {
    position: 'absolute',
    left: 0,
    top: 0,
  },

  tunnelClip: {
    overflow: 'hidden',
    backgroundColor: '#03050A',
    borderRadius: 3,
  },
  glassBack: {
    zIndex: 1,
  },
  glassDoor: {
    zIndex: 2,
  },
  tunnelStrip: {
    flexDirection: 'row',
    height: '100%',
    width: STREAK_W * STREAK_N,
  },
  tunnelCol: {
    width: STREAK_W,
    height: '100%',
    justifyContent: 'space-evenly',
    paddingVertical: '6%',
  },
  hStreak: {
    height: 4,
    borderRadius: 1,
    alignSelf: 'flex-start',
    marginLeft: 4,
  },
  hStreakHi: {
    width: 42,
    height: 5,
    backgroundColor: '#FFE566',
    opacity: 1,
  },
  hStreakMid: {
    width: 28,
    backgroundColor: '#FFB020',
    opacity: 0.85,
    alignSelf: 'flex-end',
    marginRight: 6,
  },
  hStreakLo: {
    width: 34,
    backgroundColor: '#FFF3A0',
    opacity: 0.7,
  },
  hStreakThin: {
    width: 18,
    height: 2,
    backgroundColor: '#FFF8C8',
    opacity: 0.55,
    alignSelf: 'center',
  },
  hStreakLong: { width: 54 },
  hStreakBright: {
    width: 38,
    height: 6,
    backgroundColor: '#FFD24A',
    opacity: 1,
  },

  gradeWarm: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 140, 60, 0.045)',
    zIndex: 0,
  },
  gradeCool: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(40, 120, 180, 0.03)',
    zIndex: 0,
  },

  boardSlot: {
    zIndex: 40,
    justifyContent: 'flex-start',
    overflow: 'visible',
  },
  boardHousing: {
    flex: 1,
    position: 'relative',
  },
  boardWallPlate: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#D2C2A6',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#B8A888',
  },
  boardWallPlateEdgeL: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 8,
    width: 5,
    backgroundColor: '#C4B496',
    borderRightWidth: 1,
    borderRightColor: '#A89878',
  },
  boardWallPlateEdgeR: {
    position: 'absolute',
    right: 0,
    top: 10,
    bottom: 8,
    width: 5,
    backgroundColor: '#C4B496',
    borderLeftWidth: 1,
    borderLeftColor: '#A89878',
  },
  boardCeilingBar: {
    height: 9,
    marginHorizontal: 2,
    backgroundColor: '#6A6A6A',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#8A8A8A',
    borderBottomColor: '#4A4A4A',
    zIndex: 2,
  },
  boardCeilingBolt: {
    position: 'absolute',
    left: 6,
    top: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3A3A3A',
    borderWidth: 0.5,
    borderColor: '#9A9A9A',
  },
  boardCeilingBoltRight: {
    left: undefined,
    right: 6,
  },
  boardMetalFrame: {
    flex: 1,
    marginHorizontal: 4,
    marginTop: -1,
    backgroundColor: '#1A3D32',
    borderRadius: 3,
    borderWidth: 2,
    borderTopColor: '#2F5C4C',
    borderLeftColor: '#2A5345',
    borderRightColor: '#0E241C',
    borderBottomColor: '#0A1A14',
    padding: 6,
    zIndex: 2,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  boardMetalRimTop: {
    position: 'absolute',
    left: 3,
    right: 3,
    top: 2,
    height: 2,
    backgroundColor: 'rgba(120, 180, 150, 0.35)',
    borderRadius: 1,
  },
  boardMetalRimBot: {
    position: 'absolute',
    left: 3,
    right: 3,
    bottom: 2,
    height: 2,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 1,
  },
  boardRivet: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#6E6254',
    borderWidth: 0.5,
    borderColor: '#C4B8A0',
    zIndex: 4,
  },
  boardRivetTR: { left: undefined, right: 4 },
  boardRivetBL: { top: undefined, bottom: 4 },
  boardRivetBR: { top: undefined, bottom: 4, left: undefined, right: 4 },
  boardRecess: {
    flex: 1,
    borderRadius: 2,
    backgroundColor: '#05070C',
    borderWidth: 2,
    borderTopColor: '#000',
    borderLeftColor: '#000',
    borderRightColor: '#2A4038',
    borderBottomColor: '#3A5048',
    padding: 2,
    overflow: 'hidden',
  },
  boardGlassEdge: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255, 220, 120, 0.12)',
    borderRadius: 1,
    zIndex: 1,
  },
  boardScreen: {
    flex: 1,
    borderRadius: 1,
    overflow: 'hidden',
    backgroundColor: '#06080E',
    paddingHorizontal: 7,
    paddingTop: 4,
    paddingBottom: 5,
    justifyContent: 'space-between',
    zIndex: 2,
  },
  boardDoorHeader: {
    height: 7,
    marginHorizontal: 2,
    marginTop: -1,
    backgroundColor: '#B8A888',
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#9A8A6A',
    justifyContent: 'center',
    zIndex: 1,
  },
  boardDoorHeaderLine: {
    height: 2,
    marginHorizontal: 10,
    backgroundColor: '#8A7A5A',
    borderRadius: 1,
  },
  boardScan: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 196, 64, 0.035)',
  },
  boardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 6,
  },
  boardTitleBlock: {
    flex: 1,
    gap: 0,
    minWidth: 0,
  },
  boardEyebrow: {
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: 'rgba(255, 210, 110, 0.55)',
  },
  boardTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: '#FFE566',
    textShadowColor: 'rgba(255, 190, 40, 0.85)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  boardEtaBlock: {
    alignItems: 'flex-end',
    paddingTop: 0,
    minWidth: 64,
  },
  boardEtaLabel: {
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1,
    color: 'rgba(255, 210, 110, 0.5)',
  },
  boardEtaTime: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: '#FFE566',
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(255, 190, 40, 0.85)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  boardTrack: {
    height: 36,
    justifyContent: 'flex-end',
  },
  boardRail: {
    position: 'absolute',
    left: 4,
    right: 4,
    bottom: 5,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 200, 80, 0.18)',
  },
  boardRailFill: {
    position: 'absolute',
    left: 4,
    bottom: 5,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#FFC94A',
    maxWidth: '94%',
    shadowColor: '#FFC94A',
    shadowOpacity: 0.9,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  boardStations: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    zIndex: 2,
  },
  stationCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 1,
  },
  stationDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 200, 80, 0.45)',
    backgroundColor: '#0C0F16',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stationDotDone: {
    backgroundColor: '#FFC94A',
    borderColor: '#FFE566',
  },
  stationDotActive: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    backgroundColor: '#FFF6C8',
    borderColor: '#FFE566',
    shadowColor: '#FFE566',
    shadowOpacity: 1,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
  },
  stationPulse: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FF8A1F',
  },
  stationLabel: {
    fontSize: 8,
    fontWeight: '800',
    textAlign: 'center',
    color: 'rgba(255, 210, 120, 0.38)',
    letterSpacing: 0.1,
  },
  stationLabelOn: {
    color: 'rgba(255, 220, 130, 0.78)',
  },
  stationLabelActive: {
    color: '#FFE566',
    fontWeight: '900',
    fontSize: 9,
    textShadowColor: 'rgba(255, 190, 40, 0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  stationTime: {
    fontSize: 7,
    fontWeight: '700',
    color: 'rgba(255, 210, 120, 0.28)',
    fontVariant: ['tabular-nums'],
  },
  stationTimeOn: {
    color: 'rgba(255, 220, 130, 0.65)',
  },
  stationTimeActive: {
    color: '#FFE566',
    fontWeight: '900',
  },

  npc: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  npcBob: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  npcSprite: {
    width: '100%',
    height: '100%',
  },
  eyeLids: {
    backgroundColor: '#2A1C14',
    borderRadius: 1,
    zIndex: 5,
  },
  tearzLids: {
    backgroundColor: '#1A4A68',
    borderRadius: 2,
    zIndex: 5,
  },
  floorShadow: {
    position: 'absolute',
    bottom: 2,
    width: '55%',
    height: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.38)',
    transform: [{ scaleX: 1.15 }],
  },
  floorShadowBack: {
    opacity: 0.55,
    height: 8,
    width: '48%',
  },

  tearzSlot: {
    zIndex: 12,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  tearzWrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  tearzFloorShadow: {
    position: 'absolute',
    bottom: 0,
    width: '70%',
    height: 7,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
});
