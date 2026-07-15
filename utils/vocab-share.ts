import { Linking, Platform, Share } from 'react-native';

import { postVocabShare } from '@/services/vocab-share-api';
import type { SharedVocabCard } from '@/types/vocab-share-api';

export function buildVocabShareMessage(
  folderName: string,
  cardCount: number,
  url: string,
  lines: { lead: string; cards: string; cta: string },
) {
  return [lines.lead.replace('{{name}}', folderName), '', lines.cards.replace('{{count}}', String(cardCount)), '', lines.cta, url].join(
    '\n',
  );
}

export async function shareVocabPack(input: {
  name: string;
  cards: SharedVocabCard[];
  lines: { lead: string; cards: string; cta: string };
}) {
  const { id, url } = await postVocabShare({ name: input.name, cards: input.cards });
  const message = buildVocabShareMessage(input.name, input.cards.length, url, input.lines);
  await Share.share({ message, title: input.name });
  return { id, url };
}

/** Открывает Telegram с предзаполненным текстом (если установлен). */
export async function shareVocabPackViaTelegram(input: {
  name: string;
  cards: SharedVocabCard[];
  lines: { lead: string; cards: string; cta: string };
}) {
  const { url } = await postVocabShare({ name: input.name, cards: input.cards });
  const message = buildVocabShareMessage(input.name, input.cards.length, url, input.lines);
  const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(message)}`;
  const canOpen = await Linking.canOpenURL(tgUrl);
  if (canOpen) {
    await Linking.openURL(tgUrl);
    return { url };
  }
  if (Platform.OS === 'web') {
    await Share.share({ message, title: input.name });
    return { url };
  }
  await Share.share({ message, title: input.name });
  return { url };
}
