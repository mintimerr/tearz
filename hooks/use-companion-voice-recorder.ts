import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useCallback, useRef } from 'react';
import { Alert, Platform } from 'react-native';

const MIN_MS = 450;
const MAX_MS = 60_000;

export function useCompanionVoiceRecorder() {
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
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
    if (Platform.OS === 'web') {
      Alert.alert('Голосовые', 'Запись голоса доступна в приложении на iOS или Android.');
      return false;
    }
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
      if (Platform.OS === 'web') return false;
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
    if (!state.isRecording) return null;
    await recorder.stop();
    const uri = recorder.uri ?? state.url;
    const durationMs = state.durationMillis;
    if (!uri || durationMs < MIN_MS) return null;
    return { uri, durationMs: Math.min(durationMs, MAX_MS) };
  }, [clearMaxTimer, recorder, state.durationMillis, state.isRecording, state.url]);

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
