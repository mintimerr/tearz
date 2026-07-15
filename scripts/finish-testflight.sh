#!/bin/bash
# Один раз в обычном Terminal (не в Cursor) — настроит Apple credentials и соберёт TestFlight.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== 1. Xcode license (если спросит пароль — введи пароль Mac) ==="
sudo xcodebuild -license accept 2>/dev/null || true

echo ""
echo "=== 2. API через ngrok (Mac + server должны быть включены) ==="
npm run release:api-url

echo ""
echo "=== 3. Сборка iOS + Apple credentials (ответь на вопросы в терминале) ==="
EAS_NO_VCS=1 npx eas build --platform ios --profile testflight

echo ""
echo "=== 4. Отправка в TestFlight ==="
npx eas submit --platform ios --latest

echo ""
echo "✓ Готово! App Store Connect → TestFlight"
