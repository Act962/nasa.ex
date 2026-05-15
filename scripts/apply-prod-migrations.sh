#!/usr/bin/env bash
# ============================================================
# Apply Astro Command + Alerts migrations + seed to a target DB.
# Idempotente — pode rodar várias vezes sem duplicar nada.
#
# Uso:
#   DATABASE_URL=postgres://user:pass@host:5432/db \
#     ./scripts/apply-prod-migrations.sh
#
# Pré-requisitos no host onde for executar:
#   - psql (PostgreSQL client) instalado
#   - Node + pnpm (pra rodar o seed via tsx)
#   - Permissões de DDL no DB (CREATE TABLE, ALTER TABLE)
#
# Aplica em ordem:
#   1. MANUAL_alerts_foundation.sql   (AlertRule, AlertDispatch, AdminNotification++)
#   2. MANUAL_form_completed_at.sql   (FormResponses.completed_at)
#   3. seed-alert-rules.ts            (5 regras default globais)
#
# Verifica ao final se tabelas/colunas existem antes de declarar sucesso.
# ============================================================

set -euo pipefail

# ── Cores ────────────────────────────────────────────────────────────
RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; BLUE=$'\033[34m'; RESET=$'\033[0m'
log() { echo "${BLUE}[migrate]${RESET} $*"; }
ok()  { echo "${GREEN}[ ok ]${RESET} $*"; }
warn() { echo "${YELLOW}[warn]${RESET} $*"; }
err() { echo "${RED}[fail]${RESET} $*" >&2; }

# ── Validação ────────────────────────────────────────────────────────
if [[ -z "${DATABASE_URL:-}" ]]; then
  err "DATABASE_URL não setado. Exporte com:"
  err '  export DATABASE_URL="postgres://user:pass@host:5432/db"'
  exit 1
fi

# Detecta psql disponível. Se não, tenta usar o container Docker
# "nasa-db" como fallback (útil em dev no Mac onde Postgres roda
# em Docker e psql nativo pode não estar instalado).
PSQL_CMD=()
if command -v psql >/dev/null 2>&1; then
  PSQL_CMD=(psql "$DATABASE_URL")
elif docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^nasa-db$'; then
  warn "psql nativo não encontrado — usando container nasa-db como fallback"
  # Reescreve a URL pra usar localhost interno do container
  INTERNAL_URL="${DATABASE_URL//@localhost/@127.0.0.1}"
  PSQL_CMD=(docker exec -i -e PGPASSWORD=docker nasa-db psql -U docker -d nasa_db)
  # Nesse modo, a URL é ignorada e usa-se a env do container
else
  err "psql não está instalado e container nasa-db não está rodando."
  err "  Mac: brew install postgresql@17"
  err "  Linux: apt install postgresql-client"
  exit 1
fi

# Confirma com o user antes de tocar um DB potencialmente prod.
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+).*|\1|')
log "DB alvo: ${DB_HOST}"
log "Vai aplicar 2 migrations SQL + rodar seed de regras default."
read -rp "Confirma (digite 'yes' pra continuar): " confirm
if [[ "$confirm" != "yes" ]]; then
  warn "Abortado pelo usuário."
  exit 1
fi

# Helper wrapper pra rodar SQL via psql nativo ou docker exec
run_sql() {
  local sql_file="$1"
  if [[ "${PSQL_CMD[0]}" == "docker" ]]; then
    cat "$sql_file" | "${PSQL_CMD[@]}" -v ON_ERROR_STOP=1
  else
    "${PSQL_CMD[@]}" -v ON_ERROR_STOP=1 -f "$sql_file"
  fi
}
run_query() {
  local query="$1"
  "${PSQL_CMD[@]}" -At -c "$query"
}

# ── 1. MANUAL_alerts_foundation.sql ──────────────────────────────────
log "1/3 aplicando MANUAL_alerts_foundation.sql..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
run_sql "$PROJECT_ROOT/prisma/migrations/MANUAL_alerts_foundation.sql"
ok "alerts foundation aplicada"

# ── 2. MANUAL_form_completed_at.sql ──────────────────────────────────
log "2/3 aplicando MANUAL_form_completed_at.sql..."
run_sql "$PROJECT_ROOT/prisma/migrations/MANUAL_form_completed_at.sql"
ok "form completed_at aplicado"

# ── 3. Verifica schema antes de seedar ───────────────────────────────
log "verificando schema..."
RESULT=$(run_query "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='alert_rule')")
if [[ "$RESULT" != "t" ]]; then
  err "alert_rule não existe após migration. Algo deu errado."
  exit 1
fi
RESULT=$(run_query "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='form_responses' AND column_name='completed_at')")
if [[ "$RESULT" != "t" ]]; then
  err "form_responses.completed_at não existe após migration."
  exit 1
fi
ok "schema validado"

# ── 4. Seed das 5 regras default ─────────────────────────────────────
log "3/3 rodando seed de 5 regras default (idempotente via upsert)..."
cd "$PROJECT_ROOT"

# Garante que o Prisma Client está atualizado com o schema novo
# antes do seed. Em prod isso pode ser pulado se já foi rodado.
if [[ "${SKIP_PRISMA_GENERATE:-false}" != "true" ]]; then
  log "rodando pnpm db:generate (pode pular com SKIP_PRISMA_GENERATE=true)..."
  pnpm db:generate >/dev/null
fi

pnpm exec tsx prisma/seed-alert-rules.ts

# ── 5. Validação final ───────────────────────────────────────────────
RULES_COUNT=$(run_query "SELECT COUNT(*) FROM alert_rule WHERE created_by='SYSTEM'")
ok "seed concluído — ${RULES_COUNT} regras default presentes"

echo ""
ok "Tudo aplicado com sucesso 🎉"
echo ""
echo "Próximos passos (ver DEPLOYMENT.md):"
echo "  - Subir container Piper TTS (docker compose -f base -f prod up piper -d)"
echo "  - Setar NEXT_PUBLIC_PIPER_ENABLED=true + PIPER_HTTP_URL no host do app"
echo "  - Registrar /api/inngest no Inngest Cloud"
