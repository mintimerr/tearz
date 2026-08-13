import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image, Platform } from 'react-native';

/** High enough for OpenAI vision `detail: high` + readable homework text. */
const MAX_IMAGE_EDGE = 2048;
const JPEG_QUALITY = 0.9;

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (err) => reject(err ?? new Error('Не удалось прочитать размер изображения')),
    );
  });
}

async function prepareCompanionImageWeb(fileUri: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(fileUri);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Не удалось обработать изображение');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  const base64 = dataUrl.split(',')[1] ?? '';
  if (!base64) throw new Error('Не удалось прочитать изображение');
  return { base64, mimeType: 'image/jpeg' };
}

/** Resize/compress image for OpenAI vision (handles HEIC and large photos). */
export async function prepareCompanionImageForApi(
  fileUri: string,
): Promise<{ base64: string; mimeType: string }> {
  if (Platform.OS === 'web') {
    return prepareCompanionImageWeb(fileUri);
  }

  let actions: ImageManipulator.Action[] = [];
  try {
    const { width, height } = await getImageSize(fileUri);
    const maxEdge = Math.max(width, height);
    if (maxEdge > MAX_IMAGE_EDGE) {
      const scale = MAX_IMAGE_EDGE / maxEdge;
      actions = [{ resize: { width: Math.max(1, Math.round(width * scale)) } }];
    }
  } catch {
    actions = [{ resize: { width: MAX_IMAGE_EDGE } }];
  }

  const manipulated = await ImageManipulator.manipulateAsync(fileUri, actions, {
    compress: JPEG_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const base64 = await readAsStringAsync(manipulated.uri, { encoding: EncodingType.Base64 });
  if (!base64) {
    throw new Error('Не удалось прочитать изображение');
  }
  return { base64, mimeType: 'image/jpeg' };
}
