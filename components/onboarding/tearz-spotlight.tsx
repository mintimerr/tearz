import { Image, type ImageSource } from 'expo-image';
import * as Haptics from '@/utils/safe-haptics';
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TEARZ_MARIO } from '@/components/game/tearz-mario-source';
import { Fonts } from '@/constants/theme';
import { GAME_THEME } from '@/constants/game-theme';
import { useFirstVisitTip, useOnboardingTips } from '@/contexts/onboarding-tips-context';
import { useTranslation } from '@/contexts/locale-context';
import type { OnboardingTipId } from '@/utils/onboarding-tips';

type SpotlightProps = {
  tipId: OnboardingTipId;
  targetRef: RefObject<View | null>;
  line: string;
  /** Следующая реплика в том же облаке. Тирз не перезаходит. */
  followLine?: string;
  /** Куда переключить свет на второй реплике. Без обводки. */
  followRef?: RefObject<View | null>;
  pose?: ImageSource;
  enabled?: boolean;
  /** Show only after this earlier tip was dismissed. */
  afterTip?: OnboardingTipId;
  round?: boolean;
  /** Белая обводка вокруг цели. Для поля ввода не нужна — и так ясно. */
  outline?: boolean;
  pad?: number;
  delay?: number;
  onActive?: (active: boolean) => void;
};

type AnchorProps = {
  tipId: OnboardingTipId;
  line: string;
  pose?: ImageSource;
  enabled?: boolean;
  afterTip?: OnboardingTipId;
  round?: boolean;
  pad?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

const DIM = 'rgba(6, 10, 24, 0.78)';
const SPRITE_W = 280;
const SPRITE_H = 314;
const TYPE_MS = 34;

function CoachPop({
  lines,
  nextLabel,
  pose,
  bubbleW,
  bubbleLeft,
  bubbleBottom,
  tailFromRight,
  onFinish,
  onStep,
}: {
  lines: string[];
  nextLabel: string;
  pose: ImageSource;
  bubbleW: number;
  bubbleLeft: number;
  bubbleBottom: number;
  tailFromRight: number;
  onFinish: () => void;
  onStep?: (index: number) => void;
}) {
  const [step, setStep] = useState(0);
  const line = lines[Math.min(step, lines.length - 1)] ?? '';
  const sprite = useRef(new Animated.Value(0)).current;
  const bubble = useRef(new Animated.Value(0)).current;
  const cta = useRef(new Animated.Value(0)).current;
  const chars = useMemo(() => Array.from(line), [line]);
  const [count, setCount] = useState(0);
  const [typing, setTyping] = useState(false);
  const [ready, setReady] = useState(false);
  const [caretOn, setCaretOn] = useState(true);

  useEffect(() => {
    const intro = Animated.sequence([
      Animated.spring(sprite, {
        toValue: 1,
        friction: 6,
        tension: 70,
        useNativeDriver: true,
      }),
      Animated.delay(80),
      Animated.spring(bubble, {
        toValue: 1,
        friction: 7,
        tension: 84,
        useNativeDriver: true,
      }),
    ]);
    intro.start(({ finished }) => {
      if (finished) setTyping(true);
    });
    return () => intro.stop();
  }, [bubble, sprite]);

  useEffect(() => {
    if (!typing) return;
    if (count >= chars.length) {
      setTyping(false);
      setReady(true);
      return;
    }
    const t = setTimeout(() => setCount((n) => n + 1), count === 0 ? 50 : TYPE_MS);
    return () => clearTimeout(t);
  }, [chars.length, count, typing]);

  useEffect(() => {
    if (!ready) return;
    cta.setValue(0);
    Animated.timing(cta, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [cta, ready]);

  useEffect(() => {
    if (!typing) return;
    const id = setInterval(() => setCaretOn((v) => !v), 380);
    return () => clearInterval(id);
  }, [typing]);

  const shown = chars.slice(0, count).join('');

  const advance = () => {
    if (step + 1 < lines.length) {
      setReady(false);
      setCount(0);
      setTyping(true);
      setStep(step + 1);
      onStep?.(step + 1);
      return;
    }
    onFinish();
  };

  return (
    <>
      <Animated.View
        style={[
          styles.bubble,
          {
            width: bubbleW,
            left: bubbleLeft,
            bottom: bubbleBottom,
            opacity: bubble,
            transformOrigin: `${Math.max(24, bubbleW - tailFromRight)}px bottom`,
            transform: [
              { scale: bubble.interpolate({ inputRange: [0, 1], outputRange: [0.08, 1] }) },
            ],
          },
        ]}>
        <View style={styles.lineSlot} accessibilityLabel={line}>
          <Text style={[styles.line, styles.lineGhost]}>{line}</Text>
          <Text style={[styles.line, styles.lineLive]}>
            {shown}
            {typing ? <Text style={{ opacity: caretOn ? 1 : 0 }}>|</Text> : null}
          </Text>
        </View>
        {ready ? (
          <Animated.View style={{ opacity: cta }}>
            <Pressable
              onPress={advance}
              accessibilityRole="button"
              accessibilityLabel={nextLabel}
              style={({ pressed }) => [styles.next, pressed && styles.nextPressed]}>
              <Text style={styles.nextLabel} numberOfLines={1}>
                {nextLabel}
              </Text>
            </Pressable>
          </Animated.View>
        ) : null}
        <View style={[styles.tail, { right: tailFromRight }]} />
        <View style={[styles.tailWhite, { right: tailFromRight + 6 }]} />
      </Animated.View>
      <Animated.View
        style={{
          opacity: sprite,
          transform: [
            {
              translateY: sprite.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }),
            },
            { scale: sprite.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) },
          ],
        }}>
        <Image source={pose} style={styles.sprite} contentFit="contain" />
      </Animated.View>
    </>
  );
}

