import admin from '@/firebase-admin';
import { docRef } from '@/FS-admin-refs';

const db = admin.firestore(); 


export const getDoc = async () => {
  const doc = await docRef().get();
  if (doc.exists) {
    return doc.data();
  }
  return null;
};
