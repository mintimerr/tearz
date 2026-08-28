# Google Play — Tearz

Подготовка к Play **рядом** с iOS/TestFlight. iOS-флоу не меняется.

> Полный dual-store чеклист: [PUBLIC_RELEASE.md](./PUBLIC_RELEASE.md)  
> TestFlight: [TESTFLIGHT.md](./TESTFLIGHT.md)

## Почему Play проще для старта

- Разовый взнос ~\$25 (не \$99/год).
- Identity check обычно мягче, чем у Apple Developer.
- Internal testing: тестеры по ссылке, без полной модерации production.

## 1. Play Console (один раз)

1. [play.google.com/console](https://play.google.com/console) → оплатить регистрацию.
2. Create app → **Tearz**, language, free/paid.
3. **App content → Privacy policy**:  
   `https://tearz-chat-api.onrender.com/privacy`
4. Заполни **Data safety** (email для OTP, фото/микрофон для чата — см. `docs/legal/privacy.html`).
5. Создай **Internal testing** track.

Package name уже задан: `com.tearz.app` (`app.config.ts`).

## 2. EAS env (если ещё не)

Те же production-переменные, что для TestFlight:

```bash
npx eas env:list --environment production
# нужно:
# EXPO_PUBLIC_COMPANION_CHAT_API_URL=https://tearz-chat-api.onrender.com
# опц. EXPO_PUBLIC_PRIVACY_URL / EXPO_PUBLIC_TERMS_URL
```

## 3. Сборка и заливка

В обычном **Terminal.app** (не Cursor), залогиненном в Expo:

```bash
npm run finish:play
```

Или по шагам:

```bash
npm run check:api -- https://tearz-chat-api.onrender.com
npx eas build --platform android --profile play
npx eas submit --platform android --latest --profile play
```

- Profile **`play`**: AAB + `autoIncrement` versionCode.
- Submit: track **internal**, status **draft** — в Console нажми «Review / Send to testers».

Для быстрой установки на свой Android без Console:

```bash
npx eas build --platform android --profile preview   # APK
```

## 4. Service account (для `eas submit` без браузера)

Play Console → Setup → API access → связать Google Cloud → создать service account с правом **Release to testing tracks** → скачать JSON.

```bash
# один раз
npx eas credentials --platform android
# или при submit укажи путь к JSON
```

Без JSON `eas submit` откроет браузер / попросит загрузить AAB вручную в Console.

## 5. Чеклист перед тестерами

- [ ] API `/health` → 200
- [ ] Privacy / Terms → 200
- [ ] Internal testing link открывается на Android
- [ ] OTP / чат / мик / галерея на реальном устройстве
- [ ] Data safety заполнен честно

## 6. Потом (не сейчас)

- Production track + store listing (скрины, feature graphic 1024×500)
- Play App Signing (EAS обычно настраивает сам)
- Billing / подписки — phase 2
