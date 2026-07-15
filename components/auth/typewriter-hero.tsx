import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { APP_THEME } from '@/constants/theme';

const TITLE_CHAR_MS = 32;
const SUBTITLE_CHAR_MS = 28;
const LINE_PAUSE_MS = 280;
const BLOCK_PAUSE_MS = 240;

type Phase = 'title' | 'subtitle' | 'done';

type Props = {
  title: string;
  subtitle: string;
  titleStyle?: StyleProp<TextStyle>;
  titleMutedStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
};

function isCjkChar(ch: string) {
  const code = ch.codePointAt(0) ?? 0;
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x3040 && code <= 0x30ff) ||
    (code >= 0xac00 && code <= 0xd7af)
  );
}

function charDelay(ch: string, baseMs: number) {
  if (!ch) return baseMs;
  if (isCjkChar(ch)) return baseMs + 14;
  if (ch === ' ' || ch === ',') return baseMs + 4;
  if (ch === '.' || ch === '—' || ch === '-') return baseMs + 8;
  return baseMs;
}

function SmoothTypingText({
  tick,
  style,
  children,
}: {
  tick: number;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
}) {
  const fade = useSharedValue(1);

  useEffect(() => {
    fade.value = 0.78;
    fade.value = withTiming(1, { duration: 130, easing: Easing.out(Easing.cubic) });
  }, [tick, fade]);

  const animStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  return <Animated.Text style={[style, animStyle]}>{children}</Animated.Text>;
}

function BlinkCursor({ size }: { size: 'title' | 'subtitle' }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.2, { duration: 520, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 520, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [opacity]);

  const cursorStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.Text
      style={[size === 'title' ? styles.cursorTitle : styles.cursorSubtitle, cursorStyle]}
      accessibilityElementsHidden>
      |
    </Animated.Text>
  );
}

export function TypewriterHero({ title, subtitle, titleStyle, titleMutedStyle, subtitleStyle }: Props) {
  const lines = useMemo(() => title.split('\n').filter(Boolean), [title]);
  const [phase, setPhase] = useState<Phase>('title');
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);

  const tick = phase === 'subtitle' ? 10_000 + charIndex : lineIndex * 1_000 + charIndex;

  useEffect(() => {
    setPhase('title');
    setLineIndex(0);
    setCharIndex(0);
  }, [title, subtitle]);

  useEffect(() => {
    if (phase === 'done') return;

    if (phase === 'title') {
      if (lines.length === 0) {
        setPhase('subtitle');
        setCharIndex(0);
        return;
      }

      const current = lines[lineIndex] ?? '';

      if (charIndex < current.length) {
        const next = current[charIndex] ?? '';
        const timer = setTimeout(() => setCharIndex((c) => c + 1), charDelay(next, TITLE_CHAR_MS));
        return () => clearTimeout(timer);
      }

      if (lineIndex < lines.length - 1) {
        const timer = setTimeout(() => {
          setLineIndex((i) => i + 1);
          setCharIndex(0);
        }, LINE_PAUSE_MS);
        return () => clearTimeout(timer);
      }

      const timer = setTimeout(() => {
        setPhase('subtitle');
        setCharIndex(0);
      }, BLOCK_PAUSE_MS);
      return () => clearTimeout(timer);
    }

    if (charIndex < subtitle.length) {
      const next = subtitle[charIndex] ?? '';
      const timer = setTimeout(() => setCharIndex((c) => c + 1), charDelay(next, SUBTITLE_CHAR_MS));
      return () => clearTimeout(timer);
    }

    setPhase('done');
  }, [charIndex, lineIndex, lines, phase, subtitle]);

  const typingTitle = phase === 'title';
  const typingSubtitle = phase === 'subtitle';

  return (
    <>
      {lines.map((line, i) => {
        const visible =
          i < lineIndex ? line : i === lineIndex && typingTitle ? line.slice(0, charIndex) : line;
        const isCurrent = i === lineIndex && typingTitle;
        const showLine = phase !== 'title' || i <= lineIndex;

        if (!showLine) return null;

        const lineStyle = [styles.title, titleStyle, i > 0 && [styles.titleMuted, titleMutedStyle]];

        if (isCurrent) {
          return (
            <SmoothTypingText key={`${line}-${i}`} tick={tick} style={lineStyle}>
              {visible}
              <BlinkCursor size="title" />
            </SmoothTypingText>
          );
        }

        return (
          <Text key={`${line}-${i}`} style={lineStyle}>
            {visible}
          </Text>
        );
      })}

      {phase !== 'title' || lines.length === 0 ? (
        typingSubtitle ? (
          <SmoothTypingText tick={tick} style={[styles.subtitle, subtitleStyle]}>
            {subtitle.slice(0, charIndex)}
            <BlinkCursor size="subtitle" />
          </SmoothTypingText>
        ) : (
          <Text style={[styles.subtitle, subtitleStyle]}>{subtitle}</Text>
        )
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '700',
    letterSpacing: -1.2,
    color: APP_THEME.color.text,
  },
  titleMuted: {
    color: APP_THEME.color.textSoft,
  },
  subtitle: {
    marginTop: 20,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    letterSpacing: -0.24,
    color: APP_THEME.color.muted,
    maxWidth: 300,
  },
  cursorTitle: {
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '300',
    color: APP_THEME.color.accentLight,
  },
  cursorSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '300',
    color: APP_THEME.color.accentLight,
  },
});
