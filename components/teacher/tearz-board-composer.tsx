import { Ionicons } from '@expo/vector-icons';
import { Kalam_700Bold, useFonts } from '@expo-google-fonts/kalam';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { TeacherAttachGallery } from '@/components/teacher/teacher-attach-gallery';
import {
  type TeacherComposerAttachment,
  type TeacherHomeComposerRef,
} from '@/components/teacher/teacher-home-composer';
import { TearzBoardPerformer } from '@/components/teacher/tearz-board-performer';
import { BoardInkJuice } from '@/components/teacher/board-ink-juice';
import { TEARZ_TEACHER_ASPECT } from '@/components/teacher/tearz-board-hero';
import { APP_THEME } from '@/constants/theme';
import { useBoardPerformance } from '@/hooks/use-board-performance';
import { estimateBoardInkCursor } from '@/utils/board-ink-cursor';

const BOARD_SCENE = require('@/assets/board-concept/tearz-scene-board-wide.png');

const BOARD_IMAGE_ASPECT = 1.5;
/** Доля белой поверхности внутри PNG (калибровка под tearz-scene-board-wide). */
const SURFACE_INSET = { left: 0.118, top: 0.095, width: 0.698, height: 0.528 };

const SEND_SIZE = 38;
const SEND_ACTIVE_BG = '#111111';
const SEND_ACTIVE_ICON = '#FFFFFF';
const MARKER_COLOR = '#152238';
const MARKER_HINT = 'rgba(21, 34, 56, 0.46)';
const MARKER_PLACEHOLDER = 'rgba(21, 34, 56, 0.36)';
const MARKER_INK_SHADOW = 'rgba(21, 34, 56, 0.11)';

const ZOOM_MS = 780;
const CHAT_ENTER_MS = 920;
const CHAT_EXIT_MS = 700;
const FOLLOW_MS = 280;
const ZOOM_EASING = Easing.bezier(0.25, 0.1, 0.25, 1);
const CHAT_EASING = Easing.bezier(0.22, 1, 0.36, 1);
const FONT_SIZE = 28;
const LINE_HEIGHT = 36;
const BANNER_FONT_MAX = 34;
const BANNER_LINE_MAX = 41;
/** Наклон текста под перспективу доски (левый выше, правый ниже). */
const BOARD_INK_SKEW_Y = 2.6;
const BOARD_INK_ROTATE_Z = -0.35;
/** Общая перспектива маркера на белой поверхности доски. */
const BOARD_INK_TRANSFORM = [
  { skewY: `${BOARD_INK_SKEW_Y}deg` },
  { rotateZ: `${BOARD_INK_ROTATE_Z}deg` },
] as const;
const HINT_SIZE = 19;
const HINT_LINE = 24;
const CONTROLS_GAP = 10;
const CONTROLS_DOCK_W = SEND_SIZE * 2 + 22;
const CONTROLS_DOCK_H = SEND_SIZE + 10;
const PENDING_ROW_H = 34;

type BoardLayout = {
  boardPadX: number;
  boardTop: number;
  boardH: number;
  imgLeft: number;
  imgTop: number;
  imgW: number;
  imgH: number;
  writeLeft: number;
  writeTop: number;
  writeW: number;
  writeH: number;
  surfaceLeft: number;
  surfaceTop: number;
  surfaceW: number;
  surfaceH: number;
  inkRelLeft: number;
  inkRelTop: number;
  zoomWriteLeft: number;
  zoomWriteTop: number;
  zoomWriteW: number;
  zoomWriteH: number;
  zoomInkW: number;
  zoomScale: number;
  tearzW: number;
  tearzH: number;
  tearzRight: number;
  tearzBottom: number;
};

function computeTearzSize(screenW: number, stageH: number) {
  /** Крупный Tearz: ~60% высоты сцены, без обрезки. */
  let tearzH = stageH * 0.6;
  let tearzW = tearzH * TEARZ_TEACHER_ASPECT;
  const maxW = screenW * 0.86;
  if (tearzW > maxW) {
    tearzW = maxW;
    tearzH = tearzW / TEARZ_TEACHER_ASPECT;
  }
  return {
    tearzW,
    tearzH,
    tearzRight: 0,
    /** Чуть выше нижнего края — наезжает на доску. */
    tearzBottom: Math.round(stageH * 0.088),
  };
}

/** Масштаб зума: белая поверхность заполняет экран. */
function computeZoomScale(screenW: number, stageH: number, surfaceW: number, surfaceH: number) {
  const padX = 14;
  const padTop = 22;
  const padBottom = 108;
  const availW = screenW - padX * 2;
  const availH = stageH - padTop - padBottom;
  return Math.min(availW / surfaceW, availH / surfaceH, 4.6);
}

