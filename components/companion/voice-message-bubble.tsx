import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback } from 'react';
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

export function VoiceMessageBubble({ uri, durationMs, outgoing, pending }: Props) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const playing = status.playing;

  const toggle = useCallback(() => {
    if (pending) return;
    if (playing) {
      player.pause();
      return;
    }
    if (status.currentTime > 0 && status.currentTime < (status.duration || durationMs / 1000) - 0.05) {
      player.play();
      return;
    }
    player.seekTo(0);
    player.play();
  }, [durationMs, pending, player, playing, status.currentTime, status.duration]);

  const bars = [0.35, 0.65, 0.5, 0.85, 0.45, 0.7, 0.55];

  return (
    <Pressable
      onPress={() => void toggle()}
      disabled={pending}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={pending ? 'Голосовое обрабатывается' : playing ? 'Пауза' : 'Воспроизвести'}>
      <View style={[styles.playBtn, outgoing && styles.playBtnOut]}>
        <Text style={styles.playGlyph}>{pending ? '…' : playing ? '❚❚' : '▶'}</Text>
      </View>
      <View style={styles.waveCol}>
        <View style={styles.waveRow}>
          {bars.map((h, i) => (
            <View
              key={i}
              style={[
                styles.waveBar,
                outgoing && styles.waveBarOut,
                { height: 6 + h * 14, opacity: playing ? 1 : 0.55 },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.dur, outgoing && styles.durOut]}>
          {pending ? 'расшифровка…' : formatVoiceDuration(durationMs)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 168,
    paddingVertical: 2,
  },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_THEME.color.accentSoft,
  },
  playBtnOut: {
    backgroundColor: APP_THEME.color.accentGlass,
  },
  playGlyph: {
    fontSize: 12,
    fontWeight: '600',
    color: APP_THEME.color.textSoft,
    marginLeft: 1,
  },
  waveCol: {
    flex: 1,
    gap: 4,
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 22,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: APP_THEME.color.mutedSoft,
  },
  waveBarOut: {
    backgroundColor: APP_THEME.color.textSoft,
  },
  dur: {
    fontSize: 11,
    fontWeight: '500',
    color: APP_THEME.color.mutedFaint,
    letterSpacing: 0.02,
  },
  durOut: {
    color: APP_THEME.color.mutedSoft,
  },
});
