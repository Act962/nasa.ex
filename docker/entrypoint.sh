#!/bin/sh
# Migra o banco e sobe o servidor. Se a migration falhar o container sai com erro,
# nunca fica healthy e o Coolify mantém a versão anterior no ar.
set -e

# A migração usa a conexão direta: via PgBouncer (pool por transação) o advisory lock
# do `migrate deploy` expira (P1002). Sem DIRECT_URL, cai no DATABASE_URL.
MIGRATE_DATABASE_URL="${DIRECT_URL:-$DATABASE_URL}"
MAX_MIGRATE_ATTEMPTS=3
attempt=1

echo "[entrypoint] prisma migrate deploy"
until (cd /migrator && DATABASE_URL="$MIGRATE_DATABASE_URL" node_modules/.bin/prisma migrate deploy); do
	if [ "$attempt" -ge "$MAX_MIGRATE_ATTEMPTS" ]; then
		echo "[entrypoint] migration falhou após $MAX_MIGRATE_ATTEMPTS tentativas"
		exit 1
	fi
	attempt=$((attempt + 1))
	echo "[entrypoint] nova tentativa ($attempt/$MAX_MIGRATE_ATTEMPTS) em 5 s"
	sleep 5
done

echo "[entrypoint] iniciando servidor"
exec node server.js
