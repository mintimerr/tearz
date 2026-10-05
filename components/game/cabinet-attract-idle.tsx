import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTranslation } from '@/contexts/locale-context';

const CITY = require('../../assets/images/tearz-mario/attract-press-scroll/city-strip-color.png');
const TEARZ_FLY = require('../../assets/images/tearz-mario/attract-press-scroll/tearz-fly-carpet-v4.png');

/** Медленнее + крупнее шаг = «лагучее» SNES/Mario чувство. */
const CITY_LOOP_MS = 16000;
const ORBIT_MS = 11000;
/** Дискретные позиции орбиты (как кадры спрайта). */
const ORBIT_STEPS = 20;
/** Сетка пикселей для скролла / полёта. */
const PX_CITY = 3;
const PX_TEARZ = 2;

function snapPx(v: number, step: number) {
  'worklet';
  return Math.round(v / step) * step;
}

type Props = { hintColor?: string };

/**
 * Attract: крупная 3D-надпись; Tearz летит по кругу на ковре-самолёте.
 * Движение квантовано по пикселям — Mario/SNES «лагучесть».
 */
export function CabinetAttractIdle({ hintColor = '#FFD24A' }: Props) {
  const { t, locale } = useTranslation();
  const pressLabel = t('terminal.idleTap');
  const [box, setBox] = useState({ w: 160, h: 80 });
  const cityX = useSharedValue(0);
  const orbit = useSharedValue(0);
  const orbitCx = useSharedValue(80);
  const orbitCy = useSharedValue(30);
  const orbitRx = useSharedValue(50);
  const orbitRy = useSharedValue(22);
  const titlePulse = useSharedValue(1);
  const tearzHalf = useSharedValue(16);

  // Сцена меньше и ниже — «за» надписью.
  const cityH = Math.max(28, Math.round(box.h * 0.38));
  const cityW = Math.round(cityH * (1600 / 280));
  const tearzSize = Math.max(26, Math.min(52, Math.round(box.h * 0.42)));

  const titleFontSize = useMemo(() => {
    // Крупнее и шире — почти на всю ширину CRT.
    const byH = box.h * (locale === 'zh' ? 0.36 : 0.34);
    const byW =
      locale === 'zh'
        ? (box.w * 0.98) / Math.max(2, pressLabel.length)
        : (box.w * 1.05) / Math.max(3, pressLabel.length);
    return Math.max(18, Math.min(48, Math.round(Math.min(byH, byW))));
  }, [box.h, box.w, locale, pressLabel]);

  const titleW = Math.min(box.w * 0.98, Math.max(100, box.w * 0.94));
  const depth = Math.max(3, Math.round(titleFontSize * 0.22));
  const titleH = Math.max(26, Math.round(titleFontSize * 1.2 + depth));
  const titleTop = box.h * 0.04;
  const titleFontFamily =
    locale === 'zh' ? undefined : Platform.OS === 'ios' ? 'Menlo' : 'monospace';
  const titleLetterSpacing = locale === 'zh' ? 2 : 2.2;
  /** Горизонтальное растяжение букв */
  const titleStretchX = locale === 'zh' ? 1.12 : 1.18;

  // Слои экструзии 3D (назад-вниз-вправо).
  const depthLayers = useMemo(() => {
    const layers: { ox: number; oy: number; color: string }[] = [];
    for (let i = depth; i >= 1; i -= 1) {
      const t = i / depth;
      const shade = Math.round(70 + 40 * (1 - t));
      layers.push({
        ox: i,
        oy: i,
        color: `rgb(${shade},${Math.round(shade * 0.12)},${Math.round(shade * 0.18)})`,
      });
    }
    return layers;
  }, [depth]);

  useEffect(() => {
    cityX.value = 0;
    cityX.value = withRepeat(
      withTiming(-cityW, { duration: CITY_LOOP_MS, easing: Easing.linear }),
      -1,
      false,
    );

    // Низкая плоская орбита: максимум за надписью, низ — по городу. Без залёта вверх.
    const groundYLocal = box.h * 0.58;
    const topY = titleTop + titleH * 0.5;
    const botY = Math.min(box.h - tearzSize * 0.85, groundYLocal + cityH * 0.12);
    orbitCx.value = box.w / 2;
    orbitCy.value = (topY + botY) / 2;
    orbitRy.value = Math.max(6, (botY - topY) / 2);
    orbitRx.value = Math.max(titleW * 0.22, box.w * 0.18);
    tearzHalf.value = tearzSize / 2;
    orbit.value = 0;
    orbit.value = withRepeat(
      withTiming(Math.PI * 2, { duration: ORBIT_MS, easing: Easing.linear }),
      -1,
      false,
    );

    titlePulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 400, easing: Easing.steps(1) }),
        withTiming(1, { duration: 700 }),
        withTiming(0.9, { duration: 400, easing: Easing.steps(1) }),
        withTiming(0.9, { duration: 700 }),
      ),
      -1,
      false,
    );
  }, [
    box.h,
    box.w,
    cityW,
    cityX,
    orbit,
    orbitCx,
    orbitCy,
    orbitRx,
    orbitRy,
    tearzHalf,
    tearzSize,
    titleH,
    titlePulse,
    titleTop,
    titleW,
    cityH,
  ]);

  const cityStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: snapPx(cityX.value, PX_CITY) }],
  }));
  const tearzStyle = useAnimatedStyle(() => {
    // Дискретный угол — Tearz «перепрыгивает» по кадрам орбиты.
    const raw = orbit.value;
    const step = (Math.PI * 2) / ORBIT_STEPS;
    const a = Math.round(raw / step) * step;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const x = orbitCx.value + cos * orbitRx.value - tearzHalf.value;
    const y = orbitCy.value + sin * orbitRy.value - tearzHalf.value;
    // Боб крошечный — не вылезает выше орбиты.
    const bob = snapPx(Math.sin(a * 2) * 1.5, PX_TEARZ);
    const facing = cos >= 0 ? 1 : -1;
    return {
      zIndex: 8,
      transform: [
        { translateX: snapPx(x, PX_TEARZ) },
        { translateY: snapPx(y + bob, PX_TEARZ) },
        { scaleX: facing },
      ],
    };
  });
  const titleStyle = useAnimatedStyle(() => {
    // Пульс в 2 ступени — без плавного «дыхания».
    const on = titlePulse.value >= 0.95;
    const pulse = on ? 1 : 0.94;
    return {
      opacity: on ? 1 : 0.88,
      transform: [{ scaleX: titleStretchX * pulse }, { scaleY: pulse }],
    };
  });

  const groundY = box.h * 0.58;

  return (
    <View
      style={styles.root}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 8 && height > 8) setBox({ w: width, h: height });
      }}>
      {/* Фон-сцена — позади надписи */}
      <Animated.View
        style={[
          styles.cityTrack,
          { top: groundY, height: cityH, width: cityW * 2 },
          cityStyle,
        ]}>
        <Image source={CITY} style={{ width: cityW, height: cityH }} contentFit="fill" transition={0} />
        <Image source={CITY} style={{ width: cityW, height: cityH }} contentFit="fill" transition={0} />
      </Animated.View>

      <Animated.View
        style={[
          styles.tearz,
          {
            width: tearzSize,
            height: tearzSize,
          },
          tearzStyle,
        ]}>
        <Image
          source={TEARZ_FLY}
          style={styles.fill}
          contentFit="contain"
          transition={0}
          cachePolicy="memory-disk"
        />
      </Animated.View>

      {/* 3D-надпись — герой, поверх сцены */}
      <Animated.View
        style={[
          styles.titleWrap,
          {
            top: titleTop,
            width: titleW,
            height: titleH,
            marginLeft: -titleW / 2,
          },
          titleStyle,
        ]}>
        <View style={styles.titleStack}>
          {depthLayers.map((layer, i) => (
            <Text
              key={`d-${i}`}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
              style={[
                styles.titleText,
                styles.titleLayer,
                {
                  fontFamily: titleFontFamily,
                  letterSpacing: titleLetterSpacing,
                  fontSize: titleFontSize,
                  lineHeight: Math.round(titleFontSize * 1.05),
                  color: layer.color,
                  transform: [{ translateX: layer.ox }, { translateY: layer.oy }],
                },
              ]}>
              {pressLabel}
            </Text>
          ))}
          {/* Тонкая жёлтая кромка лица */}
          {[
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ].map(([ox, oy], i) => (
            <Text
              key={`o-${i}`}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
              style={[
                styles.titleText,
                styles.titleLayer,
                {
                  fontFamily: titleFontFamily,
                  letterSpacing: titleLetterSpacing,
                  fontSize: titleFontSize,
                  lineHeight: Math.round(titleFontSize * 1.05),
                  color: hintColor,
                  opacity: 0.9,
                  transform: [{ translateX: ox }, { translateY: oy }],
                },
              ]}>
              {pressLabel}
            </Text>
          ))}
          <Text
            key={locale}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
            style={[
              styles.titleText,
              {
                fontFamily: titleFontFamily,
                letterSpacing: titleLetterSpacing,
                fontSize: titleFontSize,
                lineHeight: Math.round(titleFontSize * 1.05),
                color: '#E31B2E',
              },
            ]}>
            {pressLabel}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  cityTrack: {
    position: 'absolute',
    left: 0,
    flexDirection: 'row',
    zIndex: 1,
    opacity: 0.92,
  },
  tearz: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  titleWrap: {
    position: 'absolute',
    left: '50%',
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleStack: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    width: '100%',
    textAlign: 'center',
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  titleLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  fill: {
    width: '100%',
    height: '100%',
  },
});
