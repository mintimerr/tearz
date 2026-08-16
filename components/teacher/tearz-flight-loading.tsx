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

import { TearzToyPlane, TEARZ_PLANE_ASPECT } from '@/components/game/tearz-toy-plane';
import { TeacherLessonWindow } from '@/components/teacher/teacher-lesson-window';
import { GAME_THEME } from '@/constants/game-theme';
import { useLexicon } from '@/contexts/lexicon-context';
import { useLocale } from '@/contexts/locale-context';
import { postTeacherChatReply } from '@/services/companion-chat-ai';
import type { CompanionChatApiLanguage } from '@/types/companion-chat-api';
import type { CompanionMsg } from '@/types/companion-message';
import { messagesToCompanionApiHistory } from '@/utils/companion-chat-history';
import {
  teacherPhotoFallbackMessage,
  teacherUiLanguageFromLocale,
} from '@/utils/teacher-ui-language';

const GATHER_MS = 2200;
const PLANE_IN_MS = 700;
const MIN_CRUISE_MS = 2800;
const PART_MS = 1400;
const LESSON_IN_MS = 850;
/** Полный проход орбиты */
const PLANE_LOOP_MS = 8500;
/** Горизонтальный размах орбиты (доля ширины экрана) */
const PLANE_ORBIT_X = 0.2;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const CITY_BELOW = require('../../assets/images/tearz-mario/tearz-distant-skyline.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const CLOUD_A = require('../../assets/images/tearz-mario/tearz-cloud-fluff-0.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const CLOUD_B = require('../../assets/images/tearz-mario/tearz-cloud-fluff-1.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const CLOUD_C = require('../../assets/images/tearz-mario/tearz-cloud-fluff-2.png');

const CLOUD_SRCS = [CLOUD_A, CLOUD_B, CLOUD_C] as const;

type Props = {
  question: string;
  language?: CompanionChatApiLanguage;
  onClose: () => void;
  /** Фото с терминала — уходит в vision/OCR вместе с вопросом. */
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
  /** 0 = левый верх, 1 = правый низ (порядок змейки) */
  order: number;
  orderNorm: number;
};

function formatChatTime(d = new Date()) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const CLOUD_COLS = 4;
const CLOUD_ROWS = 9;

/** Сетка змейкой: L→R, R→L, … заканчивая правым низом */
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
        opacity: 0.96,
        order,
        orderNorm: total <= 1 ? 0 : order / (total - 1),
      });
      order += 1;
    }
  }
  return list;
}

