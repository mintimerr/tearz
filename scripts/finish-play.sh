#!/bin/bash
# Google Play Internal testing — не трогает iOS / TestFlight.
# Запуск в обычном Terminal.app: npm run finish:play
set -euo pipefail
cd "$(dirname "$0")/.."

echo "━━━ Tearz → Google Play (internal) ━━━"
echo "Нужен Google Play Console (~\$25 разово) + аккаунт в EAS."
echo ""

API_URL="$(npx eas env:list --environment production 2>/dev/null | sed -n 's/^EXPO_PUBLIC_COMPANION_CHAT_API_URL=//p' | head -1 || true)"
API_URL="${API_URL:-https://tearz-chat-api.onrender.com}"
PRIVACY_URL="${EXPO_PUBLIC_PRIVACY_URL:-https://tearz-chat-api.onrender.com/privacy}"
TERMS_URL="${EXPO_PUBLIC_TERMS_URL:-https://tearz-chat-api.onrender.com/terms}"

if [[ "${API_URL}" == *ngrok* ]]; then
  echo "EAS production всё ещё на ngrok: ${API_URL}"
  echo "Выставь постоянный HTTPS (Render) и повтори. См. docs/PLAY.md"
  exit 1
fi

echo "=== 1. Проверка API / legal ==="
echo "API:     ${API_URL}"
echo "Privacy: ${PRIVACY_URL}"
echo "Terms:   ${TERMS_URL}"

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

code_p="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "${PRIVACY_URL}" || true)"
code_t="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "${TERMS_URL}" || true)"
if [[ "${code_p}" != "200" || "${code_t}" != "200" ]]; then
  echo "Legal URL не отдают 200 (privacy=${code_p} terms=${code_t})."
  echo "Play Console требует рабочий Privacy Policy URL."
  exit 1
fi

echo ""
echo "=== 2. Android credentials (keystore через EAS, один раз) ==="
EAS_NO_VCS=1 npx eas credentials --platform android

echo ""
echo "=== 3. Сборка AAB (profile play) ==="
EAS_NO_VCS=1 npx eas build --platform android --profile play

echo ""
echo "=== 4. Submit → Play internal (draft) ==="
echo "Нужен service account JSON или логин в браузере (eas submit спросит)."
npx eas submit --platform android --latest --profile play

echo ""
echo "✓ Готово → Play Console → Testing → Internal testing"
echo "  Добавь тестеров по email / ссылке."
echo "  Документация: docs/PLAY.md"