/**
 * First-visit coach: the screen dims, Tearz and the bubble stay bright.
 * Marks the tip seen on «Дальше».
 */
export function TearzSpotlight({
  tipId,
  line,
  followLine,
  followRef,
  pose = TEARZ_MARIO.coach,
  enabled = true,
  afterTip,
  onActive,
}: SpotlightProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: SW, height: SH } = useWindowDimensions();
  const { hasSeen } = useOnboardingTips();
  const { visible, dismiss } = useFirstVisitTip(tipId);
  const show = enabled && visible && (!afterTip || hasSeen(afterTip));
  const pinged = useRef(false);
  const open = show;
  const [hole, setHole] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const lines = followLine ? [line, followLine] : [line];

  const lightFollow = () => {
    const node = followRef?.current;
    if (!node) return;
    node.measureInWindow((x, y, w, h) => {
      if (w < 4 || h < 4) return;
      const pad = 10;
      setHole({
        x: Math.max(0, x - pad),
        y: Math.max(0, y - pad),
        w: w + pad * 2,
        h: h + pad * 2,
      });
    });
  };

  useEffect(() => {
    onActive?.(open);
  }, [onActive, open]);

  useEffect(() => {
    if (open && !pinged.current) {
      pinged.current = true;
      void Haptics.selectionAsync();
    }
  }, [open]);

  const finish = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void dismiss();
  };

  if (!open) return null;

  const cluster = placeCluster(null, SW, SH, insets.top, insets.bottom);

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={finish}>
      <View style={styles.fill} pointerEvents="box-none">
        {hole ? (
          <>
            <View style={[styles.dim, { top: 0, left: 0, right: 0, height: hole.y }]} />
            <View style={[styles.dim, { top: hole.y, left: 0, width: Math.max(0, hole.x), height: hole.h }]} />
            <View
              style={[
                styles.dim,
                { top: hole.y, left: hole.x + hole.w, right: 0, height: hole.h },
              ]}
            />
            <View style={[styles.dim, { top: hole.y + hole.h, left: 0, right: 0, bottom: 0 }]} />
            <View
              style={{ position: 'absolute', left: hole.x, top: hole.y, width: hole.w, height: hole.h }}
            />
          </>
        ) : (
          <View style={[styles.dim, StyleSheet.absoluteFill]} />
        )}

        <View style={[styles.cluster, { top: cluster.y }]}>
          <CoachPop
            lines={lines}
            nextLabel={t('onboarding.introNext')}
            pose={pose}
            onFinish={finish}
            onStep={(index) => {
              if (index > 0) lightFollow();
            }}
            {...bubbleBox(SW)}
          />
        </View>
      </View>
    </Modal>
  );
}

