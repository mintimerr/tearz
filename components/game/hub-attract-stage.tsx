import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { TearzMarioSheetSprite } from '@/components/game/tearz-mario-sheet-sprite';
import { TEARZ_MARIO, isHubNightNow } from '@/components/game/tearz-mario-source';

/** Крупный Tearz на хабе — читается как герой сцены */
const SIZE = 196;
const CITY_LOOP_MS = 48000;
const CITY_ASPECT = 2560 / 863;
/** Задумчивый шаг с книгой — чуть медленнее Mario-run */
const WALK_FPS = 7;

type Phase = 'bookWalk';

type ScriptStep = {
  phase: Phase;
  toX: number;
  ms: number;
  facing: 1 | -1;
  /** Мгновенный перенос (выход справа → вход слева) */
  warp?: boolean;
};

/**
 * Профиль вправо: непрерывная ходьба с книгой, без пауз у края.
 */
const SCRIPT: ScriptStep[] = [
  { phase: 'bookWalk', toX: -0.14, ms: 0, facing: 1, warp: true },
  { phase: 'bookWalk', toX: 1.12, ms: 7200, facing: 1 },
];

/** Центр спрайта — чуть выше низа, чтобы крупный персонаж стоял на «земле» города */
const GROUND_Y = 0.7;

/**
 * Город-лента + Tearz: profile book-walk (прозрачный спрайт).
 */
export function HubAttractStage() {
  const { width: W, height: H } = useWindowDimensions();
  const stripW = useMemo(() => Math.max(W * 2.4, Math.ceil(H * CITY_ASPECT)), [H, W]);
  const [night, setNight] = useState(isHubNightNow);
  const cityBg = night ? TEARZ_MARIO.cityBgNight : TEARZ_MARIO.cityBgDay;

  const [phase, setPhase] = useState<Phase>('bookWalk');
  const [frame, setFrame] = useState(0);
  const [facing, setFacing] = useState<1 | -1>(1);

  const x = useSharedValue(SCRIPT[0].toX * W - SIZE / 2);
  const y = useSharedValue(GROUND_Y * H - SIZE / 2);
  const cityX = useSharedValue(0);

  const stepRef = useRef(0);
  const phaseStartRef = useRef(0);
  const fromXRef = useRef(SCRIPT[0].toX);
  const walkTRef = useRef(0);

  useEffect(() => {
    const sync = () => setNight(isHubNightNow());
    sync();
    const id = setInterval(sync, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    cityX.value = 0;
    cityX.value = withRepeat(
      withTiming(-stripW, { duration: CITY_LOOP_MS, easing: Easing.linear }),
      -1,
      false,
    );
  }, [cityX, stripW]);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let last = performance.now();
    stepRef.current = 0;
    phaseStartRef.current = performance.now();
    fromXRef.current = SCRIPT[0].toX;
    setPhase(SCRIPT[0].phase);
    setFacing(SCRIPT[0].facing);
    x.value = SCRIPT[0].toX * W - SIZE / 2;
    y.value = GROUND_Y * H - SIZE / 2;

    const applyStep = (stepIdx: number, now: number) => {
      const step = SCRIPT[stepIdx];
      stepRef.current = stepIdx;
      phaseStartRef.current = now;
      setPhase(step.phase);
      setFacing(step.facing);
      // не сбрасываем walkT — цикл шага не дёргается на wrap
      if (step.warp) {
        fromXRef.current = step.toX;
        x.value = step.toX * W - SIZE / 2;
        y.value = GROUND_Y * H - SIZE / 2;
      }
    };

    applyStep(0, performance.now());

    const tick = (now: number) => {
      if (cancelled) return;
      const dt = Math.min(48, now - last);
      last = now;

      let step = SCRIPT[stepRef.current];

      // warp / нулевая длительность — сразу к следующему шагу
      while (step.warp || step.ms <= 0) {
        fromXRef.current = step.toX;
        applyStep((stepRef.current + 1) % SCRIPT.length, now);
        step = SCRIPT[stepRef.current];
      }

      const elapsed = now - phaseStartRef.current;
      const t = Math.min(1, elapsed / Math.max(1, step.ms));

      const startX = fromXRef.current;
      const endX = step.toX;
      const curX = startX + (endX - startX) * t;

      x.value = curX * W - SIZE / 2;
      y.value = GROUND_Y * H - SIZE / 2;

      walkTRef.current += dt;
      const idx = Math.floor((walkTRef.current / 1000) * WALK_FPS) % 4;
      setFrame((prev) => (prev === idx ? prev : idx));

      if (elapsed >= step.ms) {
        fromXRef.current = step.toX;
        applyStep((stepRef.current + 1) % SCRIPT.length, now);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [H, W, x, y]);

  const mascotStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));

  const cityStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: cityX.value }],
  }));

  return (
    <View style={[styles.root, night && styles.rootNight]} pointerEvents="none">
      <Animated.View style={[styles.cityTrack, { width: stripW * 2, height: H }, cityStyle]}>
        <Image source={cityBg} style={{ width: stripW, height: H }} contentFit="cover" />
        <Image source={cityBg} style={{ width: stripW, height: H }} contentFit="cover" />
      </Animated.View>
      <View style={[styles.veil, night && styles.veilNight]} />

      <Animated.View style={[styles.mascot, mascotStyle]}>
        <TearzMarioSheetSprite sheet="bookWalk" frame={frame} size={SIZE} facing={facing} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#5C94FC',
  },
  rootNight: {
    backgroundColor: '#0B1430',
  },
  cityTrack: {
    position: 'absolute',
    left: 0,
    top: 0,
    flexDirection: 'row',
  },
  veil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 35, 80, 0.08)',
  },
  veilNight: {
    backgroundColor: 'rgba(4, 10, 28, 0.18)',
  },
  mascot: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 2,
  },
});
