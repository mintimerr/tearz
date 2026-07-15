#!/usr/bin/env bash
set -euo pipefail

IN="${1:?Укажите путь к видео-клипу}"
END="${2:-2.35}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/assets/images/tearz-teacher-hero.webp"
SRC="$ROOT/assets/video/tearz-teacher-book-source.mp4"
TMP_RAW="$(mktemp -d)"
TMP_CROP="$(mktemp -d)"
trap 'rm -rf "$TMP_RAW" "$TMP_CROP"' EXIT

if [ "$(cd "$(dirname "$IN")" && pwd)/$(basename "$IN")" != "$SRC" ]; then
  cp "$IN" "$SRC"
fi

W=360

# До зума (~2.4s), срезаем правый край (водяной знак Kling)
ffmpeg -y -i "$IN" -t "$END" -vf "fps=24,crop=iw-300:ih:0:0" "$TMP_RAW/frame_%04d.png"

export PYTHONPATH="$ROOT/scripts${PYTHONPATH:+:$PYTHONPATH}"

python3 "$ROOT/scripts/crop-teacher-hero-frames.py" \
  "$TMP_RAW" "$TMP_CROP" "$W" 20 36 0.94

read -r CW CH < "$TMP_CROP/_canvas.txt"
COUNT="$(ls "$TMP_CROP"/frame_*.png | wc -l | tr -d ' ')"

ffmpeg -y -framerate 24 -start_number 1 -i "$TMP_CROP/frame_%04d.png" \
  -frames:v "$COUNT" \
  -an -loop 0 -c:v libwebp -lossless 0 -q:v 84 -compression_level 5 -preset picture \
  "$OUT"

echo "canvas ${CW}x${CH} frames=$COUNT duration=${END}s"
echo "Готово → $OUT"
