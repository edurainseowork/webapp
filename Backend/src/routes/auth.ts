import { Router, Request, Response } from 'express';
import axios from 'axios';
import { getAuth } from '../lib/firebaseAdmin.js';
import type { UserRecord } from 'firebase-admin/auth';
import { authenticateToken, extractUserRole } from '../middleware/auth';
import { firebaseAuth } from '../lib/firebase-admin';
import { rateLimit } from '../middlewares/security';
import { hasPrivilegedClaims, isSuperAdminEmail, isSuperAdminToken } from '../lib/superAdmin';
import { deskRoleFromClaims } from '../lib/deskRoles';
import { emailDispatchQueue } from '../lib/perfEngine';
import { accountToUpdate, otpNumberMatches, otpReplyHasNumber } from '../lib/signupGuards';
import { db } from '@workspace/db';
import { usersTable } from '@workspace/db/schema';
import { eq } from 'drizzle-orm';

export const authRouter = Router();

// Strict brute-force rate limiter for sensitive auth & OTP routes (10 attempts per 15 minutes by IP AND Email/Phone)
const authStrictLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  algorithm: 'sliding-window',
  keyStrategy: 'ip+identifier',
  keyPrefix: 'rl:auth-strict',
  message: 'Too many authentication attempts, please try again after 15 minutes',
});

// Staff accounts (Super Admin, admins, faculty, mentors, teacher assistance) can't be taken over by app sign-up
const isPrivilegedAccount = (user: UserRecord) =>
  hasPrivilegedClaims(user.customClaims) || !!deskRoleFromClaims(user.customClaims) || isSuperAdminEmail(user.email);
const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY || '';
const ACCOUNT_EXISTS_CODES = new Set(['auth/email-already-exists', 'auth/email-already-in-use', 'auth/phone-number-already-exists']);

/**
 * Asks MSG91 whether an OTP access token is genuine. On success `number` is what MSG91 says the
 * OTP was sent to (e.g. "919876543210"); on failure `error` is safe to show to the user.
 */
async function verifyMsg91Token(accessToken: string): Promise<{ number: unknown } | { error: string }> {
  try {
    const verifyResponse = await axios.post(
      'https://control.msg91.com/api/v5/widget/verifyAccessToken',
      { authkey: MSG91_AUTH_KEY, 'access-token': accessToken },
      { headers: { 'Content-Type': 'application/json' }, timeout: 4000 }
    );
    if (verifyResponse.data?.type === 'error') {
      return { error: verifyResponse.data.message || 'Invalid Access Token' };
    }
    return { number: verifyResponse.data?.message };
  } catch (msg91Error: any) {
    console.error('MSG91 Verify Error:', msg91Error?.response?.data || msg91Error.message);
    return { error: 'Failed to verify OTP with MSG91' };
  }
}

/**
 * GET /api/auth/me — Return authenticated user profile and resolved RBAC role
 */
authRouter.get('/me', authenticateToken, async (req: Request, res: Response): Promise<any> => {
  const role = extractUserRole(req);
  res.json({
    success: true,
    user: {
      id: req.user?.id,
      firebaseUid: req.firebaseUid || req.auth?.uid,
      email: req.user?.email || req.auth?.email,
      name: req.user?.name || req.auth?.name,
      role,
      isAdminOrFaculty: role === 'admin' || role === 'faculty',
      // Decided here from the verified token; the CMS only uses it to show or hide controls
      isSuperAdmin: isSuperAdminToken(req.auth),
      superAdminEmailUnverified: isSuperAdminEmail(req.auth?.email) && req.auth?.email_verified !== true,
    },
  });
});

/**
 * POST /api/auth/cms-handoff — an admin, faculty member or mentor who signed in on the study website
 * gets a short-lived Firebase custom token, so the CMS (a different site, with its own Firebase
 * session) can sign them in without a second login. The role is read from the verified token and
 * the database, never from the request. Mentors still only get the Mentor Desk in the CMS.
 */
const CMS_HANDOFF_ROLES = new Set(['admin', 'faculty', 'mentor', 'teacher_assistant']);
authRouter.post('/cms-handoff', rateLimit({ windowMs: 60_000, max: 10 }), authenticateToken, async (req: Request, res: Response): Promise<any> => {
  const role = extractUserRole(req);
  if (!CMS_HANDOFF_ROLES.has(role)) {
    return res.status(403).json({ error: 'This account has no CMS access' });
  }
  const token = await firebaseAuth.createCustomToken(req.auth!.uid);
  res.json({ token });
});

