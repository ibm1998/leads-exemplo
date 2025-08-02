<<<<<<< HEAD
import admin from "../firebaseAdmin";

const db = admin.firestore();

// Example collection reference
export const docRef = () => db.collection("example").doc("example");

// Add more references as needed
=======
import admin from "@/firebase-admin";

// firestore references used for server

// Note:
// These should be used in getStaticProps, getStaticPaths, etc.
// Do not use these for client!
export const docRef = () =>
  admin.firestore().collection("example").doc("yfvafvaf445");
>>>>>>> d420466e54a991fe6bafba4bc9825fa68b0808dc
