import { requireNativeViewManager } from 'expo-modules-core';
import { useCallback, useMemo, useState } from 'react';
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

export function SelectableChatText({ text, style, numberOfLines, onSelect }: Props) {
  const [height, setHeight] = useState<number | undefined>(undefined);
  const flat = useMemo(() => StyleSheet.flatten(style) ?? {}, [style]);

  const onSelectionChange = useCallback(
    (event: NativeSyntheticEvent<{ text: string; start: number; end: number }>) => {
      const selected = event.nativeEvent.text.trim();
      if (!selected) return;
      onSelect(selected);
    },
    [onSelect],
  );

  const onContentSize = useCallback((event: NativeSyntheticEvent<{ width: number; height: number }>) => {
    const next = Math.ceil(event.nativeEvent.height);
    setHeight((prev) => (prev === next ? prev : next));
  }, []);

  return (
    <NativeSelectableChatText
      text={text}
      color={typeof flat.color === 'string' ? flat.color : '#1A1A1A'}
      fontSize={typeof flat.fontSize === 'number' ? flat.fontSize : 16}
      lineHeight={typeof flat.lineHeight === 'number' ? flat.lineHeight : 24}
      fontWeight={fontWeightToNumber(flat.fontWeight)}
      selectionColor="#C29438"
      numberOfLines={numberOfLines ?? 0}
      onSelectionChange={onSelectionChange}
      onContentSize={onContentSize}
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
