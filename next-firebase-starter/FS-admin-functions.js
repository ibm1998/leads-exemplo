import { adminDb } from './firebaseAdmin';

export async function getDoc() {
  // Exemplo: buscar todos os leads
  const snapshot = await adminDb.collection('leads').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
