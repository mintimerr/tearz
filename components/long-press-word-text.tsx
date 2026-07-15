import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import {
  InteractionManager,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import { useWordAddSheet } from '@/components/word-add-sheet';

export type TextToken = { type: 'word' | 'gap'; value: string };

/** Разбивает строку на слова (Unicode-буквы) и промежутки. */
export function tokenizeForLongPress(text: string): TextToken[] {
  const out: TextToken[] = [];
  let i = 0;
  const re = /[\p{L}\p{M}]+(?:[''\u2019-][\p{L}\p{M}]+)*|\d+/gu;
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

function NestedLongPressText({
  text,
  style,
  numberOfLines,
  onLongPressWord,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  onLongPressWord: (word: string) => void;
}) {
  const tokens = tokenizeForLongPress(text);
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {tokens.map((tok, i) => {
        if (tok.type === 'gap') {
          return <Text key={`g-${i}`}>{tok.value}</Text>;
        }
        return (
          <Text
            key={`w-${i}-${tok.value}`}
            style={style}
            suppressHighlighting
            onLongPress={() => onLongPressWord(tok.value)}
            {...({ delayLongPress: 320 } as object)}>
            {tok.value}
          </Text>
        );
      })}
    </Text>
  );
}

export function LongPressWordText({ text, style, numberOfLines }: Props) {
  const { openWord } = useWordAddSheet();
  const tokens = tokenizeForLongPress(text);

  const handleLongPressWord = useCallback(
    (word: string) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      InteractionManager.runAfterInteractions(() => {
        openWord(word);
      });
    },
    [openWord],
  );

  if (numberOfLines != null) {
    return (
      <NestedLongPressText
        text={text}
        style={style}
        numberOfLines={numberOfLines}
        onLongPressWord={handleLongPressWord}
      />
    );
  }

  return (
    <View style={styles.wrap}>
      {tokens.map((tok, i) => {
        if (tok.type === 'gap') {
          return (
            <Text key={`g-${i}`} style={style}>
              {tok.value}
            </Text>
          );
        }
        return (
          <Pressable
            key={`w-${i}-${tok.value}`}
            delayLongPress={320}
            onLongPress={() => handleLongPressWord(tok.value)}>
            <Text style={style}>{tok.value}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    ...Platform.select({
      android: { includeFontPadding: false },
      default: {},
    }),
  },
});
