import type { TranslateSource } from '@/utils/translate-word';
import { translateToLocale } from '@/utils/translate-word';

export type { TranslateSource } from '@/utils/translate-word';

/** @deprecated Prefer translateToLocale with app locale */
export async function translateToRu(text: string, source: TranslateSource): Promise<string | null> {
  return translateToLocale(text, source, 'ru');
}
