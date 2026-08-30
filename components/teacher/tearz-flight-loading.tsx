import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { TearzGlobeSpin, globeSpinDisplaySize } from '@/components/teacher/tearz-globe-spin';
import { TeacherLessonWindow } from '@/components/teacher/teacher-lesson-window';
import { GAME_THEME } from '@/constants/game-theme';
import { useLexicon } from '@/contexts/lexicon-context';
import { useLocale } from '@/contexts/locale-context';
import { postTeacherChatReply, warmCompanionApi } from '@/services/companion-chat-ai';
import type { CompanionChatApiLanguage } from '@/types/companion-chat-api';
import type { CompanionMsg } from '@/types/companion-message';
import { messagesToCompanionApiHistory } from '@/utils/companion-chat-history';
import {
  teacherPhotoFallbackMessage,
  teacherUiLanguageFromLocale,
} from '@/utils/teacher-ui-language';

const GATHER_MS = 2200;
const TEARZ_IN_MS = 950;
const TEARZ_IN_DELAY = Math.round(GATHER_MS * 0.68);
const MIN_SPIN_AFTER_IN_MS = 2100;
const PART_MS = 1300;
const LESSON_IN_MS = 650;
const CLOSE_EXIT_MS = 640;
const CLOUD_LOOP_MS = 8500;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const CITY_BELOW = require('../../assets/images/tearz-mario/tearz-distant-skyline.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const CLOUD_A = require('../../assets/images/tearz-mario/tearz-cloud-fluff-0.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const CLOUD_B = require('../../assets/images/tearz-mario/tearz-cloud-fluff-1.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const CLOUD_C = require('../../assets/images/tearz-mario/tearz-cloud-fluff-2.png');

const CLOUD_SRCS = [CLOUD_A, CLOUD_B, CLOUD_C] as const;
const SKY = GAME_THEME.color.sky;

type Props = {
  question: string;
  language?: CompanionChatApiLanguage;
  onClose: () => void;
  imageUri?: string;
};

type CloudSpec = {
  id: string;
  source: number;
  top: number;
  width: number;
  height: number;
  phase: number;
  side: 1 | -1;
  z: number;
  opacity: number;
  order: number;
  orderNorm: number;
};

function formatChatTime(d = new Date()) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const CLOUD_COLS = 4;
const CLOUD_ROWS = 9;

function buildSnakeClouds(): CloudSpec[] {
  const list: CloudSpec[] = [];
  let order = 0;
  const total = CLOUD_COLS * CLOUD_ROWS;

  for (let row = 0; row < CLOUD_ROWS; row++) {
    const leftToRight = row % 2 === 0;
    for (let step = 0; step < CLOUD_COLS; step++) {
      const col = leftToRight ? step : CLOUD_COLS - 1 - step;
      const top = (row / (CLOUD_ROWS - 1)) * 0.82;
      list.push({
        id: `c${row}-${col}`,
        source: CLOUD_SRCS[order % 3],
        top,
        width: 0.58 + (col % 3) * 0.08,
        height: 0.15 + (row % 3) * 0.02,
        phase: col / (CLOUD_COLS - 1),
        side: (col < CLOUD_COLS / 2 ? -1 : 1) as 1 | -1,
        z: 3 + Math.floor(top * 5),
        opacity: 0.94,
        order,
        orderNorm: total <= 1 ? 0 : order / (total - 1),
      });
      order += 1;
    }
  }
  return list;
}

/**
 * Облака сгущаются → Tearz появляется в центре и крутит глобус →
 * облака расходятся, Tearz улетает вверх → урок.
 */
export function TearzLessonTransit({
  question,
  language = 'english',
  onClose,
  imageUri,
}: Props) {
  const { width: W, height: H } = useWindowDimensions();
  const { ingestTeacherText } = useLexicon();
  const { locale } = useLocale();
  const uiLanguage = teacherUiLanguageFromLocale(locale);

  const [messages, setMessages] = useState<CompanionMsg[] | null>(null);
  const [showLesson, setShowLesson] = useState(false);

  const replyRef = useRef<CompanionMsg[] | null>(null);
  const readyRef = useRef(false);
  const sequenceDoneRef = useRef(false);
  const partingRef = useRef(false);
  const closingRef = useRef(false);

  const clock = useSharedValue(0);
  const gather = useSharedValue(0);
  const tearzIn = useSharedValue(0);
  const part = useSharedValue(0);
  const lessonIn = useSharedValue(0);
  const rootExit = useSharedValue(1);

  const clouds = useMemo(() => buildSnakeClouds(), []);
  const spinSize = globeSpinDisplaySize(Math.min(W * 0.72, 360));

  const revealLesson = () => {
    if (replyRef.current) setMessages(replyRef.current);
    setShowLesson(true);
    lessonIn.value = withTiming(1, {
      duration: LESSON_IN_MS,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
  };

  const finishClose = () => {
    onClose();
  };

  const requestClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    const closeEasing = Easing.bezier(0.22, 1, 0.36, 1);
    lessonIn.value = withTiming(0, { duration: CLOSE_EXIT_MS * 0.55, easing: closeEasing });
    rootExit.value = withTiming(
      0,
      { duration: CLOSE_EXIT_MS, easing: closeEasing },
      (ok) => {
        if (ok) runOnJS(finishClose)();
      },
    );
  };

  const beginParting = () => {
    if (partingRef.current) return;
    if (!readyRef.current || !sequenceDoneRef.current) return;
    partingRef.current = true;
    part.value = withTiming(
      1,
      { duration: PART_MS, easing: Easing.bezier(0.4, 0, 0.2, 1) },
      (ok) => {
        if (ok) runOnJS(revealLesson)();
      },
    );
  };

  useEffect(() => {
    clock.value = withRepeat(
      withTiming(1, { duration: CLOUD_LOOP_MS, easing: Easing.linear }),
      -1,
      false,
    );

    gather.value = withTiming(1, {
      duration: GATHER_MS,
      easing: Easing.bezier(0.33, 0, 0.2, 1),
    });

    tearzIn.value = withDelay(
      TEARZ_IN_DELAY,
      withTiming(1, {
        duration: TEARZ_IN_MS,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      }),
    );

    const sequenceMs = TEARZ_IN_DELAY + TEARZ_IN_MS + 80;
    const t = setTimeout(() => {
      sequenceDoneRef.current = true;
      beginParting();
    }, sequenceMs + MIN_SPIN_AFTER_IN_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const q = question.trim();
    if (!q && !imageUri) return;
    const started = Date.now();
    let cancelled = false;

    const userMsg: CompanionMsg = imageUri
      ? {
          id: 'seed',
          from: 'me',
          kind: 'image',
          imageUri,
          text: q || '📷 Фото',
          time: formatChatTime(),
          read: 'read',
        }
      : {
          id: 'seed',
          from: 'me',
          text: q,
          time: formatChatTime(),
          read: 'read',
        };

    void (async () => {
      let assistantMsg: CompanionMsg;
      try {
        await warmCompanionApi(6);
        let image: { base64: string; mimeType: string } | undefined;
        if (imageUri) {
          const { prepareCompanionImageForApi } = await import('@/utils/companion-image-base64');
          image = await prepareCompanionImageForApi(imageUri);
        }
        const reply = await postTeacherChatReply({
          message: q || (image ? teacherPhotoFallbackMessage(uiLanguage) : ''),
          conversationHistory: messagesToCompanionApiHistory([userMsg]),
          language,
          uiLanguage,
          lessonTopic: (q || 'Фото').length > 72 ? `${(q || 'Фото').slice(0, 72)}…` : q || 'Фото',
          ...(image?.base64 ? { imageBase64: image.base64, imageMimeType: image.mimeType } : {}),
        });
        if (!cancelled) ingestTeacherText(reply);
        assistantMsg = {
          id: `a-${Date.now()}`,
          from: 'them',
          text: reply,
          time: formatChatTime(),
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Ошибка сети';
        assistantMsg = {
          id: `err-${Date.now()}`,
          from: 'them',
          text: `Не удалось получить ответ.\n\n${msg}`,
          time: formatChatTime(),
        };
      }

      const minTotal = TEARZ_IN_DELAY + TEARZ_IN_MS + MIN_SPIN_AFTER_IN_MS;
      const wait = Math.max(0, minTotal - (Date.now() - started));
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      if (cancelled) return;
      readyRef.current = true;
      replyRef.current = [userMsg, assistantMsg];
      beginParting();
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingestTeacherText, language, question, imageUri, uiLanguage]);

  const cityStyle = useAnimatedStyle(() => {
    const g = gather.value;
    const p = part.value;
    return {
      height: interpolate(g, [0, 0.55, 1], [H * 0.38, H * 0.3, H * 0.24], Extrapolation.CLAMP),
      opacity: interpolate(p, [0, 0.55, 1], [0.55, 0.25, 0], Extrapolation.CLAMP),
      transform: [
        { translateY: interpolate(g, [0, 1], [0, H * 0.012], Extrapolation.CLAMP) },
        { scale: interpolate(g, [0, 1], [1.1, 1], Extrapolation.CLAMP) },
      ],
    };
  });

  const tearzStyle = useAnimatedStyle(() => {
    const t = tearzIn.value;
    const p = part.value;

    const enterOp = interpolate(t, [0, 0.12, 1], [0, 0, 1], Extrapolation.CLAMP);
    const enterScale = interpolate(t, [0, 0.55, 1], [0.84, 1.035, 1], Extrapolation.CLAMP);
    const enterY = interpolate(t, [0, 1], [H * 0.055, 0], Extrapolation.CLAMP);

    const partOp = interpolate(p, [0, 0.35, 0.85, 1], [1, 1, 0.35, 0], Extrapolation.CLAMP);
    const partY = interpolate(p, [0, 1], [0, -H * 0.42], Extrapolation.CLAMP);
    const partScale = interpolate(p, [0, 1], [1, 0.9], Extrapolation.CLAMP);

    return {
      opacity: enterOp * partOp * rootExit.value,
      transform: [
        { translateY: enterY + partY },
        { scale: enterScale * partScale },
      ],
    };
  });

  const creamStyle = useAnimatedStyle(() => ({
    opacity: interpolate(part.value, [0, 0.45, 1], [0, 0.55, 1], Extrapolation.CLAMP),
  }));

  const lessonStyle = useAnimatedStyle(() => ({
    opacity: lessonIn.value * rootExit.value,
    transform: [
      { translateY: interpolate(lessonIn.value, [0, 1], [18, 0], Extrapolation.CLAMP) },
    ],
  }));

  const rootExitStyle = useAnimatedStyle(() => ({
    opacity: rootExit.value,
  }));

  return (
    <Animated.View style={[styles.root, rootExitStyle]}>
      <View style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, styles.sky]} />

        <Animated.View style={[styles.cityWrap, cityStyle]} pointerEvents="none">
          <Image
            source={CITY_BELOW}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition="bottom"
          />
          <View style={styles.cityFade} />
        </Animated.View>

        {clouds.map((c) => (
          <CloudChip key={c.id} cloud={c} W={W} H={H} clock={clock} gather={gather} part={part} />
        ))}

        <Animated.View
          pointerEvents="none"
          style={[styles.tearzCenter, tearzStyle, { width: W, height: H }]}>
          <TearzGlobeSpin size={spinSize} />
        </Animated.View>

        <Animated.View style={[styles.creamWash, creamStyle]} pointerEvents="none" />
      </View>

      {showLesson && messages ? (
        <Animated.View pointerEvents="box-none" style={[styles.lessonLayer, lessonStyle]}>
          <TeacherLessonWindow
            initialMessages={messages}
            language={language}
            onClose={requestClose}
          />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function CloudChip({
  cloud,
  W,
  H,
  clock,
  gather,
  part,
}: {
  cloud: CloudSpec;
  W: number;
  H: number;
  clock: SharedValue<number>;
  gather: SharedValue<number>;
  part: SharedValue<number>;
}) {
  const w = W * cloud.width;
  const h = H * cloud.height;
  const top = H * cloud.top;
  const homeX = cloud.phase * (W - w * 0.5) - w * 0.12;

  const style = useAnimatedStyle(() => {
    const g = gather.value;
    const p = part.value;
    const window = 0.28;
    const start = cloud.orderNorm * (1 - window);
    const local = interpolate(g, [start, start + window], [0, 1], Extrapolation.CLAMP);

    const sway =
      Math.sin(clock.value * Math.PI * 2 + cloud.phase * Math.PI * 2) * W * 0.022 * local;
    const bob = Math.sin(clock.value * Math.PI * 4 + cloud.phase * Math.PI * 2) * 4 * local;

    const spread = (1 - local) * 0.72 + p;
    const spreadX = cloud.side * spread * W * 0.88;

    const op =
      interpolate(local, [0, 0.2, 1], [0, 0.72, cloud.opacity], Extrapolation.CLAMP) *
      interpolate(p, [0, 0.7, 1], [1, 0.22, 0], Extrapolation.CLAMP);

    return {
      opacity: op,
      transform: [
        { translateX: homeX + sway + spreadX },
        { translateY: bob + (1 - local) * H * 0.04 + p * H * 0.05 },
        { scale: interpolate(local, [0, 1], [0.85, 1.06], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.cloudAbs, { top, width: w, height: h, zIndex: cloud.z }, style]}>
      <Image source={cloud.source} style={StyleSheet.absoluteFill} contentFit="contain" />
    </Animated.View>
  );
}

/** @deprecated */
export const TearzFlightLoading = TearzLessonTransit;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SKY,
    overflow: 'hidden',
  },
  sky: {
    backgroundColor: SKY,
  },
  cityWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    zIndex: 1,
  },
  cityFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '28%',
    backgroundColor: 'rgba(92, 148, 252, 0.35)',
  },
  cloudAbs: {
    position: 'absolute',
    left: 0,
  },
  tearzCenter: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creamWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: GAME_THEME.color.cream,
    zIndex: 30,
  },
  lessonLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },
});
