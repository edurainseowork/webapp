import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "edurain-pvt.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "edurain-pvt",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "edurain-pvt.firebasestorage.app",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "5660601224",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:5660601224:web:e12194bc33e38cd1e8e83d",
};

if (!firebaseConfig.apiKey) {
  console.error('Error: VITE_FIREBASE_API_KEY environment variable is required.');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const adminEmail = process.env.ADMIN_EMAIL || process.argv[2];
const adminPassword = process.env.ADMIN_PASSWORD || process.argv[3];

if (!adminEmail || !adminPassword) {
  console.error('Usage: node create-admin.mjs <email> <password>');
  process.exit(1);
}

createUserWithEmailAndPassword(auth, adminEmail, adminPassword)
  .then((userCredential) => {
    console.log('Successfully created admin user:', userCredential.user.email);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error creating user:', error);
    process.exit(1);
  });
