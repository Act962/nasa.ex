#!/usr/bin/env bash
# Confere o secret NEXT_PUBLIC_ENV antes do build: lista as chaves (sem valores) e falha
# em segundos se faltar alguma que o build exige, em vez de quebrar minutos depois.
# Grava o conteúdo em PUBLIC_ENV_FILE para o build (via `secret-files`: o input `secrets`
# do build-push-action lê uma entrada por linha e descartaria tudo depois da primeira).
set -euo pipefail

REQUIRED_KEYS=(NEXT_PUBLIC_APP_URL NEXT_PUBLIC_PUSHER_APP_KEY NEXT_PUBLIC_PUSHER_CLUSTER)

normalized_env=$(printf '%s\n' "${PUBLIC_ENV:-}" | tr -d '\r')

echo "Chaves recebidas em NEXT_PUBLIC_ENV:"
printf '%s\n' "$normalized_env" | grep -oE '^[[:space:]]*(export[[:space:]]+)?[A-Za-z0-9_]+[[:space:]]*=' \
  | sed -E 's/^[[:space:]]*(export[[:space:]]+)?//; s/[[:space:]]*=$//' | sort || echo "  (nenhuma)"

has_missing_key=0
for key in "${REQUIRED_KEYS[@]}"; do
  value=$(printf '%s\n' "$normalized_env" \
    | sed -nE "s/^[[:space:]]*(export[[:space:]]+)?${key}[[:space:]]*=[[:space:]]*//p" | tail -1 | tr -d "\"' ")
  if [ -z "$value" ]; then
    echo "::error::${key} ausente ou vazia no secret NEXT_PUBLIC_ENV (formato: ${key}=valor, uma por linha)"
    has_missing_key=1
  fi
done

if [ -n "${PUBLIC_ENV_FILE:-}" ]; then
  printf '%s
' "$normalized_env" > "$PUBLIC_ENV_FILE"
fi

exit "$has_missing_key"
