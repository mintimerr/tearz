import type { CompanionChatApiLanguage } from '@/types/companion-chat-api';
import type { AppLocale } from '@/constants/i18n/translations';
import { companionApiErrorFromJson, parseCompanionApiJson } from '@/utils/companion-api-error';
import { postCompanionApiJson } from '@/utils/companion-api-fetch';

export type TranslateWordResult = {
  translation: string;
  pinyin?: string | null;
};

export async function postTranslateWord(
  body: {
    word: string;
    targetLocale: AppLocale;
    sourceLanguage?: CompanionChatApiLanguage | null;
    context?: string | null;
  },
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<TranslateWordResult | null> {
  try {
    const res = await postCompanionApiJson(
      '/api/translate-word',
      {
        word: body.word,
        targetLocale: body.targetLocale,
        sourceLanguage: body.sourceLanguage ?? undefined,
        context: body.context ?? undefined,
      },
      {
        skipWarm: true,
        timeoutMs: options.timeoutMs ?? 6_000,
        retries: 0,
        signal: options.signal,
      },
    );
    const raw = await res.text();
    const json = parseCompanionApiJson(raw, res.status) as {
      translation?: unknown;
      pinyin?: unknown;
    };
    if (!res.ok) {
      void companionApiErrorFromJson(json, res.status);
      return null;
    }
    const translation = typeof json.translation === 'string' ? json.translation.trim() : '';
    if (!translation) return null;
    return {
      translation,
      pinyin: typeof json.pinyin === 'string' ? json.pinyin.trim() : null,
    };
  } catch {
    return null;
  }
}
