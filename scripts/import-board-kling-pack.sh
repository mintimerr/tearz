#!/usr/bin/env bash
# Импорт пачки Kling-клипов после скачивания в ~/Downloads.
#
# Использование:
#   ./scripts/import-board-kling-pack.sh
#   ./scripts/import-board-kling-pack.sh ~/Downloads/kling-write-a.mp4 ~/Downloads/kling-write-b.mp4 ...
#
# Без аргументов ищет в ~/Downloads:
#   *write*a*.mp4 *write*b*.mp4 *write*c*.mp4 *erase*.mp4
#   или один общий write (как kling_20260712_VIDEO_EXACT_same_5033_0.mp4) → все три варианта.
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DL="${HOME}/Downloads"
DUR_WRITE="${DUR_WRITE:-0.24}"
START_WRITE="${START_WRITE:-0.82}"
DUR_ERASE="${DUR_ERASE:-0.28}"
START_ERASE="${START_ERASE:-0.9}"

run_write() {
  local mode="$1"
  local file="$2"
  echo "→ $mode from $file"
  "$ROOT/scripts/make-board-activity-webp.sh" "$file" "$mode" "$DUR_WRITE" "$START_WRITE"
}

run_erase() {
  local file="$1"
  echo "→ erase from $file"
  "$ROOT/scripts/make-board-activity-webp.sh" "$file" erase "$DUR_ERASE" "$START_ERASE"
}

# Idle PNG из первого кадра write-a
refresh_idle() {
  ROOT="$ROOT" python3 - <<'PY'
from PIL import Image
import os
root = os.environ["ROOT"]
webp = os.path.join(root, "assets/images/tearz-board-write-a.webp")
out = os.path.join(root, "assets/board-concept/tearz-board-write-idle.png")
if os.path.isfile(webp):
    im = Image.open(webp)
    im.seek(0)
    im.save(out)
    print("idle →", out)
PY
}

if [ "$#" -ge 1 ]; then
  for f in "$@"; do
    base="$(basename "$f" | tr '[:upper:]' '[:lower:]')"
    if [[ "$base" == *erase* ]]; then
      run_erase "$f"
    elif [[ "$base" == *write*b* ]] || [[ "$base" == *stroke*b* ]]; then
      run_write write-b "$f"
    elif [[ "$base" == *write*c* ]] || [[ "$base" == *stroke*c* ]]; then
      run_write write-c "$f"
    elif [[ "$base" == *write*a* ]] || [[ "$base" == *stroke*a* ]]; then
      run_write write-a "$f"
    else
      run_write write "$f"
      run_write write-a "$f"
      run_write write-b "$f"
      run_write write-c "$f"
    fi
  done
  refresh_idle
  exit 0
fi

WRITE_A="$(find "$DL" -maxdepth 1 -iname '*write*a*.mp4' -o -iname '*stroke*a*.mp4' 2>/dev/null | head -1)"
WRITE_B="$(find "$DL" -maxdepth 1 -iname '*write*b*.mp4' -o -iname '*stroke*b*.mp4' 2>/dev/null | head -1)"
WRITE_C="$(find "$DL" -maxdepth 1 -iname '*write*c*.mp4' -o -iname '*stroke*c*.mp4' 2>/dev/null | head -1)"
ERASE="$(find "$DL" -maxdepth 1 -iname '*erase*.mp4' 2>/dev/null | head -1)"
FALLBACK="$(find "$DL" -maxdepth 1 -iname 'kling*.mp4' 2>/dev/null | head -1)"

if [ -n "$WRITE_A" ]; then run_write write-a "$WRITE_A"; fi
if [ -n "$WRITE_B" ]; then run_write write-b "$WRITE_B"; fi
if [ -n "$WRITE_C" ]; then run_write write-c "$WRITE_C"; fi

if [ -z "$WRITE_A" ] && [ -z "$WRITE_B" ] && [ -z "$WRITE_C" ] && [ -n "$FALLBACK" ]; then
  echo "Один write-клип → a/b/c + default"
  run_write write "$FALLBACK"
  run_write write-a "$FALLBACK"
  run_write write-b "$FALLBACK"
  run_write write-c "$FALLBACK"
fi

if [ -n "$ERASE" ]; then run_erase "$ERASE"; fi

refresh_idle

echo ""
echo "Готово. Перезагрузи приложение."