authRouter.post('/verify-otp-and-signup', authStrictLimiter, async (req: Request, res: Response): Promise<any> => {
  try {
    const { name, email, password, phone, accessToken } = req.body;
    if (!phone || !accessToken || !email || !password || !name) {
      return res.status(400).json({ error: 'All fields (name, email, password, phone, accessToken) are required' });
    }

    const verified = await verifyMsg91Token(accessToken);
    if ('error' in verified) {
      return res.status(400).json({ error: verified.error });
    }
    // The token proves who owns the number MSG91 sent the OTP to, not the number in the form
    if (!otpNumberMatches(verified.number, phone)) {
      return res.status(400).json({ error: 'OTP was verified for a different mobile number. Please verify this number again.' });
    }
    if (!otpReplyHasNumber(verified.number)) {
      console.warn('MSG91 verifyAccessToken reply has no mobile number; number match skipped');
    }
    // App sign-up must never take over a CMS account (Super Admin, admins, faculty)
    if (isSuperAdminEmail(email)) {
      return res.status(409).json({ error: 'An account with this email already exists. Please log in.' });
    }

    // Create or Update user in Firebase with Email, Password, and Phone Number
    const phoneWithCode = phone.startsWith('+') ? phone : `+91${phone}`;
    try {
      await getAuth().createUser({
        email: email.trim(),
        password: password,
        phoneNumber: phoneWithCode,
        displayName: name.trim()
      });
    } catch (error: any) {
      if (!ACCOUNT_EXISTS_CODES.has(error.code)) {
        return res.status(400).json({ error: error.message || 'Failed to create user in Firebase' });
      }
      // Already registered: only the account on the verified number may be updated
      const [byPhone, byEmail] = await Promise.all([
        getAuth().getUserByPhoneNumber(phoneWithCode).catch(() => null),
        getAuth().getUserByEmail(email.trim()).catch(() => null),
      ]);
      const uid = accountToUpdate(byPhone, byEmail, isPrivilegedAccount);
      if (!uid) {
        return res.status(409).json({ error: 'An account with this email or phone number already exists. Please log in.' });
      }
      await getAuth().updateUser(uid, {
        email: email.trim(),
        password: password,
        displayName: name.trim()
      });
    }

    res.json({ success: true, message: 'User created successfully' });
  } catch (error: any) {
    console.error('Error verifying OTP and signing up:', error.message);
    res.status(500).json({ error: 'Failed to sign up' });
  }
});

/**
 * POST /api/auth/change-phone { phone, accessToken } — the signed-in user moves their login number
 * to a new one they just verified with an OTP. A number already on another account is refused.
 */
authRouter.post('/change-phone', authStrictLimiter, authenticateToken, async (req: Request, res: Response): Promise<any> => {
  const digits = String(req.body?.phone ?? '').replace(/\D/g, '').slice(-10);
  const accessToken = req.body?.accessToken;
  if (!/^[6-9][0-9]{9}$/.test(digits) || typeof accessToken !== 'string' || !accessToken) {
    return res.status(400).json({ error: 'Enter a valid 10-digit mobile number and verify it with the OTP.' });
  }

  const verified = await verifyMsg91Token(accessToken);
  if ('error' in verified) {
    return res.status(400).json({ error: verified.error });
  }
  // Here the number in MSG91's reply is required: it is the only proof of who received the OTP
  if (!otpReplyHasNumber(verified.number) || !otpNumberMatches(verified.number, digits)) {
    console.warn('change-phone: MSG91 reply did not confirm the number', { reply: typeof verified.number });
    return res.status(400).json({ error: 'OTP was verified for a different mobile number. Please verify this number again.' });
  }

  const uid = req.auth!.uid;
  const phoneWithCode = `+91${digits}`;
  const owner = await getAuth().getUserByPhoneNumber(phoneWithCode).catch(() => null);
  if (owner && owner.uid !== uid) {
    return res.status(409).json({ error: 'This number is already linked to another EduRain account.' });
  }
  if (!owner) {
    try {
      await getAuth().updateUser(uid, { phoneNumber: phoneWithCode });
    } catch (err: any) {
      // Someone else claimed the number between our check and this write
      if (err?.code === 'auth/phone-number-already-exists') {
        return res.status(409).json({ error: 'This number is already linked to another EduRain account.' });
      }
      throw err;
    }
  }
  if (req.user?.id) {
    await db.update(usersTable).set({ phone: digits, updatedAt: new Date() }).where(eq(usersTable.id, req.user.id));
  }
  res.json({ success: true, phone: digits });
});

authRouter.post('/get-email-by-phone', authStrictLimiter, async (req: Request, res: Response): Promise<any> => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });

    const phoneWithCode = `+91${phone}`;
    const userRecord = await getAuth().getUserByPhoneNumber(phoneWithCode);

    if (userRecord.email) {
      res.json({ success: true, email: userRecord.email });
    } else {
      res.status(404).json({ error: 'No email associated with this phone number' });
    }
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      res.status(404).json({ error: 'No account found with this phone number' });
    } else {
      console.error('Error fetching user by phone:', error.message);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  }
});

authRouter.post('/send-password-reset', authStrictLimiter, async (req: Request, res: Response): Promise<any> => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Fetch user name from Firebase
    let userName = "Student";
    try {
      const userRecord = await getAuth().getUserByEmail(email);
      if (userRecord.displayName) {
        userName = userRecord.displayName;
      }
    } catch (e) {
      console.error('User not found by email for name resolution:', e);
    }

    // Generate Firebase Password Reset Link
    const actionCodeSettings = { url: 'https://edurain-pvt.web.app/login' };
    const link = await getAuth().generatePasswordResetLink(email, actionCodeSettings);

    // Send `link` to user via MSG91 Email API using background queue with exponential backoff
    const emailPayload = {
      from: { email: "support@edurain.in", name: "Edurain" },
      domain: "edurain.in",
      template_id: "password_3",
      recipients: [
        {
          to: [{ email: email, name: userName }],
          variables: {
            "reset_link": link,
            "user_name": userName
          }
        }
      ]
    };

    const minuteBucket = Math.floor(Date.now() / 60_000);
    await emailDispatchQueue.add(
      "password-reset-email",
      {
        userIdOrEmail: String(email).trim().toLowerCase(),
        subject: "Password Reset",
        sendFn: async () => {
          await axios.post('https://control.msg91.com/api/v5/email/send', emailPayload, {
            headers: {
              'authkey': MSG91_AUTH_KEY,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          });
        },
      },
      {
        jobId: `pwd-reset:${String(email).trim().toLowerCase()}:${minuteBucket}`,
        attempts: 3,
        backoffDelayMs: 1000,
      }
    );

    res.json({ success: true, message: 'Password reset link queued for delivery' });
  } catch (error: any) {
    console.error('Error sending reset email:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to send reset link via email' });
  }
});
