// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAqYkIX8ZqQm8hePUzEcD6MF4abes_zJBo",
  authDomain: "curriculo-d1dc4.firebaseapp.com",
  databaseURL: "https://curriculo-d1dc4-default-rtdb.firebaseio.com",
  projectId: "curriculo-d1dc4",
  storageBucket: "curriculo-d1dc4.appspot.com",
  messagingSenderId: "659600241074",
  appId: "1:659600241074:web:9e73689cae7b1c37b3f4ab",
  measurementId: "G-179CEL84WJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
