import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { APP_THEME } from '@/constants/theme';

type Props = TextInputProps & {
  label: string;
  variant?: 'line' | 'filled';
};

export function AuthField({ label, style, placeholderTextColor, variant = 'filled', ...props }: Props) {
  if (variant === 'line') {
    return (
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <TextInput
          {...props}
          placeholderTextColor={placeholderTextColor ?? APP_THEME.color.mutedFaint}
          style={[styles.fieldInput, style]}
        />
        <View style={styles.fieldLine} />
      </View>
    );
  }

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldShell}>
        <TextInput
          {...props}
          placeholderTextColor={placeholderTextColor ?? APP_THEME.color.mutedFaint}
          style={[styles.fieldInputFilled, style]}
        />
      </View>
    </View>
  );
}

export const authScreenStyles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
  },
  hero: {
    marginBottom: 22,
  },
  wordmark: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.6,
    color: APP_THEME.color.mutedSoft,
    textTransform: 'lowercase',
    marginBottom: 8,
  },
  subline: {
    marginTop: 0,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
    letterSpacing: -0.18,
    color: APP_THEME.color.muted,
  },
  modeBarCard: {
    flexDirection: 'row',
    marginBottom: 22,
    gap: 20,
  },
  modeTapCard: {
    paddingVertical: 2,
  },
  modeLabelCard: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.22,
    color: APP_THEME.color.mutedSoft,
  },
  modeLabelCardActive: {
    color: APP_THEME.color.text,
    fontWeight: '600',
  },
  modeIndicator: {
    marginTop: 6,
    height: 2,
    width: 28,
    borderRadius: 1,
    backgroundColor: APP_THEME.color.accentLight,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.5,
    lineHeight: 28,
    color: APP_THEME.color.text,
    marginBottom: 8,
  },
  modeBar: {
    flexDirection: 'row',
    marginBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: APP_THEME.color.accentSoft,
  },
  modeTap: {
    flex: 1,
    paddingBottom: 10,
    alignItems: 'center',
  },
  modeLabel: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.15,
    color: APP_THEME.color.mutedSoft,
  },
  modeLabelActive: {
    color: APP_THEME.color.text,
    fontWeight: '600',
  },
  modeUnderline: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: '50%',
    height: 1.5,
    backgroundColor: 'rgba(245, 245, 247, 0.92)',
    borderRadius: 1,
  },
  modeUnderlineRight: {
    left: '50%',
  },
  hint: {
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    color: APP_THEME.color.muted,
  },
  hintEmail: {
    color: APP_THEME.color.textSoft,
    fontWeight: '500',
  },
  emailSent: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    color: APP_THEME.color.textSoft,
  },
  spamHint: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: APP_THEME.color.mutedSoft,
  },
  error: {
    marginTop: -4,
    marginBottom: 10,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.12,
    color: 'rgba(255, 120, 130, 0.95)',
  },
  devCode: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '500',
    color: APP_THEME.color.mutedSoft,
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 16,
    paddingVertical: 4,
    paddingRight: 12,
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '500',
    color: APP_THEME.color.muted,
  },
  cta: {
    marginTop: 8,
    minHeight: 52,
    borderRadius: APP_THEME.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_THEME.color.accent,
    shadowColor: APP_THEME.color.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  ctaDisabled: {
    backgroundColor: APP_THEME.color.surfaceStrong,
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.992 }],
  },
  ctaLabel: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.28,
    color: APP_THEME.color.text,
  },
  ctaLabelDisabled: {
    color: APP_THEME.color.mutedSoft,
  },
  altAction: {
    alignSelf: 'center',
    paddingVertical: 4,
    marginTop: 14,
  },
  altActionText: {
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: -0.15,
    color: APP_THEME.color.muted,
  },
  altActionMuted: {
    color: APP_THEME.color.mutedFaint,
  },
  altActionLink: {
    color: APP_THEME.color.textSoft,
    fontWeight: '600',
  },
  legal: {
    marginTop: 24,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '400',
    letterSpacing: -0.05,
    textAlign: 'center',
    color: APP_THEME.color.mutedFaint,
  },
});

const styles = StyleSheet.create({
  field: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
    color: APP_THEME.color.mutedFaint,
    marginBottom: 6,
  },
  fieldInput: {
    paddingVertical: 8,
    paddingHorizontal: 0,
    fontSize: 18,
    fontWeight: '400',
    letterSpacing: -0.32,
    color: APP_THEME.color.text,
  },
  fieldShell: {
    borderRadius: APP_THEME.radius.sm,
    backgroundColor: APP_THEME.color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.color.border,
    paddingHorizontal: 14,
    minHeight: 48,
    justifyContent: 'center',
  },
  fieldInputFilled: {
    paddingVertical: 12,
    fontSize: 17,
    fontWeight: '400',
    letterSpacing: -0.28,
    color: APP_THEME.color.text,
  },
  fieldLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: APP_THEME.color.borderStrong,
  },
});
