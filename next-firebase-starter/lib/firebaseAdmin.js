import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(
  fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8')
);

const adminApp = initializeApp({
  credential: cert(serviceAccount)
});

export const adminDb = getFirestore(adminApp);