function computeBoardLayout(screenW: number, stageH: number): BoardLayout {
  const { tearzW, tearzH, tearzRight, tearzBottom } = computeTearzSize(screenW, stageH);

  const boardPadX = 8;
  const boardTop = 0;
  const boardH = stageH;
  /** Опускаем доску к уровню указывающей руки Tearz. */
  const boardDrop = stageH * 0.1;
  const containerW = screenW - boardPadX * 2;
  const containerAspect = containerW / (boardH - boardDrop);

  let imgW: number;
  let imgH: number;
  if (containerAspect > BOARD_IMAGE_ASPECT) {
    imgH = boardH - boardDrop - 8;
    imgW = imgH * BOARD_IMAGE_ASPECT;
  } else {
    imgW = containerW;
    imgH = containerW / BOARD_IMAGE_ASPECT;
  }

  const imgLeft = boardPadX + (containerW - imgW) / 2 - screenW * 0.049;
  const imgTop = boardTop + boardDrop + stageH * 0.048;

  /** Шире вправо (левый край не трогаем), чуть выше по вертикали. */
  imgW *= 1.1;
  imgH *= 1.07;

  const surfaceLeft = imgLeft + imgW * SURFACE_INSET.left;
  const surfaceTop = imgTop + imgH * SURFACE_INSET.top;
  const surfaceW = imgW * SURFACE_INSET.width;
  const surfaceH = imgH * SURFACE_INSET.height;

  const writeLeft = surfaceLeft + surfaceW * 0.04;
  const writeTop = surfaceTop + surfaceH * 0.14;
  /** Почти вся белая поверхность — баннер + ввод. */
  const writeW = surfaceW * 0.88;
  /** При зуме — та же ширина (Tearz у доски убран). */
  const zoomInkW = writeW;
  const writeH = surfaceH * 0.82;
  const zoomScale = computeZoomScale(screenW, stageH, surfaceW, surfaceH);

  return {
    boardPadX,
    boardTop,
    boardH,
    imgLeft,
    imgTop,
    imgW,
    imgH,
    writeLeft,
    writeTop,
    writeW,
    writeH,
    surfaceLeft,
    surfaceTop,
    surfaceW,
    surfaceH,
    inkRelLeft: writeLeft - surfaceLeft,
    inkRelTop: writeTop - surfaceTop,
    zoomWriteLeft: writeLeft,
    zoomWriteTop: writeTop,
    zoomWriteW: zoomInkW,
    zoomWriteH: writeH,
    zoomInkW,
    zoomScale,
    tearzW,
    tearzH,
    tearzRight,
    tearzBottom,
  };
}

