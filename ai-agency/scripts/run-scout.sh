#!/bin/bash
# Roda Scout diariamente via cron
# Crontab: 0 9 * * * /path/to/ai-agency/scripts/run-scout.sh

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

# Carrega variáveis de ambiente
if [ -f "$ROOT_DIR/.env" ]; then
    source "$ROOT_DIR/.env"
fi

# Roda para os dois nichos — 50 perfis por keyword
python scripts/scout.py --niche all --limit 50 --min-score 5

# Log
echo "[$(date)] Scout finalizado" >> state/scout.log