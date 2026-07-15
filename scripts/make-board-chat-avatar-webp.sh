#!/usr/bin/env bash
# Анимированный аватар Tearz для чата доски — тот же 3D-персонаж, что на обложке.
#
# Приоритет источника:
#   1. assets/video/tearz-board-teacher-source.mp4  (Kling: у доски, как на cover)
#   2. assets/video/tearz-teacher-book-source.mp4   (fallback — та же модель)
#
# Использование:
#   ./scripts/make-board-chat-avatar-webp.sh [video] [duration_sec]
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/assets/images/tearz-board-chat-avatar.webp"
BOARD_SRC="$ROOT/assets/video/tearz-board-teacher-source.mp4"
BOOK_SRC="$ROOT/assets/video/tearz-teacher-book-source.mp4"
IN="${1:-}"
END="${2:-2.35}"

if [ -z "$IN" ]; then
  if [ -f "$BOARD_SRC" ]; then
    IN="$BOARD_SRC"
  else
    IN="$BOOK_SRC"
  fi
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Кроп лица — подстроено под Kling 1764×1176; для board-clip может понадобиться другой crop.
CROP="crop=620:620:560:60"

ffmpeg -y -i "$IN" -t "$END" -vf "fps=20,${CROP},scale=256:256:flags=lanczos" "$TMP/frame_%04d.png"

COUNT="$(ls "$TMP"/frame_*.png | wc -l | tr -d ' ')"

ffmpeg -y -framerate 20 -start_number 1 -i "$TMP/frame_%04d.png" \
  -frames:v "$COUNT" \
  -an -loop 0 -c:v libwebp -lossless 0 -q:v 84 -compression_level 5 -preset picture \
  "$OUT"

echo "source=$IN frames=$COUNT → $OUT"
echo ""
echo "Подключено автоматически в tearz-board-chat-avatar-source.ts"
