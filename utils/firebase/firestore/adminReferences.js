import admin from "../firebaseAdmin";

const db = admin.firestore();

// Example collection reference
export const docRef = () => db.collection("example").doc("example");

// Add more references as needed