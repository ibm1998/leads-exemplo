
#!/usr/bin/env bash

# Carrega e exporta todas as variáveis definidas em .env
if [ -f .env ]; then
  set -o allexport
  source .env
  set +o allexport
fi

# Testa conexão ao Postgres usando psql
if [ -z "$POSTGRES_URL" ]; then
  echo "POSTGRES_URL não definida no ambiente."
  exit 1
fi
PGURL="$POSTGRES_URL"
psql "$PGURL" -c '\q' 2>/dev/null

if [ $? -eq 0 ]; then
  echo "Connected to leads database"
  exit 0
else
  echo "Failed to connect to leads database"
  exit 2
fi
