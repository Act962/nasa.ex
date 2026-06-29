#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# migrate-production.sh
# Aplica migrations pendentes no banco Neon (produção).
# Execute no servidor ou localmente com acesso ao Neon:
#   bash scripts/migrate-production.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   NASA EX — Migration Produção (Neon)    ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Garante que usa o .env principal (Neon), não o .env.local
if [ -f ".env.local" ]; then
  echo "⚠ .env.local detectado — usando .env (Neon) para esta migration."
  echo ""
fi

# Carrega DATABASE_URL do .env principal
export $(grep -v '^#' .env | grep DATABASE_URL | xargs)

if [ -z "$DATABASE_URL" ]; then
  echo "✗ DATABASE_URL não encontrada no .env"
  exit 1
fi

echo "▸ Banco alvo: ${DATABASE_URL%%@*}@***"
echo ""
echo "▸ Verificando conexão..."
npx prisma db ping 2>/dev/null || true

echo "▸ Aplicando migrations..."
npx prisma migrate deploy

echo "▸ Gerando Prisma Client..."
npx prisma generate

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   ✓ Migrations aplicadas em produção!    ║"
echo "╚══════════════════════════════════════════╝"
echo ""
