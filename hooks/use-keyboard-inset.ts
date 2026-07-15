import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, type KeyboardEvent, type ViewStyle } from 'react-native';
import {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type AnimatedStyle,
} from 'react-native-reanimated';

const KEYBOARD_EASING = Easing.bezier(0.25, 0.1, 0.25, 1);

/** Малый зазор между строкой ввода и клавиатурой (только когда она открыта). */
export const KEYBOARD_COMPOSER_GAP = 10;

function keyboardDuration(e: KeyboardEvent, fallback: number) {
  if (Platform.OS === 'ios' && e.duration > 0) return e.duration;
  return fallback;
}

/** Плавный нижний отступ под клавиатуру — Reanimated на UI-потоке. */
export function useKeyboardInset(
  fallbackInset: number,
  keyboardGap: number = KEYBOARD_COMPOSER_GAP,
) {
  const paddingBottom = useSharedValue(fallbackInset);
  const openRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);

  const setOpen = useCallback((open: boolean) => {
    openRef.current = open;
    setIsOpen(open);
  }, []);

  useEffect(() => {
    if (openRef.current) return;
    cancelAnimation(paddingBottom);
    paddingBottom.value = fallbackInset;
  }, [fallbackInset, paddingBottom]);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvt, (e) => {
      cancelAnimation(paddingBottom);
      runOnJS(setOpen)(true);
      paddingBottom.value = withTiming(e.endCoordinates.height + keyboardGap, {
        duration: keyboardDuration(e, 280),
        easing: KEYBOARD_EASING,
      });
    });

    const hide = Keyboard.addListener(hideEvt, (e) => {
      cancelAnimation(paddingBottom);
      paddingBottom.value = withTiming(
        fallbackInset,
        {
          duration: keyboardDuration(e, 240),
          easing: KEYBOARD_EASING,
        },
        (finished) => {
          if (finished) runOnJS(setOpen)(false);
        },
      );
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, [fallbackInset, keyboardGap, paddingBottom, setOpen]);

  const animatedStyle = useAnimatedStyle(() => ({
    paddingBottom: paddingBottom.value,
  }));

  return {
    animatedStyle: animatedStyle as AnimatedStyle<ViewStyle>,
    isOpen,
  };
}
