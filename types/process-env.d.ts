/** Публичные переменные Expo (не секреты). OpenAI ключ только на server — см. `server/.env`. */
export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      EXPO_PUBLIC_COMPANION_CHAT_API_URL?: string;
    }
  }
}
