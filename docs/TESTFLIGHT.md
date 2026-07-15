# TestFlight — Tearz

Пошаговая инструкция: от деплоя бэкенда до сборки в TestFlight.

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

### Переменные server/.env (продакшн)

| Переменная | Обязательно | Описание |
|------------|-------------|----------|
| `OPENAI_API_KEY` | да | Ключ OpenAI |
| `RESEND_API_KEY` | да* | Письма с кодом входа |
| `AUTH_FROM_EMAIL` | да* | Отправитель писем |
| `PORT` | нет | По умолчанию 8787 |
| `TEACHER_MODEL` | нет | По умолчанию `gpt-4.1-mini` |

\* Без Resend код только в логе сервера (только для разработки).

**Почта:** на бесплатном Resend без своего домена письма уходят только на email аккаунта Resend. Для тестеров — верифицируйте домен в Resend или добавьте их email в аккаунт.

Платформы: Railway, Fly.io, Render, VPS + nginx + Let's Encrypt.

## 2. EAS (уже настроено)

- Expo: **@mitya66789** — https://expo.dev/accounts/mitya66789/projects/tearz-mobile
- Bundle ID: `com.tearz.app`
- API URL в EAS env (production + preview) — через ngrok

## 3. API для телефона

**Сейчас (ngrok):** пока Mac включён и запущены `npm run server` + ngrok:
```bash
npm run release:api-url
```

**Постоянно:** `render.yaml` → [Render](https://dashboard.render.com) → обновить EAS env на `https://….onrender.com`.

## 4. Сборка TestFlight — один шаг в Terminal.app

Из Cursor Apple ID ввести нельзя. В **обычном Terminal**:

```bash
cd ~/cortex-mobile
npm run finish:testflight
```

Скрипт: Xcode license → API URL → `eas build` (Apple ID) → submit в TestFlight.

Нужен **Apple Developer** ($99/год).

## 5. Чеклист перед заливкой

- [ ] `GET /health` отвечает 200
- [ ] Регистрация: код приходит на почту
- [ ] Преподаватель: вопрос → ответ с блоками
- [ ] Мини-тренировка · 5 → задания проходятся
- [ ] Long-press слова в чате → добавление в словарь
- [ ] Собеседник: сообщение + голосовое
- [ ] Plus — показывает paywall с текстом «Оплата в следующем обновлении»

## Лимиты мини-тренировки (продакшн)

- **4** разных объяснения в уроке
- **2** обновления набора на одно объяснение
- **5** заданий в наборе

Константы: `constants/teacher-drill.ts`

## Что ещё не в этой версии

- In-App Purchase (Plus — только paywall-заглушка)
- Полная тренировка на 15 заданий
- Соцсеть / друзья

Это нормально для закрытой беты TestFlight.
