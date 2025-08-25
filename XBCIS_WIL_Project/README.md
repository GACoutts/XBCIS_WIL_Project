# XBCIS_WIL_Project
XBCIS Work Integrated Learning. Building management system for Rawson

To use firebase
- First off you need to import the config file under src/XBCIS_WIL_PROJECT/firebaseConfig.js
- Firebase doesnt use sql however we can save the data as if it were in an sql database so thats not an issue

Example
//The import of firebaseConfig
import { db } from "./firebaseConfig";

import { collection, addDoc, serverTimestamp } from "firebase/firestore";

// Example: adding a new ticket
async function addTicket() {
  try {
    const docRef = await addDoc(collection(db, "tickets"), {
      title: "Login Bug",
      description: "User cannot log in with Google auth.",
      priority: "High",
      status: "Open",
      created_at: serverTimestamp()
    });

    console.log("✅ Ticket added with ID: ", docRef.id);
  } catch (e) {
    console.error("❌ Error adding ticket: ", e);
  }
}

addTicket();
