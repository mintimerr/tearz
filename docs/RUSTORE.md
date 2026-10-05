# RuStore — Tearz

Чеклист выпуска Android-приложения **Tearz** (`com.tearz.app`) в [RuStore](https://www.rustore.ru/help/).

> Сборка та же, что для Google Play: **AAB** (profile `play`) или **APK** (profile `preview` для своей проверки).  
> Play-флоу: [PLAY.md](./PLAY.md). Общий релиз: [PUBLIC_RELEASE.md](./PUBLIC_RELEASE.md).

## Быстрый старт

В **обычном Terminal.app** (не Cursor), залогиненном в Expo:

```bash
npm run finish:rustore
```

Скрипт: проверка API/legal → подсказка по credentials → `eas build` AAB (`play`).  
Загрузку в RuStore Console делаешь вручную (у EAS нет встроенного `submit` в RuStore).

---

## 1. Кабинет RuStore (один раз)

1. Зайди в [RuStore Консоль](https://console.rustore.ru/) → регистрация разработчика (физлицо / ИП / ООО).
2. Дождись модерации аккаунта.
3. **Создать приложение** → название **Tearz**, package: `com.tearz.app` (как в `app.config.ts`).
4. Категория: образование / языки (уточни в форме).
5. Возрастной рейтинг по опроснику RuStore.

## 2. Юридическое

В карточке приложения укажи:

| Поле | URL |
|------|-----|
| Политика конфиденциальности | `https://tearz-chat-api.onrender.com/privacy` |
| Пользовательское соглашение | `https://tearz-chat-api.onrender.com/terms` |

Источник HTML: `docs/legal/privacy.html`, `docs/legal/terms.html`.

В опроснике по данным честно отметь:

- email (OTP при входе);
- микрофон (голосовые в чате / drills);
- камера и галерея (вложения в чате);
- уведомления (локальные / разрешение POST_NOTIFICATIONS).

**Не** заявляй геолокацию и контакты — в билде они в `blockedPermissions`.

## 3. Витрина (обязательно к модерации)

Подготовь заранее:

- [ ] Иконка **512×512** PNG (из `assets/images/icon.png` / адаптивная)
- [ ] Скриншоты телефона **минимум 2–4** (портрет), лучше с реальных экранов: хаб, урок, тренировка, профиль
- [ ] Краткое описание (RU), полное описание (RU)
- [ ] Что нового в версии (для 1.0.0 можно «Первый релиз»)

Черновик текстов — см. низ файла.

## 4. Production API (как для Play)

```bash
npm run check:api -- https://tearz-chat-api.onrender.com
npx eas env:list --environment production
# нужно: EXPO_PUBLIC_COMPANION_CHAT_API_URL=https://tearz-chat-api.onrender.com
```

Без ngrok. OTP: Resend + подтверждённый домен (иначе письма только тебе).

## 5. Сборка AAB

```bash
# один раз — keystore через EAS
npx eas credentials --platform android

# релизный бандл для магазина
npx eas build --platform android --profile play
```

- Profile **`play`**: AAB + `autoIncrement` versionCode.
- Скачай `.aab` из [expo.dev](https://expo.dev) → Builds.

Для своей проверки на телефоне без магазина:

```bash
npx eas build --platform android --profile preview   # APK
```

## 6. Загрузка в RuStore

1. Консоль → приложение Tearz → **Версии** / **Загрузить сборку**.
2. Залей **AAB** (предпочтительно) или APK — смотри актуальные требования RuStore.
3. **AAB: ключ подписи** — RuStore требует сертификат той же подписи, что у AAB.  
   Файл из репо: `credentials/rustore-upload-cert.pem` (или `.cer`).  
   В форме нажми **Загрузить** рядом с «Ключ подписи не загружен» / раздел **Подпись приложения**.  
   Пересобрать сертификат из скачанного AAB:
   ```bash
   unzip -p path/to/app.aab 'META-INF/*.RSA' > /tmp/sig.rsa
   openssl pkcs7 -inform DER -in /tmp/sig.rsa -print_certs -out credentials/rustore-upload-cert.pem
   ```
4. Заполни карточку версии + витрину.
5. Отправь на **модерацию**.

Подпись: EAS App Signing / upload key — тот же keystore, что для Play (один package = один signing identity). Не теряй credentials (приватный keystore — только через `eas credentials`, в git не класть).

## 7. Биллинг (не сейчас)

v1 без подписок и IAP — **не** подключай RuStore Billing, пока не будет phase 2 (как в `PUBLIC_RELEASE.md`).

## 8. QA перед модерацией (Android)

- [ ] Установка AAB/APK на реальное устройство
- [ ] Регистрация: код на email приходит
- [ ] Хаб, урок (arcade/ATM), тренировка (сборка / перенос слов)
- [ ] Микрофон / камера / галерея по запросу
- [ ] Профиль → Политика / Условия открываются
- [ ] Выход из аккаунта
- [ ] Нет краша на холодном старте после перезапуска

## 9. Черновик текстов для витрины

**Кратко (≈80 символов):**  
Изучай языки с Tearz — пиксельный компаньон, уроки и тренировки.

**Полное:**  
Tearz — приложение для изучения языков с маскотом Tearz. Короткие уроки у «терминалов» мира, тренировки на сборку предложений и перетаскивание слов, прогресс и коллекция. Вход по email-коду. Без обязательной подписки в первой версии.

**Что нового (1.0.0):**  
Первый релиз в RuStore.

---

## Связанные команды

| Команда | Назначение |
|---------|------------|
| `npm run finish:rustore` | Проверки + сборка AAB |
| `npm run build:play` | Только `eas build` AAB |
| `npm run build:apk` | APK для себя |
| `npm run finish:play` | То же + submit в Google Play |
