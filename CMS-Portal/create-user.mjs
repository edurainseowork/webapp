import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';

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

const email = process.env.USER_EMAIL || process.argv[2];
const password = process.env.USER_PASSWORD || process.argv[3];

if (!email || !password) {
  console.error('Usage: node create-user.mjs <email> <password>');
  process.exit(1);
}

createUserWithEmailAndPassword(auth, email, password)
  .then((userCredential) => {
    console.log('Successfully created user:', userCredential.user.email);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error creating user:', error.code);
    if (error.code === 'auth/email-already-in-use') {
      console.log('User already exists. Trying to login with provided password...');
      signInWithEmailAndPassword(auth, email, password)
        .then(() => {
          console.log('Login successful! Password is correct.');
          process.exit(0);
        })
        .catch((err) => {
          console.error('Login failed! The password must be something else.', err.code);
          process.exit(1);
        });
    } else {
      process.exit(1);
    }
  });
