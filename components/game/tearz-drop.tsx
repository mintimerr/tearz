import { Image, type ImageStyle } from 'expo-image';
import { Image as InlineImage, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

const DROP = require('../../assets/images/tearz-mario/tearz-drop.png');

/** Пиксельная капля — валюта Tearz. */
export function TearzDrop({ size = 16, style }: { size?: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={DROP}
      style={[{ width: size, height: size }, style]}
      contentFit="contain"
      accessibilityElementsHidden
    />
  );
}

/** Число и капля в одной строке. */
export function CoinAmount({
  value,
  textStyle,
  size = 16,
  style,
}: {
  value: number | string;
  textStyle?: StyleProp<TextStyle>;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 4 }, style]}>
      <Text style={textStyle}>{value}</Text>
      <TearzDrop size={size} />
    </View>
  );
}

/** Текст, где символ ◉ заменён на каплю. */
export function CoinText({
  text,
  style,
  dropSize = 14,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  dropSize?: number;
}) {
  const parts = text.split('◉');
  return (
    <Text style={style}>
      {parts.map((part, i) => (
        <Text key={i}>
          {part}
          {i < parts.length - 1 ? (
            <InlineImage source={DROP} style={{ width: dropSize, height: dropSize }} resizeMode="contain" />
          ) : null}
        </Text>
      ))}
    </Text>
  );
}
