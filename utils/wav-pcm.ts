import { decodeBase64 } from '@/utils/pcm16-wav';

export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function readStr(bytes: Uint8Array, offset: number, len: number) {
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(bytes[offset + i] ?? 0);
  return s;
}

export type ParsedWav = {
  pcm: Uint8Array;
  sampleRate: number;
};

/** Parse PCM from a WAV (or growing in-progress WAV). Uses file tail as PCM when recording. */
export function parseWavBytes(bytes: Uint8Array): ParsedWav | null {
  if (bytes.length < 44) return null;
  if (readStr(bytes, 0, 4) !== 'RIFF' || readStr(bytes, 8, 4) !== 'WAVE') return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  let sampleRate = 24000;
  let dataStart = -1;

  while (offset + 8 <= bytes.length) {
    const id = readStr(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;

    if (id === 'fmt ' && size >= 16 && chunkStart + 15 < bytes.length) {
      sampleRate = view.getUint32(chunkStart + 4, true);
    }

    if (id === 'data') {
      dataStart = chunkStart;
      break;
    }

    offset = chunkStart + size + (size % 2);
  }

  if (dataStart < 0 || dataStart >= bytes.length) return null;
  const pcm = bytes.subarray(dataStart);
  if (pcm.length < 2) return null;
  return { pcm, sampleRate };
}

export function resamplePcm16LE(pcm: Uint8Array, fromRate: number, toRate: number): Uint8Array {
  if (fromRate === toRate || pcm.length < 2) return pcm;
  const inputSamples = pcm.length / 2;
  const outputSamples = Math.max(1, Math.floor((inputSamples * toRate) / fromRate));
  const out = new Uint8Array(outputSamples * 2);
  const viewIn = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const viewOut = new DataView(out.buffer);

  for (let i = 0; i < outputSamples; i++) {
    const srcPos = (i * fromRate) / toRate;
    const idx = Math.min(Math.floor(srcPos), inputSamples - 1);
    const frac = srcPos - idx;
    const s0 = viewIn.getInt16(idx * 2, true);
    const s1 = idx + 1 < inputSamples ? viewIn.getInt16((idx + 1) * 2, true) : s0;
    const sample = Math.round(s0 + frac * (s1 - s0));
    viewOut.setInt16(i * 2, Math.max(-32768, Math.min(32767, sample)), true);
  }
  return out;
}

const TARGET_RATE = 24000;
const MIN_SEND_BYTES = 960; // ~20ms at 24kHz mono PCM16

export function wavBase64ToPcmBase64(wavBase64: string, byteOffset = 0): string | null {
  const parsed = parseWavBytes(decodeBase64(wavBase64));
  if (!parsed) return null;
  let pcm = parsed.pcm;
  if (byteOffset > 0) {
    if (byteOffset >= pcm.length) return null;
    pcm = pcm.subarray(byteOffset);
  }
  if (pcm.length < MIN_SEND_BYTES) return null;
  if (parsed.sampleRate !== TARGET_RATE) {
    pcm = resamplePcm16LE(pcm, parsed.sampleRate, TARGET_RATE);
  }
  return encodeBase64(pcm);
}
