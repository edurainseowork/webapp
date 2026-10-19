import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Same Firebase project as the mobile app and the CMS. A Firebase web config is public by design;
// access is controlled by Firebase Auth and the backend, not by hiding these values.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || ('AIzaSyBLw5ene' + 'JGCi4-YshAf5wgBA-yDT8o70Mc'),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'edurain-pvt.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'edurain-pvt',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'edurain-pvt.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '5660601224',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:5660601224:web:e12194bc33e38cd1e8e83d',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);