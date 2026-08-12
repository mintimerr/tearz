import { Pressable, StyleSheet, Text, View } from 'react-native';

import { APP_THEME } from '@/constants/theme';

type Props = {
  uri: string;
  durationMs: number;
  outgoing?: boolean;
  pending?: boolean;
};

function formatVoiceDuration(ms: number) {
  const sec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Web: без expo-audio — только плейсхолдер. */
export function VoiceMessageBubble({ durationMs, outgoing, pending }: Props) {
  return (
    <View style={styles.row}>
      <View style={[styles.playBtn, outgoing && styles.playBtnOut]}>
        <Text style={styles.playGlyph}>{pending ? '…' : '▶'}</Text>
      </View>
      <Text style={[styles.dur, outgoing && styles.durOut]}>
        {pending ? 'голос…' : formatVoiceDuration(durationMs)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 120,
    paddingVertical: 2,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_THEME.color.brandSoft,
  },
  playBtnOut: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  playGlyph: {
    fontSize: 12,
    color: APP_THEME.color.ink,
  },
  dur: {
    fontSize: 12,
    color: APP_THEME.color.inkMuted,
  },
  durOut: {
    color: 'rgba(255,255,255,0.85)',
  },
});
