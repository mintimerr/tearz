import {
  AudioModule,
  AudioQuality,
  IOSOutputFormat,
  setAudioModeAsync,
  useAudioRecorder,
  type RecordingOptions,
} from 'expo-audio';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { useCallback, useRef } from 'react';
import { Platform } from 'react-native';

import { parseWavBytes, resamplePcm16LE, encodeBase64 } from '@/utils/wav-pcm';
import { decodeBase64 } from '@/utils/pcm16-wav';

const POLL_MS = 100;
const TARGET_RATE = 24000;
const MIN_SEND_BYTES = 960;

const LIVE_MIC_PRESET: RecordingOptions = {
  extension: '.wav',
  sampleRate: 24000,
  numberOfChannels: 1,
  bitRate: 384000,
  isMeteringEnabled: false,
  ios: {
    extension: '.wav',
    sampleRate: 24000,
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  android: {
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function safeStop(recorder: ReturnType<typeof useAudioRecorder>) {
  try {
    await recorder.stop();
  } catch {
    /* recorder may already be stopped or native object released */
  }
}

async function ensureCallAudioMode() {
  await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
    interruptionMode: 'mixWithOthers',
    shouldPlayInBackground: false,
    shouldRouteThroughEarpiece: false,
  });
}

export function useCompanionLiveMic() {
  const recorder = useAudioRecorder(LIVE_MIC_PRESET);
  const activeRef = useRef(false);
  const loopRef = useRef<Promise<void> | null>(null);

  const ensureMicPermission = useCallback(async (): Promise<boolean> => {
    const cur = await AudioModule.getRecordingPermissionsAsync();
    if (cur.granted) return true;
    const req = await AudioModule.requestRecordingPermissionsAsync();
    return req.granted;
  }, []);

  const startStreaming = useCallback(
    async (onChunk: (pcmBase64: string) => void): Promise<boolean> => {
      if (Platform.OS === 'web') return false;
      if (Platform.OS === 'android') return false;
      if (activeRef.current) return true;

      const ok = await ensureMicPermission();
      if (!ok) return false;

      try {
        await ensureCallAudioMode();
        await recorder.prepareToRecordAsync();
        recorder.record();
      } catch {
        return false;
      }

      activeRef.current = true;
      let sentPcmBytes = 0;

      loopRef.current = (async () => {
        while (activeRef.current) {
          await wait(POLL_MS);
          if (!activeRef.current) break;

          let uri: string | null = null;
          try {
            uri = recorder.uri;
          } catch {
            continue;
          }
          if (!uri) continue;

          let wavBase64: string;
          try {
            wavBase64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
          } catch {
            continue;
          }

          const parsed = parseWavBytes(decodeBase64(wavBase64));
          if (!parsed || parsed.pcm.length <= sentPcmBytes) continue;

          let chunk = parsed.pcm.subarray(sentPcmBytes);
          sentPcmBytes = parsed.pcm.length;

          if (chunk.length < MIN_SEND_BYTES) continue;

          if (parsed.sampleRate !== TARGET_RATE) {
            chunk = resamplePcm16LE(chunk, parsed.sampleRate, TARGET_RATE);
          }

          onChunk(encodeBase64(chunk));
        }
      })();

      return true;
    },
    [ensureMicPermission, recorder],
  );

  const stopStreaming = useCallback(async () => {
    activeRef.current = false;
    await loopRef.current?.catch(() => undefined);
    loopRef.current = null;
    await safeStop(recorder);
  }, [recorder]);

  return { startStreaming, stopStreaming, supportsLiveMic: Platform.OS === 'ios' };
};
