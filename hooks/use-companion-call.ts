import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { cacheDirectory, writeAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useCompanionLiveMic } from '@/hooks/use-companion-live-mic';
import type { CompanionChatApiLanguage } from '@/types/companion-chat-api';
import { companionRealtimeWsUrl } from '@/utils/companion-realtime-url';
import { decodeBase64, encodeWavFromPcm16 } from '@/utils/pcm16-wav';
import { encodeBase64 } from '@/utils/wav-pcm';

export type CompanionCallPhase =
  | 'idle'
  | 'connecting'
  | 'ready'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'ended'
  | 'error';

type CallStartPayload = {
  language: CompanionChatApiLanguage;
  companionDisplayName: string;
  companionPersona?: string;
};

const PLAY_FLUSH_BYTES = 5760; // ~120ms at 24kHz mono PCM16

function waitForPlayback(player: ReturnType<typeof useAudioPlayer>, timeoutMs = 8000) {
  return new Promise<void>((resolve) => {
    const started = Date.now();
    let sawPlaying = false;
    const tick = () => {
      try {
        if (player.playing) sawPlaying = true;
      } catch {
        resolve();
        return;
      }
      if ((sawPlaying && !player.playing) || Date.now() - started > timeoutMs) {
        resolve();
        return;
      }
      setTimeout(tick, 40);
    };
    setTimeout(tick, 40);
  });
}

export function useCompanionCall() {
  const wsRef = useRef<WebSocket | null>(null);
  const playPcmRef = useRef<Uint8Array[]>([]);
  const playQueueRef = useRef<string[]>([]);
  const playingRef = useRef(false);
  const micStartedRef = useRef(false);
  const player = useAudioPlayer(null, { keepAudioSessionActive: true });
  const liveMic = useCompanionLiveMic();

  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<CompanionCallPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  const flushPlayBuffer = useCallback(async () => {
    if (!playPcmRef.current.length || !cacheDirectory) return;
    const parts = playPcmRef.current;
    playPcmRef.current = [];
    let total = 0;
    for (const p of parts) total += p.length;
    const pcm = new Uint8Array(total);
    let offset = 0;
    for (const p of parts) {
      pcm.set(p, offset);
      offset += p.length;
    }
    const wav = encodeWavFromPcm16(pcm);
    const uri = `${cacheDirectory}companion-live-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`;
    await writeAsStringAsync(uri, encodeBase64(wav), { encoding: EncodingType.Base64 });
    playQueueRef.current.push(uri);
  }, []);

  const drainPlayQueue = useCallback(async () => {
    if (playingRef.current) return;
    playingRef.current = true;
    while (playQueueRef.current.length) {
      const uri = playQueueRef.current.shift();
      if (!uri) continue;
      try {
        player.replace(uri);
        player.play();
        await waitForPlayback(player);
      } catch {
        break;
      }
    }
    playingRef.current = false;
  }, [player]);

  const enqueuePcmChunk = useCallback(
    (chunkBase64: string) => {
      playPcmRef.current.push(decodeBase64(chunkBase64));
      let bytes = 0;
      for (const p of playPcmRef.current) bytes += p.length;
      if (bytes >= PLAY_FLUSH_BYTES) {
        void flushPlayBuffer().then(() => drainPlayQueue());
      }
    },
    [drainPlayQueue, flushPlayBuffer],
  );

  const clearPlayback = useCallback(() => {
    playPcmRef.current = [];
    playQueueRef.current = [];
    playingRef.current = false;
    try {
      player.pause();
    } catch {
      /* player native object may already be released */
    }
  }, [player]);

  const sendMicChunk = useCallback((pcmBase64: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'user.audio', audio: pcmBase64 }));
  }, []);

  const startMic = useCallback(async () => {
    if (micStartedRef.current) return;
    if (!liveMic.supportsLiveMic) {
      setError('Живой звонок сейчас доступен на iPhone');
      setPhase('error');
      return;
    }
    micStartedRef.current = true;
    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        interruptionMode: 'mixWithOthers',
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });
    } catch {
      /* continue */
    }
    const ok = await liveMic.startStreaming(sendMicChunk);
    if (!ok) {
      micStartedRef.current = false;
      setError('Нет доступа к микрофону');
      setPhase('error');
    }
  }, [liveMic, sendMicChunk]);

  const stopMic = useCallback(() => {
    void liveMic.stopStreaming();
  }, [liveMic]);

  const cleanupWs = useCallback(() => {
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const handleServerMessage = useCallback(
    (raw: string) => {
      let msg: {
        type?: string;
        phase?: CompanionCallPhase;
        chunk?: string;
        message?: string;
      };
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }

      if (msg.type === 'status' && msg.phase) {
        setPhase(msg.phase);
        if (msg.phase === 'ready') {
          void startMic();
        }
        return;
      }

      if (msg.type === 'assistant.audio' && msg.chunk) {
        enqueuePcmChunk(msg.chunk);
        return;
      }

      if (msg.type === 'assistant.audio.done') {
        void flushPlayBuffer().then(() => drainPlayQueue());
        return;
      }

      if (msg.type === 'assistant.interrupted') {
        clearPlayback();
        return;
      }

      if (msg.type === 'error') {
        setError(msg.message ?? 'Ошибка звонка');
        setPhase('error');
      }
    },
    [clearPlayback, drainPlayQueue, enqueuePcmChunk, flushPlayBuffer, startMic],
  );

  const startCall = useCallback(
    (payload: CallStartPayload) => {
      if (Platform.OS === 'web') {
        setError('Голосовой звонок доступен в приложении на iOS или Android');
        setPhase('error');
        setVisible(true);
        return;
      }

      cleanupWs();
      clearPlayback();
      setError(null);
      setPhase('connecting');
      setVisible(true);
      setElapsedSec(0);
      micStartedRef.current = false;

      let ws: WebSocket;
      try {
        ws = new WebSocket(companionRealtimeWsUrl());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не удалось подключиться');
        setPhase('error');
        return;
      }

      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'call.start',
            language: payload.language,
            companionDisplayName: payload.companionDisplayName,
            ...(payload.companionPersona ? { companionPersona: payload.companionPersona } : {}),
          }),
        );
      };

      ws.onmessage = (event) => {
        handleServerMessage(String(event.data));
      };

      ws.onerror = () => {
        setError('Соединение прервано');
        setPhase('error');
      };

      ws.onclose = () => {
        stopMic();
        setPhase((p) => (p === 'error' ? p : 'ended'));
      };
    },
    [cleanupWs, clearPlayback, handleServerMessage, stopMic],
  );

  const endCall = useCallback(() => {
    stopMic();
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'call.end' }));
    }
    cleanupWs();
    clearPlayback();
    setVisible(false);
    setPhase('idle');
  }, [cleanupWs, clearPlayback, stopMic]);

  useEffect(() => {
    if (!visible) return;
    const fallback = setTimeout(() => {
      void startMic();
    }, 2000);
    return () => clearTimeout(fallback);
  }, [startMic, visible]);

  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [visible]);

  useEffect(
    () => () => {
      if (visible) {
        stopMic();
        cleanupWs();
      }
    },
    [cleanupWs, stopMic, visible],
  );

  return {
    visible,
    phase,
    error,
    elapsedSec,
    startCall,
    endCall,
    isBusy: phase === 'connecting',
  };
}
