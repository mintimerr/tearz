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
import { APP_THEME } from '@/constants/theme';
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
};

const SWIPE_THRESHOLD = 72;
const VELOCITY_COMMIT = 720;
const DRAG_LABEL_FULL = 168;
const SEND_BTN_ACTIVE = '#F4F4F5';
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
      opacity: interpolate(translateX.value, [-DRAG_LABEL_FULL, 0], [0.88, 0.34], Extrapolation.CLAMP),
      borderColor: `rgba(255, 69, 58, ${0.18 + glow * 0.28})`,
      backgroundColor: `rgba(255, 69, 58, ${0.04 + glow * 0.1})`,
    };
  });

  const rightCornerPlusStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, 72, DRAG_LABEL_FULL], [0, 0, 0.75], Extrapolation.CLAMP),
  }));

  const rightCornerIconStyle = useAnimatedStyle(() => {
    const glow = interpolate(translateX.value, [0, 40, DRAG_LABEL_FULL], [0, 0.3, 1], Extrapolation.CLAMP);
    return {
      opacity: interpolate(translateX.value, [0, DRAG_LABEL_FULL], [0.34, 0.88], Extrapolation.CLAMP),
      borderColor: `rgba(48, 209, 88, ${0.18 + glow * 0.28})`,
      backgroundColor: `rgba(48, 209, 88, ${0.04 + glow * 0.1})`,
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
          <View style={styles.topBar}>
            <Pressable
              hitSlop={12}
              onPress={requestClose}
              disabled={isClosing}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel={t('vocabulary.studyClose')}>
              <Ionicons name="close" size={26} color="rgba(242,242,247,0.92)" />
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
            <View style={{ width: 44 }} />
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
                  <Ionicons name="close" size={17} color="#FF6961" />
                </Animated.View>

                <Animated.View
                  pointerEvents="none"
                  style={[styles.edgeTag, styles.edgeTagRight, rightCornerIconStyle]}>
                  <Animated.Text style={[styles.edgeTagPlus, rightCornerPlusStyle]}>
                    {t('vocabulary.studyPlusOne')}
                  </Animated.Text>
                  <Ionicons name="checkmark" size={18} color="#30D158" />
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
                          <Ionicons name="scan-outline" size={16} color={APP_THEME.color.mutedSoft} />
                          <Text style={styles.subHint}>{t('vocabulary.studyTapFlip')}</Text>
                        </View>
                      </View>
                    </View>
                  </Animated.View>
                ) : (
                  <View style={styles.deckBase} pointerEvents="none" />
                )}

                <GestureDetector gesture={gesture}>
                  <Animated.View style={[styles.cardWrap, cardStyle]}>
                    <Animated.View style={styles.cardInner}>
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
                          <Ionicons name="scan-outline" size={16} color={APP_THEME.color.mutedSoft} />
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
                          <Ionicons name="swap-horizontal-outline" size={16} color={APP_THEME.color.mutedSoft} />
                          <Text style={styles.subHint}>{t('vocabulary.studyTapSwipe')}</Text>
                        </View>
                      </Animated.View>
                    </Animated.View>
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
    backgroundColor: APP_THEME.color.bg,
    overflow: 'hidden',
  },
  sheet: {
    flex: 1,
    zIndex: 2,
  },
  studyBody: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 18,
  },
  topCenter: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
    paddingHorizontal: 8,
  },
  folderName: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.25,
    color: APP_THEME.color.text,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_THEME.color.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.border,
  },
  progress: {
    fontSize: 15,
    fontWeight: '700',
    color: APP_THEME.color.textSoft,
    letterSpacing: -0.2,
  },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: APP_THEME.color.accentSoft,
    marginHorizontal: 22,
    marginBottom: 14,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: SEND_BTN_ACTIVE,
  },
  lead: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    color: APP_THEME.color.muted,
    textAlign: 'center',
    paddingHorizontal: 22,
  },
  tagStrip: {
    position: 'relative',
    height: 34,
    marginTop: 8,
    marginBottom: 6,
    overflow: 'visible',
  },
  deck: {
    flex: 1,
    width: '100%',
    position: 'relative',
    overflow: 'visible',
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  edgeTag: {
    position: 'absolute',
    top: 2,
    zIndex: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 30,
    paddingVertical: 5,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    ...Platform.select({
      android: { elevation: 3 },
      default: {},
    }),
  },
  edgeTagLeft: {
    left: 0,
    paddingLeft: 12,
    paddingRight: 10,
    borderTopRightRadius: 9,
    borderBottomRightRadius: 9,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
    borderColor: 'rgba(255, 69, 58, 0.28)',
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
  },
  edgeTagRight: {
    right: 0,
    paddingLeft: 8,
    paddingRight: 12,
    borderTopLeftRadius: 9,
    borderBottomLeftRadius: 9,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    borderColor: 'rgba(48, 209, 88, 0.28)',
    backgroundColor: 'rgba(48, 209, 88, 0.1)',
  },
  edgeTagPlus: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: -0.1,
    color: 'rgba(48, 209, 88, 0.72)',
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
    borderRadius: APP_THEME.radius.xl,
    backgroundColor: APP_THEME.color.elevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.separator,
    opacity: 0.35,
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
    borderRadius: APP_THEME.radius.xl,
    backgroundColor: APP_THEME.color.elevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.separator,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.14,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  face: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backfaceVisibility: 'hidden',
    borderRadius: APP_THEME.radius.xl,
    paddingVertical: 28,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
    alignItems: 'stretch',
    zIndex: 3,
  },
  faceFront: {
    backgroundColor: 'transparent',
  },
  faceBack: {
    backgroundColor: APP_THEME.color.elevatedSoft,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  langTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: APP_THEME.color.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.accentSoft,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.25,
    textTransform: 'uppercase',
    color: APP_THEME.color.mutedSoft,
  },
  cardStep: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.08,
    color: APP_THEME.color.mutedSoft,
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
    fontSize: 37,
    fontWeight: '700',
    letterSpacing: -0.92,
    lineHeight: 45,
    color: APP_THEME.color.text,
    textAlign: 'center',
  },
  verdictOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  termVerdict: {
    fontSize: 37,
    fontWeight: '700',
    letterSpacing: -0.92,
    lineHeight: 45,
    textAlign: 'center',
  },
  termVerdictRight: {
    color: 'rgba(48, 209, 88, 0.82)',
  },
  termVerdictLeft: {
    color: 'rgba(255, 105, 97, 0.82)',
  },
  termBack: {
    fontSize: 27,
    fontWeight: '600',
    marginTop: 6,
    lineHeight: 34,
  },
  pinyin: {
    marginBottom: 10,
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: 0.4,
    color: APP_THEME.color.accentLight,
    textAlign: 'center',
  },
  subHint: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: -0.08,
    color: APP_THEME.color.mutedSoft,
    textAlign: 'center',
  },
  cardFooter: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  lastHint: {
    textAlign: 'center',
    fontSize: 13,
    color: APP_THEME.color.muted,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
});
