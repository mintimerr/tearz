#!/usr/bin/env bash
# Одно нажатие / одно стирание — короткий клип 150–250 ms (не loop).
# В ffmpeg ниже -loop 0 оставляем для WebP, но клип должен быть коротким —
# приложение перезапускает его на каждый pulse с клавиатуры.
#
# Промпты Kling (3–4 с, loop-friendly, камера зафиксирована):
#   write — «3D cyan round mascot at whiteboard, writing with orange marker,
#            arm moves across board, cartoon squash-and-stretch, white background»
#   erase — «same mascot erasing whiteboard with hand/eraser, wiping motion,
#            cartoon style, white background, camera locked»
#
# Использование:
#   ./scripts/make-board-activity-webp.sh path/to/clip.mp4 write|erase [duration_sec] [start_sec]
#
set -euo pipefail

IN="${1:?Укажите путь к видео}"
MODE="${2:?Укажите write или erase}"
END="${3:-3.8}"
START="${4:-0}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

case "$MODE" in
  write)
    OUT="$ROOT/assets/images/tearz-board-write.webp"
    SRC="$ROOT/assets/video/tearz-board-write-source.mp4"
    ;;
  write-a)
    OUT="$ROOT/assets/images/tearz-board-write-a.webp"
    SRC="$ROOT/assets/video/tearz-board-write-a-source.mp4"
    ;;
  write-b)
    OUT="$ROOT/assets/images/tearz-board-write-b.webp"
    SRC="$ROOT/assets/video/tearz-board-write-b-source.mp4"
    ;;
  write-c)
    OUT="$ROOT/assets/images/tearz-board-write-c.webp"
    SRC="$ROOT/assets/video/tearz-board-write-c-source.mp4"
    ;;
  erase)
    OUT="$ROOT/assets/images/tearz-board-erase.webp"
    SRC="$ROOT/assets/video/tearz-board-erase-source.mp4"
    ;;
  *)
    echo "Режим: write | write-a | write-b | write-c | erase" >&2
    exit 1
    ;;
esac

TMP_RAW="$(mktemp -d)"
TMP_CROP="$(mktemp -d)"
trap 'rm -rf "$TMP_RAW" "$TMP_CROP"' EXIT

if [ "$(cd "$(dirname "$IN")" && pwd)/$(basename "$IN")" != "$SRC" ]; then
  cp "$IN" "$SRC"
fi

W=480

if [[ "$MODE" == write* ]]; then
  # Персонаж справа — вырезаем только cyan Tearz, без доски.
  FFMPEG_VF="fps=24,crop=iw-300:ih:0:0,crop=620:ih:620:0"
  CROP_SCRIPT="$ROOT/scripts/crop-board-write-character.py"
  WRITE_TARGET_H=520
else
  FFMPEG_VF="fps=24,crop=iw-300:ih:0:0,crop=620:ih:620:0"
  CROP_SCRIPT="$ROOT/scripts/crop-board-write-character.py"
  WRITE_TARGET_H=520
fi

ffmpeg -y -ss "$START" -i "$IN" -t "$END" -vf "$FFMPEG_VF" "$TMP_RAW/frame_%04d.png"

export PYTHONPATH="$ROOT/scripts${PYTHONPATH:+:$PYTHONPATH}"

if [[ "$MODE" == write* ]]; then
  python3 "$CROP_SCRIPT" "$TMP_RAW" "$TMP_CROP" "$WRITE_TARGET_H"
else
  python3 "$CROP_SCRIPT" "$TMP_RAW" "$TMP_CROP" "$WRITE_TARGET_H"
fi

read -r CW CH < "$TMP_CROP/_canvas.txt"
COUNT="$(ls "$TMP_CROP"/frame_*.png | wc -l | tr -d ' ')"

ffmpeg -y -framerate 24 -start_number 1 -i "$TMP_CROP/frame_%04d.png" \
  -frames:v "$COUNT" \
  -an -loop 0 -c:v libwebp -lossless 1 -compression_level 4 -preset picture \
  "$OUT"

echo "canvas ${CW}x${CH} frames=$COUNT mode=$MODE duration=${END}s"
echo "Готово → $OUT"
echo ""
echo "Подключи в components/teacher/tearz-board-hero-source.ts:"
if [ "$MODE" = write ]; then
  echo "  export const TEARZ_BOARD_WRITE_WEBP = require('../../assets/images/tearz-board-write.webp');"
else
  echo "  export const TEARZ_BOARD_ERASE_WEBP = require('../../assets/images/tearz-board-erase.webp');"
fi
