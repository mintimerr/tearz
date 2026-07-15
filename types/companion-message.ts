export type CompanionReadState = 'sent' | 'read';

/** Сообщение в треде companion-chat (текст или голос). */
export type CompanionMsg = {
  id: string;
  from: 'me' | 'them';
  time: string;
  read?: CompanionReadState;
  /** По умолчанию текстовое */
  kind?: 'text' | 'voice' | 'image' | 'file';
  /** Текст пузырька или расшифровка голосового (для API) */
  text: string;
  imageUri?: string;
  fileUri?: string;
  fileName?: string;
  mimeType?: string;
  audioUri?: string;
  durationMs?: number;
  /** Идёт распознавание речи после записи */
  voicePending?: boolean;
  /** Unix ms — когда пользователь отправил сообщение */
  sentAt?: number;
};

export function isVoiceMsg(m: CompanionMsg): boolean {
  return m.kind === 'voice' || Boolean(m.audioUri);
}

export function isImageMsg(m: CompanionMsg): boolean {
  return m.kind === 'image' || Boolean(m.imageUri);
}

export function isFileMsg(m: CompanionMsg): boolean {
  return m.kind === 'file' || Boolean(m.fileUri);
}
