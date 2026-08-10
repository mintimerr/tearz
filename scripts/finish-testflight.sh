#!/bin/bash
# Один раз в обычном Terminal (не в Cursor) — настроит Apple credentials и соберёт TestFlight.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== 1. Xcode license (если спросит пароль — введи пароль Mac) ==="
sudo xcodebuild -license accept 2>/dev/null || true

echo ""
echo "=== 2. Проверка production API (HTTPS, не ngrok) ==="
API_URL="$(npx eas env:get --name EXPO_PUBLIC_COMPANION_CHAT_API_URL --environment production --format plain 2>/dev/null || true)"
if [[ -z "${API_URL}" ]]; then
  # fallback: read from list
  API_URL="$(npx eas env:list --environment production 2>/dev/null | sed -n 's/^EXPO_PUBLIC_COMPANION_CHAT_API_URL=//p' | head -1)"
fi
if [[ -z "${API_URL}" ]] || [[ "${API_URL}" == *ngrok* ]]; then
  echo "EAS production всё ещё на ngrok/пустой URL: ${API_URL:-<empty>}"
  echo "Сначала: node scripts/deploy-render.mjs  →  выставь Render URL в EAS (см. docs/TESTFLIGHT.md)."
  exit 1
fi
npm run check:api -- "${API_URL}"

echo ""
echo "=== 3. Сборка iOS + Apple credentials (ответь на вопросы в терминале) ==="
EAS_NO_VCS=1 npx eas build --platform ios --profile testflight --non-interactive

echo ""
echo "=== 4. Отправка в TestFlight ==="
npx eas submit --platform ios --latest --non-interactive

echo ""
echo "✓ Готово! App Store Connect → TestFlight"
