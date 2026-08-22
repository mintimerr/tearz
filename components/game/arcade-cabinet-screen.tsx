import * as Haptics from 'expo-haptics';
import { Image, type ImageSource } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
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
import { GAME_THEME } from '@/constants/game-theme';
import { TeacherChatsSheet } from '@/components/teacher/teacher-chats-sheet';
import { TearzLessonTransit } from '@/components/teacher/tearz-flight-loading';
import { getTerminalTheme, type TerminalThemeConfig } from '@/constants/terminal-theme';
import { Fonts } from '@/constants/theme';
import {
  getTerminalLocation,
  type TerminalLocationId,
  type TerminalNormRect,
} from '@/constants/terminal-locations';
import { useEngagement } from '@/contexts/engagement-context';
import { useTranslation } from '@/contexts/locale-context';
import { inferTeacherLessonLanguage } from '@/utils/teacher-lesson-language';
import { pickCompanionPhoto } from '@/utils/pick-companion-photo';
import {
  ExclusionTextInput,
  type ExclusionRect,
  type ExclusionTextInputRef,
} from 'tearz-exclusion-text';

const SCENE_ASPECT = 1024 / 1536;
const ZOOM_MS = 600;
const ZOOM_EASING = Easing.bezier(0.22, 1, 0.36, 1);

type FocusableInputRef = TextInput | ExclusionTextInputRef;

/** Размер превью фото на Shanghai CRT (оставляем место под текст снизу). */
function shanghaiPhotoSize(crtW: number, crtH: number) {
  const width = Math.max(48, Math.min(Math.round(crtW * 0.2), Math.round(crtW * 0.24)));
  const height = Math.max(
    56,
    Math.min(Math.round(crtH * 0.24), Math.round(crtH * 0.28), Math.round(crtH - 64)),
  );
  return { width, height };
}

/** Exclusion вплотную к фото: слева 3+ строки, потом на всю ширину под фото. */
function shanghaiPhotoExclusionNorm(
  crtW: number,
  crtH: number,
  inputFillH: number,
): ExclusionRect {
  const { width: photoW, height: photoH } = shanghaiPhotoSize(crtW, crtH);
  const viewW = Math.max(1, crtW * 0.86);
  const viewH = Math.max(1, inputFillH);

  // Фото справа (~28–32% CRT) — текст почти до левого края превью
  const gap = 6;
  const x = Math.min(0.72, Math.max(0.58, 1 - (photoW + gap) / viewW));
  // Высота exclusion ≥ фото, чтобы 3-я строка ещё упиралась в фото, а не уходила «вверх/под»
  const height = Math.min(0.56, Math.max(0.42, (photoH + 22) / viewH));

  return {
    x,
    y: 0,
    width: 1 - x,
    height,
  };
}

