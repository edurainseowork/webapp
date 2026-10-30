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

import readline from 'readline';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const adminEmail = process.env.ADMIN_EMAIL || process.argv[2];

if (!adminEmail) {
  console.error('Usage: ADMIN_PASSWORD=<password> node create-admin.mjs <email>');
  console.error('Note: Setting ADMIN_PASSWORD via environment variable or entering it interactively');
  console.error('is required so the password is not exposed in shell history or process listings.');
  process.exit(1);
}

async function getPassword() {
  if (process.env.ADMIN_PASSWORD) {
    return process.env.ADMIN_PASSWORD;
  }
  if (!process.stdin.isTTY) {
    console.error('Error: ADMIN_PASSWORD environment variable is required in non-interactive environments.');
    process.exit(1);
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question('Enter admin password: ', (ans) => {
      rl.close();
      if (!ans) {
        console.error('Error: Password cannot be empty.');
        process.exit(1);
      }
      resolve(ans);
    });
  });
}

getPassword().then((adminPassword) => {
  createUserWithEmailAndPassword(auth, adminEmail, adminPassword)
    .then((userCredential) => {
      console.log('Successfully created admin user:', userCredential.user.email);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error creating user:', error);
      process.exit(1);
    });
});
