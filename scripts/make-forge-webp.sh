#!/usr/bin/env bash
set -euo pipefail

IN="${1:?Укажите путь к видео-клипу}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/assets/images/tearz-forge.webp"
FINAL="$ROOT/assets/images/tearz-forge-final.png"
SRC="$ROOT/assets/video/tearz-forge-source.mp4"
TMP_RAW="$(mktemp -d)"
TMP_CROP="$(mktemp -d)"
trap 'rm -rf "$TMP_RAW" "$TMP_CROP"' EXIT

if [ "$(cd "$(dirname "$IN")" && pwd)/$(basename "$IN")" != "$SRC" ]; then
  cp "$IN" "$SRC"
fi

W=400

# Водяной знак Kling — только обрезка правого края, без замазывания
ffmpeg -y -i "$IN" -vf "fps=24,crop=iw-420:ih:0:0" "$TMP_RAW/frame_%04d.png"

export PYTHONPATH="$ROOT/scripts${PYTHONPATH:+:$PYTHONPATH}"

python3 "$ROOT/scripts/crop-forge-frames.py" \
  "$TMP_RAW" "$TMP_CROP" "$FINAL" "$W" 50 100 0.80 0

read -r CW CH < "$TMP_CROP/_canvas.txt"
COUNT="$(ls "$TMP_CROP"/frame_*.png | wc -l | tr -d ' ')"

ffmpeg -y -framerate 24 -start_number 1 -i "$TMP_CROP/frame_%04d.png" \
  -frames:v "$COUNT" \
  -an -loop 1 -c:v libwebp -lossless 0 -q:v 85 -compression_level 5 -preset picture \
  "$OUT"

echo "canvas ${CW}x${CH}"
echo "Готово → $OUT"
