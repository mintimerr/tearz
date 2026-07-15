# Tearz — мобильное приложение для изучения языков

AI-преподаватель, собеседник для практики, словарь с карточками и мини-тренировки по теме урока.

## Быстрый старт (разработка)

```bash
npm install
cp .env.example .env          # укажите URL бэкенда
cd server && npm install && cp .env.example .env   # OPENAI_API_KEY и т.д.
```

В двух терминалах:

```bash
npm run server      # API на :8787
npx expo start      # Expo
```

Подробнее про backend: [server/README.md](server/README.md)

## TestFlight

Полная инструкция: **[docs/TESTFLIGHT.md](docs/TESTFLIGHT.md)**

Кратко:

```bash
eas secret:create --scope project --name EXPO_PUBLIC_COMPANION_CHAT_API_URL --value https://...
eas build --platform ios --profile testflight
eas submit --platform ios --latest
```

## Скрипты

| Команда | Описание |
|---------|----------|
| `npm start` | Expo dev server |
| `npm run server` | Backend API |
| `npm run server:dev` | Backend с hot-reload |
| `npm run build:ios` | EAS-сборка для TestFlight |
| `npm run submit:ios` | Загрузка в App Store Connect |
| `npm run lint` | ESLint |

## Структура

- `app/` — экраны (Expo Router)
- `components/teacher/` — преподаватель, упражнения, paywall
- `server/` — Node API (OpenAI, auth, упражнения)
- `constants/teacher-drill.ts` — лимиты мини-тренировки

## Версия

`1.0.0` · iOS bundle `com.tearz.app`
