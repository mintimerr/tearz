import { useCallback, useEffect, useRef, useState } from 'react';

import type { AppLocale } from '@/constants/i18n/translations';
import type { VocabularyEntry } from '@/contexts/vocabulary-context';
import {
  fetchCardSuggestion,
  instantCardFields,
  type CardSuggestionCard,
} from '@/utils/card-suggestion';
import { isAbortError } from '@/utils/abort-error';

const NETWORK_DEBOUNCE_MS = 180;

type Options = {
  word: string;
  enabled: boolean;
  locale: AppLocale;
  entries: VocabularyEntry[];
  folderCards?: CardSuggestionCard[];
};

export function useCardSuggestion({
  word,
  enabled,
  locale,
  entries,
  folderCards = [],
}: Options) {
  const [translation, setTranslation] = useState('');
  const [pinyin, setPinyin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastAutoTr = useRef('');
  const lastAutoPy = useRef('');
  const seqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    setTranslation('');
    setPinyin('');
    setLoading(false);
    setError(null);
    lastAutoTr.current = '';
    lastAutoPy.current = '';
    seqRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const applyAuto = useCallback((tr: string | null, py: string | null) => {
    if (tr) {
      setTranslation((prev) => {
        if (!prev || prev === lastAutoTr.current) {
          lastAutoTr.current = tr;
          return tr;
        }
        return prev;
      });
    }
    if (py) {
      setPinyin((prev) => {
        if (!prev || prev === lastAutoPy.current) {
          lastAutoPy.current = py;
          return py;
        }
        return prev;
      });
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const w = word.trim();
    if (!w) {
      reset();
      return;
    }

    setError(null);
    const instant = instantCardFields(w, locale, { entries, folderCards });
    applyAuto(instant.translation, instant.pinyin);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (instant.translation) {
      setLoading(false);
      abortRef.current?.abort();
      abortRef.current = null;
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }

    timerRef.current = setTimeout(() => {
      const seq = ++seqRef.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);

      void fetchCardSuggestion(w, locale, {
        entries,
        folderCards,
        signal: controller.signal,
      })
        .then((result) => {
          if (seq !== seqRef.current) return;
          applyAuto(result.translation, result.pinyin);
          if (!result.translation) setError('translate');
        })
        .catch((e: unknown) => {
          if (isAbortError(e)) return;
          if (seq !== seqRef.current) return;
          setError('generic');
        })
        .finally(() => {
          if (seq === seqRef.current) setLoading(false);
        });
    }, NETWORK_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [applyAuto, enabled, entries, folderCards, locale, reset, word]);

  return {
    translation,
    setTranslation,
    pinyin,
    setPinyin,
    loading,
    error,
    reset,
  };
}
