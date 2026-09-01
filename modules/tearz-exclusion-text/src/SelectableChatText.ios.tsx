import { requireNativeViewManager } from 'expo-modules-core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

type NativeProps = {
  text: string;
  color?: string;
  fontSize?: number;
  lineHeight?: number;
  fontWeight?: number;
  selectionColor?: string;
  numberOfLines?: number;
  style?: StyleProp<ViewStyle>;
  onSelectionChange?: (event: NativeSyntheticEvent<{ text: string; start: number; end: number }>) => void;
  onContentSize?: (event: NativeSyntheticEvent<{ width: number; height: number }>) => void;
  onInteract?: () => void;
};

const NativeSelectableChatText = requireNativeViewManager<NativeProps>(
  'ExclusionText',
  'SelectableChatTextView',
);

type Props = {
  text: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  onSelect: (word: string) => void;
  /** Снятие выделения (тап в пустоту) — закрыть плашку перевода. */
  onClear?: () => void;
  /** Регистрация нативного сброса выделения (тап мимо слова на всём экране). */
  registerSelectionClearer?: (clear: () => void) => () => void;
  /** Тап мимо выделенного слова в любом сообщении — сбросить все выделения. */
  onInteract?: () => void;
};

function fontWeightToNumber(weight: TextStyle['fontWeight']): number {
  if (typeof weight === 'number') return weight;
  switch (weight) {
    case '100':
      return 100;
    case '200':
      return 200;
    case '300':
      return 300;
    case '400':
    case 'normal':
      return 400;
    case '500':
      return 500;
    case '600':
    case 'semibold':
      return 600;
    case '700':
    case 'bold':
      return 700;
    case '800':
      return 800;
    case '900':
      return 900;
    default:
      return 600;
  }
}

export function SelectableChatText({
  text,
  style,
  numberOfLines,
  onSelect,
  onClear,
  registerSelectionClearer,
  onInteract,
}: Props) {
  const [height, setHeight] = useState<number | undefined>(undefined);
  const hadSelectionRef = useRef(false);
  const nativeRef = useRef<{ clearSelection?: () => Promise<void> }>(null);
  const flat = useMemo(() => StyleSheet.flatten(style) ?? {}, [style]);

  const clearNativeSelection = useCallback(() => {
    void nativeRef.current?.clearSelection?.();
  }, []);

  useEffect(() => {
    if (!registerSelectionClearer) return;
    return registerSelectionClearer(clearNativeSelection);
  }, [clearNativeSelection, registerSelectionClearer]);

  const onSelectionChange = useCallback(
    (event: NativeSyntheticEvent<{ text: string; start: number; end: number }>) => {
      const selected = event.nativeEvent.text.trim();
      if (!selected) {
        if (hadSelectionRef.current) {
          hadSelectionRef.current = false;
          onClear?.();
        }
        return;
      }
      hadSelectionRef.current = true;
      onSelect(selected);
    },
    [onClear, onSelect],
  );

  const onContentSize = useCallback((event: NativeSyntheticEvent<{ width: number; height: number }>) => {
    const next = Math.ceil(event.nativeEvent.height);
    setHeight((prev) => (prev === next ? prev : next));
  }, []);

  return (
    <NativeSelectableChatText
      ref={nativeRef}
      text={text}
      color={typeof flat.color === 'string' ? flat.color : '#1A1A1A'}
      fontSize={typeof flat.fontSize === 'number' ? flat.fontSize : 16}
      lineHeight={typeof flat.lineHeight === 'number' ? flat.lineHeight : 24}
      fontWeight={fontWeightToNumber(flat.fontWeight)}
      selectionColor="#007AFF"
      numberOfLines={numberOfLines ?? 0}
      onSelectionChange={onSelectionChange}
      onContentSize={onContentSize}
      onInteract={onInteract}
      style={[styles.fill, height != null ? { height } : null]}
    />
  );
}

const styles = StyleSheet.create({
  fill: {
    alignSelf: 'stretch',
    width: '100%',
  },
});
