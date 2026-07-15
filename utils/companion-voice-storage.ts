import {
  copyAsync,
  documentDirectory,
  makeDirectoryAsync,
} from 'expo-file-system/legacy';

const SUBDIR = 'companion-voice/';

/** Копирует запись во внутреннее хранилище приложения (переживает перезапуск). */
export async function persistCompanionVoice(tempUri: string, messageId: string): Promise<string> {
  const root = documentDirectory;
  if (!root) {
    throw new Error('Нет доступа к файловой системе устройства');
  }
  const dir = `${root}${SUBDIR}`;
  await makeDirectoryAsync(dir, { intermediates: true });
  const extMatch = /\.([a-z0-9]+)(?:\?|$)/i.exec(tempUri);
  const ext = extMatch?.[1] ?? 'm4a';
  const dest = `${dir}${messageId}.${ext}`;
  await copyAsync({ from: tempUri, to: dest });
  return dest;
}
