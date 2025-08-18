
import admin from "@/firebase-admin";
import { docRef } from "./adminReferences";

const db = admin.firestore(); // Use para transações ou batches

// Não use essas referências no client! Apenas em getStaticProps/getStaticPaths/etc.
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
};