function useCoverLayout(
  crt: TerminalNormRect,
  focus: TerminalNormRect,
  /** booth: зум так, чтобы CRT целиком влез в экран (cover по стеклу) */
  fillCrt = false,
  /** Высота клавиатуры — вписываем стекло в зону над ней */
  keyboardH = 0,
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
    /** При открытой клавиатуре оставляем стекло над ней — «+» не перекрывается */
    const kbPad = fillCrt && keyboardH > 48 ? Math.round(keyboardH * 0.92) : 0;
    const padBottom = Math.max(insets.bottom, 10) + 8 + kbPad;
    const safeW = screenW - 16;
    const safeH = Math.max(screenH - padTop - padBottom, 120);
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
      kbPad,
    };
  }, [crt, fillCrt, focus, insets.bottom, insets.top, keyboardH, screenH, screenW]);
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
  const location = getTerminalLocation((params.location as TerminalLocationId) || 'shanghai_metro_bund');
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
  const inputRef = useRef<FocusableInputRef>(null);
  /** true только при намеренном zoomOut — иначе возвращаем фокус после случайного blur */
  const dismissKeyboardRef = useRef(false);

  const [query, setQuery] = useState('');
  const [zoomed, setZoomed] = useState(false);
  /** idle → кино-переход (небо → диалог) */
  const [gate, setGate] = useState<'idle' | 'transit'>('idle');
  const [chatsOpen, setChatsOpen] = useState(false);
  const [seed, setSeed] = useState('');
  const [seedImageUri, setSeedImageUri] = useState<string | undefined>();
  const [pendingPhoto, setPendingPhoto] = useState<{ uri: string; name?: string } | null>(null);
  const [focused, setFocused] = useState(false);
  const [keyboardH, setKeyboardH] = useState(0);

  const layout = useCoverLayout(crt, focus, fillCrt, zoomed ? keyboardH : 0);
  /** Явная высота поля = CRT минус паддинги — иначе Expo native view схлопывается (марка «внизу», текст уезжает вверх) */
  const shanghaiInputFillH =
    isShanghai && pendingPhoto
      ? Math.max(120, Math.round(layout.crtBox.height * 0.9))
      : undefined;
  const shanghaiExclusionNorm =
    isShanghai && pendingPhoto && shanghaiInputFillH != null
      ? shanghaiPhotoExclusionNorm(
          layout.crtBox.width,
          layout.crtBox.height,
          shanghaiInputFillH,
        )
      : null;

  const zoom = useSharedValue(idleScale);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const sway = useSharedValue(0);
  const drift = useSharedValue(0);
  const breathe = useSharedValue(0);
  const zoomedSv = useSharedValue(0);

  /** После тапа/зума — только строка ввода (+), без TAP TO START и меню предложений. */
  const showHints = false;

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvt, (e) => {
      setKeyboardH(e.endCoordinates.height);
    });
    const onHide = Keyboard.addListener(hideEvt, () => setKeyboardH(0));
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

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

  const applyCamera = (inZoom: boolean, kbHeight = keyboardH) => {
    const scale = inZoom ? layout.zoomScale : idleScale;
    const idleX = layout.screenW * idlePanXNorm;
    const idleY = layout.screenH * idlePanYNorm;
    /**
     * Зум через transformOrigin на центре CRT (см. cameraStyle).
     * fillCrt + keyboard: safe-area уже над клавиатурой (useCoverLayout kbPad).
     * Лёгкий доп. подъём — зазор между низом стекла и клавишами.
     */
    const tx = inZoom ? 0 : idleX;
    let ty = inZoom && fillCrt ? -Math.min(layout.screenH * 0.04, 28) : idleY;
    if (inZoom && fillCrt && kbHeight > 0) {
      ty -= Math.min(18, 24);
    } else if (inZoom && theme.id === 'crt' && kbHeight > 0) {
      ty -= Math.min(kbHeight * 0.28, 110);
    }
    zoomedSv.value = withTiming(inZoom ? 1 : 0, { duration: ZOOM_MS, easing: ZOOM_EASING });
    zoom.value = withTiming(scale, { duration: ZOOM_MS, easing: ZOOM_EASING });
    panX.value = withTiming(tx, { duration: ZOOM_MS, easing: ZOOM_EASING });
    panY.value = withTiming(ty, { duration: inZoom && kbHeight > 0 ? 220 : ZOOM_MS, easing: ZOOM_EASING });
  };

  useEffect(() => {
    if (zoomed) {
      applyCamera(true, keyboardH);
      return;
    }
    panX.value = layout.screenW * idlePanXNorm;
    panY.value = layout.screenH * idlePanYNorm;
    zoom.value = idleScale;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync camera to layout / zoom / keyboard
  }, [
    idlePanXNorm,
    idlePanYNorm,
    idleScale,
    keyboardH,
    layout.focusCx,
    layout.focusCy,
    layout.screenH,
    layout.screenW,
    layout.zoomScale,
    zoomed,
  ]);

  useEffect(() => {
    if (gate !== 'transit') return;
    dismissKeyboardRef.current = true;
    setFocused(false);
    inputRef.current?.blur();
    Keyboard.dismiss();
    setKeyboardH(0);
    const t = setTimeout(() => {
      dismissKeyboardRef.current = false;
    }, 400);
    return () => clearTimeout(t);
  }, [gate]);

  const openCrt = () => {
    if (zoomed) {
      inputRef.current?.focus();
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setZoomed(true);
    applyCamera(true);
    setTimeout(() => inputRef.current?.focus(), ZOOM_MS + 40);
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
    if ((!q && !pendingPhoto) || gate !== 'idle') return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const preview = q || 'Фото';
    recordActivity({ kind: 'message', messagePreview: preview, lessonTopic: preview.slice(0, 48) });
    setSeed(q || 'Фото');
    setSeedImageUri(pendingPhoto?.uri);
    setPendingPhoto(null);

    // keepKeyboard иначе мгновенно возвращает фокус после Keyboard.dismiss()
    dismissKeyboardRef.current = true;
    setFocused(false);
    inputRef.current?.blur();
    Keyboard.dismiss();
    setKeyboardH(0);
    setZoomed(false);
    applyCamera(false);

    setGate('transit');
    setTimeout(() => {
      dismissKeyboardRef.current = false;
    }, 400);
  };

  const closeChat = () => {
    setGate('idle');
    setSeed('');
    setSeedImageUri(undefined);
    setQuery('');
    setPendingPhoto(null);
    zoomOut();
  };

  const attachPhoto = async () => {
    void Haptics.selectionAsync();
    openCrt();
    const picked = await pickCompanionPhoto();
    if (!picked) return;
    let uri = picked.uri;
    try {
      const out = await ImageManipulator.manipulateAsync(picked.uri, [{ resize: { width: 720 } }], {
        compress: 0.85,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      uri = out.uri;
    } catch {
      // оставляем исходный uri
    }
    setPendingPhoto({ uri, name: picked.name });
    requestAnimationFrame(() => inputRef.current?.focus());
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
          ) : isShanghai ? (
            <ShanghaiGlow />
          ) : isGlassUi ? (
            <MetroGlow />
          ) : null}
          {/* Pressable вокруг TextInput на iOS срывает клавиатуру при ререндере — после зума только View */}
          {!(floatTerminalUi && zoomed) ? (
            zoomed && gate === 'idle' ? (
              <View
                style={[
                  styles.crtHit,
                  isLcd && styles.crtHitLcd,
                  isLcd && styles.crtHitLcdFill,
                  isBooth && styles.crtHitBooth,
                  isGlassUi && !isCallbox && styles.crtHitMetro,
                  isCallbox && styles.crtHitCallbox,
                  isShanghai && styles.crtHitShanghai,
                  isShanghai && !!pendingPhoto && styles.crtHitShanghaiWithPhoto,
                  theme.id === 'crt' && styles.crtHitArcade,
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
                  pendingPhotoUri={pendingPhoto?.uri}
                  onAttach={attachPhoto}
                  onClearAttach={() => setPendingPhoto(null)}
                  onOpen={openCrt}
                  onPick={pickSuggestion}
                  onSubmit={submit}
                  setFocused={setFocused}
                  keyboardClearance={
                    (isBooth || isCallbox || isMetro || isShanghai) && keyboardH > 0 ? 10 : 0
                  }
                  showCornerAttach={false}
                  photoExclusionNorm={shanghaiExclusionNorm}
                  inputFillHeight={shanghaiInputFillH}
                />
              </View>
            ) : (
              <Pressable
                style={[
                  styles.crtHit,
                  isLcd && styles.crtHitLcd,
                  isLcd && styles.crtHitLcdFill,
                  isBooth && styles.crtHitBooth,
                  isGlassUi && !isCallbox && styles.crtHitMetro,
                  isCallbox && styles.crtHitCallbox,
                  isShanghai && styles.crtHitShanghai,
                  theme.id === 'crt' && styles.crtHitArcade,
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
                  pendingPhotoUri={pendingPhoto?.uri}
                  onAttach={attachPhoto}
                  onClearAttach={() => setPendingPhoto(null)}
                  onOpen={openCrt}
                  onPick={pickSuggestion}
                  onSubmit={submit}
                  setFocused={setFocused}
                  showCornerAttach={false}
                  photoExclusionNorm={shanghaiExclusionNorm}
                  inputFillHeight={shanghaiInputFillH}
                />
              </Pressable>
            )
          ) : null}
          {zoomed && pendingPhoto ? (
            <Pressable
              onPress={() => setPendingPhoto(null)}
              accessibilityRole="button"
              accessibilityLabel="Убрать фото"
              style={[
                styles.photoOnCrtGlass,
                isShanghai && styles.photoOnCrtGlassShanghai,
                (() => {
                  const size = isShanghai
                    ? shanghaiPhotoSize(layout.crtBox.width, layout.crtBox.height)
                    : {
                        width: Math.max(72, Math.round(layout.crtBox.width * 0.34)),
                        height: Math.max(88, Math.round(layout.crtBox.height * 0.4)),
                      };
                  return size;
                })(),
              ]}>
              <Image
                source={{ uri: pendingPhoto.uri }}
                style={styles.attachPreviewImg}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={pendingPhoto.uri}
              />
              <View style={[styles.attachPreviewClear, isShanghai && styles.attachPreviewClearCompact]}>
                <Text style={[styles.attachPreviewClearText, isShanghai && styles.attachPreviewClearTextCompact, { color: theme.hot }]}>
                  ×
                </Text>
              </View>
            </Pressable>
          ) : null}
          {zoomed && !floatTerminalUi ? (
            <Pressable
              onPress={attachPhoto}
              hitSlop={isCallbox ? 8 : isShanghai ? 10 : 14}
              accessibilityRole="button"
              accessibilityLabel="Прикрепить фото"
              style={({ pressed }) => [
                styles.attachBtn,
                styles.attachOnCrtGlass,
                isCallbox && styles.attachOnCrtGlassSm,
                isShanghai && styles.attachOnCrtGlassShanghai,
                {
                  borderColor: isLcd
                    ? 'rgba(142, 197, 240, 0.55)'
                    : isBooth
                      ? 'rgba(255, 240, 248, 0.45)'
                      : isCallbox
                        ? 'rgba(232, 160, 154, 0.55)'
                        : isMetro
                          ? 'rgba(192, 38, 255, 0.55)'
                          : isShanghai
                            ? 'rgba(255, 92, 92, 0.42)'
                            : 'rgba(138, 255, 168, 0.5)',
                  opacity: pressed ? 0.72 : 1,
                },
              ]}>
              <Text
                style={[
                  styles.attachPlus,
                  isCallbox && styles.attachPlusCallbox,
                  isShanghai && styles.attachPlusShanghai,
                  {
                    color:
                      isMetro
                        ? '#C026FF'
                        : isLcd || isBooth || isCallbox || isShanghai || theme.id === 'crt'
                          ? theme.hot
                          : theme.fg,
                  },
                ]}>
                +
              </Text>
            </Pressable>
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

      {floatTerminalUi && zoomed && gate === 'idle' ? (
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
              pendingPhotoUri={pendingPhoto?.uri}
              onAttach={attachPhoto}
              onClearAttach={() => setPendingPhoto(null)}
              onOpen={openCrt}
              onPick={pickSuggestion}
              onSubmit={submit}
              setFocused={setFocused}
            />
          </View>
        </View>
      ) : null}

      <TeacherChatsSheet visible={chatsOpen} onClose={() => setChatsOpen(false)} />

      {gate === 'transit' && (seed || seedImageUri) ? (
        <View style={styles.transitLayer} pointerEvents="auto">
          <TearzLessonTransit
            question={seed}
            imageUri={seedImageUri}
            language={inferTeacherLessonLanguage(seed || 'photo', location.lessonLanguage ?? 'english')}
            onClose={closeChat}
          />
        </View>
      ) : null}
    </View>
  );
}

type FaceProps = {
  theme: TerminalThemeConfig;
  query: string;
  setQuery: (v: string) => void;
  inputRef: React.RefObject<FocusableInputRef | null>;
  showHints: boolean;
  suggestions: string[];
  /** true после полного зума — тогда UI заполняет весь CRT */
  active: boolean;
  keepKeyboard: boolean;
  dismissKeyboardRef: React.RefObject<boolean>;
  pendingPhotoUri?: string;
  /** Нормализованный exclusion 0…1 для обтекания фото (Shanghai) */
  photoExclusionNorm?: ExclusionRect | null;
  /** Фиксированная высота поля ввода (px) — чтобы текст шёл под фото */
  inputFillHeight?: number;
  onAttach: () => void;
  onClearAttach: () => void;
  onOpen: () => void;
  onPick: (s: string) => void;
  onSubmit: () => void;
  setFocused: (v: boolean) => void;
  /** Отступ снизу внутри CRT, чтобы «+» не уезжал под клавиатуру */
  keyboardClearance?: number;
  /** false — «+» рисует родитель на crtGlass (надёжный низ стекла) */
  showCornerAttach?: boolean;
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
  pendingPhotoUri,
  photoExclusionNorm = null,
  inputFillHeight,
  onAttach,
  onClearAttach,
  onOpen,
  onPick,
  onSubmit,
  setFocused,
  keyboardClearance = 0,
  showCornerAttach = true,
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
  const callbox = theme.id === 'callbox';

  // До зума — только короткая приманка; полный UI после заполнения экрана
  if (!active) {
    return (
      <View style={styles.terminalIdle}>
        <Animated.Text
          style={[
            styles.idleHint,
            callbox && styles.idleHintCallbox,
            { color: theme.hot },
            hintStyle,
          ]}>
          {t('terminal.idleTap')}
        </Animated.Text>
      </View>
    );
  }

  const lcd = theme.id === 'lcd';
  const booth = theme.id === 'booth';
  const metro = theme.id === 'metro';
  const shanghai = theme.id === 'shanghai';
  const crt = theme.id === 'crt';
  const glass = metro || shanghai || callbox;
  const tapOnly = shanghai || booth;
  /** Ввод сверху + «+» в правом нижнем углу экрана. */
  const cornerAttach = shanghai || crt || lcd || booth || callbox || metro;
  const startHint = tapOnly ? t('terminal.idleTap') : t('terminal.startHint');
  const caretColor = metro
    ? '#C026FF'
    : booth || shanghai || crt || lcd || callbox
      ? theme.hot
      : theme.fg;
  const wrapDown = booth || shanghai || crt || lcd || callbox || metro;
  const useExclusionInput = shanghai && !!pendingPhotoUri && Platform.OS === 'ios';
  // Компактная «марка»: больше колонки под текст слева
  const shanghaiPhotoWFrac = 0.2;
  const shanghaiPhotoHFrac = 0.26;
  const inputStyles = [
    styles.input,
    lcd && styles.inputLcd,
    booth && styles.inputBooth,
    glass && !callbox && styles.inputMetro,
    shanghai && styles.inputShanghai,
    wrapDown && styles.inputBoothWrap,
    shanghai && styles.inputShanghai,
    crt && styles.inputCrtTop,
    lcd && styles.inputLcdTop,
    callbox && styles.inputCallbox,
    callbox && styles.inputCallboxPad,
    metro && styles.inputMetroWrap,
    shanghai && styles.inputShanghaiType,
    !useExclusionInput && shanghai && styles.inputShanghaiPad,
    useExclusionInput && styles.inputShanghaiExclusion,
    !!pendingPhotoUri && !useExclusionInput && styles.inputWithPhoto,
    shanghai && !!pendingPhotoUri && !useExclusionInput && styles.inputShanghaiWithPhoto,
    { color: shanghai ? theme.fg : booth || crt || lcd || callbox || metro ? theme.hot : theme.fg },
    styles.inputFillDock,
    wrapDown && styles.inputFillWrapDown,
    // «+» на стекле (corner) — текст на всю ширину CRT; запас справа только у inline «+»
    cornerAttach && styles.inputFillWrapDownCorner,
    useExclusionInput && styles.inputFillWrapDownExclusion,
  ];
  const sharedInputProps = {
    value: query,
    onChangeText: setQuery,
    placeholder: '',
    placeholderTextColor: theme.dim,
    maxLength: wrapDown ? 400 : 100,
    multiline: wrapDown,
    textAlignVertical: wrapDown ? ('top' as const) : ('center' as const),
    returnKeyType: 'go' as const,
    blurOnSubmit: true,
    underlineColorAndroid: 'transparent' as const,
    onFocus: () => {
      setFocused(true);
      onOpen();
    },
    onBlur: () => {
      setFocused(false);
      if (keepKeyboard && !dismissKeyboardRef.current) {
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    },
    onSubmitEditing: onSubmit,
    selectionColor: metro ? 'rgba(192, 38, 255, 0.35)' : theme.selection,
    cursorColor: caretColor,
    caretHidden: false,
  };

  return (
    <View
      style={[
        styles.terminal,
        styles.terminalMenu,
        lcd && styles.terminalMenuLcd,
        lcd && styles.terminalMenuLcdFill,
        booth && styles.terminalMenuBooth,
        glass && styles.terminalMenuMetro,
        metro && styles.terminalMenuMetroFill,
        shanghai && styles.terminalMenuShanghai,
        crt && styles.terminalMenuCrt,
        booth && styles.terminalMenuTapOnly,
        styles.terminalActiveStack,
        booth && styles.terminalActiveStackTop,
        cornerAttach && styles.terminalActiveStackTop,
      ]}>
      <View
        style={[
          styles.menuLayer,
          styles.menuLayerFlex,
          booth && styles.menuLayerBooth,
          glass && styles.menuLayerMetro,
          tapOnly && styles.menuLayerTapOnly,
          !showHints && styles.menuLayerHidden,
        ]}
        pointerEvents={showHints ? 'box-none' : 'none'}>
        {tapOnly && showHints ? (
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
        ) : !tapOnly ? (
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
                    shanghai && styles.menuIndexShanghai,
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
                      shanghai && styles.menuTextShanghai,
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
        ) : null}
      </View>

      <View
        style={[
          styles.inputLayer,
          styles.inputLayerDock,
          tapOnly && styles.inputLayerTapOnly,
          cornerAttach && styles.inputLayerShanghaiDock,
          wrapDown && styles.inputLayerBoothFill,
          useExclusionInput && styles.inputLayerExclusionFill,
          keyboardClearance > 0 && { paddingBottom: keyboardClearance },
        ]}
        pointerEvents="auto">
        <View
          style={[
            styles.cmdBlock,
            styles.cmdBlockDock,
            booth && styles.cmdBlockBooth,
            wrapDown && styles.cmdBlockBoothFill,
            wrapDown && styles.cmdBlockBoothWrap,
            useExclusionInput && styles.cmdBlockExclusionFill,
            glass && !shanghai && !metro && !callbox && styles.cmdBlockMetro,
            cornerAttach && !wrapDown && styles.cmdBlockShanghaiTop,
            metro && !wrapDown && styles.cmdBlockMetroTop,
          ]}>
          {!tapOnly && !crt && !callbox && !metro && theme.prompt ? (
            <Text
              style={[
                styles.prompt,
                booth && styles.promptBooth,
                glass && styles.promptMetro,
                lcd && styles.promptLcd,
                { color: glass ? theme.dim : theme.hot },
              ]}>
              {theme.prompt}
            </Text>
          ) : null}
          <View
            style={[
              styles.inputCol,
              glass && !shanghai && !metro && !callbox && styles.inputColMetro,
              shanghai && styles.inputColShanghai,
              callbox && styles.inputColCallbox,
              metro && !wrapDown && styles.inputColMetroTop,
              wrapDown && styles.inputColBoothFill,
              styles.inputColDock,
              wrapDown && styles.inputColWrapDown,
              !!pendingPhotoUri && !shanghai && styles.inputColWithPhoto,
              useExclusionInput && styles.inputColExclusionFill,
            ]}>
            {useExclusionInput ? (
              <ExclusionTextInput
                ref={inputRef}
                {...sharedInputProps}
                style={[inputStyles, styles.inputExclusionFill]}
                photoUri={pendingPhotoUri}
                photoWidthFrac={shanghaiPhotoWFrac}
                photoHeightFrac={shanghaiPhotoHFrac}
                onClearPhoto={onClearAttach}
              />
            ) : (
              <TextInput ref={inputRef} {...sharedInputProps} style={inputStyles} />
            )}
          </View>
          {!cornerAttach ? (
            <Pressable
              onPress={onAttach}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Прикрепить фото"
              style={({ pressed }) => [
                styles.attachBtn,
                glass && styles.attachBtnGlass,
                { borderColor: theme.dim, opacity: pressed ? 0.55 : 1 },
              ]}>
              <Text style={[styles.attachPlus, { color: theme.fg }]}>+</Text>
            </Pressable>
          ) : null}
        </View>
        {cornerAttach && showCornerAttach ? (
          <Pressable
            onPress={onAttach}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Прикрепить фото"
            style={({ pressed }) => [
              styles.attachBtn,
              styles.attachBtnShanghaiCorner,
              shanghai && styles.attachBtnShanghaiHot,
              crt && styles.attachBtnCrtCorner,
              lcd && styles.attachBtnLcdCorner,
              booth && styles.attachBtnBoothCorner,
              callbox && styles.attachBtnCallboxCorner,
              metro && styles.attachBtnMetroCorner,
              {
                borderColor: crt
                  ? 'rgba(138, 255, 168, 0.45)'
                  : lcd
                    ? 'rgba(142, 197, 240, 0.5)'
                    : booth
                      ? 'rgba(255, 240, 248, 0.35)'
                      : callbox
                        ? 'rgba(232, 160, 154, 0.55)'
                        : metro
                          ? 'rgba(192, 38, 255, 0.55)'
                          : shanghai
                            ? 'rgba(255, 70, 70, 0.55)'
                            : 'rgba(255,255,255,0.35)',
                opacity: pressed ? 0.55 : 1,
              },
            ]}>
            <Text
              style={[
                styles.attachPlus,
                callbox && styles.attachPlusCallbox,
                {
                  color:
                    crt || lcd || booth || callbox || shanghai || metro
                      ? theme.hot
                      : theme.fg,
                },
              ]}>
              +
            </Text>
          </Pressable>
        ) : null}
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
  transitLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    elevation: 200,
    backgroundColor: GAME_THEME.color.cream,
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
  /** «+» на рамке стекла — всегда правый нижний угол LCD, не зависит от flex ввода */
  attachOnCrtGlass: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    zIndex: 30,
    elevation: 30,
  },
  attachOnCrtGlassSm: {
    width: 15,
    height: 15,
    borderRadius: 8,
    right: 2,
    bottom: 5,
  },
  attachOnCrtGlassShanghai: {
    width: 19,
    height: 19,
    borderRadius: 10,
    right: 18,
    bottom: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(8, 4, 6, 0.52)',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
  attachPlusShanghai: {
    fontFamily: Fonts.rounded,
    fontSize: 15,
    lineHeight: 16,
    fontWeight: '300',
    marginTop: -1,
    letterSpacing: -0.5,
  },
  photoOnCrtGlass: {
    position: 'absolute',
    top: 8,
    right: 6,
    borderRadius: 6,
    overflow: 'visible',
    zIndex: 40,
    elevation: 40,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  photoOnCrtGlassShanghai: {
    top: 14,
    right: 11,
    borderRadius: 5,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  attachPreviewClearCompact: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingTop: 2,
    paddingRight: 3,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  attachPreviewClearTextCompact: {
    fontSize: 9,
    lineHeight: 10,
    fontWeight: '400',
  },
  crtHit: {
    flex: 1,
    paddingHorizontal: '8%',
    paddingTop: '10%',
    paddingBottom: '8%',
    zIndex: 2,
  },
  crtHitLcd: {
    paddingHorizontal: '7%',
    paddingTop: '8%',
    paddingBottom: '7%',
  },
  crtHitLcdFill: {
    paddingHorizontal: '6%',
    paddingTop: '7%',
    paddingBottom: '5%',
    overflow: 'hidden',
    width: '100%',
    maxWidth: '100%',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  terminalMenuLcdFill: {
    flex: 1,
    width: '100%',
    gap: 0,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  attachBtnLcdCorner: {
    right: 2,
    bottom: 2,
  },
  attachBtnBoothCorner: {
    right: 4,
    bottom: 4,
  },
  crtHitBooth: {
    paddingHorizontal: '5%',
    paddingTop: '5%',
    paddingBottom: '6%',
    overflow: 'hidden',
    width: '100%',
    maxWidth: '100%',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  crtHitMetro: {
    paddingHorizontal: '6%',
    paddingTop: '7%',
    paddingBottom: '5%',
    overflow: 'hidden',
    width: '100%',
    maxWidth: '100%',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  terminalMenuMetroFill: {
    flex: 1,
    width: '100%',
    gap: 0,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  attachBtnMetroCorner: {
    right: 4,
    bottom: 4,
  },
  inputMetroWrap: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
    letterSpacing: 0.2,
    textAlign: 'left',
    width: '100%',
    paddingLeft: 4,
  },
  crtHitCallbox: {
    paddingHorizontal: '5%',
    paddingTop: '8%',
    paddingBottom: '8%',
    overflow: 'hidden',
    width: '100%',
    maxWidth: '100%',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  attachBtnCallboxCorner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    right: 3,
    bottom: 3,
  },
  attachPlusCallbox: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '300',
    marginTop: -1,
  },
  inputColCallbox: {
    borderBottomWidth: 0,
    paddingBottom: 0,
    width: '100%',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  inputCallboxPad: {
    paddingLeft: 6,
  },
  crtHitShanghai: {
    paddingHorizontal: '7%',
    paddingTop: '9%',
    paddingBottom: '7%',
    overflow: 'hidden',
    width: '100%',
    maxWidth: '100%',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  /** С фото — почти весь чёрный CRT, марка сверху справа */
  crtHitShanghaiWithPhoto: {
    paddingHorizontal: '3%',
    paddingTop: '3%',
    paddingBottom: '4%',
  },
  crtHitArcade: {
    paddingHorizontal: '6%',
    paddingTop: '8%',
    paddingBottom: '5%',
    overflow: 'hidden',
    width: '100%',
    maxWidth: '100%',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  terminalMenuCrt: {
    flex: 1,
    width: '100%',
    gap: 0,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  attachBtnCrtCorner: {
    right: 2,
    bottom: 2,
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
  idleHintCallbox: {
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.4,
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
  terminalActiveStack: {
    justifyContent: 'flex-end',
    gap: 8,
  },
  terminalActiveStackTop: {
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  inputLayerBoothTop: {
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    width: '100%',
    marginTop: 0,
  },
  inputLayerBoothFill: {
    flex: 1,
    width: '100%',
    position: 'relative',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  cmdBlockBoothTop: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
  },
  cmdBlockBoothFill: {
    flex: 1,
    width: '100%',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  cmdBlockBoothWrap: {
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
  },
  inputColBoothFill: {
    borderBottomWidth: 0,
    paddingBottom: 0,
    width: '100%',
    flex: 1,
    minHeight: 0,
  },
  inputColWrapDown: {
    flex: 1,
    minHeight: 0,
    alignSelf: 'stretch',
  },
  inputBoothWrap: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: 0.4,
    textAlign: 'left',
    width: '100%',
  },
  inputFillWrapDown: {
    flex: 1,
    width: '100%',
    minHeight: 48,
    paddingRight: 36,
    textAlignVertical: 'top',
  },
  /** «+» absolute на CRT — не резервируем широкую колонку справа */
  inputFillWrapDownCorner: {
    paddingRight: 10,
  },
  inputFillWrapDownExclusion: {
    paddingRight: 8,
  },
  attachPreviewBooth: {
    alignSelf: 'flex-start',
  },
  menuLayerFlex: {
    position: 'relative',
    left: undefined,
    top: undefined,
    right: undefined,
    bottom: undefined,
    flex: 1,
    width: '100%',
  },
  inputLayerDock: {
    position: 'relative',
    left: undefined,
    top: undefined,
    right: undefined,
    bottom: undefined,
    flexGrow: 0,
    flexShrink: 0,
    width: '100%',
    zIndex: 3,
    gap: 6,
  },
  inputLayerShanghaiDock: {
    flex: 1,
    width: '100%',
    position: 'relative',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    paddingTop: 2,
  },
  inputLayerExclusionFill: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
    width: '100%',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    position: 'relative',
    overflow: 'hidden',
  },
  cmdBlockShanghaiTop: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    flexGrow: 0,
    flexShrink: 0,
  },
  cmdBlockMetroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    flexGrow: 0,
    flexShrink: 0,
    paddingTop: 2,
  },
  inputColMetroTop: {
    flex: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(210, 218, 235, 0.28)',
    paddingBottom: 3,
    minHeight: 22,
    justifyContent: 'center',
  },
  attachBtnShanghaiCorner: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    zIndex: 4,
  },
  attachBtnShanghaiHot: {
    right: 4,
    bottom: 6,
  },
  inputShanghaiPad: {
    paddingLeft: 10,
    paddingTop: 4,
  },
  inputMeasureHost: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    alignSelf: 'stretch',
  },
  attachPreviewShanghai: {
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  attachPreviewShanghaiCorner: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: '46%',
    aspectRatio: 0.82,
    maxHeight: '62%',
    alignSelf: 'auto',
    zIndex: 5,
    borderRadius: 8,
    borderColor: 'rgba(255, 70, 70, 0.35)',
  },
  inputColWithPhoto: {
    flex: 0,
    width: '48%',
    maxWidth: '48%',
    alignSelf: 'flex-start',
    paddingRight: 0,
  },
  inputColShanghaiWithPhoto: {
    width: '54%',
    maxWidth: '54%',
    paddingRight: 2,
  },
  inputWithPhoto: {
    paddingRight: 8,
    width: '100%',
  },
  inputShanghaiWithPhoto: {
    paddingLeft: 8,
    paddingRight: 4,
    fontSize: 17,
    lineHeight: 22,
  },
  /** Padding для native UITextView задаётся insets внутри модуля — тут только типографика */
  inputShanghaiExclusion: {
    paddingLeft: 0,
    paddingTop: 0,
    paddingRight: 0,
    fontFamily: Fonts.rounded,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '500',
    letterSpacing: -0.35,
  },
  inputColExclusionFill: {
    flex: 1,
    minHeight: 0,
    alignSelf: 'stretch',
    justifyContent: 'flex-start',
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  inputExclusionFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    minHeight: 0,
  },
  cmdBlockExclusionFill: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
    width: '100%',
    alignItems: 'stretch',
    alignSelf: 'stretch',
    justifyContent: 'flex-start',
  },
  cmdBlockDock: {
    alignItems: 'center',
    flexShrink: 0,
    width: '100%',
  },
  inputColDock: {
    flex: 1,
    minHeight: 22,
    justifyContent: 'flex-start',
  },
  inputFillDock: {
    minHeight: 22,
    paddingVertical: 2,
  },
  attachBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    marginLeft: 2,
  },
  attachBtnGlass: {
    borderColor: 'rgba(210, 218, 235, 0.35)',
  },
  attachBtnBooth: {
    borderColor: 'rgba(255, 190, 220, 0.4)',
  },
  attachPlus: {
    fontSize: 18,
    fontWeight: '200',
    lineHeight: 20,
    marginTop: -1,
  },
  attachPreview: {
    alignSelf: 'flex-start',
    width: 36,
    height: 36,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  attachPreviewImg: {
    width: '100%',
    height: '100%',
  },
  attachPreviewClear: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    padding: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  attachPreviewClearText: {
    fontSize: 11,
    fontWeight: '300',
    lineHeight: 12,
  },
  tapHintShanghai: {
    fontFamily: Fonts.rounded,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 4,
    lineHeight: 20,
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
    height: 0,
    flex: 0,
    overflow: 'hidden',
  },
  inputLayer: {
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
  promptLcd: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 0,
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
    fontFamily: Fonts.rounded,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '500',
    letterSpacing: -0.35,
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
  inputCrtTop: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  inputLcdTop: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: 0.2,
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
    borderBottomColor: 'rgba(255, 240, 248, 0.28)',
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
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
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
  menuIndexShanghai: {
    fontFamily: Fonts.rounded,
    fontSize: 11,
    fontWeight: '600',
    minWidth: 20,
    textAlign: 'left',
    lineHeight: 16,
    letterSpacing: -0.2,
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
  menuTextShanghai: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontFamily: Fonts.rounded,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
    letterSpacing: -0.3,
  },
  panelHit: {
    position: 'absolute',
    zIndex: 4,
  },
});
