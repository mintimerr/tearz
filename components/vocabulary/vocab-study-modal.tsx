import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StudySessionResult } from '@/components/vocabulary/study-session-result';
import { GAME_THEME } from '@/constants/game-theme';
import { useTranslation } from '@/contexts/locale-context';
import { useUserProfile } from '@/contexts/user-profile-context';
import { useEngagement } from '@/contexts/engagement-context';

export type StudyDeckCard = {
  id: string;
  front: string;
  back: string;
  pinyin?: string;
};

type Props = {
  cards: StudyDeckCard[];
  startIndex?: number;
  frontLabel: string;
  backLabel: string;
  folderName?: string;
  onClose: () => void;
  /** Открыть форму добавления слова в эту папку. */
  onAddWord?: () => void;
};

const SWIPE_THRESHOLD = 72;
const VELOCITY_COMMIT = 720;
const DRAG_LABEL_FULL = 168;
const STACK_SCALE = 0.96;
const STACK_PEEK = 20;
const STACK_OFFSET_Y = 4;
const SWIPE_ROTATION_MAX = 12;

const EASE_CINEMA = Easing.bezier(0.33, 1, 0.68, 1);
const EASE_SWIPE_OFF = Easing.out(Easing.cubic);
const SPRING_SNAP = { damping: 24, stiffness: 210, mass: 0.95 };
const STACK_LIFT_EASING = Easing.bezier(0.25, 0.9, 0.35, 1);
/** Same curve as companion-chat stack `animation: 'fade'` */
const SCREEN_FADE_OPEN = { duration: 300, easing: Easing.bezier(0.4, 0, 0.2, 1) };
const SCREEN_FADE_CLOSE = { duration: 300, easing: Easing.bezier(0.4, 0, 0.2, 1) };

