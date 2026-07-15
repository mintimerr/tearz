import type { ConfigContext, ExpoConfig } from 'expo/config';

import appJson from './app.json';

const base = appJson.expo;

export default ({ config }: ConfigContext): ExpoConfig => {
  const apiUrl = process.env.EXPO_PUBLIC_COMPANION_CHAT_API_URL?.trim();
  if (process.env.EAS_BUILD === 'true' && !apiUrl) {
    console.warn(
      '[Tearz] EXPO_PUBLIC_COMPANION_CHAT_API_URL не задан. ' +
        'eas secret:create --scope project --name EXPO_PUBLIC_COMPANION_CHAT_API_URL --value https://...',
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
    },
  } as ExpoConfig;
};
