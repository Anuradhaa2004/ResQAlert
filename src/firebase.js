import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase } from "firebase/database";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyDIDic2ejf30MxVWb82no8tlWdSjItsTPw",
    authDomain: "resqalert-f8c76.firebaseapp.com",
    databaseURL: "https://resqalert-f8c76-default-rtdb.firebaseio.com",
    projectId: "resqalert-f8c76",
    storageBucket: "resqalert-f8c76.firebasestorage.app",
    messagingSenderId: "527771237650",
    appId: "1:527771237650:web:8c14fa79891a6f495bc7cb",
    measurementId: "G-DHSSMFNL41"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const database = getDatabase(app);
const auth = getAuth(app);

// Explicitly ensure persistence is set to browserLocalPersistence (IndexedDB / LocalStorage)
// This guarantees the user stays logged in even when reopening the installed PWA
setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn("Firebase Auth persistence notice:", err);
});

export { app, database, auth, analytics };