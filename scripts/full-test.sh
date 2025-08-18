#!/bin/bash
# Teste integrado do projeto
set -e
bash ./scripts/db-check.sh
node ./scripts/agent-test.js --payloadFile=examples/leadPayload.json
# Adicione outros testes aqui
echo "SUCCESS: Todos os testes automáticos executados."
