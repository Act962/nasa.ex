#!/bin/sh
# Migra o banco e sobe o servidor. Se a migration falhar o container sai com erro,
# nunca fica healthy e o Coolify mantém a versão anterior no ar.
set -e

echo "[entrypoint] prisma migrate deploy"
(cd /migrator && node_modules/.bin/prisma migrate deploy)

echo "[entrypoint] iniciando servidor"
exec node server.js
