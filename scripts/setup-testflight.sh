#!/bin/bash
# Alias: то же, что npm run finish:testflight (после Apple Developer $99).
set -euo pipefail
cd "$(dirname "$0")/.."
exec bash scripts/finish-testflight.sh
