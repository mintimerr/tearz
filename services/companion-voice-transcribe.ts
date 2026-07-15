import type {
  CompanionChatApiLanguage,
  CompanionTranscribeSuccessBody,
} from '@/types/companion-chat-api';

import { companionApiRequestHeaders, getCompanionChatApiBaseUrl } from '@/utils/companion-api-config';
export async function postCompanionVoiceTranscribe(
  audioUri: string,
  language: CompanionChatApiLanguage,
): Promise<string> {
  const { readAsStringAsync, EncodingType } = await import('expo-file-system/legacy');
  const base64 = await readAsStringAsync(audioUri, { encoding: EncodingType.Base64 });
  if (!base64) {
    throw new Error('Пустая запись');
  }

  const base = getCompanionChatApiBaseUrl();
  const res = await fetch(`${base}/api/transcribe`, {
    method: 'POST',
    headers: companionApiRequestHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      audioBase64: base64,
      mimeType: 'audio/mp4',
      language,
    }),
  });

  const raw = await res.text();
  let json: unknown;
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(raw.slice(0, 200) || `HTTP ${res.status}`);
  }
  if (!res.ok) {
    const err = json as { error?: string };
    throw new Error(err.error || `Ошибка сервера (${res.status})`);
  }
  const ok = json as Partial<CompanionTranscribeSuccessBody>;
  if (typeof ok.text !== 'string' || !ok.text.trim()) {
    throw new Error('Пустая расшифровка');
  }
  return ok.text.trim();
}