/**
 * Облака сгущаются змейкой: левый верх → правый низ.
 * Самолёт — после полной сетки. Затем расходятся → диалог.
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

  const clock = useSharedValue(0);
  /** Отдельные часы орбиты: стартуют с появлением самолёта из центра (sin=0). */
  const planeOrbit = useSharedValue(0);
  const cover = useSharedValue(1);
  const gather = useSharedValue(0);
  const planeIn = useSharedValue(0);
  const part = useSharedValue(0);
  const lessonIn = useSharedValue(0);

  const clouds = useMemo(() => buildSnakeClouds(), []);

  const revealLesson = () => {
    if (replyRef.current) setMessages(replyRef.current);
    setShowLesson(true);
    lessonIn.value = withTiming(1, {
      duration: LESSON_IN_MS,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
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
      withTiming(1, { duration: PLANE_LOOP_MS, easing: Easing.linear }),
      -1,
      false,
    );

    // Облака сгущаются с первого кадра (город уже на экране)
    gather.value = withTiming(1, {
      duration: GATHER_MS,
      easing: Easing.bezier(0.33, 0, 0.2, 1),
    });

    // Самолёт влетает слева → центр; орбита — после влёта, из центра
    planeIn.value = withDelay(
      GATHER_MS,
      withTiming(1, {
        duration: PLANE_IN_MS,
        easing: Easing.bezier(0.12, 0.85, 0.2, 1),
      }),
    );
    planeOrbit.value = withDelay(
      GATHER_MS + PLANE_IN_MS,
      withRepeat(
        withTiming(1, { duration: PLANE_LOOP_MS, easing: Easing.linear }),
        -1,
        false,
      ),
    );

    const sequenceMs = GATHER_MS + PLANE_IN_MS;
    const t = setTimeout(() => {
      sequenceDoneRef.current = true;
      beginParting();
    }, sequenceMs + 80);
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
        let image:
          | { base64: string; mimeType: string }
          | undefined;
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

      const wait = Math.max(0, MIN_CRUISE_MS - (Date.now() - started));
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

  const coverStyle = useAnimatedStyle(() => ({
    opacity: cover.value,
  }));

  const cityStyle = useAnimatedStyle(() => {
    const g = gather.value;
    const p = part.value;
    return {
      height: interpolate(g, [0, 0.55, 1], [H * 0.42, H * 0.34, H * 0.28], Extrapolation.CLAMP),
      opacity: interpolate(p, [0, 0.55, 1], [1, 0.4, 0], Extrapolation.CLAMP),
      transform: [
        {
          translateY: interpolate(g, [0, 1], [0, H * 0.015], Extrapolation.CLAMP),
        },
        {
          scale: interpolate(g, [0, 1], [1.12, 1], Extrapolation.CLAMP),
        },
      ],
    };
  });

  const planeStyle = useAnimatedStyle(() => {
    const t = planeOrbit.value * Math.PI * 2;
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    const pin = planeIn.value;
    const p = part.value;

    const planeW = 236;
    const planeH = planeW / TEARZ_PLANE_ASPECT;
    const cx = W * 0.5 - planeW / 2;
    /** Примерно середина экрана — не верхнее небо */
    const cy = H * 0.42 - planeH / 2;

    // Влёт слева (за кадром) → центр; орбита только после pin=1
    const enterX = interpolate(pin, [0, 1], [-planeW * 1.15, cx], Extrapolation.CLAMP);
    const x = enterX + sin * W * PLANE_ORBIT_X;
    const y = cy + Math.sin(t * 2) * H * 0.03 + cos * H * 0.015;
    // Пока влетает слева — всегда носом вправо
    const face = pin < 1 || cos >= 0 ? 1 : -1;

    const partOp = interpolate(p, [0, 0.45, 1], [1, 0.45, 0], Extrapolation.CLAMP);
    // Виден сразу, как только выглядывает слева — не fade из пустоты
    const enterOp = interpolate(pin, [0, 0.02, 1], [0, 1, 1], Extrapolation.CLAMP);

    return {
      width: planeW,
      height: planeH,
      opacity: enterOp * partOp,
      transform: [
        { translateX: x },
        {
          translateY: y + interpolate(p, [0, 1], [0, -H * 0.4], Extrapolation.CLAMP),
        },
        { scaleX: face },
        { rotate: `${-sin * 9}deg` },
        {
          scale:
            interpolate(pin, [0, 1], [0.92, 1], Extrapolation.CLAMP) *
            interpolate(p, [0, 1], [1, 0.75], Extrapolation.CLAMP),
        },
      ],
    };
  });

  const creamStyle = useAnimatedStyle(() => ({
    opacity: interpolate(part.value, [0, 0.4, 1], [0, 0.65, 1], Extrapolation.CLAMP),
  }));

  const lessonStyle = useAnimatedStyle(() => ({
    opacity: lessonIn.value,
    transform: [
      { translateY: interpolate(lessonIn.value, [0, 1], [18, 0], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <View style={styles.root}>
      <Animated.View style={[StyleSheet.absoluteFill, coverStyle]}>
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
          <CloudChip
            key={c.id}
            cloud={c}
            W={W}
            H={H}
            clock={clock}
            gather={gather}
            part={part}
          />
        ))}

        <Animated.View style={[styles.planeTrack, planeStyle]} pointerEvents="none">
          <TearzToyPlane width={236} spinning />
        </Animated.View>

        <Animated.View style={[styles.creamWash, creamStyle]} pointerEvents="none" />
      </Animated.View>

      {showLesson && messages ? (
        <Animated.View style={[styles.lessonLayer, lessonStyle]}>
          <TeacherLessonWindow
            initialMessages={messages}
            language={language}
            onClose={onClose}
          />
        </Animated.View>
      ) : null}
    </View>
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
    // Волна змейки: локальный прогресс от 0→1 по orderNorm
    const window = 0.28;
    const start = cloud.orderNorm * (1 - window);
    const local = interpolate(g, [start, start + window], [0, 1], Extrapolation.CLAMP);

    const sway =
      Math.sin(clock.value * Math.PI * 2 + cloud.phase * Math.PI * 2) * W * 0.025 * local;
    const bob = Math.sin(clock.value * Math.PI * 4 + cloud.phase * Math.PI * 2) * 4 * local;

    // Появляются сбоку своей половины и встают на место
    const spread = (1 - local) * 0.7 + p;
    const spreadX = cloud.side * spread * W * 0.85;

    const op =
      interpolate(local, [0, 0.2, 1], [0, 0.75, cloud.opacity], Extrapolation.CLAMP) *
      interpolate(p, [0, 0.75, 1], [1, 0.28, 0], Extrapolation.CLAMP);

    return {
      opacity: op,
      transform: [
        { translateX: homeX + sway + spreadX },
        { translateY: bob + (1 - local) * H * 0.04 + p * H * 0.03 },
        { scale: interpolate(local, [0, 1], [0.85, 1.05], Extrapolation.CLAMP) },
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
    backgroundColor: '#5C94FC',
    overflow: 'hidden',
  },
  sky: {
    backgroundColor: '#5C94FC',
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
  planeTrack: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 12,
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
