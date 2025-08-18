// Simula envio de payload para agentes
const fs = require('fs');
const path = require('path');
const payloadFile = process.argv.find(arg => arg.startsWith('--payloadFile='));
if (!payloadFile) {
  console.error('Uso: node agent-test.js --payloadFile=examples/leadPayload.json');
  process.exit(1);
}
const filePath = payloadFile.split('=')[1];
if (!fs.existsSync(filePath)) {
  console.error('Arquivo de payload não encontrado:', filePath);
  process.exit(2);
}
const payload = JSON.parse(fs.readFileSync(filePath));
console.log('Simulando processamento do lead:', payload);
console.log('Lead processed by AgentName');
