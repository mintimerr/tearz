#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo "→ API :8787"
if ! curl -sS -m 1 http://127.0.0.1:8787/health >/dev/null; then
  (cd server && npm start) >/tmp/tearz-api.log 2>&1 &
  sleep 1
fi
echo "→ ngrok"
if ! curl -sS -m 1 http://127.0.0.1:4040/api/tunnels >/dev/null 2>&1; then
  ngrok http 8787 >/tmp/ngrok-tearz.log 2>&1 &
  sleep 2
fi
URL=$(python3 -c "import json,urllib.request; d=json.load(urllib.request.urlopen('http://127.0.0.1:4040/api/tunnels')); print(next(t['public_url'] for t in d['tunnels'] if t['public_url'].startswith('https')))")
echo "→ API public: $URL"
# sync .env
python3 - <<PY
from pathlib import Path
url="$URL"
p=Path(".env"); lines=p.read_text().splitlines() if p.exists() else []
keys={
  "EXPO_PUBLIC_COMPANION_CHAT_API_URL": url,
  "EXPO_PUBLIC_PRIVACY_URL": url+"/privacy",
  "EXPO_PUBLIC_TERMS_URL": url+"/terms",
}
out=[]; seen=set()
for line in lines:
  k=line.split("=",1)[0] if "=" in line else None
  if k in keys:
    out.append(f"{k}={keys[k]}"); seen.add(k)
  else:
    out.append(line)
for k,v in keys.items():
  if k not in seen: out.append(f"{k}={v}")
p.write_text("\n".join(out)+"\n")
PY
echo "→ Expo (tunnel) — на телефоне: Expo Go → Scan QR"
exec npx expo start --tunnel --port 8081
