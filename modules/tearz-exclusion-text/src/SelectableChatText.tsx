import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextInputContentSizeChangeEventData,
  type TextInputSelectionChangeEventData,
  type TextStyle,
} from 'react-native';
import * as Haptics from '@/utils/safe-haptics';

type Props = {
  text: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  inline?: boolean;
  onSelect: (word: string) => void;
  onClear?: () => void;
  registerSelectionClearer?: (clear: () => void) => () => void;
  onInteract?: () => void;
};

const LONG_PRESS_MS = 380;

/** Android / web: выделение только после зажима (+ haptic). */
export function SelectableChatText({
  text,
  style,
  numberOfLines,
  inline = false,
  onSelect,
  onClear,
  registerSelectionClearer,
}: Props) {
  const inputRef = useRef<TextInput>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressArmedRef = useRef(false);
  const hadSelectionRef = useRef(false);
  const [height, setHeight] = useState<number | undefined>(undefined);

  const clearNativeSelection = useCallback(() => {
    longPressArmedRef.current = false;
    hadSelectionRef.current = false;
    inputRef.current?.setNativeProps({ selection: { start: 0, end: 0 } });
    inputRef.current?.blur();
    onClear?.();
  }, [onClear]);

  useEffect(() => {
    if (!registerSelectionClearer) return;
    return registerSelectionClearer(clearNativeSelection);
  }, [clearNativeSelection, registerSelectionClearer]);

  useEffect(
    () => () => {
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
      if (armTimerRef.current) clearTimeout(armTimerRef.current);
    },
    [],
  );

  const onTouchStart = useCallback(() => {
    longPressArmedRef.current = false;
    if (armTimerRef.current) clearTimeout(armTimerRef.current);
    armTimerRef.current = setTimeout(() => {
      armTimerRef.current = null;
      longPressArmedRef.current = true;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, LONG_PRESS_MS);
  }, []);

  const onTouchEnd = useCallback(() => {
    if (armTimerRef.current) {
      clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
    }
    // Короткий тап без зажима — сбросить системное выделение, если всплыло.
    if (!longPressArmedRef.current && !hadSelectionRef.current) {
      inputRef.current?.setNativeProps({ selection: { start: 0, end: 0 } });
    }
  }, []);

  const onSelectionChange = useCallback(
    (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      const { start, end } = e.nativeEvent.selection;
      if (end <= start) {
        if (!hadSelectionRef.current) return;
        if (openTimerRef.current) clearTimeout(openTimerRef.current);
        openTimerRef.current = setTimeout(() => {
          openTimerRef.current = null;
          if (!hadSelectionRef.current) return;
          hadSelectionRef.current = false;
          longPressArmedRef.current = false;
          onClear?.();
          inputRef.current?.blur();
        }, 160);
        return;
      }

      // Без зажима — игнорируем системное выделение (тап / двойной тап).
      if (!longPressArmedRef.current && !hadSelectionRef.current) {
        inputRef.current?.setNativeProps({ selection: { start: 0, end: 0 } });
        return;
      }

      if (openTimerRef.current) clearTimeout(openTimerRef.current);
      const selected = text.slice(start, end).replace(/\s+/g, ' ').trim();
      if (!selected) {
        if (hadSelectionRef.current) {
          hadSelectionRef.current = false;
          longPressArmedRef.current = false;
          onClear?.();
        }
        return;
      }
      hadSelectionRef.current = true;
      openTimerRef.current = setTimeout(() => onSelect(selected), 80);
    },
    [onClear, onSelect, text],
  );

  const onContentSizeChange = useCallback(
    (e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
      const next = Math.ceil(e.nativeEvent.contentSize.height);
      setHeight((prev) => (prev === next ? prev : next));
    },
    [],
  );

  return (
    <View
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      style={inline ? styles.inlineWrap : undefined}>
      <TextInput
        ref={inputRef}
        value={text}
        editable={false}
        caretHidden
        multiline
        scrollEnabled={false}
        showSoftInputOnFocus={false}
        contextMenuHidden
        autoCorrect={false}
        autoCapitalize="none"
        spellCheck={false}
        underlineColorAndroid="transparent"
        selectionColor="rgba(0, 122, 255, 0.22)"
        onSelectionChange={onSelectionChange}
        onContentSizeChange={onContentSizeChange}
        numberOfLines={numberOfLines}
        style={[style, styles.input, height != null ? { height } : null]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  inlineWrap: {
    alignSelf: 'flex-start',
    flexShrink: 1,
  },
  input: {
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    margin: 0,
    textAlignVertical: 'top',
    ...Platform.select({
      android: { includeFontPadding: false },
      default: {},
    }),
  },
});
