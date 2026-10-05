import {
  AudioModule,
  AudioQuality,
  IOSOutputFormat,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  const startedAtRef = useRef<number | null>(null);
  const startingRef = useRef(false);
  const [wallClockMs, setWallClockMs] = useState(0);

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

  useEffect(() => {
    if (!state.isRecording) {
      setWallClockMs(0);
      return;
    }
    const tick = () => {
      if (startedAtRef.current == null) return;
      setWallClockMs(Math.min(MAX_MS, Date.now() - startedAtRef.current));
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [state.isRecording]);

  const restorePlaybackMode = useCallback(async () => {
    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
    } catch {
      /* ignore */
    }
  }, []);

  const startRecording = useCallback(
    async (onAutoStop?: () => void) => {
      if (startingRef.current || recorder.getStatus().isRecording) return false;
      startingRef.current = true;
      try {
        const ok = await ensureMicPermission();
        if (!ok) return false;
        onMaxDuration.current = onAutoStop ?? null;
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
        await recorder.prepareToRecordAsync();
        recorder.record();
        startedAtRef.current = Date.now();
        setWallClockMs(0);
        clearMaxTimer();
        maxTimer.current = setTimeout(() => {
          onMaxDuration.current?.();
        }, MAX_MS);
        return true;
      } catch (e) {
        startedAtRef.current = null;
        console.warn('[voice-recorder] start failed', e);
        await restorePlaybackMode();
        Alert.alert('Запись', 'Не удалось начать запись. Попробуй ещё раз.');
        return false;
      } finally {
        startingRef.current = false;
      }
    },
    [clearMaxTimer, ensureMicPermission, recorder, restorePlaybackMode],
  );

  const resolveDurationMs = useCallback((statusDuration: number) => {
    const wall =
      startedAtRef.current != null ? Math.max(0, Date.now() - startedAtRef.current) : 0;
    const ms = Math.max(statusDuration || 0, wall);
    return Math.min(ms, MAX_MS);
  }, []);

  const stopRecording = useCallback(async (): Promise<{ uri: string; durationMs: number } | null> => {
    clearMaxTimer();
    // Ждём, если start ещё в полёте (tap слишком быстрый).
    for (let i = 0; i < 20 && startingRef.current; i += 1) {
      await new Promise((r) => setTimeout(r, 50));
    }
    const live = recorder.getStatus();
    if (!live.isRecording) {
      startedAtRef.current = null;
      await restorePlaybackMode();
      return null;
    }
    try {
      await recorder.stop();
    } catch (e) {
      console.warn('[voice-recorder] stop failed', e);
      startedAtRef.current = null;
      await restorePlaybackMode();
      return null;
    }
    const status = recorder.getStatus();
    const uri = recorder.uri ?? status.url ?? null;
    const durationMs = resolveDurationMs(status.durationMillis);
    startedAtRef.current = null;
    await restorePlaybackMode();
    if (!uri || durationMs < MIN_MS) return null;
    const ready = await waitForRecordingFile(uri);
    if (!ready) return null;
    return { uri, durationMs };
  }, [clearMaxTimer, recorder, resolveDurationMs, restorePlaybackMode]);

  const cancelRecording = useCallback(async () => {
    clearMaxTimer();
    for (let i = 0; i < 20 && startingRef.current; i += 1) {
      await new Promise((r) => setTimeout(r, 50));
    }
    startedAtRef.current = null;
    setWallClockMs(0);
    if (recorder.getStatus().isRecording || state.isRecording) {
      try {
        await recorder.stop();
      } catch {
        /* already stopped */
      }
    }
    await restorePlaybackMode();
  }, [clearMaxTimer, recorder, restorePlaybackMode, state.isRecording]);

  const nativeDuration = state.durationMillis || 0;
  const durationMs = state.isRecording
    ? Math.max(nativeDuration, wallClockMs)
    : nativeDuration || wallClockMs;

  return {
    isRecording: state.isRecording,
    isStarting: startingRef.current,
    durationMs,
    metering: state.metering,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
