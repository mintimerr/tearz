# Companion chat API (OpenAI через backend)

## Переменные окружения

Создайте `server/.env` (рядом с этим README), скопировав `server/.env.example`:

- `OPENAI_API_KEY` — ключ OpenAI (никогда не кладите его в Expo / mobile).
- `PORT` — порт HTTP (по умолчанию `8787`).
- `TEACHER_MODEL` — уроки / drills / проверка (по умолчанию `gpt-4.1`).
- `TEACHER_FAST_MODEL` — intent + push-copy (по умолчанию `gpt-4.1-mini`).
- `COMPANION_MODEL` — чат собеседника (по умолчанию `gpt-4.1`).
- `COMPANION_PROFILE_MODEL` — генерация persona (по умолчанию = `COMPANION_MODEL`).
- **Placement test** (когда будет включён): `PLACEMENT_FAST_MODEL` (`gpt-5.6-luna`), `PLACEMENT_MODEL` (`gpt-5.6-terra`), `PLACEMENT_SCORE_MODEL` (`o3-mini`) — tiered по сложности вопроса.
- `RESEND_API_KEY` — **нужен для писем с кодом** на почту ([Resend](https://resend.com) → API Keys). Без ключа код только в логе сервера (режим разработки).
- `AUTH_FROM_EMAIL` — отправитель. Для старта: `Tearz <onboarding@resend.dev>` (бесплатно). **Важно:** без своего домена Resend шлёт письма **только на email, с которым вы зарегистрировались в Resend** — для регистрации в приложении используйте тот же адрес или верифицируйте домен в Resend.

## Маршруты

- `GET /health` — проверка живости (для деплоя и мониторинга).
- `POST /api/auth/send-code` — отправить 6-значный код (`email`, опц. `displayName`, `purpose`: `signIn` | `signUp`).
- `POST /api/auth/verify-code` — проверить код (`email`, `code`) → `{ displayName }`.
- `POST /api/teacher-chat` — ответ AI-преподавателя (`message`, `conversationHistory`, `language` опц., `lessonTopic` опц.). Модель: `TEACHER_MODEL`.
- `POST /api/teacher-exercise` — короткое задание по конкретному ответу преподавателя (`explanation`, `conversationHistory`, `language` опц., `lessonTopic` опц.).
- `POST /api/teacher-exercise-check` — проверка ответа ученика на задание (`exercise`, `answer`, `conversationHistory`, `language` опц., `lessonTopic` опц.).
- `POST /api/chat` — ответ собеседника (тело: `message`, `conversationHistory`, `language`, опционально `companionPersona`).
- `POST /api/transcribe` — голос → текст (Whisper): `audioBase64`, `mimeType` (опц.), `language` — для голосовых в чате собеседника.
- `POST /api/companion-profile` — случайный профиль под `language`: `english` | `chinese` | `russian` (JSON: `name`, `age`, `city`, **`bio`** — короткое «о себе» **от первого лица** в духе типичных анкет приложений знакомств: работа/учёба, увлечения, штампы и самоирония; на **языке практики**; `letter`, `color`, `persona`, `openingLine`).

## System prompt

Тексты system prompt:
- `prompts/companion-system.txt` — собеседник
- `prompts/teacher-system.txt` — преподаватель
- `prompts/teacher-exercise-patterns.txt` — шаблоны стиля заданий для генератора практики

## Запуск

```bash
cd server
npm install
npm run dev
```

### Docker (продакшн)

```bash
docker build -t tearz-api .
docker run -p 8787:8787 --env-file .env tearz-api
```

### Health check

`GET /health` → `{"ok":true,"service":"tearz-chat-api","version":"1.0.0"}`

## Expo / симулятор

В **корне** репозитория добавьте в `.env` (для Expo):

`EXPO_PUBLIC_COMPANION_CHAT_API_URL=http://<ваш-хост>:8787`

- iOS Simulator + сервер на Mac: `http://127.0.0.1:8787`
- Android Emulator: `http://10.0.2.2:8787`
- Физическое устройство: IP машины в LAN, например `http://192.168.1.10:8787`
