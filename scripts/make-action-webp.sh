#!/usr/bin/env bash
#
# Превращает видео-клип (mp4/mov/webm) в зацикленный анимированный WebP
# для экрана «Генерируем тренировку» (components/teacher/teacher-exercise-generating.tsx).
#
# Экран генерации имеет ЧЁРНЫЙ фон (#000000), поэтому клип кладётся на чёрный
# фон — прозрачность не нужна. Делайте клипы изначально на чёрном фоне.
#
# Использование:
#   scripts/make-action-webp.sh <input-video> <computer|book|build>
#
# Примеры:
#   scripts/make-action-webp.sh ~/Downloads/typing.mp4 computer
#   scripts/make-action-webp.sh ~/Downloads/reading.mov book
#   scripts/make-action-webp.sh ~/Downloads/hammer.webm build
#
# После запуска перезапустите приложение — анимация подхватится автоматически.

set -euo pipefail

IN="${1:?Укажите путь к видео-клипу}"
NAME="${2:?Укажите действие: computer | book | build}"

case "$NAME" in
  computer|book|build) ;;
  *) echo "Действие должно быть одним из: computer | book | build"; exit 1 ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/assets/images/tearz-act-$NAME.webp"

# fps 24, квадрат 512x512, центрируем на чёрном фоне, бесконечный цикл.
ffmpeg -y -i "$IN" \
  -vf "fps=24,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black" \
  -loop 0 -an -c:v libwebp -q:v 78 -compression_level 6 -preset picture \
  "$OUT"

echo "Готово → $OUT"
echo "Перезапустите приложение, чтобы увидеть анимацию."
