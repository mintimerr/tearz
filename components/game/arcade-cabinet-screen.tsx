import * as Haptics from 'expo-haptics';
import { Image, type ImageSource } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameBackButton } from '@/components/game/game-back-button';
import { GameTeacherChatsButton } from '@/components/game/game-teacher-chats-button';
import { TeacherChatsSheet } from '@/components/teacher/teacher-chats-sheet';
import { TearzLessonTransit } from '@/components/teacher/tearz-flight-loading';
import { getTerminalTheme, type TerminalThemeConfig } from '@/constants/terminal-theme';
import {
  getTerminalLocation,
  type TerminalLocationId,
  type TerminalNormRect,
} from '@/constants/terminal-locations';
import { useEngagement } from '@/contexts/engagement-context';
import { useTranslation } from '@/contexts/locale-context';
import { inferTeacherLessonLanguage } from '@/utils/teacher-lesson-language';

const SCENE_ASPECT = 1024 / 1536;
const ZOOM_MS = 600;
const ZOOM_EASING = Easing.bezier(0.22, 1, 0.36, 1);

function useCoverLayout(
  crt: TerminalNormRect,
  focus: TerminalNormRect,
  /** booth: зум так, чтобы CRT целиком влез в экран (cover по стеклу) */
  fillCrt = false,
) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return useMemo(() => {
    const screenAspect = screenW / screenH;
    let drawW: number;
    let drawH: number;
    let drawLeft: number;
    let drawTop: number;

    if (screenAspect > SCENE_ASPECT) {
      drawW = screenW;
      drawH = screenW / SCENE_ASPECT;
      drawLeft = 0;
      drawTop = (screenH - drawH) / 2;
    } else {
      drawH = screenH;
      drawW = screenH * SCENE_ASPECT;
      drawLeft = (screenW - drawW) / 2;
      drawTop = 0;
    }

    const toBox = (r: TerminalNormRect) => ({
      left: drawLeft + drawW * r.left,
      top: drawTop + drawH * r.top,
      width: drawW * r.width,
      height: drawH * r.height,
    });

    const crtBox = toBox(crt);
    const focusCx = fillCrt
      ? crtBox.left + crtBox.width / 2
      : drawLeft + drawW * (focus.left + focus.width / 2);
    const focusCy = fillCrt
      ? crtBox.top + crtBox.height / 2
      : drawTop + drawH * (focus.top + focus.height / 2);
    const focusW = drawW * focus.width;
    const focusH = drawH * focus.height;

    const padTop = insets.top + 36;
    const padBottom = Math.max(insets.bottom, 10) + 8;
    const safeW = screenW - 16;
    const safeH = screenH - padTop - padBottom;
    /**
     * fillCrt: вписываем стекло в safe-area.
     * London (панель аппарата ~3–4×) — cover ~78%; крошечный LCD — сильнее запас.
     */
    const crtFit = Math.min(safeW / crtBox.width, safeH / crtBox.height);
    const fillPad = crtFit > 5 ? 0.7 : crtFit > 3.2 ? 0.78 : 0.88;
    const fit = fillCrt
      ? crtFit
      : Math.min(safeW / focusW, safeH / focusH, 2.55);
    /** focus: чуть плотнее среднего плана (не улица, не «в упор») */
    const zoomScale = Math.max(fit * (fillCrt ? fillPad : 0.9), 1.45);

    return {
      screenW,
      screenH,
      drawLeft,
      drawTop,
      drawW,
      drawH,
      crtBox,
      focusCx,
      focusCy,
      zoomScale,
      toBox,
    };
  }, [crt, fillCrt, focus, insets.bottom, insets.top, screenH, screenW]);
}

