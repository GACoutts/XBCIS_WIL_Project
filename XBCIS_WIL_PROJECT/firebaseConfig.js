// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDOGrhK2-YtPiZgWL9-jGsLSXfGrNZe4ik",
  authDomain: "rawsoncloudstorage.firebaseapp.com",
  projectId: "rawsoncloudstorage",
  storageBucket: "rawsoncloudstorage.firebasestorage.app",
  messagingSenderId: "65886494589",
  appId: "1:65886494589:web:629a22e2cb5ae423e93614",
  measurementId: "G-MF6SW8K25F"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);