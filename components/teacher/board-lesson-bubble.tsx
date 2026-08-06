import { Kalam_400Regular, useFonts } from '@expo-google-fonts/kalam';
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { BrandGradient, GlowCard } from '@/components/ui';
import { GAME_THEME } from '@/constants/game-theme';
import { APP_THEME } from '@/constants/theme';
import { TEACHER_MUTED, TEACHER_TITLE } from '@/components/teacher/teacher-tokens';
import { TearzBoardChatAvatar } from '@/components/teacher/tearz-board-chat-avatar';

type Side = 'student' | 'teacher';
type Variant = 'default' | 'game';

type Props = {
  side: Side;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  variant?: Variant;
};

function TypingDots({ game }: { game?: boolean }) {
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
        <Animated.View
          key={i}
          style={[
            styles.dot,
            game && styles.dotGame,
            { opacity: v, transform: [{ scale: v }] },
          ]}
        />
      ))}
    </View>
  );
}

function GamePanel({
  side,
  children,
  compact,
}: {
  side: Side;
  children: ReactNode;
  compact?: boolean;
}) {
  const student = side === 'student';
  return (
    <View style={[styles.gamePanel, student ? styles.gamePanelStudent : styles.gamePanelTeacher, compact && styles.cardCompact]}>
      <View pointerEvents="none" style={[styles.gamePanelLip, student ? styles.gamePanelLipStudent : styles.gamePanelLipTeacher]} />
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

function TearzAvatar({ size = 40, game }: { size?: number; game?: boolean }) {
  if (game) {
    return (
      <View style={styles.gameAvatarFrame}>
        <TearzBoardChatAvatar size={size - 6} bordered={false} />
      </View>
    );
  }
  return <TearzBoardChatAvatar size={size} />;
}

/** Карточка сообщения на доске — iOS glass или SNES dialog box. */
export function BoardLessonBubble({ side, children, style, compact, variant = 'default' }: Props) {
  const isStudent = side === 'student';
  const game = variant === 'game';

  if (game) {
    if (isStudent) {
      return (
        <View style={[styles.rowStudent, style]}>
          <GamePanel side="student" compact={compact}>
            {children}
          </GamePanel>
        </View>
      );
    }

    return (
      <View style={[styles.rowTeacher, style]}>
        <TearzAvatar size={40} game />
        <GamePanel side="teacher" compact={compact}>
          {children}
        </GamePanel>
      </View>
    );
  }

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
  variant?: Variant;
};

export function BoardLessonTyping({ label, style, variant = 'default' }: TypingProps) {
  const game = variant === 'game';

  if (game) {
    return (
      <View style={[styles.rowTeacher, style]}>
        <TearzAvatar size={40} game />
        <View style={[styles.gamePanel, styles.gamePanelTeacher, styles.typingCardGame]}>
          <View style={styles.typingInner}>
            <TypingDots game />
            <Text style={styles.typingLabelGame}>{label}</Text>
          </View>
        </View>
      </View>
    );
  }

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
  game?: boolean;
};

export function BoardStudentText({ children, markerFamily, game }: StudentTextProps) {
  const [fontsLoaded] = useFonts({ Kalam_400Regular });
  const family = markerFamily ?? (fontsLoaded ? 'Kalam_400Regular' : undefined);

  return (
    <Text style={[styles.studentText, game && styles.studentTextGame, family && { fontFamily: family }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  rowStudent: {
    width: '100%',
    alignItems: 'flex-end',
    marginVertical: 8,
  },
  rowTeacher: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginVertical: 8,
  },
  studentCard: {
    maxWidth: '84%',
    position: 'relative',
  },
  teacherCard: {
    flex: 1,
    maxWidth: '78%',
  },
  gamePanel: {
    position: 'relative',
    borderWidth: 3,
    borderColor: GAME_THEME.color.ink,
    borderRadius: 4,
    backgroundColor: GAME_THEME.color.paper,
    shadowColor: GAME_THEME.color.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  gamePanelTeacher: {
    flex: 1,
    maxWidth: '78%',
  },
  gamePanelStudent: {
    maxWidth: '84%',
    backgroundColor: GAME_THEME.color.paperWarm,
  },
  gamePanelLip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
  },
  gamePanelLipTeacher: {
    backgroundColor: GAME_THEME.color.sky,
  },
  gamePanelLipStudent: {
    backgroundColor: GAME_THEME.color.sky,
  },
  gameAvatarFrame: {
    width: 40,
    height: 40,
    marginBottom: 2,
    borderRadius: 4,
    borderWidth: 3,
    borderColor: GAME_THEME.color.ink,
    backgroundColor: GAME_THEME.color.cream,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
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
  studentTextGame: {
    color: GAME_THEME.color.ink,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  typingCard: {
    flexShrink: 1,
  },
  typingCardGame: {
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
  typingLabelGame: {
    fontSize: 14,
    fontWeight: '800',
    color: 'rgba(26,26,26,0.55)',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
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
  dotGame: {
    width: 6,
    height: 6,
    borderRadius: 1,
    backgroundColor: GAME_THEME.color.ink,
  },
});
