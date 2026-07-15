#!/usr/bin/env bash
# Собирает зацикленный WebP для Tearz у доски из видео-клипа (Kling / 3D-рендер).
#
# Пример промпта для Kling (3–5 с, loop-friendly):
#   «3D cyan round mascot teacher, pointing at whiteboard with pencil,
#    cartoon squash-and-stretch, blinks, breathes, subtle point emphasis,
#    full body, clean white background, no watermark, camera locked»
#
# Использование:
#   ./scripts/make-board-teacher-webp.sh path/to/clip.mp4 [duration_sec]
#
set -euo pipefail

IN="${1:?Укажите путь к видео-клипу}"
END="${2:-4.5}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/assets/images/tearz-board-teacher.webp"
SRC="$ROOT/assets/video/tearz-board-teacher-source.mp4"
TMP_RAW="$(mktemp -d)"
TMP_CROP="$(mktemp -d)"
trap 'rm -rf "$TMP_RAW" "$TMP_CROP"' EXIT

if [ "$(cd "$(dirname "$IN")" && pwd)/$(basename "$IN")" != "$SRC" ]; then
  cp "$IN" "$SRC"
fi

# Шире, чем hero с книгой — персонаж у доски крупнее и выше.
W=480

# Срезаем правый край (водяной знак Kling), 24 fps.
ffmpeg -y -i "$IN" -t "$END" -vf "fps=24,crop=iw-300:ih:0:0" "$TMP_RAW/frame_%04d.png"

export PYTHONPATH="$ROOT/scripts${PYTHONPATH:+:$PYTHONPATH}"

python3 "$ROOT/scripts/crop-teacher-hero-frames.py" \
  "$TMP_RAW" "$TMP_CROP" "$W" 28 48 0.94

read -r CW CH < "$TMP_CROP/_canvas.txt"
COUNT="$(ls "$TMP_CROP"/frame_*.png | wc -l | tr -d ' ')"

ffmpeg -y -framerate 24 -start_number 1 -i "$TMP_CROP/frame_%04d.png" \
  -frames:v "$COUNT" \
  -an -loop 0 -c:v libwebp -lossless 0 -q:v 86 -compression_level 5 -preset picture \
  "$OUT"

echo "canvas ${CW}x${CH} frames=$COUNT duration=${END}s"
echo "Готово → $OUT"
echo ""
echo "Подключи ассет в components/teacher/tearz-board-hero-source.ts:"
echo "  export const TEARZ_BOARD_HERO_WEBP = require('../../assets/images/tearz-board-teacher.webp');"
