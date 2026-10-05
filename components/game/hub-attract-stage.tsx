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
/** День 2560×863, ночь 2560×1400 — своё соотношение, иначе fill тянет картинку. */
const CITY_ASPECT_DAY = 2560 / 863;
const CITY_ASPECT_NIGHT = 2560 / 1400;
/** Задумчивый шаг с книгой — чуть медленнее Mario-run */
const WALK_FPS = 7;
/** Полный проход: за левый край → за правый край (~px/s). */
const WALK_SPEED_PX = 52;

/** Центр спрайта — ниже кнопок-навигации, на «земле» города */
const GROUND_Y = 0.885;

/**
 * Город-лента + Tearz: profile book-walk (прозрачный спрайт).
 * Ходьба бесконечная: полностью уходит за правый край и так же выходит слева
 * (wrap только когда спрайт целиком за экраном — без «телепорта»).
 */
export function HubAttractStage() {
  const { width: W, height: H } = useWindowDimensions();
  const [night, setNight] = useState(isHubNightNow);
  const cityAspect = night ? CITY_ASPECT_NIGHT : CITY_ASPECT_DAY;
  const stripW = useMemo(() => Math.max(W * 2.4, Math.ceil(H * cityAspect)), [H, W, cityAspect]);
  const cityBg = night ? TEARZ_MARIO.cityBgNight : TEARZ_MARIO.cityBgDay;

  const [frame, setFrame] = useState(0);

  /** left edge of sprite: -SIZE … W (оба конца полностью за кадром) */
  const x = useSharedValue(-SIZE);
  const y = useSharedValue(GROUND_Y * H - SIZE / 2);
  const cityX = useSharedValue(0);

  const walkTRef = useRef(0);
  const posRef = useRef(-SIZE);

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

    // Старт чуть за левым краем — сразу идёт внутрь экрана.
    const startX = -SIZE;
    const endX = W; // left edge = W → целиком за правым краем
    const span = endX - startX; // W + SIZE
    posRef.current = startX;
    x.value = startX;
    y.value = GROUND_Y * H - SIZE / 2;

    const tick = (now: number) => {
      if (cancelled) return;
      const dt = Math.min(48, now - last);
      last = now;

      let next = posRef.current + (WALK_SPEED_PX * dt) / 1000;
      // Wrap только за кадром: прыжок endX → startX невидим.
      while (next >= endX) next -= span;
      posRef.current = next;

      x.value = next;
      y.value = GROUND_Y * H - SIZE / 2;

      walkTRef.current += dt;
      const idx = Math.floor((walkTRef.current / 1000) * WALK_FPS) % 4;
      setFrame((prev) => (prev === idx ? prev : idx));

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
        <Image
          source={cityBg}
          style={{ width: stripW, height: H }}
          contentFit="fill"
          allowDownscaling={false}
          pixelated
        />
        <Image
          source={cityBg}
          style={{ width: stripW, height: H }}
          contentFit="fill"
          allowDownscaling={false}
          pixelated
        />
      </Animated.View>
      <View style={[styles.veil, night && styles.veilNight]} />

      <Animated.View style={[styles.mascot, mascotStyle]}>
        <TearzMarioSheetSprite sheet="bookWalk" frame={frame} size={SIZE} facing={1} />
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
