/* ------------------------------------------------------------------ */
/*  Auth service (mock)                                                 */
/*                                                                      */
/*  Every function below simulates network latency and succeeds for     */
/*  any well-formed input, so the screens can be clicked through        */
/*  without a backend. Swap each body for the real call noted above it  */
/*  (endpoints live in Backend/src/routes/auth.ts).                     */
/*                                                                      */
/*  Demo-only: OTP "0000" (or "000000") is rejected, to preview the     */
/*  wrong-code state.                                                   */
/* ------------------------------------------------------------------ */

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

const wait = (ms = 900) => new Promise((resolve) => setTimeout(resolve, ms));

const nameFromEmail = (email: string) => {
  const handle = email.split('@')[0] ?? 'Student';
  return handle.charAt(0).toUpperCase() + handle.slice(1);
};

export const authService = {
  /**
   * Real flow:
   *  - Firebase setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence)
   *  - 10-digit phone → POST /api/auth/get-email-by-phone { phone } → { email }
   *  - then Firebase signInWithEmailAndPassword(auth, email, password)
   */
  async login(identifier: string, password: string, remember: boolean): Promise<AuthResult & { user?: AuthUser }> {
    await wait();
    const isPhone = /^\d{10}$/.test(identifier);
    const email = isPhone ? 'student@edurain.in' : identifier;
    return { ok: true, user: { name: nameFromEmail(email), email, phone: isPhone ? identifier : undefined } };
  },

  /**
   * Real flow: send the OTP through the MSG91 OTP widget for `91${phone}`
   * and keep its reqId for verification / retry.
   */
  async sendSignupOtp(phone: string): Promise<AuthResult> {
    await wait(700);
    return { ok: true };
  },

  /** Real flow: MSG91 widget retry for the same reqId. */
  async resendSignupOtp(phone: string): Promise<AuthResult> {
    await wait(700);
    return { ok: true };
  },

  /**
   * Real flow:
   *  - verify the code with the MSG91 widget → access token
   *  - POST /api/auth/verify-otp-and-signup { name, email, password, phone, accessToken }
   *  - then Firebase signInWithEmailAndPassword(auth, email, password)
   */
  async verifyOtpAndSignup(data: SignUpData, code: string): Promise<AuthResult & { user?: AuthUser }> {
    await wait();
    if (/^0+$/.test(code)) {
      return { ok: false, error: 'Incorrect OTP. Please check the code and try again.' };
    }
    return { ok: true, user: { name: data.name, email: data.email, phone: data.phone } };
  },

  /** Real flow: POST /api/auth/send-password-reset { email } */
  async sendPasswordReset(email: string): Promise<AuthResult> {
    await wait();
    return { ok: true };
  },

  /**
   * Real flow: Firebase confirmPasswordReset(auth, oobCode, newPassword).
   * The oobCode arrives on the reset link (?mode=resetPassword&oobCode=…)
   * once Firebase's action URL points at this app.
   */
  async confirmPasswordReset(oobCode: string, newPassword: string): Promise<AuthResult> {
    await wait();
    return { ok: true };
  },
};