function SunlightShimmer({
  style,
  phase = 0,
}: {
  style?: StyleProp<ViewStyle>;
  phase?: number;
}) {
  const glow = useSharedValue(0.2);

  useEffect(() => {
    glow.value = withRepeat(
      withSequence(
        withTiming(0.42 + (phase % 3) * 0.04, {
          duration: 2200 + phase * 200,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(0.15, { duration: 280 }),
        withTiming(0.32, {
          duration: 1800 + phase * 160,
          easing: Easing.inOut(Easing.quad),
        }),
      ),
      -1,
      false,
    );
  }, [glow, phase]);

  const anim = useAnimatedStyle(() => ({ opacity: glow.value }));
  const tint =
    phase % 2 === 0 ? 'rgba(255, 248, 210, 0.35)' : 'rgba(255, 255, 255, 0.28)';

  return (
    <Animated.View
      style={[styles.neonBlob, { backgroundColor: tint }, style, anim]}
      pointerEvents="none"
    />
  );
}

function LcdGlare() {
  const drift = useSharedValue(0);

  useEffect(() => {
    drift.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [drift]);

  const glareStyle = useAnimatedStyle(() => ({
    opacity: interpolate(drift.value, [0, 0.5, 1], [0.08, 0.18, 0.1]),
    transform: [{ translateX: interpolate(drift.value, [0, 1], [-6, 10]) }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, glareStyle]} pointerEvents="none">
      <View style={styles.lcdGlareBand} />
    </Animated.View>
  );
}

function BoothGlow() {
  const drift = useSharedValue(0);

  useEffect(() => {
    drift.value = withRepeat(
      withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [drift]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(drift.value, [0, 0.5, 1], [0.22, 0.4, 0.25]),
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, glowStyle]} pointerEvents="none">
      <View style={styles.boothGlowCore} />
      <View style={styles.boothGlowRing} />
    </Animated.View>
  );
}

/** Стекло Navigo LCD: мягкий блик + виньетка, без неонового пульса */
function MetroGlow() {
  const drift = useSharedValue(0);

  useEffect(() => {
    drift.value = withRepeat(
      withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [drift]);

  const glareStyle = useAnimatedStyle(() => ({
    opacity: interpolate(drift.value, [0, 0.5, 1], [0.1, 0.18, 0.12]),
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.metroGlassFill} />
      <View style={styles.metroVignette} />
      <Animated.View style={[styles.metroSpecular, glareStyle]} />
    </View>
  );
}

/** Shanghai LCD: как Navigo — лёгкий тинт стекла, без непрозрачного «квадрата» поверх арта */
function ShanghaiGlow() {
  const drift = useSharedValue(0);

  useEffect(() => {
    drift.value = withRepeat(
      withTiming(1, { duration: 5600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [drift]);

  const glareStyle = useAnimatedStyle(() => ({
    opacity: interpolate(drift.value, [0, 0.5, 1], [0.06, 0.12, 0.07]),
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.shanghaiGlassFill} />
      <Animated.View style={[styles.shanghaiSpecular, glareStyle]} />
    </View>
  );
}

function NeonFlicker({
  style,
  phase = 0,
}: {
  style?: StyleProp<ViewStyle>;
  phase?: number;
}) {
  const glow = useSharedValue(0.35);

  useEffect(() => {
    glow.value = withRepeat(
      withSequence(
        withTiming(0.75 + (phase % 3) * 0.05, {
          duration: 900 + phase * 180,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(0.25, { duration: 140 }),
        withTiming(0.55, { duration: 220 }),
        withTiming(0.2 + phase * 0.04, {
          duration: 1100 + phase * 120,
          easing: Easing.inOut(Easing.quad),
        }),
      ),
      -1,
      false,
    );
  }, [glow, phase]);

  const anim = useAnimatedStyle(() => ({ opacity: glow.value }));
  const tint =
    phase % 3 === 0
      ? 'rgba(255, 90, 40, 0.26)'
      : phase % 3 === 1
        ? 'rgba(255, 40, 120, 0.2)'
        : 'rgba(255, 200, 80, 0.18)';

  return (
    <Animated.View
      style={[styles.neonBlob, { backgroundColor: tint }, style, anim]}
      pointerEvents="none"
    />
  );
}

/**
 * Пасхалка: спрайт кнопки вдавливается в лунку панели.
 * Круглые (аркада) — scale внутрь; прямоугольные (ATM) — только вниз,
 * без сжатия, иначе «криво» на мелких клавишах.
 */
function ArcadeCabButton({
  sprite,
  box,
  onPress,
  square = false,
}: {
  sprite: ImageSource;
  box: { left: number; top: number; width: number; height: number };
  onPress?: () => void;
  /** Прямоугольные клавиши ATM — без круглого клипа */
  square?: boolean;
}) {
  const press = useSharedValue(0);

  const left = Math.round(box.left);
  const top = Math.round(box.top);
  const width = Math.max(8, Math.round(box.width));
  const height = Math.max(8, Math.round(box.height));
  const sink = square
    ? Math.max(2, Math.min(3, Math.round(height * 0.28)))
    : Math.max(2, Math.round(height * 0.22));

  const faceStyle = useAnimatedStyle(() => {
    const p = press.value;
    if (square) {
      return {
        transform: [{ translateY: p * sink }],
      };
    }
    return {
      transform: [
        { translateY: p * sink },
        { scale: 1 - p * 0.22 },
      ],
    };
  });

  const bump = () => {
    press.value = withSequence(
      withTiming(1, { duration: 55, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 120 }),
      withTiming(0, { duration: 160, easing: Easing.out(Easing.cubic) }),
    );
    onPress?.();
  };

  return (
    <Pressable
      onPress={bump}
      hitSlop={square ? 10 : 14}
      style={[
        styles.cabBtnHole,
        square && styles.cabBtnHoleSquare,
        { left, top, width, height },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Кнопка автомата">
      <Animated.View style={[styles.cabBtnFace, faceStyle]} pointerEvents="none">
        <Image
          source={sprite}
          style={{ width, height }}
          contentFit="fill"
          transition={0}
        />
      </Animated.View>
    </Pressable>
  );
}

function CrtScanlines() {
  const scan = useSharedValue(0);
  const flicker = useSharedValue(1);

  useEffect(() => {
    scan.value = withRepeat(withTiming(1, { duration: 2800, easing: Easing.linear }), -1, false);
    flicker.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800 }),
        withTiming(0.82, { duration: 60 }),
        withTiming(1, { duration: 90 }),
        withTiming(0.9, { duration: 40 }),
        withTiming(1, { duration: 1200 }),
      ),
      -1,
      false,
    );
  }, [flicker, scan]);

  const scanStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(scan.value, [0, 1], [-20, 40]) }],
    opacity: interpolate(scan.value, [0, 0.5, 1], [0.12, 0.28, 0.1]),
  }));

  const glassStyle = useAnimatedStyle(() => ({ opacity: flicker.value }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, glassStyle]} pointerEvents="none">
      <View style={styles.crtVignette} />
      <Animated.View style={[styles.crtScanBand, scanStyle]} />
      {Array.from({ length: 8 }, (_, i) => (
        <View key={i} style={[styles.crtLine, { top: `${8 + i * 12}%` }]} />
      ))}
    </Animated.View>
  );
}

/**
 * Терминал без UI-хрома: тап по автомату → зум,
 * даблтап / тап в пустоту → отдалить. На экране — подсказка + предложения.
 */
export function ArcadeCabinetScreen() {
  const params = useLocalSearchParams<{ location?: string }>();
  const location = getTerminalLocation((params.location as TerminalLocationId) || 'asia_arcade');
  const theme = getTerminalTheme(location.theme);
  const isLcd = theme.id === 'lcd';
  const isBooth = theme.id === 'booth';
  const isMetro = theme.id === 'metro';
  const isShanghai = theme.id === 'shanghai';
  const isCallbox = theme.id === 'callbox';
  /** Компактный glass-UI (Paris / Shanghai / London phone LCD) */
  const isGlassUi = isMetro || isShanghai || isCallbox;
  /** Днём ATM/Paris/Shanghai/London не крутим; booth/аркада — лёгкий night sway */
  const freezeCamera =
    (isLcd && location.id === 'europe_atm') ||
    (isMetro && location.id === 'paris_metro_guimard') ||
    (isShanghai && location.id === 'shanghai_metro_bund') ||
    (isCallbox && location.id === 'uk_phone_box') ||
    (isBooth && location.id === 'seoul_photo_booth');
  const fillCrt = location.zoomFill === 'crt';
  /** UI всегда на CRT/LCD локации — без нижней плашки */
  const floatTerminalUi = false;

  const crt = location.crt ?? { left: 0.40039, top: 0.47461, width: 0.23145, height: 0.13216 };
  const focus = location.focus ?? { left: 0.34, top: 0.46, width: 0.34, height: 0.26 };
  const suggestions = location.suggestions ?? ['English for airport', '点餐 · заказать еду', '旅行の会話'];
  const phosphor = location.phosphor ?? theme.screenBg;
  const scene = location.scene!;
  const neonZones = location.neon ?? [];
  const cabButtons = location.buttons ?? [];
  const cabButtonSprites = location.buttonSprites ?? [];
  const idleCam = location.cameraIdle ?? {};
  const idlePanXNorm = idleCam.panX ?? 0;
  const idlePanYNorm = idleCam.panY ?? 0;
  const idleScale = idleCam.scale ?? 1;

  const { recordActivity } = useEngagement();
  const inputRef = useRef<TextInput>(null);
  /** true только при намеренном zoomOut — иначе возвращаем фокус после случайного blur */
  const dismissKeyboardRef = useRef(false);
  const layout = useCoverLayout(crt, focus, fillCrt);

  const [query, setQuery] = useState('');
  const [zoomed, setZoomed] = useState(false);
  /** idle → кино-переход (небо → диалог) */
  const [gate, setGate] = useState<'idle' | 'transit'>('idle');
  const [chatsOpen, setChatsOpen] = useState(false);
  const [seed, setSeed] = useState('');
  const [focused, setFocused] = useState(false);

  const zoom = useSharedValue(idleScale);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const sway = useSharedValue(0);
  const drift = useSharedValue(0);
  const breathe = useSharedValue(0);
  const zoomedSv = useSharedValue(0);

  const typing = query.trim().length > 0;
  /** Shanghai / Seoul: только TAP → тап → строка ввода; остальным — подсказки пока пусто */
  const tapOnlyUi = isShanghai || isBooth;
  const showHints = tapOnlyUi ? !focused && !typing : !typing;

  useEffect(() => {
    sway.value = withRepeat(
      withTiming(1, { duration: 4800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    drift.value = withRepeat(
      withTiming(1, { duration: 7200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    breathe.value = withRepeat(
      withTiming(1, { duration: 5600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [breathe, drift, sway]);

  const applyCamera = (inZoom: boolean) => {
    const scale = inZoom ? layout.zoomScale : idleScale;
    const idleX = layout.screenW * idlePanXNorm;
    const idleY = layout.screenH * idlePanYNorm;
    /**
     * Зум через transformOrigin на центре CRT (см. cameraStyle).
     * pan в зуме почти 0 — только лёгкий подъём, чтобы LCD не уезжал под keyboard.
     */
    const tx = inZoom ? 0 : idleX;
    const ty = inZoom && fillCrt ? -Math.min(layout.screenH * 0.04, 28) : idleY;
    zoomedSv.value = withTiming(inZoom ? 1 : 0, { duration: ZOOM_MS, easing: ZOOM_EASING });
    zoom.value = withTiming(scale, { duration: ZOOM_MS, easing: ZOOM_EASING });
    panX.value = withTiming(tx, { duration: ZOOM_MS, easing: ZOOM_EASING });
    panY.value = withTiming(ty, { duration: ZOOM_MS, easing: ZOOM_EASING });
  };

  useEffect(() => {
    if (zoomed) {
      applyCamera(true);
      return;
    }
    panX.value = layout.screenW * idlePanXNorm;
    panY.value = layout.screenH * idlePanYNorm;
    zoom.value = idleScale;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync camera to layout / zoom flag
  }, [idlePanXNorm, idlePanYNorm, idleScale, layout.focusCx, layout.focusCy, layout.screenH, layout.screenW, layout.zoomScale, zoomed]);

  const openCrt = () => {
    if (zoomed) {
      inputRef.current?.focus();
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setZoomed(true);
    applyCamera(true);
    // Shanghai / Seoul: сначала TAP на LCD; клавиатура — вторым тапом
    if (!isShanghai && !isBooth) {
      setTimeout(() => inputRef.current?.focus(), ZOOM_MS + 40);
    }
  };

  const zoomOut = () => {
    dismissKeyboardRef.current = true;
    Keyboard.dismiss();
    setFocused(false);
    setZoomed(false);
    applyCamera(false);
    setTimeout(() => {
      dismissKeyboardRef.current = false;
    }, 320);
  };

  /** Тап в пустоту (не по CRT) — только отдалить, без кнопок. */
  const onBlankTap = () => {
    if (!zoomed) return;
    void Haptics.selectionAsync();
    zoomOut();
  };

  const pickSuggestion = (s: string) => {
    setQuery(s);
    void Haptics.selectionAsync();
    openCrt();
  };

  const submit = () => {
    const q = query.trim();
    if (!q || gate !== 'idle') return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    recordActivity({ kind: 'message', messagePreview: q, lessonTopic: q.slice(0, 48) });
    setSeed(q);
    Keyboard.dismiss();
    // Сразу небо — без пана камеры в пустоту над сценой автомата
    setGate('transit');
  };

  const closeChat = () => {
    setGate('idle');
    setSeed('');
    setQuery('');
    zoomOut();
  };

  const cameraStyle = useAnimatedStyle(() => {
    const ambient = interpolate(zoomedSv.value, [0, 1], [1, 0.22]);
    const swayAmt = freezeCamera ? 0.55 : 1;
    const x =
      panX.value +
      (interpolate(sway.value, [0, 1], [-2.8, 2.8]) +
        interpolate(drift.value, [0, 1], [-1.4, 1.4])) *
        ambient *
        swayAmt;
    const y =
      panY.value +
      (interpolate(sway.value, [0, 1], [0, 2.2]) + interpolate(drift.value, [0, 1], [0.3, -0.7])) *
        ambient *
        swayAmt;
    // На дневном ATM не крутим камеру — иначе UI «плывёт» относительно безеля
    const rot = freezeCamera
      ? 0
      : (interpolate(sway.value, [0, 1], [-0.35, 0.35]) +
          interpolate(drift.value, [0, 1], [-0.14, 0.14])) *
        ambient;
    const scale =
      zoom.value *
      interpolate(breathe.value, [0, 1], [1.02, freezeCamera || fillCrt ? 1.02 : 1.038]);
    /** Idle: центр экрана; zoom: центр CRT — иначе мелкий LCD улетает в небо */
    const originX = interpolate(zoomedSv.value, [0, 1], [layout.screenW / 2, layout.focusCx]);
    const originY = interpolate(zoomedSv.value, [0, 1], [layout.screenH / 2, layout.focusCy]);
    return {
      transformOrigin: [originX, originY],
      transform: [{ scale }, { translateX: x }, { translateY: y }, { rotate: `${rot}deg` }],
    };
  });

  const chromeTone = theme.chromeDark ? 'dark' : 'light';

  return (
    <View style={[styles.root, { backgroundColor: theme.rootBg }]}>
      <Animated.View
        style={[
          styles.cameraLayer,
          { width: layout.screenW, height: layout.screenH, zIndex: 1 },
          cameraStyle,
        ]}
        pointerEvents="box-none">
        {/* Пустота сцены — тап/даблтап отдаляет */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onBlankTap} />

        <Image
          source={scene}
          style={[
            styles.scene,
            {
              left: layout.drawLeft,
              top: layout.drawTop,
              width: layout.drawW,
              height: layout.drawH,
            },
          ]}
          contentFit="fill"
          pointerEvents="none"
        />

        {neonZones.map((zone, i) => {
          const box = layout.toBox(zone);
          const Ambient = freezeCamera ? SunlightShimmer : NeonFlicker;
          return (
            <Ambient
              key={`ambient-${i}`}
              phase={i}
              style={{
                left: box.left,
                top: box.top,
                width: box.width,
                height: box.height,
              }}
            />
          );
        })}

        {cabButtons.map((btn, i) => {
          const sprite = cabButtonSprites[i];
          if (sprite == null) return null;
          const box = layout.toBox(btn);
          return (
            <ArcadeCabButton
              key={`btn-${i}`}
              sprite={sprite}
              box={box}
              square={isLcd}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            />
          );
        })}

        <View
          style={[
            styles.crtGlass,
            isBooth && styles.crtGlassBooth,
            isGlassUi && styles.crtGlassMetro,
            isShanghai && styles.crtGlassShanghai,
            {
              left: layout.crtBox.left,
              top: layout.crtBox.top,
              width: layout.crtBox.width,
              height: layout.crtBox.height,
              backgroundColor: phosphor,
              opacity: floatTerminalUi && zoomed ? 0.22 : 1,
            },
          ]}
          pointerEvents={floatTerminalUi && zoomed ? 'none' : 'auto'}>
          {theme.scanlines ? (
            <CrtScanlines />
          ) : isBooth ? (
            <BoothGlow />
          ) : isShanghai ? (
            <ShanghaiGlow />
          ) : isGlassUi ? (
            <MetroGlow />
          ) : null}
          {/* Pressable вокруг TextInput на iOS срывает клавиатуру при ререндере — после зума только View */}
          {!(floatTerminalUi && zoomed) ? (
            zoomed ? (
              <View
                style={[
                  styles.crtHit,
                  isLcd && styles.crtHitLcd,
                  isBooth && styles.crtHitBooth,
                  isGlassUi && styles.crtHitMetro,
                  isShanghai && styles.crtHitShanghai,
                ]}>
                <TerminalFace
                  theme={theme}
                  query={query}
                  setQuery={setQuery}
                  inputRef={inputRef}
                  showHints={showHints}
                  suggestions={suggestions}
                  active
                  keepKeyboard
                  dismissKeyboardRef={dismissKeyboardRef}
                  onOpen={openCrt}
                  onPick={pickSuggestion}
                  onSubmit={submit}
                  setFocused={setFocused}
                />
              </View>
            ) : (
              <Pressable
                style={[
                  styles.crtHit,
                  isLcd && styles.crtHitLcd,
                  isBooth && styles.crtHitBooth,
                  isGlassUi && styles.crtHitMetro,
                  isShanghai && styles.crtHitShanghai,
                ]}
                onPress={openCrt}>
                <TerminalFace
                  theme={theme}
                  query={query}
                  setQuery={setQuery}
                  inputRef={inputRef}
                  showHints={showHints}
                  suggestions={suggestions}
                  active={false}
                  keepKeyboard={false}
                  dismissKeyboardRef={dismissKeyboardRef}
                  onOpen={openCrt}
                  onPick={pickSuggestion}
                  onSubmit={submit}
                  setFocused={setFocused}
                />
              </Pressable>
            )
          ) : null}
        </View>

        {/* Панель автомата тоже открывает CRT */}
        <Pressable
          style={[
            styles.panelHit,
            {
              left: layout.drawLeft + layout.drawW * focus.left,
              top: layout.drawTop + layout.drawH * (focus.top + focus.height * 0.55),
              width: layout.drawW * focus.width,
              height: layout.drawH * focus.height * 0.4,
            },
          ]}
          onPress={openCrt}
        />
      </Animated.View>

      {/*
        Chrome выше камеры по zIndex: при fillCrt-зуме (Seoul/Paris/London)
        transform на cameraLayer иначе рисуется поверх кнопок.
      */}
      {gate !== 'transit' ? (
        <View style={styles.chrome} pointerEvents="box-none">
          <GameBackButton tone={chromeTone} />
          <GameTeacherChatsButton tone={chromeTone} onPress={() => setChatsOpen(true)} />
        </View>
      ) : null}

      {floatTerminalUi && zoomed ? (
        <View style={[styles.callboxOverlay, isBooth && styles.boothOverlay]} pointerEvents="box-none">
          <View style={[styles.callboxPanel, isBooth && styles.boothPanel]}>
            <TerminalFace
              theme={theme}
              query={query}
              setQuery={setQuery}
              inputRef={inputRef}
              showHints={showHints}
              suggestions={suggestions}
              active
              keepKeyboard
              dismissKeyboardRef={dismissKeyboardRef}
              onOpen={openCrt}
              onPick={pickSuggestion}
              onSubmit={submit}
              setFocused={setFocused}
            />
          </View>
        </View>
      ) : null}

      <TeacherChatsSheet visible={chatsOpen} onClose={() => setChatsOpen(false)} />

      {gate === 'transit' && seed ? (
        <Modal
          visible
          animationType="none"
          presentationStyle="fullScreen"
          onRequestClose={closeChat}>
          <TearzLessonTransit
            question={seed}
            language={inferTeacherLessonLanguage(seed, location.lessonLanguage ?? 'english')}
            onClose={closeChat}
          />
        </Modal>
      ) : null}
    </View>
  );
}

type FaceProps = {
  theme: TerminalThemeConfig;
  query: string;
  setQuery: (v: string) => void;
  inputRef: React.RefObject<TextInput | null>;
  showHints: boolean;
  suggestions: string[];
  /** true после полного зума — тогда UI заполняет весь CRT */
  active: boolean;
  keepKeyboard: boolean;
  dismissKeyboardRef: React.RefObject<boolean>;
  onOpen: () => void;
  onPick: (s: string) => void;
  onSubmit: () => void;
  setFocused: (v: boolean) => void;
};

function TerminalFace({
  theme,
  query,
  setQuery,
  inputRef,
  showHints,
  suggestions,
  active,
  keepKeyboard,
  dismissKeyboardRef,
  onOpen,
  onPick,
  onSubmit,
  setFocused,
}: FaceProps) {
  const { t } = useTranslation();
  const blink = useSharedValue(1);
  const pulse = useSharedValue(0.55);

  useEffect(() => {
    blink.value = withRepeat(
      withSequence(withTiming(1, { duration: 420 }), withTiming(0, { duration: 420 })),
      -1,
      false,
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.45, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
  }, [blink, pulse]);

  const cursorStyle = useAnimatedStyle(() => ({ opacity: blink.value }));
  const hintStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  // До зума — только короткая приманка; полный UI после заполнения экрана
  if (!active) {
    return (
      <View style={styles.terminalIdle}>
        <Animated.Text style={[styles.idleHint, { color: theme.hot }, hintStyle]}>
          {t('terminal.idleTap')}
        </Animated.Text>
      </View>
    );
  }

  const lcd = theme.id === 'lcd';
  const booth = theme.id === 'booth';
  const metro = theme.id === 'metro';
  const shanghai = theme.id === 'shanghai';
  const callbox = theme.id === 'callbox';
  const glass = metro || shanghai || callbox;
  const tapOnly = shanghai || booth;
  const startHint = tapOnly ? t('terminal.idleTap') : t('terminal.startHint');

  return (
    <View
      style={[
        styles.terminal,
        styles.terminalMenu,
        lcd && styles.terminalMenuLcd,
        booth && styles.terminalMenuBooth,
        glass && styles.terminalMenuMetro,
        shanghai && styles.terminalMenuShanghai,
        booth && styles.terminalMenuTapOnly,
      ]}>
      {/* Меню — только opacity; поле ввода всегда в одном и том же слое */}
      <View
        style={[
          styles.menuLayer,
          booth && styles.menuLayerBooth,
          glass && styles.menuLayerMetro,
          tapOnly && styles.menuLayerTapOnly,
          !showHints && styles.menuLayerHidden,
        ]}
        pointerEvents={showHints ? 'box-none' : 'none'}>
        {tapOnly ? (
          <Pressable
            onPress={onOpen}
            style={styles.tapOnlyHit}
            accessibilityRole="button"
            accessibilityLabel={startHint}>
            <Animated.Text
              style={[
                styles.tapHint,
                shanghai && styles.tapHintShanghai,
                booth && styles.tapHintBoothTap,
                { color: theme.hot },
                hintStyle,
              ]}>
              {startHint}
            </Animated.Text>
          </Pressable>
        ) : (
          <>
            {glass ? <View style={styles.metroHairline} /> : null}
            <Animated.Text
              style={[
                styles.tapHint,
                lcd && styles.tapHintLcd,
                booth && styles.tapHintBooth,
                glass && styles.tapHintMetro,
                { color: glass ? theme.dim : theme.hot },
                hintStyle,
              ]}>
              {startHint}
            </Animated.Text>
            <View
              style={[
                styles.menuCol,
                lcd && styles.menuColLcd,
                booth && styles.menuColBooth,
                glass && styles.menuColMetro,
              ]}>
              {suggestions.map((s, i) => (
                <Pressable
                  key={s}
                  onPress={() => onPick(s)}
                  style={({ pressed }) => [
                    styles.menuItem,
                    lcd && styles.menuItemLcd,
                    booth && styles.menuItemBooth,
                    glass && styles.menuItemMetro,
                    callbox && styles.menuItemCallbox,
                    pressed && (glass ? styles.menuItemMetroOn : styles.menuItemOn),
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={s}>
                  <Text
                    style={[
                      styles.menuIndex,
                      lcd && styles.menuIndexLcd,
                      booth && styles.menuIndexBooth,
                      glass && styles.menuIndexMetro,
                      { color: glass ? theme.dim : theme.hot },
                    ]}>
                    {booth ? '✦' : glass ? String(i + 1).padStart(2, '0') : i + 1}
                  </Text>
                  <Text
                    style={[
                      styles.menuText,
                      lcd && styles.menuTextLcd,
                      booth && styles.menuTextBooth,
                      glass && styles.menuTextMetro,
                      { color: theme.fg },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}>
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>

      <View
        style={[
          styles.inputLayer,
          tapOnly && styles.inputLayerTapOnly,
          showHints && styles.inputLayerHidden,
        ]}
        pointerEvents={showHints ? 'none' : 'auto'}>
        <View
          style={[
            styles.cmdBlock,
            styles.cmdBlockGrow,
            booth && styles.cmdBlockBooth,
            glass && styles.cmdBlockMetro,
            tapOnly && styles.cmdBlockTapOnly,
            shanghai && styles.cmdBlockShanghaiType,
          ]}>
          {!tapOnly && theme.prompt ? (
            <Text
              style={[
                styles.prompt,
                booth && styles.promptBooth,
                glass && styles.promptMetro,
                { color: glass ? theme.dim : theme.hot },
              ]}>
              {theme.prompt}
            </Text>
          ) : null}
          <View
            style={[
              styles.inputCol,
              styles.inputColGrow,
              glass && styles.inputColMetro,
              shanghai && styles.inputColShanghai,
              booth && styles.inputColBoothTap,
              shanghai && styles.inputColShanghaiType,
            ]}>
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              placeholder=""
              placeholderTextColor={theme.dim}
              style={[
                styles.input,
                lcd && styles.inputLcd,
                booth && styles.inputBooth,
                glass && styles.inputMetro,
                shanghai && styles.inputShanghai,
                booth && styles.inputBoothTap,
                (callbox || booth) && !tapOnly && styles.inputCallbox,
                shanghai && styles.inputShanghaiType,
                { color: tapOnly ? theme.hot : theme.fg },
                styles.inputFill,
                shanghai && styles.inputFillShanghai,
              ]}
              maxLength={100}
              multiline={shanghai || !tapOnly}
              textAlignVertical={shanghai ? 'top' : 'center'}
              returnKeyType="go"
              blurOnSubmit
              underlineColorAndroid="transparent"
              onFocus={() => {
                setFocused(true);
                onOpen();
              }}
              onBlur={() => {
                setFocused(false);
                if (keepKeyboard && !dismissKeyboardRef.current) {
                  requestAnimationFrame(() => inputRef.current?.focus());
                }
              }}
              onSubmitEditing={onSubmit}
              selectionColor={theme.selection}
              cursorColor={tapOnly ? theme.hot : theme.fg}
              caretHidden={!shanghai}
            />
            {!query ? (
              <Animated.Text
                style={[
                  styles.underscore,
                  booth && styles.underscoreBooth,
                  glass && styles.underscoreMetro,
                  tapOnly && styles.underscoreTapOnly,
                  shanghai && styles.underscoreShanghaiType,
                  { color: tapOnly ? theme.hot : glass ? theme.dim : theme.fg },
                  cursorStyle,
                ]}>
                {booth && !tapOnly ? '▌' : '_'}
              </Animated.Text>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  cameraLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  chrome: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
  },
  scene: {
    position: 'absolute',
  },
  neonBlob: {
    position: 'absolute',
    borderRadius: 80,
    backgroundColor: 'rgba(255, 120, 60, 0.22)',
    zIndex: 2,
  },
  cabBtnHole: {
    position: 'absolute',
    zIndex: 8,
    overflow: 'hidden',
    borderRadius: 999,
  },
  cabBtnHoleSquare: {
    /** Прямоугольные вырезки из арта ATM — без скругления, иначе «UI-наклейка» */
    borderRadius: 0,
  },
  cabBtnFace: {
    width: '100%',
    height: '100%',
  },
  lcdGlareBand: {
    position: 'absolute',
    left: '8%',
    right: '12%',
    top: '12%',
    height: '22%',
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  boothGlowCore: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 80, 170, 0.12)',
  },
  boothGlowRing: {
    position: 'absolute',
    left: '6%',
    right: '6%',
    top: '8%',
    bottom: '10%',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 150, 210, 0.35)',
    backgroundColor: 'rgba(120, 60, 160, 0.08)',
  },
  metroGlassFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 14, 28, 0.22)',
  },
  metroVignette: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  metroSpecular: {
    position: 'absolute',
    left: '6%',
    right: '18%',
    top: '6%',
    height: '34%',
    borderRadius: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  shanghaiGlassFill: {
    ...StyleSheet.absoluteFillObject,
    /** Плотнее — край читается по контуру LCD при подгонке */
    backgroundColor: 'rgba(4, 8, 16, 0.55)',
  },
  shanghaiVignette: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  shanghaiRedEdge: {
    height: 0,
  },
  shanghaiSpecular: {
    position: 'absolute',
    left: '8%',
    right: '24%',
    top: '10%',
    height: '28%',
    borderRadius: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
  },
  metroHairline: {
    alignSelf: 'center',
    width: '42%',
    height: StyleSheet.hairlineWidth,
    marginBottom: 5,
    backgroundColor: 'rgba(210, 218, 235, 0.28)',
  },
  shanghaiHairline: {
    height: 0,
  },
  crtGlass: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: 'transparent',
    zIndex: 6,
  },
  crtGlassBooth: {
    borderRadius: 5,
    overflow: 'hidden',
  },
  crtGlassMetro: {
    borderRadius: 0,
    overflow: 'hidden',
  },
  crtGlassShanghai: {
    borderRadius: 0,
    overflow: 'hidden',
    borderWidth: 0,
  },
  crtHit: {
    flex: 1,
    paddingHorizontal: '7%',
    paddingTop: '8%',
    paddingBottom: '8%',
    zIndex: 2,
  },
  crtHitLcd: {
    paddingHorizontal: '6%',
    paddingTop: '6%',
    paddingBottom: '7%',
  },
  crtHitBooth: {
    paddingHorizontal: '6%',
    paddingTop: '7%',
    paddingBottom: '7%',
    overflow: 'hidden',
    width: '100%',
    maxWidth: '100%',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  crtHitMetro: {
    paddingHorizontal: '8%',
    paddingTop: '9%',
    paddingBottom: '9%',
    overflow: 'hidden',
    width: '100%',
    maxWidth: '100%',
    alignItems: 'stretch',
  },
  crtHitShanghai: {
    paddingHorizontal: '4%',
    paddingTop: '4%',
    paddingBottom: '4%',
    overflow: 'hidden',
    width: '100%',
    maxWidth: '100%',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  /** London: UI не раздуваем вместе с LCD — карточка поверх среднего плана будки */
  callboxOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 28,
    zIndex: 24,
  },
  callboxPanel: {
    maxHeight: '46%',
    minHeight: 210,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 220, 210, 0.28)',
    backgroundColor: 'rgba(18, 8, 10, 0.78)',
  },
  boothOverlay: {
    paddingBottom: 24,
  },
  boothPanel: {
    maxHeight: '44%',
    minHeight: 200,
    borderRadius: 20,
    borderWidth: 0,
    backgroundColor: 'rgba(12, 6, 18, 0.82)',
  },
  crtVignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 20, 8, 0.18)',
  },
  crtScanBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 18,
    backgroundColor: 'rgba(140, 255, 170, 0.12)',
  },
  crtLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(80, 255, 140, 0.08)',
  },
  terminalIdle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idleHint: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2,
  },
  terminal: {
    flex: 1,
    justifyContent: 'center',
  },
  terminalMenu: {
    justifyContent: 'center',
    gap: 10,
  },
  terminalMenuLcd: {
    gap: 6,
    paddingTop: 0,
  },
  terminalMenuBooth: {
    gap: 8,
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
    alignItems: 'stretch',
  },
  terminalMenuMetro: {
    gap: 7,
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
    alignItems: 'stretch',
  },
  terminalMenuShanghai: {
    flex: 1,
    gap: 0,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  terminalMenuTapOnly: {
    gap: 0,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  tapHintShanghai: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 3.2,
    lineHeight: 18,
    marginBottom: 0,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  tapHintBoothTap: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2.8,
    lineHeight: 16,
    marginBottom: 0,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  tapOnlyHit: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLayerTapOnly: {
    gap: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLayerShanghai: {
    gap: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shanghaiTapHit: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemShanghai: {
    gap: 8,
    minHeight: 20,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    borderWidth: 0,
    borderLeftWidth: 1.5,
    borderLeftColor: 'rgba(227, 28, 35, 0.78)',
    borderColor: 'transparent',
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden',
    alignSelf: 'stretch',
    flexShrink: 1,
  },
  menuItemShanghaiOn: {
    backgroundColor: 'rgba(227, 28, 35, 0.12)',
    borderColor: 'transparent',
  },
  terminalLcd: {
    justifyContent: 'flex-start',
    gap: 8,
    paddingTop: 2,
  },
  menuLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    gap: 10,
    zIndex: 2,
  },
  menuLayerBooth: {
    gap: 3,
    overflow: 'hidden',
    paddingHorizontal: 0,
  },
  menuLayerMetro: {
    gap: 6,
    overflow: 'hidden',
    paddingHorizontal: 0,
    justifyContent: 'center',
  },
  menuLayerHidden: {
    opacity: 0,
  },
  inputLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  inputLayerHidden: {
    opacity: 0,
  },
  inputLayerTapOnly: {
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  inputLayerShanghai: {
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  tapHint: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    lineHeight: 12,
    marginBottom: 0,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  tapHintLcd: {
    fontSize: 9,
    letterSpacing: 0.7,
    lineHeight: 11,
    marginBottom: 0,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  tapHintBooth: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
    lineHeight: 11,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  tapHintMetro: {
    fontSize: 8,
    fontWeight: '500',
    letterSpacing: 1.6,
    lineHeight: 11,
    marginBottom: 6,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  cmdBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    flexShrink: 0,
  },
  cmdBlockGrow: {
    flex: 1,
    minHeight: 0,
  },
  cmdBlockBooth: {
    gap: 5,
    paddingHorizontal: 2,
  },
  cmdBlockMetro: {
    gap: 7,
    paddingHorizontal: 2,
    paddingVertical: 2,
    alignItems: 'flex-start',
  },
  prompt: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
    marginTop: 1,
  },
  promptBooth: {
    fontSize: 11,
    marginTop: 2,
  },
  promptMetro: {
    fontSize: 12,
    fontWeight: '300',
    marginTop: 1,
    letterSpacing: 0,
    opacity: 0.85,
  },
  inputCol: {
    flex: 1,
    position: 'relative',
    minHeight: 20,
  },
  inputColGrow: {
    flex: 1,
    minHeight: 0,
  },
  input: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    padding: 0,
    margin: 0,
    textAlignVertical: 'top',
    backgroundColor: 'transparent',
  },
  inputLcd: {
    fontSize: 11,
    lineHeight: 15,
    fontVariant: ['tabular-nums'],
  },
  inputBooth: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
    letterSpacing: 0.2,
  },
  inputMetro: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  cmdBlockTapOnly: {
    gap: 0,
    width: '100%',
    maxWidth: '100%',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  cmdBlockShanghai: {
    gap: 0,
    width: '100%',
    maxWidth: '100%',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  cmdBlockShanghaiType: {
    flexDirection: 'column',
    flex: 1,
    width: '100%',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  inputShanghai: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: 0.4,
    textAlign: 'left',
    minWidth: '100%',
  },
  inputShanghaiType: {
    width: '100%',
    textAlign: 'left',
    textAlignVertical: 'top',
    includeFontPadding: false,
  },
  inputBoothTap: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: 1.2,
    textAlign: 'left',
    minWidth: '100%',
  },
  /** ≥16pt — иначе iOS зумит страницу при фокусе клавиатуры */
  inputCallbox: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
  },
  inputColMetro: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(210, 218, 235, 0.28)',
    paddingBottom: 3,
  },
  inputColShanghai: {
    borderBottomWidth: 0,
    paddingBottom: 0,
    width: '100%',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  inputColShanghaiType: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    alignSelf: 'stretch',
  },
  inputColBoothTap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 110, 199, 0.55)',
    paddingBottom: 4,
    width: '100%',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  inputFill: {
    flex: 1,
    alignSelf: 'stretch',
  },
  inputFillShanghai: {
    width: '100%',
    height: '100%',
    minHeight: 48,
  },
  underscore: {
    position: 'absolute',
    left: 0,
    top: 0,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  underscoreBooth: {
    fontSize: 11,
    lineHeight: 15,
  },
  underscoreMetro: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '300',
  },
  underscoreTapOnly: {
    left: 0,
    textAlign: 'left',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
  underscoreShanghaiType: {
    left: 0,
    top: 0,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  underscoreShanghai: {
    left: 0,
    right: undefined,
    textAlign: 'left',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
  menuCol: {
    flexGrow: 0,
    flexShrink: 1,
    justifyContent: 'center',
    gap: 6,
    minHeight: 0,
    alignSelf: 'stretch',
  },
  menuColLcd: {
    flexGrow: 0,
    flexShrink: 1,
    justifyContent: 'center',
    gap: 4,
    paddingTop: 0,
  },
  menuColBooth: {
    gap: 6,
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  menuColMetro: {
    gap: 4,
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 1,
    minHeight: 16,
  },
  menuItemLcd: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 0,
    minHeight: 14,
  },
  menuItemBooth: {
    gap: 8,
    minHeight: 22,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 0,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255, 120, 190, 0.75)',
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden',
    alignSelf: 'stretch',
    flexShrink: 1,
  },
  /** Билет-ряд Navigo: стекло / тонкая линия, без неонового «гейм-UI» */
  menuItemMetro: {
    gap: 8,
    minHeight: 20,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(220, 226, 238, 0.16)',
    borderLeftWidth: 1.5,
    borderLeftColor: 'rgba(117, 73, 150, 0.72)',
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden',
    alignSelf: 'stretch',
    flexShrink: 1,
  },
  menuItemCallbox: {
    borderLeftColor: 'rgba(200, 90, 80, 0.75)',
    borderColor: 'rgba(230, 210, 200, 0.16)',
  },
  menuItemOn: {
    opacity: 0.55,
  },
  menuItemMetroOn: {
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderColor: 'rgba(220, 226, 238, 0.28)',
  },
  menuIndex: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 14,
    minWidth: 12,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  menuIndexLcd: {
    fontSize: 10,
    minWidth: 12,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
    lineHeight: 13,
  },
  menuIndexBooth: {
    fontSize: 10,
    minWidth: 12,
    textAlign: 'center',
    lineHeight: 14,
  },
  menuIndexMetro: {
    fontSize: 9,
    fontWeight: '500',
    minWidth: 16,
    textAlign: 'left',
    lineHeight: 13,
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
  },
  menuText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
  menuTextLcd: {
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 13,
  },
  menuTextBooth: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 15,
    letterSpacing: 0,
  },
  menuTextMetro: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 14,
    letterSpacing: 0.15,
  },
  panelHit: {
    position: 'absolute',
    zIndex: 4,
  },
});
