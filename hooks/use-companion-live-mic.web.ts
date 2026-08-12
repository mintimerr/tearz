import { useCallback, useRef } from 'react';

import { encodeBase64 } from '@/utils/wav-pcm';

const TARGET_RATE = 24000;
const MIN_SEND_BYTES = 960;
const BUFFER_SIZE = 4096;

function floatToPcm16(input: Float32Array): Uint8Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i] ?? 0));
    out[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
  }
  return new Uint8Array(out.buffer);
}

function downsample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const start = Math.floor(i * ratio);
    out[i] = input[start] ?? 0;
  }
  return out;
}

/** Web: live mic через getUserMedia + ScriptProcessor → PCM16 @ 24kHz. */
export function useCompanionLiveMic() {
  const activeRef = useRef(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const pendingRef = useRef<Uint8Array[]>([]);

  const stopStreaming = useCallback(async () => {
    activeRef.current = false;
    try {
      processorRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    processorRef.current = null;
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    streamRef.current = null;
    try {
      await ctxRef.current?.close();
    } catch {
      /* ignore */
    }
    ctxRef.current = null;
    pendingRef.current = [];
  }, []);

  const startStreaming = useCallback(
    async (onChunk: (pcmBase64: string) => void): Promise<boolean> => {
      if (activeRef.current) return true;
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        return false;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1);

        processor.onaudioprocess = (event) => {
          if (!activeRef.current) return;
          const input = event.inputBuffer.getChannelData(0);
          const down = downsample(input, ctx.sampleRate, TARGET_RATE);
          const pcm = floatToPcm16(down);
          pendingRef.current.push(pcm);

          let total = 0;
          for (const p of pendingRef.current) total += p.length;
          if (total < MIN_SEND_BYTES) return;

          const merged = new Uint8Array(total);
          let offset = 0;
          for (const p of pendingRef.current) {
            merged.set(p, offset);
            offset += p.length;
          }
          pendingRef.current = [];
          onChunk(encodeBase64(merged));
        };

        // Silent sink so the processor runs without feeding mic into speakers.
        const mute = ctx.createGain();
        mute.gain.value = 0;
        source.connect(processor);
        processor.connect(mute);
        mute.connect(ctx.destination);

        streamRef.current = stream;
        ctxRef.current = ctx;
        processorRef.current = processor;
        activeRef.current = true;
        if (ctx.state === 'suspended') await ctx.resume();
        return true;
      } catch {
        await stopStreaming();
        return false;
      }
    },
    [stopStreaming],
  );

  return {
    startStreaming,
    stopStreaming,
    supportsLiveMic: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
  };
}
