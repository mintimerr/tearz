import { Pressable, StyleSheet, Text, View } from 'react-native';

import { APP_THEME } from '@/constants/theme';

type Props = {
  code: string;
  title: string;
  hint: string;
  serverHint: string;
  tapHint: string;
  onUseCode: () => void;
};

export function VerifyCodeDevBanner({ code, title, hint, serverHint, tapHint, onUseCode }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.hint}>{hint}</Text>
      <Pressable onPress={onUseCode} style={styles.codeBox} accessibilityRole="button" accessibilityLabel={code}>
        <Text style={styles.code}>{code}</Text>
        <Text style={styles.tapHint}>{tapHint}</Text>
      </Pressable>
      <Text style={styles.serverHint}>{serverHint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
    padding: 16,
    borderRadius: APP_THEME.radius.md,
    backgroundColor: APP_THEME.color.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(168, 148, 255, 0.35)',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    color: APP_THEME.color.accentLight,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    color: APP_THEME.color.textSoft,
    marginBottom: 12,
  },
  codeBox: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: APP_THEME.radius.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  code: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 8,
    color: APP_THEME.color.text,
    fontVariant: ['tabular-nums'],
  },
  tapHint: {
    marginTop: 6,
    fontSize: 12,
    color: APP_THEME.color.mutedSoft,
  },
  serverHint: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 17,
    color: APP_THEME.color.muted,
  },
});
