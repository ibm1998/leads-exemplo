import * as admin from 'firebase-admin';
import { config } from './environment';

const rawJson = config.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawJson) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT_JSON não definida');
  process.exit(1);
}

let serviceAccount: admin.ServiceAccount;
try {
  serviceAccount = JSON.parse(rawJson);
} catch (err) {
  console.error('❌ JSON inválido em FIREBASE_SERVICE_ACCOUNT_JSON:', err);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: config.FIREBASE_DATABASE_URL,
});

export { admin };
