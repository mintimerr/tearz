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
  /** Inside a wrapping row — size to content, not full width. */
  inline?: boolean;
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
  inline = false,
  onSelect,
  onClear,
  registerSelectionClearer,
  onInteract,
}: Props) {
  const [height, setHeight] = useState<number | undefined>(undefined);
  const [width, setWidth] = useState<number | undefined>(undefined);
  const hadSelectionRef = useRef(false);
  const nativeRef = useRef<{ clearSelection?: () => Promise<void> }>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flat = useMemo(() => StyleSheet.flatten(style) ?? {}, [style]);
  const fontSize = typeof flat.fontSize === 'number' ? flat.fontSize : 16;
  // Без явного lineHeight не подставлять 24: на крупном кегле (слово в тренировке, 28)
  // строка ниже шрифта обрезает иероглифы.
  const lineHeight =
    typeof flat.lineHeight === 'number' ? flat.lineHeight : Math.max(24, Math.ceil(fontSize * 1.35));

  // Новый текст — сбросить размер, иначе может остаться высота «столбика».
  useEffect(() => {
    setHeight(undefined);
    setWidth(undefined);
  }, [text]);

  const clearNativeSelection = useCallback(() => {
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    void nativeRef.current?.clearSelection?.();
  }, []);

  useEffect(() => {
    if (!registerSelectionClearer) return;
    return registerSelectionClearer(clearNativeSelection);
  }, [clearNativeSelection, registerSelectionClearer]);

  useEffect(
    () => () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    },
    [],
  );

  const onSelectionChange = useCallback(
    (event: NativeSyntheticEvent<{ text: string; start: number; end: number }>) => {
      const selected = event.nativeEvent.text.trim();
      if (!selected) {
        if (!hadSelectionRef.current) return;
        if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
        // Debounce empty — handle release / stretch often emits empty briefly.
        clearTimerRef.current = setTimeout(() => {
          clearTimerRef.current = null;
          if (!hadSelectionRef.current) return;
          // Don't clear sheet from a flicker — only if still empty after settle.
          hadSelectionRef.current = false;
          onClear?.();
        }, 420);
        return;
      }
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }
      hadSelectionRef.current = true;
      onSelect(selected);
    },
    [onClear, onSelect],
  );

  const onContentSize = useCallback(
    (event: NativeSyntheticEvent<{ width: number; height: number }>) => {
      const nextH = Math.ceil(event.nativeEvent.height);
      const nextW = Math.ceil(event.nativeEvent.width);
      setHeight((prev) => (prev === nextH ? prev : nextH));
      // Всегда фиксируем intrinsic width — иначе CJK пузырь схлопывается в 1 символ.
      setWidth((prev) => (prev === nextW ? prev : nextW));
    },
    [],
  );

  return (
    <NativeSelectableChatText
      ref={nativeRef}
      text={text}
      color={typeof flat.color === 'string' ? flat.color : '#1A1A1A'}
      fontSize={fontSize}
      lineHeight={lineHeight}
      fontWeight={fontWeightToNumber(flat.fontWeight)}
      selectionColor="rgba(0, 122, 255, 0.22)"
      numberOfLines={numberOfLines ?? 0}
      onSelectionChange={onSelectionChange}
      onContentSize={onContentSize}
      onInteract={onInteract}
      style={[
        inline ? styles.inline : styles.fill,
        // Пока нет intrinsic size — не рисуем: иначе на fade/slide мелькает
        // синий selection/frame до хрома экрана.
        height == null || width == null ? styles.pending : null,
        height != null ? { height } : null,
        width != null ? { width } : null,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  fill: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  inline: {
    alignSelf: 'flex-start',
    flexShrink: 1,
    maxWidth: '100%',
  },
  pending: {
    opacity: 0,
  },
});