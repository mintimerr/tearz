import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import { SelectableChatText } from 'tearz-exclusion-text';
import { useWordAddSheet } from '@/components/word-add-sheet';

export type TextToken = { type: 'word' | 'gap'; value: string };

/** @deprecated kept for API compatibility — выделение теперь нативное. */
export function tokenizeForLongPress(text: string): TextToken[] {
  const out: TextToken[] = [];
  let i = 0;
  const re =
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]|[\p{L}\p{M}]+(?:[''\u2019-][\p{L}\p{M}]+)*|\d+/gu;
  const s = text;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (m.index > i) out.push({ type: 'gap', value: s.slice(i, m.index) });
    out.push({ type: 'word', value: m[0] });
    i = m.index + m[0].length;
  }
  if (i < s.length) out.push({ type: 'gap', value: s.slice(i) });
  return out;
}

type Props = {
  text: string;
  style?: StyleProp<TextStyle>;
  /** @deprecated kept for API compatibility */
  animKey?: string;
  numberOfLines?: number;
};

export function LongPressWordText({ text, style, numberOfLines }: Props) {
  const { openWord, closeSheet, clearWordSelections, registerSelectionClearer } = useWordAddSheet();
  return (
    <SelectableChatText
      text={text}
      style={[styles.base, style]}
      numberOfLines={numberOfLines}
      onSelect={openWord}
      onClear={() => closeSheet()}
      registerSelectionClearer={registerSelectionClearer}
      onInteract={clearWordSelections}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    margin: 0,
  },
});