function savedTypography(text: string, areaW: number, areaH: number) {
  const lines = text.split('\n');
  const charW = 11.5;
  const estLines = lines.reduce((sum, line) => {
    const wraps = Math.max(1, Math.ceil(line.length / Math.max(1, Math.floor(areaW / charW))));
    return sum + wraps;
  }, 0);

  let fontSize = Math.min(28, Math.max(15, (areaH / Math.max(1, estLines)) * 0.88));
  if (text.length > 80) fontSize *= 0.9;
  if (text.length > 160) fontSize *= 0.82;
  if (text.length > 280) fontSize *= 0.76;

  const lineHeight = Math.round(fontSize * 1.26);
  return { fontSize, lineHeight };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Декоративная маркерная линия под баннером на доске. */
function BoardMarkerAccent({ width }: { width: number }) {
  const h = 14;
  const w = Math.max(80, width);
  return (
    <View style={[styles.boardAccentWrap, { width: w }]}>
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <Path
          d={`M 2 ${h - 4} C ${w * 0.28} ${h - 10}, ${w * 0.62} ${h - 1}, ${w - 2} ${h - 6}`}
          stroke={MARKER_COLOR}
          strokeWidth={1.8}
          fill="none"
          strokeLinecap="round"
          opacity={0.22}
        />
      </Svg>
    </View>
  );
}

type Props = {
  onSubmit: (question: string, attachment?: TeacherComposerAttachment | null) => void;
  disabled?: boolean;
  /** Плейсхолдер в поле ввода при зуме. */
  placeholderOverride?: string;
  /** Бегущие подсказки на доске в покое (без ввода). */
  idleBoardPrompt?: string;
  /** Статичная подсказка «нажми на доску». */
  idleTapHint?: string;
  /** Тап по доске — режим ввода (зум). */
  onFocusChange?: (focused: boolean) => void;
  /** Отправка с доски открывает чат (без zoomOut). */
  submitOpensChat?: boolean;
  /** Чат открыт — камера въезжает в доску. */
  chatOpen?: boolean;
};

export type { TeacherComposerAttachment, TeacherHomeComposerRef };

export const TearzBoardComposer = forwardRef<TeacherHomeComposerRef, Props>(function TearzBoardComposer(
  {
    onSubmit,
    disabled,
    placeholderOverride,
    idleBoardPrompt,
    idleTapHint,
    onFocusChange,
    submitOpensChat = false,
    chatOpen = false,
  },
  ref,
) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [fontsLoaded] = useFonts({ Kalam_700Bold });

  const layout = useMemo(() => {
    const stageH = Math.max(380, screenH - 150);
    return { stageH, ...computeBoardLayout(screenW, stageH) };
  }, [screenW, screenH]);

  const {
    stageH,
    boardTop,
    boardH,
    imgLeft,
    imgTop,
    imgW,
    imgH,
    writeLeft,
    writeTop,
    writeW,
    writeH,
    surfaceLeft,
    surfaceTop,
    surfaceW,
    surfaceH,
    inkRelLeft,
    inkRelTop,
    zoomWriteLeft,
    zoomWriteTop,
    zoomWriteW,
    zoomWriteH,
    zoomInkW,
    zoomScale,
    tearzW,
    tearzH,
    tearzRight,
    tearzBottom,
  } = layout;

  const [draft, setDraft] = useState('');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [inputH, setInputH] = useState(LINE_HEIGHT);
  const [attachOpen, setAttachOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<TeacherComposerAttachment | null>(null);
  const inputRef = useRef<TextInput>(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const controlsBusyRef = useRef(false);
  const zoomOutBusyRef = useRef(false);
  const prevZoomedRef = useRef(false);
  const canSend = (draft.trim().length > 0 || pendingAttachment !== null) && !disabled;

  const [chatLayer, setChatLayer] = useState(false);
  const boardInputActive = zoomed && !chatOpen && !chatLayer;
  const activeWriteW = boardInputActive ? zoomInkW : writeW;
  const { performance: boardPerformance, applyDraftChange, applySelectionChange, resetSync, draftRef } =
    useBoardPerformance({
      writeW: activeWriteW,
      writeH,
      lineHeight: LINE_HEIGHT,
      fontSize: FONT_SIZE,
      draft,
      canSend,
      zoomed,
      attachOpen,
      chatOpen,
      chatLayer,
    });

  const zoom = useSharedValue(1);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const kickX = useSharedValue(0);
  const kickY = useSharedValue(0);
  const chatEnter = useSharedValue(0);
  const decorFade = useSharedValue(1);
  const lastKickPulse = useRef(0);

  const savedStyle = useMemo(
    () => (draft ? savedTypography(draft, writeW, writeH) : { fontSize: FONT_SIZE, lineHeight: LINE_HEIGHT }),
    [draft, writeW, writeH],
  );

  /** Кнопки «+» и «↑» — горизонтально за курсором, вертикально всегда под всем текстом. */
  const controlsPos = useMemo(() => {
    const inkW = zoomed ? zoomInkW : writeW;
    const pendingOffset = pendingAttachment ? PENDING_ROW_H : 0;
    const cursorAt = clamp(selection.end, 0, draft.length);
    const cursor = estimateBoardInkCursor(draft, cursorAt, inkW, LINE_HEIGHT, FONT_SIZE);
    const textEnd = estimateBoardInkCursor(draft, draft.length, inkW, LINE_HEIGHT, FONT_SIZE);

    const textBlockBottom =
      pendingOffset + Math.max(textEnd.y + LINE_HEIGHT, draft.trim() ? inputH : 0);
    const minTop = writeTop + textBlockBottom + CONTROLS_GAP;

    let left = writeLeft + (draft.trim() ? cursor.x : 0);
    let top = minTop;

    if (!draft.trim()) {
      left = writeLeft;
      top = writeTop + pendingOffset + CONTROLS_GAP;
    }

    left = clamp(left, surfaceLeft + 4, surfaceLeft + surfaceW - CONTROLS_DOCK_W - 4);
    const maxTop = surfaceTop + surfaceH - CONTROLS_DOCK_H - 4;
    top = maxTop >= minTop ? clamp(top, minTop, maxTop) : minTop;

    return { left, top, width: CONTROLS_DOCK_W };
  }, [
    draft,
    selection.end,
    inputH,
    writeLeft,
    writeTop,
    writeW,
    zoomed,
    zoomInkW,
    surfaceLeft,
    surfaceTop,
    surfaceW,
    surfaceH,
    pendingAttachment,
  ]);

  const applyCameraForChat = (enter: boolean, animateMs = CHAT_ENTER_MS) => {
    const scale = enter ? zoomScale : 1;
    const stageCenterX = screenW / 2;
    const stageCenterY = stageH / 2;
    const fx = surfaceLeft + surfaceW * 0.5;
    const fy = surfaceTop + surfaceH * 0.4;
    const tx = enter ? -(fx - stageCenterX) * (scale - 1) : 0;
    const ty = enter ? -(fy - stageCenterY) * (scale - 1) : 0;
    const easing = CHAT_EASING;
    zoom.value = withTiming(scale, { duration: animateMs, easing });
    panX.value = withTiming(tx, { duration: animateMs, easing });
    panY.value = withTiming(ty, { duration: animateMs, easing });
  };

  const hideChatLayer = () => setChatLayer(false);

  useEffect(() => {
    if (chatOpen) {
      controlsBusyRef.current = true;
      setAttachOpen(false);
      inputRef.current?.blur();
      Keyboard.dismiss();
      setZoomed(false);
      onFocusChange?.(false);
      setChatLayer(true);
      chatEnter.value = 0;
      decorFade.value = 1;
      const id = requestAnimationFrame(() => {
        chatEnter.value = withTiming(1, { duration: CHAT_ENTER_MS, easing: CHAT_EASING });
        decorFade.value = withTiming(0, { duration: CHAT_ENTER_MS * 0.78, easing: CHAT_EASING });
        applyCameraForChat(true, CHAT_ENTER_MS);
      });
      const unlock = setTimeout(() => {
        controlsBusyRef.current = false;
      }, CHAT_ENTER_MS + 48);
      return () => {
        cancelAnimationFrame(id);
        clearTimeout(unlock);
      };
    }

    if (!chatLayer) return;

    chatEnter.value = withTiming(0, { duration: CHAT_EXIT_MS, easing: CHAT_EASING }, (finished) => {
      if (finished) runOnJS(hideChatLayer)();
    });
    decorFade.value = withTiming(1, { duration: CHAT_EXIT_MS, easing: CHAT_EASING });
    applyCameraForChat(false, CHAT_EXIT_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatOpen]);

  const applyCamera = (
    inZoom: boolean,
    cursorX = 0,
    cursorY = 0,
    animateMs = ZOOM_MS,
    focusSurface = false,
  ) => {
    const scale = inZoom ? zoomScale : 1;
    const stageCenterX = screenW / 2;
    const stageCenterY = stageH / 2;

    const lookAheadX = 18;
    const lookAheadY = LINE_HEIGHT * 0.4;

    const inkLeft = zoomWriteLeft;
    const inkTop = zoomWriteTop;
    const inkW = zoomWriteW;

    const rawFx = focusSurface
      ? inkLeft + inkW * 0.38
      : inkLeft + cursorX + lookAheadX;
    const rawFy = focusSurface
      ? inkTop + zoomWriteH * 0.32
      : inkTop + cursorY + lookAheadY;

    const textEndY = estimateBoardInkCursor(draft, draft.length, inkW, LINE_HEIGHT, FONT_SIZE).y + LINE_HEIGHT;
    const followMaxY = inkTop + Math.max(zoomWriteH, textEndY) + LINE_HEIGHT * 1.15;

    const fx = clamp(rawFx, inkLeft + 2, inkLeft + inkW);
    const fy = clamp(rawFy, inkTop + LINE_HEIGHT * 0.3, followMaxY);

    const tx = inZoom ? -(fx - stageCenterX) * (scale - 1) : 0;
    const ty = inZoom ? -(fy - stageCenterY) * (scale - 1) : 0;

    const easing = ZOOM_EASING;
    zoom.value = withTiming(scale, { duration: animateMs, easing });
    panX.value = withTiming(tx, { duration: animateMs, easing });
    panY.value = withTiming(ty, { duration: animateMs, easing });
  };

  useEffect(() => {
    if (chatOpen || chatLayer) return;
    if (!zoomed) {
      if (prevZoomedRef.current) {
        prevZoomedRef.current = false;
        applyCamera(false);
      }
      return;
    }
    prevZoomedRef.current = true;
    if (selection.start === 0 && draft.length === 0) {
      applyCamera(true, 0, 0, ZOOM_MS, true);
      return;
    }
    const { x, y } = estimateBoardInkCursor(draft, selection.start, zoomWriteW, LINE_HEIGHT, FONT_SIZE);
    applyCamera(true, x, y, FOLLOW_MS, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomed, draft, selection.start, screenW, stageH, zoomWriteW, zoomWriteLeft, zoomWriteTop, zoomWriteH, zoomScale]);

  // Camera kick на буквы отключён — давал ощущение «трясущейся фигурки».

  const stageMotion = useAnimatedStyle(() => ({
    transform: [
      { translateX: panX.value + kickX.value },
      { translateY: panY.value + kickY.value },
      { scale: zoom.value },
    ],
  }));

  const decorMotion = useAnimatedStyle(() => ({
    opacity: decorFade.value,
  }));

  const tearzMotion = useAnimatedStyle(() => ({
    opacity: decorFade.value,
    transform: [
      {
        translateX: interpolate(chatEnter.value, [0, 0.45], [0, 36], Extrapolation.CLAMP),
      },
      {
        scale: interpolate(chatEnter.value, [0, 0.5], [1, 0.96], Extrapolation.CLAMP),
      },
    ],
  }));

  const whiteWashMotion = useAnimatedStyle(() => ({
    opacity: interpolate(chatEnter.value, [0.22, 0.62], [0, 0.92], Extrapolation.CLAMP),
  }));

  const controlsCounterMotion = useAnimatedStyle(() => {
    const inv = zoom.value > 1.02 ? 1 / zoom.value : 1;
    return {
      transform: [{ scale: inv }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transformOrigin: 'top left' as any,
    };
  });

  /** Тап — вся белая поверхность; текст — в write-зоне слева. */
  const boardSurfaceStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      left: surfaceLeft,
      top: surfaceTop,
      width: surfaceW,
      height: surfaceH,
      zIndex: 12,
    }),
    [surfaceLeft, surfaceTop, surfaceW, surfaceH],
  );

  const writeZoneStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      left: writeLeft,
      top: writeTop,
      width: writeW,
      height: writeH,
      zIndex: 13,
    }),
    [writeLeft, writeTop, writeW, writeH],
  );

  const surfaceClipStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      left: surfaceLeft,
      top: surfaceTop,
      width: surfaceW,
      height: surfaceH,
      zIndex: 14,
      overflow: 'visible' as const,
    }),
    [surfaceLeft, surfaceTop, surfaceW, surfaceH],
  );

  const inkFieldStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      left: inkRelLeft,
      top: inkRelTop,
      width: writeW,
      minHeight: writeH,
    }),
    [inkRelLeft, inkRelTop, writeW, writeH],
  );

  const zoomOut = () => {
    if (!zoomed || zoomOutBusyRef.current) return;
    zoomOutBusyRef.current = true;
    void Haptics.selectionAsync();
    setZoomed(false);
    setSelection({ start: 0, end: 0 });
    selectionRef.current = { start: 0, end: 0 };
    resetSync();
    onFocusChange?.(false);
    inputRef.current?.blur();
    Keyboard.dismiss();
    setTimeout(() => {
      zoomOutBusyRef.current = false;
    }, ZOOM_MS + 40);
  };

  const openBoard = () => {
    if (disabled) return;
    void Haptics.selectionAsync();
    zoomIn();
  };

  const zoomIn = () => {
    if (disabled) return;
    void Haptics.selectionAsync();
    prevZoomedRef.current = false;
    draftRef.current = draft;
    setSelection({ start: draft.length, end: draft.length });
    selectionRef.current = { start: draft.length, end: draft.length };
    setZoomed(true);
    onFocusChange?.(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  useImperativeHandle(ref, () => ({
    focus: () => {
      openBoard();
    },
    clear: () => {
      setDraft('');
      draftRef.current = '';
      resetSync();
      setPendingAttachment(null);
      setAttachOpen(false);
      setZoomed(false);
    },
    blur: () => {
      inputRef.current?.blur();
      Keyboard.dismiss();
      setZoomed(false);
      onFocusChange?.(false);
    },
    setDraft: (text: string) => {
      setDraft(text);
      setAttachOpen(false);
    },
  }));

  const submit = () => {
    const q = draft.trim();
    if ((!q && !pendingAttachment) || disabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAttachOpen(false);
    const attachment = pendingAttachment;
    setDraft('');
    setPendingAttachment(null);

    if (submitOpensChat) {
      Keyboard.dismiss();
      inputRef.current?.blur();
      setZoomed(false);
      onFocusChange?.(false);
      onSubmit(q, attachment);
      return;
    }

    zoomOut();
    onSubmit(q, attachment);
  };

  const onGalleryPhoto = (uri: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPendingAttachment({ kind: 'image', uri });
    setAttachOpen(false);
  };

  const handleBrowseFiles = async () => {
    if (disabled) return;
    setAttachOpen(false);
    if (Platform.OS === 'web') {
      Alert.alert('Файлы', 'Выбор файлов доступен в приложении на iOS или Android.');
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      const asset = result.assets[0];
      const { uri, name, mimeType } = asset;
      const isImage =
        mimeType?.startsWith('image/') === true ||
        /\.(jpe?g|png|gif|webp|heic|bmp)$/i.test(name ?? '');

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (isImage) {
        setPendingAttachment({ kind: 'image', uri, name: name ?? undefined });
      } else {
        setPendingAttachment({
          kind: 'file',
          uri,
          fileName: name?.trim() || 'Файл',
          mimeType,
        });
      }
    } catch {
      Alert.alert('Файлы', 'Не удалось открыть приложение «Файлы».');
    }
  };

  const markerFamily = fontsLoaded ? 'Kalam_700Bold' : undefined;

  return (
    <View style={styles.root}>
      {attachOpen ? (
        <Pressable
          style={styles.attachBackdrop}
          onPress={() => setAttachOpen(false)}
          accessibilityLabel="Закрыть"
        />
      ) : null}

      {attachOpen ? (
        <View style={[styles.attachPanel, { top: Math.max(12, screenH * 0.08) }]}>
          <TeacherAttachGallery visible={attachOpen} onPhotoSelected={onGalleryPhoto} />
          <Pressable
            onPress={() => void handleBrowseFiles()}
            style={({ pressed }) => [styles.attachFileBtn, pressed && styles.attachFileBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Выбрать файл">
            <Ionicons name="document-outline" size={18} color="#444" />
            <Text style={styles.attachMenuLabel}>Файл</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.stageClip, { height: stageH, overflow: chatOpen || chatLayer ? 'hidden' : 'visible' }]}>
        <Animated.View
          pointerEvents="box-none"
          style={[styles.stage, stageMotion, { height: stageH, width: screenW }]}>
          <View
            pointerEvents="box-none"
            style={[styles.stageCompose, { width: screenW, height: stageH }]}>
            {/* ── Доска: задний план на весь экран ── */}
            <Animated.View pointerEvents="none" style={decorMotion}>
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: imgLeft,
                  top: imgTop,
                  width: imgW,
                  height: imgH,
                  zIndex: 0,
                }}>
                <Image
                  source={BOARD_SCENE}
                  style={styles.boardImage}
                  contentFit="fill"
                  cachePolicy="memory-disk"
                  priority="high"
                />
              </View>
            </Animated.View>

            {!zoomed && !chatLayer ? (
              <View pointerEvents="box-none" style={boardSurfaceStyle} collapsable={false}>
                <Pressable
                  style={StyleSheet.absoluteFillObject}
                  onPress={openBoard}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityLabel={idleTapHint ?? 'Начать ввод на доске'}
                />
              </View>
            ) : null}

            {!zoomed && !draft && (idleTapHint || idleBoardPrompt) ? (
              <Animated.View
                pointerEvents="none"
                style={[styles.boardBannerLayer, writeZoneStyle, decorMotion]}>
                <View style={styles.boardChalkDust} pointerEvents="none">
                  <View style={[styles.chalkDot, styles.chalkDotA]} />
                  <View style={[styles.chalkDot, styles.chalkDotB]} />
                  <View style={[styles.chalkDot, styles.chalkDotC]} />
                </View>
                <View style={styles.boardBannerBlock}>
                  {idleBoardPrompt ? (
                    <View style={[styles.boardInkPlane, styles.boardHeadlinePlane]}>
                      <Text
                        style={[
                          styles.boardHeadline,
                          styles.markerInkDepth,
                          {
                            fontFamily: markerFamily,
                            fontSize: BANNER_FONT_MAX,
                            lineHeight: BANNER_LINE_MAX,
                          },
                        ]}>
                        {idleBoardPrompt}
                      </Text>
                    </View>
                  ) : null}
                  {idleTapHint ? (
                    <View style={[styles.boardInkPlane, styles.boardCtaRow]}>
                      <Text
                        style={[
                          styles.boardCtaInk,
                          styles.markerInkDepthSoft,
                          { fontFamily: markerFamily, fontSize: HINT_SIZE, lineHeight: HINT_LINE },
                        ]}>
                        {idleTapHint}
                      </Text>
                    </View>
                  ) : null}
                  <View style={[styles.boardInkPlane, styles.boardAccentPlane]}>
                    <BoardMarkerAccent width={writeW * 0.72} />
                  </View>
                </View>
              </Animated.View>
            ) : null}

            {!zoomed && !chatLayer && (draft || pendingAttachment) ? (
              <>
                {draft ? (
                  <View pointerEvents="none" style={[styles.boardWriteLayer, writeZoneStyle]}>
                    <View style={styles.boardInkField}>
                      <Text
                        style={[
                          styles.markerText,
                          styles.markerInkDepth,
                          {
                            fontFamily: markerFamily,
                            fontSize: savedStyle.fontSize,
                            lineHeight: savedStyle.lineHeight,
                          },
                        ]}>
                        {draft}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {pendingAttachment ? (
                  <View pointerEvents="auto" style={[styles.pendingRow, writeZoneStyle]}>
                    <Ionicons
                      name={pendingAttachment.kind === 'image' ? 'image-outline' : 'document-outline'}
                      size={14}
                      color="rgba(21, 34, 56, 0.55)"
                    />
                    <Text style={[styles.pendingText, { fontFamily: markerFamily }]} numberOfLines={1}>
                      {pendingAttachment.kind === 'image'
                        ? pendingAttachment.name ?? 'Фото'
                        : pendingAttachment.fileName}
                    </Text>
                    <Pressable
                      onPress={() => setPendingAttachment(null)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Убрать вложение">
                      <Ionicons name="close-circle" size={17} color="rgba(21, 34, 56, 0.38)" />
                    </Pressable>
                  </View>
                ) : null}
              </>
            ) : null}

            {zoomed && !chatOpen && !chatLayer ? (
              <>
                <Pressable
                  style={styles.zoomDismiss}
                  onPress={zoomOut}
                  accessibilityRole="button"
                  accessibilityLabel="Свернуть доску"
                />
                <View pointerEvents="box-none" style={surfaceClipStyle}>
                  <View pointerEvents="box-none" style={[styles.boardInkField, inkFieldStyle, { width: zoomInkW }]}>
                    {pendingAttachment ? (
                      <View style={styles.pendingRow} pointerEvents="auto">
                        <Ionicons
                          name={pendingAttachment.kind === 'image' ? 'image-outline' : 'document-outline'}
                          size={14}
                          color="rgba(21, 34, 56, 0.55)"
                        />
                        <Text style={[styles.pendingText, { fontFamily: markerFamily }]} numberOfLines={1}>
                          {pendingAttachment.kind === 'image'
                            ? pendingAttachment.name ?? 'Фото'
                            : pendingAttachment.fileName}
                        </Text>
                        <Pressable
                          onPress={() => setPendingAttachment(null)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel="Убрать вложение">
                          <Ionicons name="close-circle" size={17} color="rgba(21, 34, 56, 0.38)" />
                        </Pressable>
                      </View>
                    ) : null}

                    <View pointerEvents="auto" style={styles.inputTouch}>
                      <TextInput
                        ref={inputRef}
                        style={[
                          styles.markerInput,
                          {
                            fontFamily: markerFamily,
                            fontSize: FONT_SIZE,
                            lineHeight: LINE_HEIGHT,
                            height: Math.max(writeH, inputH),
                          },
                        ]}
                        value={draft}
                        onChangeText={(next) => {
                          const prev = draft;
                          let cursorAt = selectionRef.current.start;
                          if (next.length === prev.length + 1 && next.startsWith(prev)) {
                            cursorAt = next.length;
                          } else if (next.length < prev.length) {
                            cursorAt = Math.min(cursorAt, next.length);
                          } else {
                            cursorAt = Math.min(next.length, Math.max(0, cursorAt));
                          }
                          setDraft(next);
                          applyDraftChange(next, cursorAt);
                        }}
                        onSelectionChange={(e) => {
                          const { start, end } = e.nativeEvent.selection;
                          selectionRef.current = { start, end };
                          setSelection({ start, end });
                          applySelectionChange(draft, end);
                        }}
                        onContentSizeChange={(e) => {
                          setInputH(Math.max(LINE_HEIGHT, e.nativeEvent.contentSize.height));
                        }}
                        onBlur={() => {
                          if (controlsBusyRef.current || zoomOutBusyRef.current) return;
                          if (zoomed) zoomOut();
                        }}
                        scrollEnabled
                        placeholder={!draft ? (placeholderOverride ?? '') : ''}
                        placeholderTextColor={MARKER_PLACEHOLDER}
                        multiline
                        maxLength={2000}
                        editable={!disabled && boardInputActive}
                        autoCorrect
                        autoCapitalize="sentences"
                        returnKeyType="default"
                        blurOnSubmit={false}
                        textAlignVertical="top"
                        caretHidden={boardInputActive}
                        selectionColor={boardInputActive ? 'rgba(21, 34, 56, 0.12)' : MARKER_COLOR}
                        cursorColor={boardInputActive ? 'transparent' : MARKER_COLOR}
                      />
                    </View>
                  </View>

                  {(boardPerformance.kind === 'type' || boardPerformance.kind === 'delete') ? (
                    <BoardInkJuice
                      pulse={boardPerformance.pulse}
                      kind={boardPerformance.kind}
                      x={inkRelLeft + boardPerformance.actionX}
                      y={inkRelTop + boardPerformance.actionY}
                    />
                  ) : null}

                  <Animated.View
                    pointerEvents="box-none"
                    style={[
                      styles.boardControls,
                      controlsCounterMotion,
                      {
                        left: controlsPos.left - surfaceLeft,
                        top: controlsPos.top - surfaceTop,
                        width: controlsPos.width,
                      },
                    ]}>
                    <View style={styles.boardControlsDock}>
                      <Pressable
                        onPressIn={() => {
                          controlsBusyRef.current = true;
                        }}
                        onPressOut={() => {
                          controlsBusyRef.current = false;
                        }}
                        onPress={() => {
                          if (disabled) return;
                          void Haptics.selectionAsync();
                          setAttachOpen((open) => !open);
                        }}
                        disabled={disabled}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={attachOpen ? 'Закрыть меню вложений' : 'Прикрепить'}
                        style={({ pressed }) => [
                          styles.boardBtn,
                          styles.boardBtnAttach,
                          (attachOpen || pendingAttachment) && styles.boardBtnAttachOn,
                          pressed && styles.boardBtnPressed,
                        ]}>
                        <Ionicons
                          name={attachOpen ? 'close' : 'add'}
                          size={20}
                          color={attachOpen || pendingAttachment ? '#333' : '#666'}
                        />
                      </Pressable>

                      <Pressable
                        onPressIn={() => {
                          controlsBusyRef.current = true;
                        }}
                        onPressOut={() => {
                          controlsBusyRef.current = false;
                        }}
                        onPress={submit}
                        disabled={!canSend}
                        hitSlop={8}
                        style={({ pressed }) => [
                          styles.boardBtn,
                          canSend ? styles.boardBtnSendOn : styles.boardBtnSendOff,
                          canSend && pressed && styles.boardBtnPressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Отправить">
                        <Ionicons name="arrow-up" size={18} color={canSend ? SEND_ACTIVE_ICON : '#AAA'} />
                      </Pressable>
                    </View>
                  </Animated.View>
                </View>
              </>
            ) : null}

            {(chatOpen || chatLayer) ? (
              <Animated.View pointerEvents="none" style={[styles.chatWhiteWash, whiteWashMotion]} />
            ) : null}
          </View>
        </Animated.View>

        {/* Tearz только вне зума — у доски маскот убран (нет нормальной анимации письма). */}
        {!chatLayer && !zoomed ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.tearzHero,
              tearzMotion,
              { width: tearzW, height: tearzH, right: tearzRight, bottom: tearzBottom },
            ]}>
            <Animated.View style={styles.tearzHeroInner}>
              <TearzBoardPerformer
                width={tearzW}
                height={tearzH}
                performance={boardPerformance}
              />
            </Animated.View>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: APP_THEME.color.bgSoft,
    justifyContent: 'center',
    position: 'relative',
  },
  attachBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 8,
  },
  attachPanel: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 9,
    gap: 8,
  },
  attachFileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E0E0E5',
  },
  attachFileBtnPressed: {
    opacity: 0.88,
  },
  attachMenuLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  stageClip: {
    width: '100%',
    overflow: 'visible',
    position: 'relative',
  },
  chatWhiteWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(250, 250, 248, 0.94)',
    zIndex: 6,
  },
  stage: {
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  stageCompose: {
    position: 'relative',
    overflow: 'visible',
  },
  boardClip: {
    position: 'absolute',
    overflow: 'visible',
    backgroundColor: 'transparent',
  },
  boardImage: {
    width: '100%',
    height: '100%',
  },
  tearzHero: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    overflow: 'visible',
    zIndex: 30,
  },
  tearzHeroInner: {
    width: '100%',
    height: '100%',
  },
  boardBannerLayer: {
    justifyContent: 'flex-start',
    paddingTop: 8,
    overflow: 'visible',
  },
  boardChalkDust: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'visible',
  },
  chalkDot: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: MARKER_COLOR,
    opacity: 0.07,
  },
  chalkDotA: {
    width: 5,
    height: 5,
    top: '18%',
    right: '8%',
  },
  chalkDotB: {
    width: 3,
    height: 3,
    top: '62%',
    left: '4%',
  },
  chalkDotC: {
    width: 4,
    height: 4,
    bottom: '12%',
    right: '22%',
  },
  boardBannerBlock: {
    width: '100%',
    gap: 5,
    overflow: 'visible',
  },
  boardInkPlane: {
    width: '100%',
    transform: [...BOARD_INK_TRANSFORM],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transformOrigin: 'left center' as any,
  },
  boardInkField: {
    width: '100%',
    transform: [...BOARD_INK_TRANSFORM],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transformOrigin: 'left top' as any,
  },
  boardHeadlinePlane: {
    marginTop: -1,
  },
  boardHeadline: {
    color: MARKER_COLOR,
    flexShrink: 1,
    textAlign: 'left',
    letterSpacing: -0.4,
  },
  markerInkDepth: {
    textShadowColor: MARKER_INK_SHADOW,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  markerInkDepthSoft: {
    textShadowColor: MARKER_INK_SHADOW,
    textShadowOffset: { width: 0, height: 0.5 },
    textShadowRadius: 1,
  },
  boardCtaRow: {
    marginTop: -1,
  },
  boardAccentPlane: {
    marginTop: 2,
  },
  boardAccentWrap: {
    height: 14,
  },
  boardCtaInk: {
    color: MARKER_HINT,
    letterSpacing: 0.15,
  },
  boardWriteLayer: {
    justifyContent: 'flex-start',
    overflow: 'visible',
  },
  zoomDismiss: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  boardControls: {
    position: 'absolute',
    zIndex: 30,
  },
  boardControlsDock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(21, 34, 56, 0.1)',
    shadowColor: '#152238',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  markerText: {
    color: MARKER_COLOR,
    width: '100%',
    textAlign: 'left',
    letterSpacing: -0.3,
  },
  inputTouch: {
    width: '100%',
    minHeight: LINE_HEIGHT,
    overflow: 'visible',
  },
  markerInput: {
    width: '100%',
    color: MARKER_COLOR,
    backgroundColor: 'transparent',
    padding: 0,
    margin: 0,
    textAlignVertical: 'top',
    letterSpacing: -0.3,
    textShadowColor: MARKER_INK_SHADOW,
    textShadowOffset: { width: 0, height: 0.5 },
    textShadowRadius: 1,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(21, 34, 56, 0.07)',
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  pendingText: {
    flex: 1,
    fontSize: 15,
    color: 'rgba(21, 34, 56, 0.62)',
  },
  boardBtn: {
    width: SEND_SIZE,
    height: SEND_SIZE,
    borderRadius: SEND_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardBtnAttach: {
    backgroundColor: 'rgba(242, 242, 247, 0.96)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(21, 34, 56, 0.1)',
  },
  boardBtnAttachOn: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(21, 34, 56, 0.18)',
  },
  boardBtnSendOn: {
    backgroundColor: SEND_ACTIVE_BG,
  },
  boardBtnSendOff: {
    backgroundColor: 'rgba(242, 242, 247, 0.96)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(21, 34, 56, 0.1)',
  },
  boardBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.95 }],
  },
});
