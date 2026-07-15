import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { APP_THEME } from '@/constants/theme';
import type { CompanionCallPhase } from '@/hooks/use-companion-call';

type Props = {
  visible: boolean;
  name: string;
  letter: string;
  color: string;
  phase: CompanionCallPhase;
  error: string | null;
  elapsedSec: number;
  onEnd: () => void;
  labels: {
    connecting: string;
    ready: string;
    listening: string;
    thinking: string;
    speaking: string;
    ended: string;
    error: string;
    endCall: string;
  };
};

function formatElapsed(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function phaseLabel(phase: CompanionCallPhase, labels: Props['labels']) {
  switch (phase) {
    case 'connecting':
      return labels.connecting;
    case 'ready':
      return labels.ready;
    case 'listening':
      return labels.listening;
    case 'thinking':
      return labels.thinking;
    case 'speaking':
      return labels.speaking;
    case 'ended':
      return labels.ended;
    case 'error':
      return labels.error;
    default:
      return labels.ready;
  }
}

export function CompanionCallScreen({
  visible,
  name,
  letter,
  color,
  phase,
  error,
  elapsedSec,
  onEnd,
  labels,
}: Props) {
  const insets = useSafeAreaInsets();
  const status = error ?? phaseLabel(phase, labels);

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onEnd}>
      <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.topRow}>
          <Text style={styles.timer}>{formatElapsed(elapsedSec)}</Text>
          <Pressable onPress={onEnd} hitSlop={12} accessibilityRole="button" accessibilityLabel={labels.endCall}>
            <Text style={styles.collapse}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.center}>
          <View style={[styles.avatar, { backgroundColor: color }]}>
            <Text style={styles.avatarLetter}>{letter}</Text>
          </View>
          <Text style={styles.name}>{name}</Text>
          <Text style={[styles.status, phase === 'error' && styles.statusError]}>{status}</Text>
        </View>

        <View style={styles.controls}>
          <Pressable
            onPress={onEnd}
            style={({ pressed }) => [styles.endBtn, pressed && styles.endBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel={labels.endCall}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
            ) : null}
            <Ionicons name="call" size={22} color="#FF453A" style={styles.endIcon} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: APP_THEME.color.bg,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timer: {
    fontSize: 15,
    fontWeight: '600',
    color: APP_THEME.color.mutedSoft,
    fontVariant: ['tabular-nums'],
  },
  collapse: {
    fontSize: 22,
    color: APP_THEME.color.muted,
    lineHeight: 24,
  },
  center: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
  },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarLetter: {
    fontSize: 42,
    fontWeight: '600',
    color: APP_THEME.color.text,
  },
  name: {
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.5,
    color: APP_THEME.color.text,
  },
  status: {
    fontSize: 15,
    color: APP_THEME.color.muted,
    textAlign: 'center',
  },
  statusError: {
    color: APP_THEME.color.danger,
  },
  controls: {
    alignItems: 'center',
    gap: 14,
  },
  endBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 69, 58, 0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 69, 58, 0.35)',
  },
  endBtnPressed: {
    opacity: 0.85,
  },
  endIcon: {
    transform: [{ rotate: '135deg' }],
  },
});
