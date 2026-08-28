import type {
  CompanionChatApiLanguage,
  CompanionTranscribeSuccessBody,
} from '@/types/companion-chat-api';

import { companionApiRequestHeaders, getCompanionChatApiBaseUrl } from '@/utils/companion-api-config';

function voiceMimeFromExt(ext: string): string {
  switch (ext) {
    case 'm4a':
      return 'audio/m4a';
    case 'mp4':
      return 'audio/mp4';
    case 'caf':
      return 'audio/x-caf';
    case 'wav':
      return 'audio/wav';
    case 'mp3':
      return 'audio/mpeg';
    case 'webm':
      return 'audio/webm';
    case '3gp':
      return 'audio/3gpp';
    default:
      return 'audio/m4a';
  }
}

async function prepareVoiceUpload(audioUri: string): Promise<{ uri: string; mimeType: string }> {
  const { getInfoAsync, copyAsync, cacheDirectory, makeDirectoryAsync } = await import(
    'expo-file-system/legacy'
  );

  const sourceInfo = await getInfoAsync(audioUri, { size: true });
  if (
    !sourceInfo.exists ||
    !('size' in sourceInfo) ||
    typeof sourceInfo.size !== 'number' ||
    sourceInfo.size < 200
  ) {
    throw new Error('Запись пустая или не сохранилась — попробуй записать ещё раз');
  }

  const extMatch = /\.([a-z0-9]+)(?:\?|$)/i.exec(audioUri);
  const ext = (extMatch?.[1] ?? 'm4a').toLowerCase();
  const mimeType = voiceMimeFromExt(ext);

  const root = cacheDirectory;
  if (!root) {
    return { uri: audioUri, mimeType };
  }

  const dir = `${root}voice-upload/`;
  await makeDirectoryAsync(dir, { intermediates: true });
  const dest = `${dir}upload-${Date.now()}.${ext}`;
  await copyAsync({ from: audioUri, to: dest });

  const destInfo = await getInfoAsync(dest, { size: true });
  if (
    !destInfo.exists ||
    !('size' in destInfo) ||
    typeof destInfo.size !== 'number' ||
    destInfo.size < 200
  ) {
    throw new Error('Не удалось подготовить запись — попробуй ещё раз');
  }

  return { uri: dest, mimeType };
}

export async function postCompanionVoiceTranscribe(
  audioUri: string,
  language: CompanionChatApiLanguage,
  uiLanguage?: 'ru' | 'en' | 'zh',
): Promise<string> {
  const { readAsStringAsync, EncodingType } = await import('expo-file-system/legacy');
  const { uri, mimeType } = await prepareVoiceUpload(audioUri);
  const base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
  if (!base64) {
    throw new Error('Пустая запись');
  }

  const base = getCompanionChatApiBaseUrl();
  const res = await fetch(`${base}/api/transcribe`, {
    method: 'POST',
    headers: companionApiRequestHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      audioBase64: base64,
      mimeType,
      language,
      uiLanguage,
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
