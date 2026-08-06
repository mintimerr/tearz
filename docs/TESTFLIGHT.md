# TestFlight — Tearz

Пошаговая инструкция: от деплоя бэкенда до сборки в TestFlight.

> **Публичный релиз (App Store + Play):** см. **[PUBLIC_RELEASE.md](./PUBLIC_RELEASE.md)** — постоянный HTTPS API, legal URLs, `npm run build:all`.  
> Ниже — закрытая бета; ngrok допустим только для неё.

## 1. Задеплойте backend

API должен быть доступен по **HTTPS** с телефона (не `localhost`).

### Docker (рекомендуется)

```bash
cd server
docker build -t tearz-api .
docker run -p 8787:8787 \
  -e OPENAI_API_KEY=sk-... \
  -e RESEND_API_KEY=re_... \
  -e AUTH_FROM_EMAIL="Tearz <onboarding@resend.dev>" \
  tearz-api
```

Проверка: `curl https://ваш-домен/health` → `{"ok":true,...}`  
Или: `npm run check:api -- https://ваш-домен`

### Переменные server/.env (продакшн)

| Переменная | Обязательно | Описание |
|------------|-------------|----------|
| `OPENAI_API_KEY` | да | Ключ OpenAI |
| `RESEND_API_KEY` | да* | Письма с кодом входа |
| `AUTH_FROM_EMAIL` | да* | Отправитель писем |
| `PORT` | нет | По умолчанию 8787 |
| `TEACHER_MODEL` | нет | Уроки/drills, по умолчанию `gpt-4.1` |
| `TEACHER_FAST_MODEL` | нет | Intent/push, по умолчанию `gpt-4.1-mini` |
| `COMPANION_MODEL` | нет | Собеседник, по умолчанию `gpt-4.1` |

\* Без Resend код только в логе сервера (только для разработки).

**Почта:** на бесплатном Resend без своего домена письма уходят только на email аккаунта Resend. Для тестеров — верифицируйте домен в Resend или добавьте их email в аккаунт.

Платформы: Railway, Fly.io, Render, VPS + nginx + Let's Encrypt.

## 2. EAS (уже настроено)

- Expo: **@mitya66789** — https://expo.dev/accounts/mitya66789/projects/tearz-mobile
- Bundle ID: `com.tearz.app`
- API URL в EAS env (production + preview) — **постоянный HTTPS** для публики; ngrok только для быстрой закрытой беты

## 3. API для телефона

**Постоянно (рекомендуется):** `render.yaml` → [Render](https://dashboard.render.com) → EAS env `EXPO_PUBLIC_COMPANION_CHAT_API_URL=https://….onrender.com`.

**Временно (ngrok, только закрытая бета):** пока Mac включён и запущены `npm run server` + ngrok:
```bash
npm run release:api-url
```

## 4. Сборка TestFlight — один шаг в Terminal.app

Из Cursor Apple ID ввести нельзя. В **обычном Terminal**:

```bash
cd ~/cortex-mobile
npm run finish:testflight
```

Скрипт: Xcode license → API URL → `eas build` (Apple ID) → submit в TestFlight.

Нужен **Apple Developer** ($99/год).

Для production iOS+Android: `npm run build:all` (см. PUBLIC_RELEASE.md).

## 5. Чеклист перед заливкой

- [ ] `GET /health` отвечает 200
- [ ] Регистрация: код приходит на почту
- [ ] Privacy / Terms открываются (`/privacy` и `/terms` на API; EAS env `EXPO_PUBLIC_PRIVACY_URL` / `EXPO_PUBLIC_TERMS_URL`)
- [ ] Преподаватель: вопрос → ответ с блоками
- [ ] Мини-тренировка · 5 → задания проходятся
- [ ] Long-press слова в чате → добавление в словарь
- [ ] Собеседник: сообщение + голосовое
- [ ] Plus — день за монеты (без фейковой подписки)
- [ ] Хаб: монеты / цель дня / стрик; оверлей наград после урока

## Лимиты мини-тренировки (продакшн)

- **4** разных объяснения в уроке
- **2** обновления набора на одно объяснение
- **5** заданий в наборе

Константы: `constants/teacher-drill.ts`

## Что ещё не в этой версии

- In-App Purchase (Plus — только за монеты, 1 день)
- Полная тренировка на 15 заданий без Plus-дня
- Соцсеть / друзья
- Остальные world-локации (только Arcade + ATM)

Это нормально для закрытой беты TestFlight; для стора см. PUBLIC_RELEASE.md.
