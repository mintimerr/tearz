#!/bin/zsh
set -e
SRC=""
for p in \
  "$HOME/Downloads/rivemcp-macos-arm64" \
  "$HOME/Desktop/rivemcp-macos-arm64" \
  "$HOME/Downloads/rivemcp" \
  ; do
  if [[ -f "$p" ]]; then SRC="$p"; break; fi
done
if [[ -z "$SRC" ]]; then
  echo "Не найден скачанный файл. Скачай:"
  echo "  https://github.com/paradoxsyn/rivemcp-releases/releases/download/v1.8.2/rivemcp-macos-arm64"
  echo "в Downloads, потом снова: bash tools/install-rivemcp.sh"
  exit 1
fi
DEST="$HOME/cortex-mobile/tools/node_modules/rivemcp/bin/rivemcp"
mkdir -p "$(dirname "$DEST")"
cp "$SRC" "$DEST"
chmod +x "$DEST"
xattr -d com.apple.quarantine "$DEST" 2>/dev/null || true
ls -lh "$DEST"
file "$DEST"
echo "OK — теперь Cmd+Q Cursor и открой снова. Напиши: rivemcp готов"
