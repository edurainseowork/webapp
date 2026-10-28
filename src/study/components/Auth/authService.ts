/* ------------------------------------------------------------------ */
/*  Auth service                                                        */
/*                                                                      */
/*  Firebase email/password sign-in plus the Edurain backend routes     */
/*  the mobile app uses (Backend/src/routes/auth.ts):                   */
/*   - login by email, or by 10-digit mobile via get-email-by-phone     */
/*   - sign-up: MSG91 OTP → verify-otp-and-signup → Firebase sign-in    */
/*   - forgot password: send-password-reset (emailed link)              */
/*   - reset password: Firebase confirmPasswordReset with the oobCode   */
/*  The signed-in session itself is tracked by AuthGate                 */
/*  (onAuthStateChanged), not here.                                     */
/* ------------------------------------------------------------------ */

import {
  browserLocalPersistence,
  browserSessionPersistence,
  confirmPasswordReset,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  verifyPasswordResetCode,
} from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { apiFetch, ApiError } from '../../lib/api';
import { resendSignupOtp, sendSignupOtp, verifySignupOtp } from './msg91';

export interface AuthResult {
  ok: boolean;
  error?: string;
}

export interface AuthUser {
  name: string;
  email: string;
  phone?: string;
}

export interface SignUpData {
  name: string;
  phone: string;
  email: string;
  password: string;
}

// Firebase error codes → messages a student can act on
const firebaseMessage = (err: unknown, fallback: string): string => {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Incorrect email/mobile number or password.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your internet connection and try again.';
    case 'auth/expired-action-code':
      return 'This reset link has expired. Request a new one.';
    case 'auth/invalid-action-code':
      return 'This reset link is invalid or was already used. Request a new one.';
    case 'auth/weak-password':
      return 'Please choose a stronger password.';
    default:
      return err instanceof Error && err.message && !code ? err.message : fallback;
  }
};

const fail = (err: unknown, fallback: string): AuthResult => ({ ok: false, error: firebaseMessage(err, fallback) });

const toAuthUser = (fallbackEmail: string, phone?: string): AuthUser => {
  const user = auth.currentUser;
  const email = user?.email ?? fallbackEmail;
  return { name: user?.displayName || email.split('@')[0], email, phone };
};

export const authService = {
  /** Email or 10-digit mobile number + password. `remember` keeps the session after the browser closes. */
  async login(identifier: string, password: string, remember: boolean): Promise<AuthResult & { user?: AuthUser }> {
    try {
      await setPersistence(auth, browserLocalPersistence);
      const isPhone = /^\d{10}$/.test(identifier);
      let email = identifier;
      if (isPhone) {
        try {
          const res = await apiFetch<{ email: string }>('/auth/get-email-by-phone', { body: { phone: identifier } });
          email = res.email;
        } catch (err) {
          if (err instanceof ApiError && err.status === 404) {
            return { ok: false, error: 'No account found with this mobile number.' };
          }
          throw err;
        }
      }
      await signInWithEmailAndPassword(auth, email, password);
      return { ok: true, user: toAuthUser(email, isPhone ? identifier : undefined) };
    } catch (err) {
      return fail(err, 'Could not log in. Please try again.');
    }
  },

  /** Step 1 of sign-up: text an OTP to the mobile number. */
  async sendSignupOtp(phone: string): Promise<AuthResult> {
    try {
      await sendSignupOtp(phone);
      return { ok: true };
    } catch (err) {
      return fail(err, 'Could not send the OTP. Please try again.');
    }
  },

  async resendSignupOtp(_phone: string): Promise<AuthResult> {
    try {
      await resendSignupOtp();
      return { ok: true };
    } catch (err) {
      return fail(err, 'Could not resend the OTP. Please try again.');
    }
  },

  /** Step 2: verify the OTP, create the account on the backend, then sign in with Firebase. */
  async verifyOtpAndSignup(data: SignUpData, code: string): Promise<AuthResult & { user?: AuthUser }> {
    let accessToken: string;
    try {
      accessToken = await verifySignupOtp(code);
    } catch (err) {
      return fail(err, 'Incorrect OTP. Please check the code and try again.');
    }
    try {
      await apiFetch('/auth/verify-otp-and-signup', {
        body: { name: data.name, email: data.email, password: data.password, phone: data.phone, accessToken },
      });
      await setPersistence(auth, browserLocalPersistence);
      await signInWithEmailAndPassword(auth, data.email, data.password);
      return { ok: true, user: toAuthUser(data.email, data.phone) };
    } catch (err) {
      return fail(err, 'Sign-up failed. Please try again.');
    }
  },

  /** Emails a reset link (the backend sends it with the Edurain template). */
  async sendPasswordReset(email: string): Promise<AuthResult> {
    try {
      await apiFetch('/auth/send-password-reset', { body: { email } });
      return { ok: true };
    } catch (err) {
      return fail(err, 'Could not send the reset link. Please try again.');
    }
  },

  /** Email address the reset link belongs to, or null when the link is invalid or expired. */
  async verifyResetCode(oobCode: string): Promise<string | null> {
    try {
      return await verifyPasswordResetCode(auth, oobCode);
    } catch {
      return null;
    }
  },

  /** Sets the new password from a reset link (?mode=resetPassword&oobCode=…). */
  async confirmPasswordReset(oobCode: string, newPassword: string): Promise<AuthResult> {
    if (!oobCode) return { ok: false, error: 'This reset link is invalid. Request a new one.' };
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      return { ok: true };
    } catch (err) {
      return fail(err, 'This reset link is invalid or has expired. Request a new one.');
    }
  },

  async logout(): Promise<void> {
    await signOut(auth);
  },
};