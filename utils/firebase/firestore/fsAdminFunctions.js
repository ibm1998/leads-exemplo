import admin from "../firebaseAdmin";
import { docRef } from "./adminReferences";

const db = admin.firestore(); // mostly for transactions or batches

// Note: Do not use these references for client!
// Only use in getStaticProps / getStaticPaths / etc.
export const getDoc = async () => {
  try {
    const doc = await docRef().get();
    if (doc.exists) {
      return doc.data();
    }
    return null;
  } catch (error) {
    console.error("Error getting document:", error);
    return null;
  }
};