export function VocabStudyModal({
  cards,
  startIndex = 0,
  frontLabel,
  backLabel,
  folderName,
  onClose,
  onAddWord,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const { recordStudySwipe } = useUserProfile();
  const { recordActivity } = useEngagement();
  const sessionActivityLogged = useRef(false);

  const ordered = useMemo(() => {
    if (!cards.length) return [];
    const k = Math.min(Math.max(0, startIndex), cards.length - 1);
    return [...cards.slice(k), ...cards.slice(0, k)];
  }, [cards, startIndex]);

  const deckSignature = useMemo(
    () => `${startIndex}:${cards.map((c) => c.id).join(',')}`,
    [cards, startIndex],
  );

  const [phase, setPhase] = useState<'study' | 'done'>('study');
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [isClosing, setIsClosing] = useState(false);

  const translateX = useSharedValue(0);
  const stackLift = useSharedValue(0);
  const topCardOpacity = useSharedValue(1);
  const handoffActive = useSharedValue(0);
  const exitingActive = useSharedValue(0);
  const flipAnim = useSharedValue(0);
  const sheetEnter = useSharedValue(0);
  const verdict = useSharedValue(0);
  const totalRef = useRef(0);
  const isExitingRef = useRef(false);
  const promotePendingRef = useRef(false);
  const closingRef = useRef(false);
  const indexRef = useRef(0);
  totalRef.current = ordered.length;
  indexRef.current = index;

  const resetAnimToIdle = useCallback(() => {
    cancelAnimation(translateX);
    cancelAnimation(stackLift);
    translateX.value = 0;
    stackLift.value = 0;
    topCardOpacity.value = 1;
    handoffActive.value = 0;
    flipAnim.value = 0;
    sheetEnter.value = 1;
    verdict.value = 0;
    isExitingRef.current = false;
    promotePendingRef.current = false;
    exitingActive.value = 0;
  }, [exitingActive, flipAnim, handoffActive, sheetEnter, stackLift, topCardOpacity, translateX, verdict]);

  const resetSession = useCallback(() => {
    setPhase('study');
    setIndex(0);
    setCorrect(0);
    setWrong(0);
    resetAnimToIdle();
  }, [resetAnimToIdle]);

  useEffect(() => {
    resetSession();
    sessionActivityLogged.current = false;
    sheetEnter.value = 0;
    requestAnimationFrame(() => {
      sheetEnter.value = withTiming(1, SCREEN_FADE_OPEN);
    });
  }, [deckSignature, resetSession, sheetEnter]);

  useEffect(() => {
    if (phase !== 'done' || sessionActivityLogged.current) return;
    if (correct + wrong < 1) return;
    sessionActivityLogged.current = true;
    recordActivity({ kind: 'vocab_session' });
  }, [correct, phase, recordActivity, wrong]);

  const finishClose = useCallback(() => {
    closingRef.current = false;
    setIsClosing(false);
    onClose();
  }, [onClose]);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setIsClosing(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    cancelAnimation(sheetEnter);
    sheetEnter.value = withTiming(
      0,
      SCREEN_FADE_CLOSE,
      (finished) => {
        'worklet';
        if (!finished) return;
        runOnJS(finishClose)();
      },
    );
  }, [finishClose, sheetEnter]);

  const current = ordered[index];
  const nextCard = ordered[index + 1] ?? null;
  const total = ordered.length;
  const isLast = index >= total - 1;

  useLayoutEffect(() => {
    if (!promotePendingRef.current) return;
    promotePendingRef.current = false;
    stackLift.value = 0;
    handoffActive.value = 0;
    exitingActive.value = 0;
    flipAnim.value = 0;
    verdict.value = 0;
    topCardOpacity.value = 1;
  }, [exitingActive, flipAnim, handoffActive, index, stackLift, topCardOpacity, verdict]);

  const promoteAfterExit = useCallback(
    (gotIt: boolean) => {
      const leavingIndex = indexRef.current;
      const tLen = totalRef.current;
      const next = leavingIndex + 1;

      if (gotIt) {
        setCorrect((c) => c + 1);
      } else {
        setWrong((w) => w + 1);
      }

      isExitingRef.current = false;

      if (next >= tLen) {
        handoffActive.value = 0;
        exitingActive.value = 0;
        cancelAnimation(translateX);
        cancelAnimation(stackLift);
        translateX.value = 0;
        stackLift.value = 0;
        topCardOpacity.value = 1;
        flipAnim.value = 0;
        verdict.value = 0;
        recordStudySwipe(gotIt);
        setPhase('done');
        return;
      }

      topCardOpacity.value = 0;
      handoffActive.value = 1;
      cancelAnimation(translateX);
      translateX.value = 0;
      flipAnim.value = 0;
      verdict.value = 0;
      promotePendingRef.current = true;
      setIndex(next);
      queueMicrotask(() => recordStudySwipe(gotIt));
    },
    [exitingActive, flipAnim, handoffActive, recordStudySwipe, stackLift, topCardOpacity, translateX, verdict],
  );

  const onSwipeCommit = useCallback(
    (dir: 'left' | 'right', startX: number, velocityX: number) => {
      if (isExitingRef.current) return;

      isExitingRef.current = true;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const outX = dir === 'right' ? screenW * 1.25 : -screenW * 1.25;
      const velocity = Math.max(Math.abs(velocityX), 700);
      const travel = Math.abs(outX - startX);
      const duration = Math.min(Math.max((travel / velocity) * 1000, 180), 260);
      const liftStart = Math.min(Math.abs(startX) / (screenW * 0.52), 1);
      const gotIt = dir === 'right';

      cancelAnimation(translateX);
      cancelAnimation(stackLift);
      stackLift.value = liftStart;
      stackLift.value = withTiming(
        1,
        { duration, easing: STACK_LIFT_EASING },
        (finished) => {
          'worklet';
          if (!finished) return;
          runOnJS(promoteAfterExit)(gotIt);
        },
      );

      translateX.value = withTiming(outX, { duration, easing: EASE_SWIPE_OFF });
    },
    [promoteAfterExit, screenW, stackLift, translateX],
  );

  const snapBack = useCallback(() => {
    translateX.value = withSpring(0, SPRING_SNAP);
    verdict.value = withTiming(0, { duration: 160 });
  }, [translateX, verdict]);

  const pan = Gesture.Pan()
    .activeOffsetX([-14, 14])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      'worklet';
      if (exitingActive.value === 1) return;
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      'worklet';
      if (exitingActive.value === 1) return;
      const x = e.translationX;
      const vx = e.velocityX;
      if (x > SWIPE_THRESHOLD || vx > VELOCITY_COMMIT) {
        exitingActive.value = 1;
        runOnJS(onSwipeCommit)('right', translateX.value, vx);
      } else if (x < -SWIPE_THRESHOLD || vx < -VELOCITY_COMMIT) {
        exitingActive.value = 1;
        runOnJS(onSwipeCommit)('left', translateX.value, vx);
      } else {
        runOnJS(snapBack)();
      }
    });

  const tap = Gesture.Tap().onEnd(() => {
    'worklet';
    const next = flipAnim.value < 0.5 ? 1 : 0;
    flipAnim.value = withTiming(next, { duration: 420, easing: EASE_CINEMA });
  });

  const gesture = Gesture.Exclusive(pan, tap);

  const cardStyle = useAnimatedStyle(() => {
    const rotateZ = interpolate(
      translateX.value,
      [-screenW * 0.55, 0, screenW * 0.55],
      [-SWIPE_ROTATION_MAX, 0, SWIPE_ROTATION_MAX],
      Extrapolation.CLAMP,
    );

    return {
      opacity: topCardOpacity.value,
      transform: [
        { translateX: translateX.value },
        { rotateZ: `${rotateZ}deg` },
      ],
    };
  });

  const behindCardStyle = useAnimatedStyle(() => {
    const useStackLift = exitingActive.value === 1 || handoffActive.value === 1;
    const progress = useStackLift
      ? stackLift.value
      : interpolate(
          Math.abs(translateX.value),
          [0, screenW * 0.52],
          [0, 1],
          Extrapolation.CLAMP,
        );

    return {
      transform: [
        { scale: interpolate(progress, [0, 1], [STACK_SCALE, 1]) },
        {
          translateY: interpolate(progress, [0, 1], [STACK_OFFSET_Y, -STACK_PEEK]),
        },
      ],
    };
  });

  const screenFadeStyle = useAnimatedStyle(() => ({
    opacity: sheetEnter.value,
  }));

  const frontFaceStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipAnim.value, [0, 1], [0, 180]);
    return {
      opacity: interpolate(flipAnim.value, [0, 0.42, 0.58, 1], [1, 1, 0, 0]),
      transform: [{ perspective: 1200 }, { rotateY: `${rotateY}deg` }],
    };
  });

  const backFaceStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipAnim.value, [0, 1], [180, 360]);
    return {
      opacity: interpolate(flipAnim.value, [0, 0.42, 0.58, 1], [0, 0, 1, 1]),
      transform: [{ perspective: 1200 }, { rotateY: `${rotateY}deg` }],
    };
  });

  const leftCornerIconStyle = useAnimatedStyle(() => {
    const glow = interpolate(translateX.value, [-DRAG_LABEL_FULL, -40, 0], [1, 0.3, 0], Extrapolation.CLAMP);
    return {
      opacity: interpolate(translateX.value, [-DRAG_LABEL_FULL, 0], [1, 0.45], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(glow, [0, 1], [1, 1.06]) }],
    };
  });

  const rightCornerPlusStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, 72, DRAG_LABEL_FULL], [0, 0, 1], Extrapolation.CLAMP),
  }));

  const rightCornerIconStyle = useAnimatedStyle(() => {
    const glow = interpolate(translateX.value, [0, 40, DRAG_LABEL_FULL], [0, 0.3, 1], Extrapolation.CLAMP);
    return {
      opacity: interpolate(translateX.value, [0, DRAG_LABEL_FULL], [0.45, 1], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(glow, [0, 1], [1, 1.06]) }],
    };
  });

  const frontTermStyle = useAnimatedStyle(() => {
    const right = interpolate(translateX.value, [0, DRAG_LABEL_FULL], [0, 1], Extrapolation.CLAMP);
    const left = interpolate(translateX.value, [-DRAG_LABEL_FULL, 0], [1, 0], Extrapolation.CLAMP);
    const replace = Math.max(right, left);
    return { opacity: 1 - replace * 0.92 };
  });

  const frontLearnedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, DRAG_LABEL_FULL * 0.42, DRAG_LABEL_FULL],
      [0, 0.38, 0.92],
      Extrapolation.CLAMP,
    ),
  }));

  const frontLearningStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-DRAG_LABEL_FULL, -DRAG_LABEL_FULL * 0.42, 0],
      [0.92, 0.38, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const frontHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(translateX.value), [0, 52], [1, 0], Extrapolation.CLAMP),
  }));

  if (!total) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      onRequestClose={requestClose}>
      <Animated.View
        style={[
          styles.root,
          screenFadeStyle,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 },
        ]}
        pointerEvents={isClosing ? 'none' : 'auto'}>
        <View style={styles.sheet}>
          <View style={styles.titleBar}>
            <Pressable
              hitSlop={12}
              onPress={requestClose}
              disabled={isClosing}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel={t('vocabulary.studyClose')}>
              <Ionicons name="close" size={20} color={GAME_THEME.color.cream} />
            </Pressable>
            <View style={styles.topCenter}>
              {folderName ? (
                <Text style={styles.folderName} numberOfLines={1}>
                  {folderName}
                </Text>
              ) : null}
              {phase === 'study' ? (
                <Text style={styles.progress}>
                  {Math.min(index + 1, total)} / {total}
                </Text>
              ) : (
                <Text style={styles.progress}>{t('vocabulary.studyDone')}</Text>
              )}
            </View>
            {onAddWord ? (
              <Pressable
                hitSlop={12}
                onPress={() => {
                  void Haptics.selectionAsync();
                  onAddWord();
                }}
                disabled={isClosing}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
                accessibilityRole="button"
                accessibilityLabel={t('vocabulary.addWord')}>
                <Ionicons name="add" size={22} color={GAME_THEME.color.cream} />
              </Pressable>
            ) : (
              <View style={styles.topSpacer} />
            )}
          </View>

          {phase === 'study' ? (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.min(100, ((index + 1) / total) * 100)}%` }]} />
            </View>
          ) : null}

          {phase === 'study' && current ? (
            <View style={styles.studyBody}>
              <Text style={styles.lead}>{t('vocabulary.studyLead')}</Text>

              <View style={styles.tagStrip}>
                <Animated.View
                  pointerEvents="none"
                  style={[styles.edgeTag, styles.edgeTagLeft, leftCornerIconStyle]}>
                  <Text style={styles.edgeTagLabel}>✕ Учим</Text>
                </Animated.View>

                <Animated.View
                  pointerEvents="none"
                  style={[styles.edgeTag, styles.edgeTagRight, rightCornerIconStyle]}>
                  <Animated.Text style={[styles.edgeTagPlus, rightCornerPlusStyle]}>
                    {t('vocabulary.studyPlusOne')}
                  </Animated.Text>
                  <Text style={styles.edgeTagLabelDark}>✓ Знаю</Text>
                </Animated.View>
              </View>

              <View style={styles.deck}>
                {nextCard ? (
                  <Animated.View style={[styles.cardBehind, behindCardStyle]} pointerEvents="none">
                    <View style={styles.cardInner}>
                      <View style={[styles.face, styles.faceFront]}>
                        <View style={styles.cardTopRow}>
                          <Text style={styles.langTag}>{frontLabel}</Text>
                          <Text style={styles.cardStep}>
                            {index + 2} / {total}
                          </Text>
                        </View>
                        <View style={styles.termBlock}>
                          <Text style={styles.term}>{nextCard.front}</Text>
                        </View>
                        <View style={styles.cardFooter}>
                          <Ionicons name="hand-left-outline" size={15} color="rgba(26,26,26,0.45)" />
                          <Text style={styles.subHint}>{t('vocabulary.studyTapFlip')}</Text>
                        </View>
                      </View>
                    </View>
                  </Animated.View>
                ) : (
                  <View style={styles.deckBase} pointerEvents="none" />
                )}

                <GestureDetector gesture={gesture}>
                  <Animated.View
                    style={[styles.cardWrap, cardStyle]}
                    renderToHardwareTextureAndroid
                    shouldRasterizeIOS>
                    <View style={styles.cardInner}>
                      <Animated.View style={[styles.face, styles.faceFront, frontFaceStyle]}>
                        <View style={styles.cardTopRow}>
                          <Text style={styles.langTag}>{frontLabel}</Text>
                          <Text style={styles.cardStep}>
                            {Math.min(index + 1, total)} / {total}
                          </Text>
                        </View>
                        <View style={styles.termBlock}>
                          <View style={styles.termSwap}>
                            <Animated.Text style={[styles.term, frontTermStyle]}>{current.front}</Animated.Text>
                            <Animated.View style={[styles.verdictOverlay, frontLearnedStyle]} pointerEvents="none">
                              <Text style={[styles.termVerdict, styles.termVerdictRight]}>
                                {t('vocabulary.studyLearned')}
                              </Text>
                            </Animated.View>
                            <Animated.View style={[styles.verdictOverlay, frontLearningStyle]} pointerEvents="none">
                              <Text style={[styles.termVerdict, styles.termVerdictLeft]}>
                                {t('vocabulary.studyLearning')}
                              </Text>
                            </Animated.View>
                          </View>
                        </View>
                        <Animated.View style={[styles.cardFooter, frontHintStyle]}>
                          <Ionicons name="hand-left-outline" size={15} color="rgba(26,26,26,0.45)" />
                          <Text style={styles.subHint}>{t('vocabulary.studyTapFlip')}</Text>
                        </Animated.View>
                      </Animated.View>

                      <Animated.View style={[styles.face, styles.faceBack, backFaceStyle]}>
                        <View style={styles.cardTopRow}>
                          <Text style={styles.langTag}>{backLabel}</Text>
                          <Text style={styles.cardStep}>{t('vocabulary.studyGrade')}</Text>
                        </View>
                        <View style={styles.termBlock}>
                          {current.pinyin ? <Text style={styles.pinyin}>{current.pinyin}</Text> : null}
                          <Text style={[styles.term, styles.termBack]}>{current.back}</Text>
                        </View>
                        <View style={styles.cardFooter}>
                          <Ionicons name="swap-horizontal" size={15} color="rgba(26,26,26,0.45)" />
                          <Text style={styles.subHint}>{t('vocabulary.studyTapSwipe')}</Text>
                        </View>
                      </Animated.View>
                    </View>
                  </Animated.View>
                </GestureDetector>
              </View>

              {isLast ? (
                <Text style={styles.lastHint}>{t('vocabulary.studyLastCard')}</Text>
              ) : null}
            </View>
          ) : (
            <StudySessionResult
              key={`r-${correct}-${wrong}-${total}`}
              correct={correct}
              wrong={wrong}
              total={total}
              onClose={requestClose}
              onRestart={() => {
                void Haptics.selectionAsync();
                resetSession();
                sheetEnter.value = 0;
                requestAnimationFrame(() => {
                  sheetEnter.value = withTiming(1, SCREEN_FADE_OPEN);
                });
              }}
            />
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: GAME_THEME.color.sky,
    overflow: 'hidden',
  },
  sheet: {
    flex: 1,
    zIndex: 2,
  },
  studyBody: {
    flex: 1,
  },
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: GAME_THEME.color.sky,
  },
  topCenter: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
    paddingHorizontal: 8,
  },
  topSpacer: {
    width: 40,
  },
  folderName: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: GAME_THEME.color.cream,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  closeBtnPressed: {
    opacity: 0.75,
  },
  progress: {
    fontSize: 15,
    fontWeight: '900',
    color: GAME_THEME.color.cream,
    letterSpacing: 0.5,
  },
  progressTrack: {
    height: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: GAME_THEME.color.cream,
  },
  lead: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.42)',
    textAlign: 'center',
    paddingHorizontal: 22,
  },
  tagStrip: {
    position: 'relative',
    height: 32,
    marginTop: 6,
    marginBottom: 4,
    paddingHorizontal: 16,
    overflow: 'visible',
  },
  deck: {
    flex: 1,
    width: '100%',
    position: 'relative',
    overflow: 'visible',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  edgeTag: {
    position: 'absolute',
    top: 2,
    zIndex: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 28,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 999,
    ...Platform.select({
      android: { elevation: 2 },
      default: {},
    }),
  },
  edgeTagLeft: {
    left: 16,
    backgroundColor: GAME_THEME.color.danger,
  },
  edgeTagRight: {
    right: 16,
    backgroundColor: GAME_THEME.color.ok,
  },
  edgeTagLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: GAME_THEME.color.cream,
  },
  edgeTagLabelDark: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: GAME_THEME.color.cream,
  },
  edgeTagPlus: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.2,
    color: GAME_THEME.color.ink,
  },
  cardBehind: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: STACK_PEEK,
    bottom: 0,
    zIndex: 1,
  },
  deckBase: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: STACK_PEEK,
    bottom: 0,
    zIndex: 0,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(26,26,26,0.1)',
    transform: [{ scale: STACK_SCALE }],
  },
  cardWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: STACK_PEEK,
    zIndex: 4,
  },
  cardInner: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: GAME_THEME.color.cream,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(26,26,26,0.1)',
    // hard shadow — GPU-friendly (no blur)
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cardGoldLip: {
    display: 'none',
  },
  face: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backfaceVisibility: 'hidden',
    borderRadius: 4,
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 22,
    justifyContent: 'space-between',
    alignItems: 'stretch',
    zIndex: 3,
  },
  faceFront: {
    backgroundColor: GAME_THEME.color.cream,
  },
  faceBack: {
    backgroundColor: '#F0F6FF',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  langTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(26,26,26,0.07)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: 'rgba(26,26,26,0.5)',
    overflow: 'hidden',
  },
  cardStep: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: 'rgba(26,26,26,0.45)',
    textTransform: 'uppercase',
  },
  termBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    width: '100%',
  },
  termSwap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: 96,
    paddingHorizontal: 4,
  },
  term: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 48,
    color: GAME_THEME.color.ink,
    textAlign: 'center',
  },
  verdictOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  termVerdict: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.4,
    lineHeight: 42,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  termVerdictRight: {
    color: GAME_THEME.color.ok,
  },
  termVerdictLeft: {
    color: GAME_THEME.color.danger,
  },
  termBack: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 6,
    lineHeight: 36,
  },
  pinyin: {
    marginBottom: 10,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: 'rgba(26,26,26,0.55)',
    textAlign: 'center',
  },
  subHint: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: 'rgba(26,26,26,0.42)',
    textAlign: 'center',
  },
  cardFooter: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  lastHint: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(26,26,26,0.5)',
    paddingHorizontal: 22,
    paddingVertical: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
