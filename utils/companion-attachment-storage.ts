import {
  copyAsync,
  documentDirectory,
  makeDirectoryAsync,
} from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const SUBDIR = 'companion-attachments/';

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'gif']);

function extFromName(fileName?: string): string | null {
  if (!fileName) return null;
  const m = /\.([^.]+)$/i.exec(fileName);
  return m?.[1]?.toLowerCase() ?? null;
}

/** Копирует вложение во внутреннее хранилище приложения. */
export async function persistCompanionAttachment(
  tempUri: string,
  messageId: string,
  fileName?: string,
): Promise<string> {
  const root = documentDirectory;
  if (!root || Platform.OS === 'web') {
    return tempUri;
  }
  const dir = `${root}${SUBDIR}`;
  await makeDirectoryAsync(dir, { intermediates: true });
  const fromName = extFromName(fileName);
  const fromUri = /\.([a-z0-9]+)(?:\?|$)/i.exec(tempUri)?.[1]?.toLowerCase();
  let ext = fromName ?? fromUri ?? 'bin';
  if (!fromName && !fromUri && !fileName) {
    ext = 'jpg';
  } else if (IMAGE_EXTS.has(ext) || ext === 'bin') {
    /* keep */
  }
  const dest = `${dir}${messageId}.${ext}`;
  await copyAsync({ from: tempUri, to: dest });
  return dest;
}
