import Constants from 'expo-constants';

/**
 * Публичные URL Privacy / Terms.
 * Переопределение: EXPO_PUBLIC_PRIVACY_URL / EXPO_PUBLIC_TERMS_URL (EAS env или .env).
 * Дефолт — Render (tearz.app пока без DNS); HTML: docs/legal/*.html
 */
const extra = (Constants.expoConfig?.extra ?? {}) as {
  privacyPolicyUrl?: string | null;
  termsOfServiceUrl?: string | null;
};

const DEFAULT_PRIVACY = 'https://tearz-chat-api.onrender.com/privacy';
const DEFAULT_TERMS = 'https://tearz-chat-api.onrender.com/terms';

export function getPrivacyPolicyUrl(): string {
  return (
    process.env.EXPO_PUBLIC_PRIVACY_URL?.trim() ||
    extra.privacyPolicyUrl?.trim() ||
    DEFAULT_PRIVACY
  );
}

export function getTermsOfServiceUrl(): string {
  return (
    process.env.EXPO_PUBLIC_TERMS_URL?.trim() ||
    extra.termsOfServiceUrl?.trim() ||
    DEFAULT_TERMS
  );
}
