import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useCompanionVoiceRecorder } from '@/hooks/use-companion-voice-recorder';
import { APP_THEME } from '@/constants/theme';

const LOCK_DRAG_Y = 72;
const CANCEL_DRAG_X = 100;
const CANCEL_COMMIT_X = 118;
const MIC_SIZE = 48;
const ATTACH_SIZE = 42;
const RECORD_RED = '#FF453A';
const SEND_BTN_ACTIVE = '#F4F4F5';
const SEND_ICON_ACTIVE = '#09090B';

function formatRecordMs(ms: number) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

type Captured = { uri: string; durationMs: number };

type Props = {
  input: string;
  onChangeText: (t: string) => void;
  onSendText: () => void;
  onCaptured: (captured: Captured) => void;
  onAttachPress?: () => void;
  attachOpen?: boolean;
  typing?: boolean;
  disabled?: boolean;
};

/**
 * Композер в стиле Telegram: справа микрофон (пустой ввод) или отправка;
 * удержание — запись, влево — отмена, вверх — закрепить.
 */
export function CompanionVoiceComposer({
  input,
  onChangeText,
  onSendText,
  onCaptured,
  onAttachPress,
  attachOpen = false,
  typing,
  disabled,
}: Props) {
  const voice = useCompanionVoiceRecorder();
  const [locked, setLocked] = useState(false);
  const [holdActive, setHoldActive] = useState(false);
  const startingRef = useRef(false);
  const lockedRef = useRef(false);
  const holdActiveRef = useRef(false);
  const recordingRef = useRef(false);
  const pendingReleaseRef = useRef(false);
  const isLockedSv = useSharedValue(0);
  lockedRef.current = locked;
  holdActiveRef.current = holdActive;
  recordingRef.current = voice.isRecording;

  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const panelH = useSharedValue(0);
  const dotPulse = useSharedValue(1);
  /** 0 = микрофон, 1 = отправка текста */
  const actionMix = useSharedValue(0);
  const attachSpin = useSharedValue(0);

  const recordingVisible = voice.isRecording || holdActive;
  const hasText = input.trim().length > 0;
  const canVoice = !disabled && !typing;

  useEffect(() => {
    isLockedSv.value = locked ? 1 : 0;
  }, [isLockedSv, locked]);

  useEffect(() => {
    actionMix.value = withTiming(hasText ? 1 : 0, { duration: 160 });
  }, [actionMix, hasText]);

  useEffect(() => {
    attachSpin.value = withSpring(attachOpen ? 1 : 0, { damping: 16, stiffness: 220 });
  }, [attachOpen, attachSpin]);

  useEffect(() => {
    if (!voice.isRecording) {
      dotPulse.value = 1;
      return;
    }
    dotPulse.value = withRepeat(
      withSequence(withTiming(0.35, { duration: 480 }), withTiming(1, { duration: 480 })),
      -1,
      false,
    );
  }, [dotPulse, voice.isRecording]);

  useEffect(() => {
    panelH.value = withTiming(recordingVisible ? 1 : 0, { duration: 200 });
  }, [panelH, recordingVisible]);

  const resetGesture = useCallback(() => {
    panX.value = withSpring(0, { damping: 18, stiffness: 240 });
    panY.value = withSpring(0, { damping: 18, stiffness: 240 });
    setLocked(false);
    isLockedSv.value = 0;
    setHoldActive(false);
    holdActiveRef.current = false;
    recordingRef.current = false;
    pendingReleaseRef.current = false;
  }, [isLockedSv, panX, panY]);

  const cancelFlow = useCallback(async () => {
    await voice.cancelRecording();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    resetGesture();
  }, [resetGesture, voice]);

  const sendFlow = useCallback(async () => {
    const captured = await voice.stopRecording();
    resetGesture();
    if (!captured) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCaptured(captured);
  }, [onCaptured, resetGesture, voice]);

  const armLocked = useCallback(() => {
    if (lockedRef.current) return;
    setLocked(true);
    isLockedSv.value = 1;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    panY.value = withSpring(-LOCK_DRAG_Y * 0.55, { damping: 16, stiffness: 200 });
    panX.value = withSpring(0);
  }, [isLockedSv, panX, panY]);

  const beginHold = useCallback(async () => {
    if (disabled || typing || hasText || startingRef.current || recordingRef.current) return;
    startingRef.current = true;
    pendingReleaseRef.current = false;
    setHoldActive(true);
    holdActiveRef.current = true;
    const ok = await voice.startRecording(() => {
      void sendFlow();
    });
    startingRef.current = false;
    if (!ok) {
      setHoldActive(false);
      holdActiveRef.current = false;
      return;
    }
    recordingRef.current = true;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (pendingReleaseRef.current) {
      pendingReleaseRef.current = false;
      void sendFlow();
    }
  }, [disabled, hasText, sendFlow, typing, voice]);

  const endHold = useCallback(
    (cancelArmed: boolean) => {
      if (lockedRef.current) {
        panX.value = withSpring(0);
        return;
      }
      if (!recordingRef.current) {
        if (holdActiveRef.current || startingRef.current) {
          pendingReleaseRef.current = true;
        }
        return;
      }
      if (cancelArmed) {
        void cancelFlow();
        return;
      }
      void sendFlow();
    },
    [cancelFlow, sendFlow],
  );

  const recordGesture = Gesture.Pan()
    .enabled(canVoice && !hasText && !locked)
    .minDistance(0)
    .onBegin(() => {
      runOnJS(beginHold)();
    })
    .onUpdate((e) => {
      if (isLockedSv.value > 0) return;
      panX.value = Math.min(0, e.translationX);
      panY.value = Math.min(0, e.translationY);
      if (e.translationY < -LOCK_DRAG_Y && isLockedSv.value === 0) {
        runOnJS(armLocked)();
      }
    })
    .onFinalize((e) => {
      if (isLockedSv.value > 0) return;
      const cancelArmed = e.translationX < -CANCEL_COMMIT_X;
      runOnJS(endHold)(cancelArmed);
    });

  const recordBarEnterStyle = useAnimatedStyle(() => ({
    opacity: panelH.value,
    transform: [{ scale: interpolate(panelH.value, [0, 1], [0.98, 1]) }],
  }));

  const lockFloatStyle = useAnimatedStyle(() => {
    const lift = interpolate(panY.value, [0, -LOCK_DRAG_Y], [0, 1], Extrapolation.CLAMP);
    const visible = Math.max(lift, isLockedSv.value);
    return {
      opacity: visible,
      transform: [
        { translateY: interpolate(visible, [0, 1], [20, 0]) },
        { scale: interpolate(visible, [0, 1], [0.75, 1]) },
      ],
    };
  });

  const cancelSlideStyle = useAnimatedStyle(() => {
    const p = interpolate(panX.value, [0, -CANCEL_DRAG_X], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: isLockedSv.value ? 0 : interpolate(p, [0, 1], [1, 0.25]),
      transform: [{ translateX: interpolate(p, [0, 1], [0, -28]) }],
    };
  });

  const trashStyle = useAnimatedStyle(() => {
    const p = interpolate(panX.value, [-CANCEL_DRAG_X, -CANCEL_COMMIT_X], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: isLockedSv.value ? 0 : p,
      transform: [{ scale: interpolate(p, [0, 1], [0.5, 1.1]) }],
    };
  });

  const micButtonStyle = useAnimatedStyle(() => {
    const idleScale = interpolate(actionMix.value, [0, 1], [1, 0.82]);
    const idleOpacity = interpolate(actionMix.value, [0, 1], [1, 0]);
    if (isLockedSv.value > 0) {
      return { opacity: 0, transform: [{ scale: 0.85 }] };
    }
    if (panelH.value > 0.05) {
      const dragScale = interpolate(panX.value, [-CANCEL_COMMIT_X, 0], [0.88, 1], Extrapolation.CLAMP);
      return {
        opacity: 1,
        transform: [
          { translateX: panX.value },
          { translateY: panY.value },
          { scale: dragScale },
        ],
      };
    }
    return {
      opacity: idleOpacity,
      transform: [{ scale: idleScale }],
    };
  });

  const sendIdleStyle = useAnimatedStyle(() => ({
    opacity: actionMix.value,
    transform: [{ scale: interpolate(actionMix.value, [0, 1], [0.82, 1]) }],
  }));

  const attachIconStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(attachSpin.value, [0, 1], [0, 45])}deg` },
      { scale: interpolate(attachSpin.value, [0, 1], [1, 0.92]) },
    ],
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotPulse.value,
    transform: [{ scale: interpolate(dotPulse.value, [0.35, 1], [0.85, 1.15]) }],
  }));

  const metering = voice.metering ?? -160;
  const level = Math.min(1, Math.max(0.15, (metering + 50) / 50));

  const micControl = canVoice && !hasText ? (
    <GestureDetector gesture={recordGesture}>
      <Animated.View
        style={[styles.micSlot, micButtonStyle]}
        pointerEvents={locked ? 'none' : 'auto'}>
        <View style={[styles.micCircle, recordingVisible && styles.micCircleRec]}>
          <Ionicons name="mic" size={24} color={SEND_ICON_ACTIVE} />
        </View>
      </Animated.View>
    </GestureDetector>
  ) : null;

  return (
    <View style={styles.host}>
      <View style={[styles.composerRow, recordingVisible && styles.composerRowRec]}>
        {recordingVisible ? (
          <Animated.View style={[styles.recordBar, recordBarEnterStyle]} pointerEvents="box-none">
            {locked ? (
              <>
                <TouchableOpacity
                  onPress={() => void cancelFlow()}
                  style={styles.sideBtn}
                  hitSlop={10}
                  accessibilityLabel="Отменить запись">
                  <Ionicons name="trash" size={24} color={RECORD_RED} />
                </TouchableOpacity>

                <View style={styles.waveRow}>
                  {Array.from({ length: 28 }).map((_, i) => {
                    const ph = 4 + level * (18 + ((i * 3) % 5));
                    return (
                      <View
                        key={i}
                        style={[
                          styles.waveLine,
                          {
                            height: ph,
                            opacity: 0.35 + (i % 4 === 0 ? level * 0.65 : level * 0.4),
                          },
                        ]}
                      />
                    );
                  })}
                </View>

                <Text style={styles.timer}>{formatRecordMs(voice.durationMs)}</Text>

                <TouchableOpacity
                  onPress={() => void sendFlow()}
                  style={styles.sendCircle}
                  hitSlop={10}
                  accessibilityLabel="Отправить голосовое">
                  <Ionicons name="arrow-up" size={20} color={SEND_ICON_ACTIVE} />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Animated.View style={[styles.cancelHint, cancelSlideStyle]} pointerEvents="none">
                  <Ionicons name="chevron-back" size={16} color="rgba(242,242,247,0.45)" />
                  <Text style={styles.cancelText} numberOfLines={1}>
                    Влево — отмена
                  </Text>
                </Animated.View>

                <Animated.View style={[styles.trashFloat, trashStyle]} pointerEvents="none">
                  <Ionicons name="trash" size={22} color={RECORD_RED} />
                </Animated.View>

                <View style={styles.recordMid}>
                  <Animated.View style={[styles.recDot, dotStyle]} />
                  <Text style={styles.timer}>{formatRecordMs(voice.durationMs)}</Text>
                  <Text style={styles.releaseHint} numberOfLines={1}>
                    Отпустите
                  </Text>
                </View>

                {micControl}

                <Animated.View style={[styles.lockFloat, lockFloatStyle]} pointerEvents="none">
                  <View style={styles.lockCircle}>
                    <Ionicons name="chevron-up" size={14} color={APP_THEME.color.mutedSoft} style={styles.lockChevron} />
                    <Ionicons name="lock-open-outline" size={20} color={APP_THEME.color.textSoft} />
                  </View>
                </Animated.View>
              </>
            )}
          </Animated.View>
        ) : (
          <>
            {onAttachPress ? (
              <TouchableOpacity
                onPress={onAttachPress}
                activeOpacity={0.75}
                disabled={typing || disabled}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={attachOpen ? 'Закрыть вложения' : 'Прикрепить вложение'}>
                <Animated.View
                  style={[
                    styles.attachBtn,
                    attachOpen && styles.attachBtnActive,
                    attachIconStyle,
                    (typing || disabled) && styles.attachBtnOff,
                  ]}>
                  <Ionicons name="add" size={26} color={APP_THEME.color.textSoft} />
                </Animated.View>
              </TouchableOpacity>
            ) : null}

            <TextInput
              style={styles.input}
              placeholder="Сообщение"
              placeholderTextColor={APP_THEME.color.mutedFaint}
              value={input}
              onChangeText={onChangeText}
              multiline
              maxLength={2000}
            />

            <View style={styles.actionDock}>
              {micControl}

              <Animated.View
                style={[styles.actionLayer, sendIdleStyle]}
                pointerEvents={hasText ? 'auto' : 'none'}>
                <TouchableOpacity
                  style={[styles.sendCircle, (typing || disabled) && styles.actionOff]}
                  onPress={() => onSendText()}
                  activeOpacity={0.7}
                  disabled={typing || disabled || !hasText}>
                  <Ionicons name="arrow-up" size={20} color={SEND_ICON_ACTIVE} />
                </TouchableOpacity>
              </Animated.View>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    width: '100%',
  },
  lockFloat: {
    position: 'absolute',
    right: 4,
    bottom: MIC_SIZE + 6,
    alignItems: 'center',
    zIndex: 10,
  },
  lockCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: APP_THEME.color.elevatedSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockCircleOn: {
    backgroundColor: APP_THEME.color.accentGlass,
    borderColor: APP_THEME.color.borderStrong,
  },
  lockChevron: {
    position: 'absolute',
    top: 6,
  },
  composerRowRec: {
    alignItems: 'center',
  },
  recordBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIC_SIZE,
    height: MIC_SIZE,
    paddingLeft: 6,
    paddingRight: 4,
    borderRadius: MIC_SIZE / 2,
    backgroundColor: APP_THEME.color.elevated,
    gap: 6,
    overflow: 'visible',
  },
  cancelHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    maxWidth: 108,
    flexShrink: 0,
    paddingLeft: 4,
  },
  recordMid: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minWidth: 0,
    paddingHorizontal: 4,
  },
  releaseHint: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(242, 242, 247, 0.48)',
    letterSpacing: -0.2,
  },
  micSlot: {
    width: MIC_SIZE,
    height: MIC_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  recDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: RECORD_RED,
  },
  timer: {
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    color: 'rgba(242, 242, 247, 0.92)',
    letterSpacing: -0.3,
    flexShrink: 0,
  },
  cancelText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(242, 242, 247, 0.45)',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  trashFloat: {
    position: 'absolute',
    left: 10,
    top: 0,
    bottom: 0,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    height: 32,
    overflow: 'hidden',
  },
  waveLine: {
    width: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(242, 242, 247, 0.75)',
  },
  sideBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendCircle: {
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: MIC_SIZE / 2,
    backgroundColor: SEND_BTN_ACTIVE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    minHeight: MIC_SIZE,
  },
  attachBtn: {
    width: ATTACH_SIZE,
    height: ATTACH_SIZE,
    borderRadius: ATTACH_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
    backgroundColor: APP_THEME.color.elevated,
  },
  attachBtnActive: {
    backgroundColor: APP_THEME.color.elevatedSoft,
  },
  attachBtnOff: {
    opacity: 0.4,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: APP_THEME.color.elevated,
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: -0.2,
    color: APP_THEME.color.text,
    marginBottom: 2,
  },
  actionDock: {
    width: MIC_SIZE,
    height: MIC_SIZE,
    marginBottom: 2,
    overflow: 'visible',
  },
  actionLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  micCircle: {
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: MIC_SIZE / 2,
    backgroundColor: SEND_BTN_ACTIVE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micCircleRec: {
    backgroundColor: RECORD_RED,
  },
  actionOff: {
    opacity: 0.45,
  },
});
