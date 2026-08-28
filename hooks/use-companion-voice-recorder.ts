import {
  AudioModule,
  AudioQuality,
  IOSOutputFormat,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';

const MIN_MS = 450;
const MAX_MS = 60_000;
const MIN_BYTES = 200;

/** Mono AAC — лучше для Whisper и меньше шанс битого файла, чем stereo HIGH_QUALITY. */
const VOICE_RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  extension: '.m4a',
  sampleRate: 44_100,
  numberOfChannels: 1,
  bitRate: 96_000,
  isMeteringEnabled: true,
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.HIGH,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  android: {
    outputFormat: 'mpeg4' as const,
    audioEncoder: 'aac' as const,
  },
};

async function waitForRecordingFile(uri: string, minBytes = MIN_BYTES, timeoutMs = 2500): Promise<boolean> {
  const { getInfoAsync } = await import('expo-file-system/legacy');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const info = await getInfoAsync(uri, { size: true });
    if (info.exists && 'size' in info && typeof info.size === 'number' && info.size >= minBytes) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  return false;
}

export function useCompanionVoiceRecorder() {
  const recorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);
  const state = useAudioRecorderState(recorder, 100);
  const maxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMaxDuration = useRef<(() => void) | null>(null);

  const clearMaxTimer = useCallback(() => {
    if (maxTimer.current) {
      clearTimeout(maxTimer.current);
      maxTimer.current = null;
    }
  }, []);

  const ensureMicPermission = useCallback(async (): Promise<boolean> => {
    const cur = await AudioModule.getRecordingPermissionsAsync();
    if (cur.granted) return true;
    const req = await AudioModule.requestRecordingPermissionsAsync();
    if (!req.granted) {
      Alert.alert('Микрофон', 'Разреши доступ к микрофону в настройках, чтобы записывать голосовые.');
      return false;
    }
    return true;
  }, []);

  const startRecording = useCallback(
    async (onAutoStop?: () => void) => {
      const ok = await ensureMicPermission();
      if (!ok) return false;
      onMaxDuration.current = onAutoStop ?? null;
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      clearMaxTimer();
      maxTimer.current = setTimeout(() => {
        onMaxDuration.current?.();
      }, MAX_MS);
      return true;
    },
    [clearMaxTimer, ensureMicPermission, recorder],
  );

  const stopRecording = useCallback(async (): Promise<{ uri: string; durationMs: number } | null> => {
    clearMaxTimer();
    if (!recorder.getStatus().isRecording) return null;
    await recorder.stop();
    const status = recorder.getStatus();
    const uri = recorder.uri ?? status.url ?? null;
    const durationMs = status.durationMillis;
    if (!uri || durationMs < MIN_MS) return null;
    const ready = await waitForRecordingFile(uri);
    if (!ready) return null;
    return { uri, durationMs: Math.min(durationMs, MAX_MS) };
  }, [clearMaxTimer, recorder]);

  const cancelRecording = useCallback(async () => {
    clearMaxTimer();
    if (state.isRecording) {
      try {
        await recorder.stop();
      } catch {
        /* already stopped */
      }
    }
  }, [clearMaxTimer, recorder, state.isRecording]);

  return {
    isRecording: state.isRecording,
    durationMs: state.durationMillis,
    metering: state.metering,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
