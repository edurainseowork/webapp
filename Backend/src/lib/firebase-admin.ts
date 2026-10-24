import { initializeApp, getApps, cert, type ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";
import path from "path";

// Credentials come from FIREBASE_SERVICE_ACCOUNT (the JSON as a string, for Lambda / CI)
// or from firebase-service-account.json next to the process (local dev). Never commit either.
function loadServiceAccount(): ServiceAccount | null {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (fromEnv) {
    try {
      return JSON.parse(fromEnv) as ServiceAccount;
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT:", e);
    }
  }
  const possiblePaths = [
    path.resolve(process.cwd(), "firebase-service-account.json"),
    path.resolve(process.cwd(), "Backend", "firebase-service-account.json"),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, "utf8")) as ServiceAccount;
      } catch (e) {
        console.error(`Failed to parse ${p}:`, e);
      }
    }
  }
  return null;
}

if (!getApps().length) {
  const sa = loadServiceAccount();
  if (sa) {
    initializeApp({ credential: cert(sa) });
  } else {
    // ponytail: fallback to projectId when service account json is omitted for local dev
    const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "edurain-pvt";
    initializeApp({ projectId });
  }
}

export const firebaseAuth = getAuth();
