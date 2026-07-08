#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_DIR="$ROOT/.local"
DB_PATH="$DB_DIR/atlas-dev.sqlite"

mkdir -p "$DB_DIR"
rm -f "$DB_PATH"

sqlite3 "$DB_PATH" < "$ROOT/packages/db/migrations/001_initial_schema.sql"
sqlite3 "$DB_PATH" < "$ROOT/packages/db/seeds/001_fake_portfolio.sql"

echo "Base SQLite fictive créée : $DB_PATH"
echo
echo "Tables :"
sqlite3 "$DB_PATH" ".tables"
echo
echo "Aperçu patrimoine :"
sqlite3 -header -column "$DB_PATH" < "$ROOT/packages/db/queries/portfolio_overview.sql"
