import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { translate, type AppLocale, type TranslationKey } from '@/constants/i18n/translations';
import { LOCALE_STORAGE_KEY } from '@/constants/locale-storage';
import { useAuth, type NativeLanguage } from '@/contexts/auth-context';

type LocaleContextValue = {
  locale: AppLocale;
  setPreviewLocale: (locale: NativeLanguage | null) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [storedLocale, setStoredLocale] = useState<AppLocale>('ru');
  const [previewLocale, setPreviewLocale] = useState<AppLocale | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
        if (!cancelled && (raw === 'ru' || raw === 'en' || raw === 'zh')) {
          setStoredLocale(raw);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user?.nativeLanguage) return;
    setStoredLocale(user.nativeLanguage);
    void AsyncStorage.setItem(LOCALE_STORAGE_KEY, user.nativeLanguage);
  }, [user?.nativeLanguage]);

  const locale: AppLocale = previewLocale ?? user?.nativeLanguage ?? storedLocale;

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale],
  );

  const value = useMemo(
    () => ({
      locale,
      setPreviewLocale: (next: NativeLanguage | null) => setPreviewLocale(next),
      t,
    }),
    [locale, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}

export function useTranslation() {
  const { t, locale, setPreviewLocale } = useLocale();
  return { t, locale, setPreviewLocale };
}
