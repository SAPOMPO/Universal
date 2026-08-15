import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, update, push, onValue, child, serverTimestamp, onDisconnect } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCfyAeiuw65_Pi3P0TDntFkqb7lgbPT7tM",
  authDomain: "universal-3d40a.firebaseapp.com",
  projectId: "universal-3d40a",
  storageBucket: "universal-3d40a.firebasestorage.app",
  messagingSenderId: "828271151150",
  appId: "1:828271151150:web:d729fb8dcae3556d1077bf",
  measurementId: "G-J8QZZHNSP7"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, set, get, update, push, onValue, child, serverTimestamp, onDisconnect };