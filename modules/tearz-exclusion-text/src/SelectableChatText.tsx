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
import * as Haptics from 'expo-haptics';

type Props = {
  text: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  onSelect: (word: string) => void;
  onClear?: () => void;
  registerSelectionClearer?: (clear: () => void) => () => void;
  onInteract?: () => void;
};

const LONG_PRESS_MS = 380;

/** Android / web: системное выделение через TextInput. */
export function SelectableChatText({
  text,
  style,
  numberOfLines,
  onSelect,
  onClear,
  registerSelectionClearer,
}: Props) {
  const inputRef = useRef<TextInput>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hapticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hadSelectionRef = useRef(false);
  const [height, setHeight] = useState<number | undefined>(undefined);

  const clearNativeSelection = useCallback(() => {
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
      if (hapticTimerRef.current) clearTimeout(hapticTimerRef.current);
    },
    [],
  );

  const onTouchStart = useCallback(() => {
    if (hapticTimerRef.current) clearTimeout(hapticTimerRef.current);
    hapticTimerRef.current = setTimeout(() => {
      hapticTimerRef.current = null;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, LONG_PRESS_MS);
  }, []);

  const onTouchEnd = useCallback(() => {
    if (hapticTimerRef.current) {
      clearTimeout(hapticTimerRef.current);
      hapticTimerRef.current = null;
    }
  }, []);

  const onSelectionChange = useCallback(
    (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      const { start, end } = e.nativeEvent.selection;
      if (end <= start) {
        if (hadSelectionRef.current) {
          hadSelectionRef.current = false;
          onClear?.();
        }
        inputRef.current?.blur();
        return;
      }
      const selected = text.slice(start, end).replace(/\s+/g, ' ').trim();
      if (!selected) {
        if (hadSelectionRef.current) {
          hadSelectionRef.current = false;
          onClear?.();
        }
        return;
      }
      hadSelectionRef.current = true;
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
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
    <View onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
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