/** Wraps a control and spotlights it on the first visit. */
export function SpotlightAnchor({
  tipId,
  line,
  pose,
  enabled,
  afterTip,
  round,
  pad,
  delay,
  style,
  children,
}: AnchorProps) {
  const ref = useRef<View>(null);
  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
      <TearzSpotlight
        tipId={tipId}
        targetRef={ref}
        line={line}
        pose={pose}
        enabled={enabled}
        afterTip={afterTip}
        round={round}
        pad={pad}
        delay={delay}
      />
    </View>
  );
}

/**
 * Облако шире и над кепкой, чтобы не закрывать голову.
 * Хвост длинный и уходит под левый край щеки (sprite x≈76, y≈82):
 * Тирз рисуется поверх, поэтому кончик прячется в него и реплика из него выходит.
 */
function bubbleBox(sw: number) {
  const margin = 12;
  const bubbleW = Math.min(320, sw - margin * 2);
  const spriteLeft = sw - SPRITE_W;
  const bubbleLeftScreen = Math.max(margin, Math.min(20, sw - bubbleW - margin));
  const notchX = spriteLeft + 78;
  const tailFromRight = Math.max(16, Math.min(bubbleW - 48, bubbleLeftScreen + bubbleW - notchX - 14));
  return {
    bubbleW,
    bubbleLeft: bubbleLeftScreen - spriteLeft,
    bubbleBottom: SPRITE_H + 6,
    tailFromRight,
  };
}

function placeCluster(
  _hole: { left: number; top: number; right: number; bottom: number; width: number; height: number } | null,
  sw: number,
  sh: number,
  _topInset: number,
  _bottomInset: number,
) {
  const w = sw - 4;
  const y = sh - SPRITE_H;
  return { x: 0, y, onRight: true, w };
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  dim: {
    position: 'absolute',
    backgroundColor: DIM,
  },
  cluster: {
    position: 'absolute',
    right: 0,
    width: SPRITE_W,
    height: SPRITE_H,
    overflow: 'visible',
  },
  sprite: {
    width: SPRITE_W,
    height: SPRITE_H,
  },
  lineSlot: {
    position: 'relative',
  },
  lineGhost: {
    opacity: 0,
  },
  lineLive: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  bubble: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: GAME_THEME.color.ink,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  line: {
    fontFamily: Fonts.rounded,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
    color: GAME_THEME.color.ink,
  },
  next: {
    alignSelf: 'flex-start',
    marginTop: 10,
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: GAME_THEME.radius.button,
    borderWidth: 2,
    borderColor: GAME_THEME.color.ink,
    borderBottomWidth: 4,
    borderBottomColor: GAME_THEME.color.goldLip,
    backgroundColor: '#FFFFFF',
  },
  nextPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 2,
  },
  nextLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: GAME_THEME.color.ink,
    letterSpacing: 0.2,
  },
  tail: {
    position: 'absolute',
    bottom: -86,
    width: 0,
    height: 0,
    borderLeftWidth: 16,
    borderRightWidth: 16,
    borderTopWidth: 88,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: GAME_THEME.color.ink,
  },
  tailWhite: {
    position: 'absolute',
    bottom: -74,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 76,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
  },
});
