import { forwardRef, useImperativeHandle, useRef } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

import type { ExclusionRect, ExclusionTextInputRef } from './types';

type Props = Omit<TextInputProps, 'onChangeText' | 'onSubmitEditing'> & {
  exclusionRect?: ExclusionRect | null;
  onChangeText?: (text: string) => void;
  onSubmitEditing?: () => void;
};

/** Web / fallback — обычный TextInput без exclusion paths. */
export const ExclusionTextInput = forwardRef<ExclusionTextInputRef, Props>(function ExclusionTextInput(
  { onChangeText, onSubmitEditing, exclusionRect: _exclusionRect, ...rest },
  ref,
) {
  const inputRef = useRef<TextInput>(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    blur: () => inputRef.current?.blur(),
  }));

  return (
    <TextInput
      {...rest}
      ref={inputRef}
      onChangeText={onChangeText}
      onSubmitEditing={onSubmitEditing}
    />
  );
});

export type { ExclusionRect, ExclusionTextInputRef } from './types';
