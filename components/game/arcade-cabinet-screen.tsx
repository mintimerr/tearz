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

const SCENE_ASPECT = 1024 / 1536;
const ZOOM_MS = 600;
const ZOOM_EASING = Easing.bezier(0.22, 1, 0.36, 1);

function useCoverLayout(
  crt: TerminalNormRect,
  focus: TerminalNormRect,
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
    const focusCx = drawLeft + drawW * (focus.left + focus.width / 2);
    const focusCy = drawTop + drawH * (focus.top + focus.height / 2);
    const focusW = drawW * focus.width;
    const focusH = drawH * focus.height;

    const padTop = insets.top + 36;
    const padBottom = Math.max(insets.bottom, 10) + 8;
    const fit = Math.min((screenW - 12) / focusW, (screenH - padTop - padBottom) / focusH, 2.8);
    const zoomScale = Math.max(fit * 0.98, 1.7);

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
  }, [crt, focus, insets.bottom, insets.top, screenH, screenW]);
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
  const layout = useCoverLayout(crt, focus);

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
  const showHints = !typing;

  useEffect(() => {
    // Старт с idle-смещением (ATM: фасад + tearz справа)
    panX.value = layout.screenW * idlePanXNorm;
    panY.value = layout.screenH * idlePanYNorm;
    zoom.value = idleScale;
  }, [idlePanXNorm, idlePanYNorm, idleScale, layout.screenH, layout.screenW, panX, panY, zoom]);

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
    const stageCx = layout.screenW / 2;
    const stageCy = layout.screenH / 2;
    const lookY = layout.focusCy + (inZoom ? layout.crtBox.height * 0.08 : 0);
    const idleX = layout.screenW * idlePanXNorm;
    const idleY = layout.screenH * idlePanYNorm;
    const tx = inZoom ? -(layout.focusCx - stageCx) * (scale - 1) : idleX;
    const ty = inZoom ? -(lookY - stageCy) * (scale - 1) : idleY;
    zoomedSv.value = withTiming(inZoom ? 1 : 0, { duration: ZOOM_MS, easing: ZOOM_EASING });
    zoom.value = withTiming(scale, { duration: ZOOM_MS, easing: ZOOM_EASING });
    panX.value = withTiming(tx, { duration: ZOOM_MS, easing: ZOOM_EASING });
    panY.value = withTiming(ty, { duration: ZOOM_MS, easing: ZOOM_EASING });
  };

  const openCrt = () => {
    if (zoomed) {
      inputRef.current?.focus();
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setZoomed(true);
    applyCamera(true);
    // Фокус только когда зум доехал и CRT занял экран
    setTimeout(() => inputRef.current?.focus(), ZOOM_MS + 40);
  };

  const zoomOut = () => {
    Keyboard.dismiss();
    setFocused(false);
    setZoomed(false);
    applyCamera(false);
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
    const swayAmt = isLcd ? 0.55 : 1;
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
    const rot = isLcd
      ? 0
      : (interpolate(sway.value, [0, 1], [-0.35, 0.35]) +
          interpolate(drift.value, [0, 1], [-0.14, 0.14])) *
        ambient;
    const scale =
      zoom.value * interpolate(breathe.value, [0, 1], [1.02, 1.038]);
    return {
      transform: [{ scale }, { translateX: x }, { translateY: y }, { rotate: `${rot}deg` }],
    };
  });

  return (
    <View style={[styles.root, { backgroundColor: theme.rootBg }]}>
      <Animated.View
        style={[styles.cameraLayer, { width: layout.screenW, height: layout.screenH }, cameraStyle]}
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
          const Ambient = isLcd ? SunlightShimmer : NeonFlicker;
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
            {
              left: layout.crtBox.left,
              top: layout.crtBox.top,
              width: layout.crtBox.width,
              height: layout.crtBox.height,
              backgroundColor: phosphor,
            },
          ]}>
          {isLcd ? null : <CrtScanlines />}
          <Pressable
            style={styles.crtHit}
            onPress={openCrt}
          >
            <TerminalFace
              theme={theme}
              query={query}
              setQuery={setQuery}
              inputRef={inputRef}
              showHints={showHints}
              suggestions={suggestions}
              active={zoomed}
              onOpen={openCrt}
              onPick={pickSuggestion}
              onSubmit={submit}
              setFocused={setFocused}
            />
          </Pressable>
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

      {/* Chrome поверх сцены — иначе absoluteFill камеры перекрывает */}
      {gate !== 'transit' ? <GameBackButton tone="dark" /> : null}
      {gate !== 'transit' ? (
        <GameTeacherChatsButton tone="dark" onPress={() => setChatsOpen(true)} />
      ) : null}

      <TeacherChatsSheet visible={chatsOpen} onClose={() => setChatsOpen(false)} />

      {gate === 'transit' && seed ? (
        <Modal
          visible
          animationType="none"
          presentationStyle="fullScreen"
          onRequestClose={closeChat}>
          <TearzLessonTransit question={seed} onClose={closeChat} />
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
  onOpen,
  onPick,
  onSubmit,
  setFocused,
}: FaceProps) {
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
          {theme.idleLabel}
        </Animated.Text>
      </View>
    );
  }

  const startHint = theme.id === 'lcd' ? 'TIPPEN · START' : 'НАЖМИТЕ\nЧТОБЫ НАЧАТЬ';
  const lcd = theme.id === 'lcd';

  return (
    <View style={[styles.terminal, lcd && styles.terminalLcd]}>
      {showHints ? (
        <Animated.Text
          style={[styles.tapHint, lcd && styles.tapHintLcd, { color: theme.hot }, hintStyle]}>
          {startHint}
        </Animated.Text>
      ) : null}

      {!showHints || !lcd ? (
        <View style={[styles.cmdBlock, !showHints && styles.cmdBlockGrow]}>
          <Text style={[styles.prompt, { color: theme.hot }]}>{'>'}</Text>
          <View style={[styles.inputCol, !showHints && styles.inputColGrow]}>
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              placeholder=""
              placeholderTextColor={theme.dim}
              style={[styles.input, lcd && styles.inputLcd, { color: theme.fg }, !showHints && styles.inputFill]}
              maxLength={100}
              multiline
              returnKeyType="go"
              blurOnSubmit
              underlineColorAndroid="transparent"
              onFocus={() => {
                setFocused(true);
                onOpen();
              }}
              onBlur={() => setFocused(false)}
              onSubmitEditing={onSubmit}
              selectionColor={
                theme.id === 'lcd' ? 'rgba(142, 197, 240, 0.35)' : 'rgba(138, 255, 168, 0.35)'
              }
              cursorColor={theme.fg}
              caretHidden
            />
            {!query ? (
              <Animated.Text style={[styles.underscore, { color: theme.fg }, cursorStyle]}>
                _
              </Animated.Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {showHints ? (
        <View style={[styles.menuCol, lcd && styles.menuColLcd]}>
          {suggestions.map((s, i) => (
            <Pressable
              key={s}
              onPress={() => onPick(s)}
              style={({ pressed }) => [
                styles.menuItem,
                lcd && styles.menuItemLcd,
                pressed && styles.menuItemOn,
              ]}
              accessibilityRole="button"
              accessibilityLabel={s}>
              <Text style={[styles.menuIndex, lcd && styles.menuIndexLcd, { color: theme.hot }]}>
                {i + 1}
              </Text>
              <Text style={[styles.menuText, lcd && styles.menuTextLcd, { color: theme.fg }]} numberOfLines={1}>
                {s}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
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
  crtGlass: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: 'transparent',
    zIndex: 6,
  },
  crtHit: {
    flex: 1,
    paddingHorizontal: '8%',
    paddingTop: '10%',
    paddingBottom: '10%',
    zIndex: 2,
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
    justifyContent: 'space-between',
  },
  terminalLcd: {
    justifyContent: 'flex-start',
    gap: 8,
    paddingTop: 2,
  },
  tapHint: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    lineHeight: 12,
    marginBottom: 6,
    textAlign: 'left',
  },
  tapHintLcd: {
    fontSize: 11,
    letterSpacing: 1,
    lineHeight: 14,
    marginBottom: 2,
    textAlign: 'center',
    alignSelf: 'stretch',
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
  prompt: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
    marginTop: 1,
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
  inputFill: {
    flex: 1,
    alignSelf: 'stretch',
  },
  underscore: {
    position: 'absolute',
    left: 0,
    top: 0,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  menuCol: {
    flex: 1,
    justifyContent: 'space-evenly',
    paddingTop: 4,
    minHeight: 0,
  },
  menuColLcd: {
    flex: 0,
    justifyContent: 'flex-start',
    gap: 5,
    paddingTop: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    paddingVertical: 2,
  },
  menuItemLcd: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 3,
    minHeight: 18,
  },
  menuItemOn: {
    opacity: 0.55,
  },
  menuIndex: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
    minWidth: 12,
  },
  menuIndexLcd: {
    minWidth: 14,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
    lineHeight: 15,
  },
  menuText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
  menuTextLcd: {
    fontWeight: '600',
    lineHeight: 15,
  },
  panelHit: {
    position: 'absolute',
    zIndex: 4,
  },
});
