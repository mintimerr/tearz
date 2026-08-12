# Web demo (Expo static) — Tearz

Шаринг по **ссылке / QR** без App Store / Play.

## Ссылка после деплоя

`https://tearz-chat-api.onrender.com/`

QR: любой генератор → вставь этот URL.

## Сборка

```bash
npm run build:web
```

Кладёт статику в `server/public/app`. API URL по умолчанию — Render.

Локально проверить:

```bash
npm run server
# http://localhost:8787/
```

## Деплой

Закоммить `server/public/app` + серверные правки и запушь в `main` (Render подхватит), либо:

```bash
npm run deploy:render
```

## Веб vs native

- Rive (маскот / board) — canvas runtime (`@rive-app/react-canvas`)
- Голосовые сообщения — `expo-audio` в браузере
- Звонки — WebSocket + getUserMedia / Web Audio
- Пуши — нет (только native)
