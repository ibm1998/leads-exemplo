import * as admin from 'firebase-admin';
import { config } from './environment';

const rawJson = config.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawJson) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT_JSON não definida');
  process.exit(1);
}


let serviceAccount: any;
try {
  serviceAccount = JSON.parse(rawJson);
  // Corrige as quebras de linha do private_key, se necessário
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    // Garante compatibilidade com o tipo do SDK
    serviceAccount.privateKey = serviceAccount.private_key;
  } else if (serviceAccount.privateKey) {
    serviceAccount.privateKey = serviceAccount.privateKey.replace(/\\n/g, '\n');
  }
} catch (err) {
  console.error('❌ JSON inválido em FIREBASE_SERVICE_ACCOUNT_JSON:', err);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: config.FIREBASE_DATABASE_URL,
});

export { admin };
