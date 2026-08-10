#!/bin/bash
# Один раз в обычном Terminal.app (не в Cursor) после покупки Apple Developer ($99).
# Предусловия уже сделаны: Render API + EAS production URLs на https://tearz-chat-api.onrender.com
set -euo pipefail
cd "$(dirname "$0")/.."

echo "━━━ Tearz → TestFlight ━━━"
echo "Нужен активный Apple Developer Program ($99/год)."
echo ""

echo "=== 1. Xcode license (если спросит — пароль Mac) ==="
sudo xcodebuild -license accept 2>/dev/null || true

echo ""
echo "=== 2. Проверка production API (HTTPS, не ngrok) ==="
API_URL="$(npx eas env:list --environment production 2>/dev/null | sed -n 's/^EXPO_PUBLIC_COMPANION_CHAT_API_URL=//p' | head -1 || true)"
API_URL="${API_URL:-https://tearz-chat-api.onrender.com}"
if [[ "${API_URL}" == *ngrok* ]]; then
  echo "EAS production всё ещё на ngrok: ${API_URL}"
  echo "Выставь Render URL в EAS (docs/TESTFLIGHT.md) и повтори."
  exit 1
fi
echo "API: ${API_URL}"
# Free Render cold-start: пару попыток
ok=0
for _ in 1 2 3 4 5; do
  if npm run check:api -- "${API_URL}"; then
    ok=1
    break
  fi
  echo "API ещё просыпается (free Render)…"
  sleep 8
done
if [[ "$ok" -ne 1 ]]; then
  echo "API не отвечает. Dashboard: https://dashboard.render.com"
  exit 1
fi

echo ""
echo "=== 3. Apple credentials (логин Apple ID в терминале) ==="
EAS_NO_VCS=1 npx eas credentials:configure-build -p ios -e testflight

echo ""
echo "=== 4. Сборка iOS в EAS (~15–25 мин) ==="
EAS_NO_VCS=1 npx eas build --platform ios --profile testflight

echo ""
echo "=== 5. Submit в TestFlight ==="
npx eas submit --platform ios --latest --profile testflight

echo ""
echo "✓ Готово → App Store Connect → TestFlight → добавь тестеров."
echo "Почта OTP: без своего домена в Resend коды приходят только на email аккаунта Resend."
