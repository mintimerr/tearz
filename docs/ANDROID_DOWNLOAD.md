# Android APK + лендинг скачивания

Пока без App Store / Play: сайт с QR и кнопкой **Скачать APK**. Бинарник тот же native Android — анимации и вибрация как в обычной сборке.

## 1. Собрать APK

В Terminal (нужен Expo-аккаунт):

```bash
npx eas build --platform android --profile preview
```

Profile `preview` в `eas.json` → **APK** (не AAB).

Скачай артефакт с страницы сборки EAS.

## 2. Положить APK на лендинг

Вариант A — рядом с сайтом:

```bash
cp ~/Downloads/tearz-*.apk landing/tearz.apk
```

Вариант B — GitHub Release / Cloudflare R2 / любой HTTPS:

Отредактируй `landing/config.js`:

```js
window.TEARZ_DOWNLOAD = {
  brand: 'Tearz',
  version: '1.0.0',
  apkUrl: 'https://github.com/YOU/REPO/releases/download/v1.0.0/tearz.apk',
};
```

## 3. Открыть локально

```bash
npm run landing:serve
```

Открой URL из терминала (обычно http://127.0.0.1:4173).

## 4. Выложить сайт (без Render)

Проще всего **Cloudflare Pages** или **GitHub Pages** — только папка `landing/`.

### Cloudflare Pages
1. Залей содержимое `landing/` (включая `tearz.apk` или внешнюю ссылку в config).
2. Подключи свой домен в Cloudflare (DNS → Pages).

### GitHub Pages
1. Репозиторий → Settings → Pages → deploy from `/landing` или `gh-pages` branch.
2. Домен: Settings → Pages → Custom domain.

Домен покупается отдельно (Namecheap / Cloudflare Registrar / REG.RU и т.д.) и указывает A/CNAME на хостинг. Пока можно пользоваться `*.pages.dev` / `*.github.io`.

### Уже на Render (API host)

После деплоя сервера лендинг доступен так:

- https://tearz-chat-api.onrender.com/android/
- https://tearz-chat-api.onrender.com/download → редирект на `/android/`

APK URL задаётся в `landing/config.js` (`apkUrl`).

## 5. Установка на Android

1. Открыть сайт на телефоне (или QR).
2. Скачать APK.
3. Разрешить установку из браузера/файлов → Установить.

Приложение ходит на API из `EXPO_PUBLIC_COMPANION_CHAT_API_URL` (как в EAS production/preview env). Если Render лежит — чат/AI не ответят, но сам APK ставится.

## Что не меняется

Это full native APK через Expo/EAS — не веб-обёртка. Хаптика, анимации, офлайн-части UI — как у `expo run:android` / preview build.
