#!/bin/bash

echo "🔍 Testando conexão com Neon..."
echo "Database URL: ${DATABASE_URL:0:50}..."

# Tentar conectar com psql
if command -v psql &> /dev/null; then
  echo "✅ psql encontrado"
  psql "$DATABASE_URL" -c "SELECT 1;" && echo "✅ Conexão bem-sucedida!" || echo "❌ Falha na conexão"
else
  echo "❌ psql não instalado"
  echo "Tente: brew install postgresql@16"
fi
