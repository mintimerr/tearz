import type { AppLocale } from '@/constants/i18n/translations';
import type { TranslationKey } from '@/constants/i18n/translations';

type TFn = (key: TranslationKey, params?: Record<string, string | number>) => string;

export function localeLangLabel(locale: AppLocale, t: TFn): string {
  if (locale === 'ru') return t('auth.langRu');
  if (locale === 'zh') return t('auth.langZh');
  return t('auth.langEn');
}
