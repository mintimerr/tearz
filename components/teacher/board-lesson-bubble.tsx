import { Kalam_400Regular, useFonts } from '@expo-google-fonts/kalam';
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { BrandGradient, GlowCard } from '@/components/ui';
import { APP_THEME } from '@/constants/theme';
import { TEACHER_MUTED, TEACHER_TITLE } from '@/components/teacher/teacher-tokens';
import { TearzBoardChatAvatar } from '@/components/teacher/tearz-board-chat-avatar';

type Side = 'student' | 'teacher';

type Props = {
  side: Side;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
};

function TypingDots() {
  const a1 = useRef(new Animated.Value(0.3)).current;
  const a2 = useRef(new Animated.Value(0.3)).current;
  const a3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const mk = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration: 340,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0.3,
            duration: 340,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );
    const x1 = mk(a1, 0);
    const x2 = mk(a2, 130);
    const x3 = mk(a3, 260);
    x1.start();
    x2.start();
    x3.start();
    return () => {
      x1.stop();
      x2.stop();
      x3.stop();
    };
  }, [a1, a2, a3]);

  return (
    <View style={styles.dotsRow}>
      {[a1, a2, a3].map((v, i) => (
        <Animated.View key={i} style={[styles.dot, { opacity: v, transform: [{ scale: v }] }]} />
      ))}
    </View>
  );
}

function TearzAvatar({ size = 40 }: { size?: number }) {
  return <TearzBoardChatAvatar size={size} />;
}

/** Премиальная карточка сообщения — геймифицированный HUD, без дешёвых обводок. */
export function BoardLessonBubble({ side, children, style, compact }: Props) {
  const isStudent = side === 'student';

  if (isStudent) {
    return (
      <View style={[styles.rowStudent, style]}>
        <GlowCard
          radius={APP_THEME.radius.xl}
          glow={APP_THEME.color.brandGlow}
          glowStrength={0.38}
          borderColor={APP_THEME.color.brandBorder}
          backgroundColor="rgba(255, 252, 246, 0.96)"
          style={[styles.studentCard, compact && styles.cardCompact]}>
          <BrandGradient direction="vertical" opacity={0.1} />
          <View style={styles.studentAccent} />
          <View style={styles.cardBody}>{children}</View>
        </GlowCard>
      </View>
    );
  }

  return (
    <View style={[styles.rowTeacher, style]}>
      <TearzAvatar />
      <GlowCard
        radius={APP_THEME.radius.xl}
        glowStrength={0.32}
        borderColor={APP_THEME.color.border}
        backgroundColor={APP_THEME.color.elevated}
        style={[styles.teacherCard, compact && styles.cardCompact]}>
        <BrandGradient direction="diagonal" opacity={0.06} />
        <View style={styles.cardBody}>{children}</View>
      </GlowCard>
    </View>
  );
}

type TypingProps = {
  label: string;
  style?: StyleProp<ViewStyle>;
};

export function BoardLessonTyping({ label, style }: TypingProps) {
  return (
    <View style={[styles.rowTeacher, style]}>
      <TearzAvatar />
      <GlowCard
        radius={APP_THEME.radius.lg}
        glowStrength={0.28}
        borderColor={APP_THEME.color.border}
        backgroundColor={APP_THEME.color.elevated}
        style={styles.typingCard}>
        <BrandGradient direction="diagonal" opacity={0.05} />
        <View style={styles.typingInner}>
          <TypingDots />
          <Text style={styles.typingLabel}>{label}</Text>
        </View>
      </GlowCard>
    </View>
  );
}

type StudentTextProps = {
  children: string;
  markerFamily?: string;
};

export function BoardStudentText({ children, markerFamily }: StudentTextProps) {
  const [fontsLoaded] = useFonts({ Kalam_400Regular });
  const family = markerFamily ?? (fontsLoaded ? 'Kalam_400Regular' : undefined);

  return (
    <Text style={[styles.studentText, family && { fontFamily: family }]}>{children}</Text>
  );
}

const styles = StyleSheet.create({
  rowStudent: {
    width: '100%',
    alignItems: 'flex-end',
    marginVertical: 6,
  },
  rowTeacher: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginVertical: 6,
  },
  studentCard: {
    maxWidth: '84%',
    position: 'relative',
  },
  teacherCard: {
    flex: 1,
    maxWidth: '78%',
  },
  cardCompact: {
    paddingVertical: 2,
  },
  studentAccent: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 4,
    borderRadius: 2,
    backgroundColor: APP_THEME.color.brand,
    opacity: 0.85,
    zIndex: 2,
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    zIndex: 1,
  },
  studentText: {
    fontSize: 17,
    lineHeight: 24,
    color: TEACHER_TITLE,
    letterSpacing: -0.2,
  },
  avatarWrap: {
    marginBottom: 2,
  },
  typingCard: {
    flexShrink: 1,
  },
  typingInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    zIndex: 1,
  },
  typingLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: TEACHER_MUTED,
    letterSpacing: -0.15,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: APP_THEME.color.brand,
  },
});
