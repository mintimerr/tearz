#!/bin/bash
# RuStore PEPK — из EAS keystore → pepk_out.zip
# Запуск в Terminal.app после:
#   1) RuStore модалка → Скачать pepk.jar → положи в ~/Downloads/rustore-pepk/
#   2) expo.dev → Credentials → Android → Download Keystore
#      (обычно zip с .jks/.keystore + credentials.json)
set -euo pipefail

DIR="${HOME}/Downloads/rustore-pepk"
mkdir -p "$DIR"
cd "$DIR"

ENC="0000bc0a12a93503e423c5b8cd986d3818afb317d21cfdcba9f2578a13e099914bfe13b8776dc5ea8f9e9efe4397b057972111eb635ca3d91ebc5301a4fdef8ccfadd99b"

if [[ ! -f pepk.jar ]]; then
  echo "Нет pepk.jar в $DIR"
  echo "В модалке RuStore нажми «Скачать» и положи файл сюда."
  exit 1
fi

# Java
if ! java -version >/dev/null 2>&1; then
  echo "Нет Java. Установи: brew install --cask temurin"
  exit 1
fi

# Find keystore
KS=""
for f in "$DIR"/*.jks "$DIR"/*.keystore ~/Downloads/*.jks ~/Downloads/*.keystore; do
  [[ -f "$f" ]] || continue
  KS="$f"
  break
done

if [[ -z "$KS" ]]; then
  echo "Не найден .jks/.keystore"
  echo "Скачай: https://expo.dev/accounts/mitya66789/projects/tearz-mobile/credentials"
  echo "Android → Download Keystore → распакуй в $DIR"
  exit 1
fi

# Alias / passwords from credentials.json if present
ALIAS=""
KS_PASS=""
KEY_PASS=""
CRED_JSON=""
for j in "$DIR"/credentials.json "$(dirname "$KS")/credentials.json"; do
  [[ -f "$j" ]] || continue
  CRED_JSON="$j"
  break
done

if [[ -n "$CRED_JSON" ]] && command -v python3 >/dev/null; then
  eval "$(python3 - "$CRED_JSON" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
ks = d.get("keystore") if isinstance(d.get("keystore"), dict) else d
alias = ks.get("keyAlias") or ks.get("alias") or d.get("keyAlias") or ""
ksp = ks.get("keystorePassword") or d.get("keystorePassword") or ""
kp = ks.get("keyPassword") or d.get("keyPassword") or ksp
print("ALIAS=" + repr(alias))
print("KS_PASS=" + repr(ksp))
print("KEY_PASS=" + repr(kp))
PY
)"
fi

if [[ -z "${ALIAS}" ]]; then
  echo "Keystore: $KS"
  read -r -p "Alias (из Expo credentials): " ALIAS
fi
if [[ -z "${KS_PASS}" ]]; then
  read -r -s -p "Keystore password: " KS_PASS; echo
fi
if [[ -z "${KEY_PASS}" ]]; then
  KEY_PASS="$KS_PASS"
fi

OUT="$DIR/pepk_out.zip"
echo "→ pepk: $KS alias=$ALIAS → $OUT"

# pepk prompts for passwords if not passed; feed via expect-like printf if supported
# Official pepk reads passwords interactively — use printf pipe
printf '%s\n%s\n' "$KS_PASS" "$KEY_PASS" | java -jar pepk.jar \
  --keystore "$KS" \
  --alias "$ALIAS" \
  --output "$OUT" \
  --encryptionkey="$ENC" \
  --include-cert

echo "OK: $OUT"
echo "В RuStore:"
echo "  3) ZIP → $OUT"
echo "  4) PEM → $HOME/Downloads/tearz-rustore-upload-cert.pem"
echo "  → Отправить ключ подписи"
