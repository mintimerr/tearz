import { getContentUriAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import type { RefObject } from 'react';
import type { View } from 'react-native';

import { PROGRESS_CARD_HEIGHT, PROGRESS_CARD_WIDTH } from '@/components/viral/progress-share-card';

function ensureFileUri(uri: string) {
  return uri.startsWith('file://') ? uri : `file://${uri}`;
}

async function toShareableImageUri(tmpUri: string) {
  const fileUri = ensureFileUri(tmpUri);
  if (Platform.OS === 'android') {
    return getContentUriAsync(fileUri);
  }
  return fileUri;
}

function isShareCancelled(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return /cancel|dismiss|CANCELED/i.test(msg);
}

/**
 * Одно вложение — PNG-карточка (текст и ссылка уже на изображении).
 * Отдельный message не передаём: на iOS/Android он уходит вторым сообщением.
 */
export async function shareProgressCardImage(
  cardRef: RefObject<View | null>,
  dialogTitle = 'tearz',
) {
  const node = cardRef.current;
  if (!node) {
    throw new Error('sharePosterNotReady');
  }

  const tmpUri = await captureRef(node, {
    format: 'png',
    quality: 1,
    width: PROGRESS_CARD_WIDTH * 3,
    height: PROGRESS_CARD_HEIGHT * 3,
    result: 'tmpfile',
  });

  const imageUri = await toShareableImageUri(tmpUri);

  if (Platform.OS === 'web') {
    await Share.share({ url: tmpUri, title: dialogTitle });
    return;
  }

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(imageUri, {
      mimeType: 'image/png',
      dialogTitle,
    });
    return;
  }

  try {
    await Share.share({ url: imageUri, title: dialogTitle });
  } catch (err) {
    if (isShareCancelled(err)) return;
    throw err;
  }
}
