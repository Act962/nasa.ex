#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# setup-local.sh — Inicia PostgreSQL local e roda migrations pendentes
# Execute: bash scripts/setup-local.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"

DB_NAME="nasaex_dev"
DB_USER="nasaex"
DB_PASS="nasaex123"
PGDATA="$HOME/Library/Application Support/Postgres/var-18"
LOCAL_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   NASA EX — Banco Local                  ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── 1. Verificar Postgres.app ─────────────────────────────────────────────────
if ! command -v pg_ctl &>/dev/null; then
  echo "✗ Postgres.app não encontrado em /Applications."
  echo "  Baixe em: https://postgresapp.com"
  exit 1
fi

# ── 2. Inicializar data dir se necessário ─────────────────────────────────────
if [ ! -d "$PGDATA" ]; then
  echo "▸ Inicializando banco..."
  initdb -D "$PGDATA" --username="$(whoami)" --auth=trust
fi

# ── 3. Iniciar servidor se não estiver rodando ────────────────────────────────
if ! pg_isready -q 2>/dev/null; then
  echo "▸ Iniciando PostgreSQL..."
  pg_ctl -D "$PGDATA" -l "$HOME/Library/Application Support/Postgres/postgres.log" start
  sleep 2
fi
echo "✓ PostgreSQL rodando"

# ── 4. Criar usuário/banco se não existirem ───────────────────────────────────
psql postgres -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}' CREATEDB;" 2>/dev/null || true
psql postgres -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" 2>/dev/null || true
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" 2>/dev/null || true

# ── 5. Garantir DATABASE_URL local no .env ───────────────────────────────────
if grep -q "^DATABASE_URL=" .env; then
  sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=\"${LOCAL_URL}\"|" .env
else
  echo "DATABASE_URL=\"${LOCAL_URL}\"" >> .env
fi
echo "✓ .env aponta para banco local"

# ── 6. Rodar migrations pendentes ────────────────────────────────────────────
echo "▸ Rodando migrations..."
npx prisma migrate dev
npx prisma generate

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   ✓ Pronto! Rode: pnpm dev               ║"
echo "╚══════════════════════════════════════════╝"
echo ""
