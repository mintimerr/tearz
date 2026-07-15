import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

const MAX_IMAGE_WIDTH = 1024;

/** Resize/compress image for OpenAI vision (handles HEIC and large photos). */
export async function prepareCompanionImageForApi(
  fileUri: string,
): Promise<{ base64: string; mimeType: string }> {
  const manipulated = await ImageManipulator.manipulateAsync(
    fileUri,
    [{ resize: { width: MAX_IMAGE_WIDTH } }],
    { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG },
  );
  const base64 = await readAsStringAsync(manipulated.uri, { encoding: EncodingType.Base64 });
  if (!base64) {
    throw new Error('Не удалось прочитать изображение');
  }
  return { base64, mimeType: 'image/jpeg' };
}
