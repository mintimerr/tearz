# Public release — Tearz (iOS + Android)

Soft launch checklist for App Store and Google Play. **v1.0 non-goals:** IAP/subscriptions, remote push (APNs/FCM), unfinished world locations, server-synced coins/streak.

## 1. Production API (required)

Use a permanent **HTTPS** URL (Render / Railway / VPS). Do **not** ship ngrok.

```bash
# Deploy backend (example: Render Blueprint)
# render.yaml → New Blueprint → set OPENAI_API_KEY, RESEND_API_KEY, AUTH_FROM_EMAIL

# Health check
npm run check:api -- https://YOUR-API.example.com

# EAS env (production)
eas env:create --name EXPO_PUBLIC_COMPANION_CHAT_API_URL \
  --value https://YOUR-API.example.com \
  --environment production
```

Resend must use a **verified domain** so OTP emails reach any tester/user (free Resend without a domain only delivers to the account owner).

Local / TestFlight tunnel docs: [TESTFLIGHT.md](./TESTFLIGHT.md) (ngrok is OK for closed beta only).

## 2. Legal URLs (required by stores)

Defaults in app: `https://tearz.app/privacy` and `https://tearz.app/terms`.

Source HTML to host:

- [docs/legal/privacy.html](./legal/privacy.html)
- [docs/legal/terms.html](./legal/terms.html)

Override if needed:

```bash
eas env:create --name EXPO_PUBLIC_PRIVACY_URL --value https://… --environment production
eas env:create --name EXPO_PUBLIC_TERMS_URL --value https://… --environment production
```

In App Store Connect / Play Console paste the same Privacy Policy URL. Fill App Privacy / Data safety using the HTML policy.

## 3. Product rules for v1

| Area | Behavior |
|------|----------|
| Worlds | Only Yokocho Arcade + Berlin ATM rotate |
| Plus | Unlock **1 day** with coins only (no fake subscription price) |
| Rewards | See `constants/reward-rules.ts` + Profile → Reward rules |
| Economy | Local AsyncStorage (not server-authoritative) |

## 4. Build & submit

```bash
npm run check:api -- https://YOUR-API.example.com
npm run build:all          # eas build --platform all --profile production
npm run submit:ios
npm run submit:android     # Play track: internal / draft (see eas.json)
```

Needs: Apple Developer ($99), Google Play Console, EAS login (`npx eas login`).

## 5. QA checklist

- [ ] `GET /health` → 200 on production URL
- [ ] Sign-up: email code arrives (Resend + verified domain)
- [ ] Welcome legal links open Terms + Privacy
- [ ] Profile → Terms / Privacy open same URLs
- [ ] Hub shows coins, daily goal, streak (localized)
- [ ] Start → arcade or ATM → lesson → reward overlay (XP/coins/streak)
- [ ] Cards session awards coins; drill awards per correct
- [ ] Asteroids grants coins; Plus day unlock works; **no** “499 ₽ / Подписка скоро”
- [ ] Collection shelf visible in Profile
- [ ] Sign out works
- [ ] iOS + Android production builds install from TestFlight / internal track

## 6. After 1.0 (phase 2)

- StoreKit / Play Billing (RevenueCat)
- Remote push tokens
- More terminal locations
- Server sync for engagement
- Crash analytics (Sentry)
