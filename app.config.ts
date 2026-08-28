import type { ConfigContext, ExpoConfig } from 'expo/config';

import appJson from './app.json';

const base = appJson.expo;

export default ({ config }: ConfigContext): ExpoConfig => {
  const apiUrl = process.env.EXPO_PUBLIC_COMPANION_CHAT_API_URL?.trim();
  const privacyPolicyUrl =
    process.env.EXPO_PUBLIC_PRIVACY_URL?.trim() ||
    'https://tearz-chat-api.onrender.com/privacy';
  const termsOfServiceUrl =
    process.env.EXPO_PUBLIC_TERMS_URL?.trim() || 'https://tearz-chat-api.onrender.com/terms';

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
      // buildNumber: remote via eas.json appVersionSource
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      ...base.android,
      package: 'com.tearz.app',
      versionCode: 1,
      // versionCode дальше поднимает EAS (appVersionSource: remote)
      softwareKeyboardLayoutMode: 'resize',
      allowBackup: false,
      permissions: [
        'android.permission.RECORD_AUDIO',
        'android.permission.MODIFY_AUDIO_SETTINGS',
        'android.permission.CAMERA',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.VIBRATE',
      ],
      blockedPermissions: [
        // Не просим точную геолокацию / контакты — меньше вопросов в Data safety
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.READ_CONTACTS',
      ],
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
