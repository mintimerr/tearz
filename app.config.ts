import type { ConfigContext, ExpoConfig } from 'expo/config';

import appJson from './app.json';

const base = appJson.expo;

export default ({ config }: ConfigContext): ExpoConfig => {
  const apiUrl = process.env.EXPO_PUBLIC_COMPANION_CHAT_API_URL?.trim();
  const privacyPolicyUrl =
    process.env.EXPO_PUBLIC_PRIVACY_URL?.trim() || 'https://tearz.app/privacy';
  const termsOfServiceUrl =
    process.env.EXPO_PUBLIC_TERMS_URL?.trim() || 'https://tearz.app/terms';

  if (process.env.EAS_BUILD === 'true' && !apiUrl) {
    const msg =
      '[Tearz] EXPO_PUBLIC_COMPANION_CHAT_API_URL не задан. ' +
      'Для production: eas env:create --name EXPO_PUBLIC_COMPANION_CHAT_API_URL --value https://… --environment production';
    if (process.env.EAS_BUILD_PROFILE === 'production' || process.env.EAS_BUILD_PROFILE === 'testflight') {
      throw new Error(msg);
    }
    console.warn(msg);
  }

  if (process.env.EAS_BUILD === 'true' && apiUrl && /ngrok/i.test(apiUrl)) {
    console.warn(
      '[Tearz] API URL указывает на ngrok — для публичного релиза нужен постоянный HTTPS (Render и т.п.).',
    );
  }

  return {
    ...config,
    ...base,
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.tearz.app',
      buildNumber: '1',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      ...base.android,
      package: 'com.tearz.app',
      versionCode: 1,
    },
    extra: {
      eas: {
        projectId: '014cc597-cda4-44b2-aef6-ca6b4a2ad33f',
      },
      apiUrl: apiUrl ?? null,
      privacyPolicyUrl,
      termsOfServiceUrl,
    },
  } as ExpoConfig;
};
