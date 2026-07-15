#!/bin/bash
# Один запуск в Terminal.app — всё остальное автоматизировано.
# Потребуется: пароль Mac (лицензия Xcode) + Apple ID (сертификаты EAS).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "━━━ Tearz → TestFlight ━━━"
echo ""

if ! git rev-parse --show-toplevel &>/dev/null 2>&1; then
  echo "→ Лицензия Xcode (один раз, введите пароль Mac):"
  sudo xcodebuild -license accept
fi

echo "→ Сервер + публичный URL API…"
node scripts/release-testflight.mjs --no-build

echo ""
echo "→ Apple-сертификаты (ответьте на вопросы — логин Apple ID, EAS создаст всё сам):"
EAS_NO_VCS=1 npx eas credentials:configure-build -p ios -e testflight

echo ""
echo "→ Сборка iOS в облаке EAS (~15–25 мин)…"
EAS_NO_VCS=1 npx eas build --platform ios --profile testflight

echo ""
read -r -p "Загрузить в TestFlight? [Y/n] " ans
if [[ ! "$ans" =~ ^[Nn] ]]; then
  EAS_NO_VCS=1 npx eas submit --platform ios --latest
  echo ""
  echo "✓ Готово! App Store Connect → TestFlight → добавьте тестеров."
else
  echo "Сборка на expo.dev — submit позже: npm run submit:ios"
fi
