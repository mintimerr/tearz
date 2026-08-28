import { requireNativeViewManager } from 'expo-modules-core';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import {
  Platform,
  StyleSheet,
  TextInput,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import type { ExclusionRect, ExclusionTextInputRef } from './types';

type NativeProps = {
  text: string;
  placeholder?: string;
  color?: string;
  placeholderColor?: string;
  fontSize?: number;
  lineHeight?: number;
  fontWeight?: number;
  selectionColor?: string;
  maxLength?: number;
  photoUri?: string | null;
  photoWidthFrac?: number;
  photoHeightFrac?: number;
  exclusionRect?: ExclusionRect | null;
  exclusionNorm?: ExclusionRect | null;
  style?: StyleProp<ViewStyle>;
  onChangeText?: (event: NativeSyntheticEvent<{ text: string }>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onSubmitEditing?: () => void;
  onClearPhoto?: () => void;
};

const NativeExclusionTextView = requireNativeViewManager<NativeProps>('ExclusionText');

type Props = Omit<TextInputProps, 'onChangeText' | 'onSubmitEditing'> & {
  exclusionRect?: ExclusionRect | null;
  exclusionNorm?: ExclusionRect | null;
  photoUri?: string | null;
  photoWidthFrac?: number;
  photoHeightFrac?: number;
  fontWeight?: TextInputProps['fontWeight'];
  onChangeText?: (text: string) => void;
  onSubmitEditing?: () => void;
  onClearPhoto?: () => void;
};

export const ExclusionTextInput = forwardRef<ExclusionTextInputRef, Props>(function ExclusionTextInput(
  {
    value = '',
    placeholder,
    style,
    color,
    placeholderTextColor,
    fontSize,
    lineHeight,
    fontWeight,
    selectionColor,
    maxLength,
    exclusionRect,
    exclusionNorm,
    photoUri,
    photoWidthFrac,
    photoHeightFrac,
    onChangeText,
    onFocus,
    onBlur,
    onSubmitEditing,
    onClearPhoto,
    ...rest
  },
  ref,
) {
  const nativeRef = useRef<{ focus?: () => Promise<void>; blur?: () => Promise<void> }>(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      void nativeRef.current?.focus?.();
    },
    blur: () => {
      void nativeRef.current?.blur?.();
    },
  }));

  const useNative = Platform.OS === 'ios' && !!(photoUri || exclusionNorm || exclusionRect);

  if (!useNative) {
    return (
      <TextInput
        {...rest}
        value={value}
        placeholder={placeholder}
        style={style}
        placeholderTextColor={placeholderTextColor}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        onSubmitEditing={onSubmitEditing}
        selectionColor={selectionColor}
        maxLength={maxLength}
      />
    );
  }

  const flat = StyleSheet.flatten(style) ?? {};

  return (
    <NativeExclusionTextView
      ref={nativeRef}
      text={value}
      placeholder={placeholder ?? ''}
      color={typeof color === 'string' ? color : (flat.color as string | undefined) ?? '#FF5C5C'}
      placeholderColor={placeholderTextColor}
      fontSize={typeof fontSize === 'number' ? fontSize : (flat.fontSize as number | undefined) ?? 13}
      lineHeight={typeof lineHeight === 'number' ? lineHeight : (flat.lineHeight as number | undefined) ?? 17}
      fontWeight={fontWeightToNumber(fontWeight ?? flat.fontWeight) ?? 600}
      selectionColor={typeof selectionColor === 'string' ? selectionColor : '#FF5C5C'}
      maxLength={maxLength}
      photoUri={photoUri ?? null}
      photoWidthFrac={photoWidthFrac}
      photoHeightFrac={photoHeightFrac}
      exclusionNorm={photoUri ? null : exclusionNorm ?? null}
      exclusionRect={photoUri ? null : exclusionNorm ? null : exclusionRect}
      style={[styles.fill, style]}
      onChangeText={(event) => onChangeText?.(event.nativeEvent.text)}
      onFocus={onFocus}
      onBlur={onBlur}
      onSubmitEditing={onSubmitEditing}
      onClearPhoto={onClearPhoto}
    />
  );
});

function fontWeightToNumber(weight: TextInputProps['fontWeight'] | undefined): number | undefined {
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
      return undefined;
  }
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    alignSelf: 'stretch',
    width: '100%',
    height: '100%',
    minHeight: 0,
  },
});

export type { ExclusionRect, ExclusionTextInputRef } from './types';
