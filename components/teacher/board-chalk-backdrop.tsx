import { Kalam_400Regular, useFonts } from '@expo-google-fonts/kalam';
import { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Pattern, Rect, Stop } from 'react-native-svg';

import { AmbientBackdrop } from '@/components/ui/ambient-backdrop';
import { APP_THEME } from '@/constants/theme';

type GhostPhrase = {
  text: string;
  left: number;
  top: number;
  rotate: number;
  size: number;
  opacity: number;
  smudge?: boolean;
};

const GHOST_PHRASES: GhostPhrase[] = [
  { text: 'Bonjour', left: 0.05, top: 0.1, rotate: -5, size: 24, opacity: 0.055 },
  { text: 'Hola', left: 0.62, top: 0.08, rotate: 3, size: 22, opacity: 0.048 },
  { text: '你好', left: 0.78, top: 0.15, rotate: -2, size: 28, opacity: 0.05 },
  { text: 'Guten Tag', left: 0.08, top: 0.24, rotate: 1, size: 20, opacity: 0.042 },
  { text: 'How do you say…', left: 0.38, top: 0.2, rotate: -1, size: 18, opacity: 0.038 },
  { text: 'Je voudrais…', left: 0.58, top: 0.32, rotate: 4, size: 19, opacity: 0.036 },
  { text: 'すみません', left: 0.14, top: 0.42, rotate: -3, size: 22, opacity: 0.045 },
  { text: 'past tense', left: 0.5, top: 0.5, rotate: -2, size: 21, opacity: 0.032, smudge: true },
  { text: 'verb + obj', left: 0.06, top: 0.6, rotate: 2, size: 19, opacity: 0.03, smudge: true },
  { text: '谢谢', left: 0.7, top: 0.57, rotate: -4, size: 26, opacity: 0.034, smudge: true },
  { text: 'Merci', left: 0.32, top: 0.7, rotate: 1, size: 20, opacity: 0.04 },
  { text: 'привет', left: 0.18, top: 0.76, rotate: -3, size: 23, opacity: 0.035, smudge: true },
];

function BoardDotGrid() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="boardDots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
            <Rect x="13" y="13" width="2" height="2" rx="1" fill="rgba(0, 122, 255, 0.06)" />
          </Pattern>
          <LinearGradient id="boardWash" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.72} />
            <Stop offset="45%" stopColor="#F8F9FC" stopOpacity={0.38} />
            <Stop offset="100%" stopColor="#F2F2F7" stopOpacity={0.55} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#boardDots)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#boardWash)" />
      </Svg>
    </View>
  );
}

type Props = {
  style?: StyleProp<ViewStyle>;
};

/** Премиальный фон доски — глубина, сетка, атмосфера, едва заметный маркер. */
export function BoardChalkBackdrop({ style }: Props) {
  const [fontsLoaded] = useFonts({ Kalam_400Regular });
  const phrases = useMemo(() => GHOST_PHRASES, []);

  return (
    <View style={[styles.root, style]} pointerEvents="none">
      <AmbientBackdrop intensity={0.85} />
      <BoardDotGrid />
      {phrases.map((p) => (
        <Text
          key={`${p.text}-${p.left}`}
          style={[
            styles.ghost,
            {
              left: `${p.left * 100}%`,
              top: `${p.top * 100}%`,
              fontSize: p.size,
              opacity: p.opacity,
              transform: [{ rotate: `${p.rotate}deg` }],
              fontFamily: fontsLoaded ? 'Kalam_400Regular' : undefined,
              color: p.smudge ? 'rgba(0, 0, 0, 0.18)' : 'rgba(0, 0, 0, 0.22)',
            },
          ]}>
          {p.text}
        </Text>
      ))}
      <View style={styles.edgeGlow} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: APP_THEME.color.bgSoft,
    overflow: 'hidden',
  },
  ghost: {
    position: 'absolute',
    maxWidth: '40%',
    zIndex: 1,
  },
  edgeGlow: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.04)',
    margin: 12,
    borderRadius: APP_THEME.radius.sheet,
    zIndex: 2,
  },
});
