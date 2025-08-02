<<<<<<< HEAD
import admin from "../firebaseAdmin";
import { docRef } from "./adminReferences";
=======
import admin from "@/firebase-admin";
import { docRef } from "@/FS-admin-refs";
>>>>>>> d420466e54a991fe6bafba4bc9825fa68b0808dc

const db = admin.firestore(); // mostly for transactions or batches

// Note: Do not use these references for client!
// Only use in getStaticProps / getStaticPaths / etc.
export const getDoc = async () => {
<<<<<<< HEAD
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
=======
  const doc = await docRef().get();
  if (doc.exists) {
    return doc.data();
  }
  return null;
>>>>>>> d420466e54a991fe6bafba4bc9825fa68b0808dc
};