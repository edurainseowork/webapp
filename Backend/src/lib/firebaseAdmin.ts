import { initializeApp, getApps, cert } from 'firebase-admin/app';
import fs from 'fs';
import path from 'path';

// Initialize Firebase Admin (Only once)
if (!getApps().length) {
  const serviceAccountPath = path.resolve(process.cwd(), 'firebase-service-account.json');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    initializeApp({
      credential: cert(serviceAccount),
    });
  } else {
    // ponytail: fallback to projectId when service account json is omitted for local dev
    const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'edurain-pvt';
    initializeApp({ projectId });
  }
}

export { getAuth } from 'firebase-admin/auth';