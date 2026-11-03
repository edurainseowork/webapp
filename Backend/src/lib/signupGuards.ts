/** Rules that keep OTP sign-up from touching an account the caller does not own. */

const lastTen = (value: unknown) => String(value ?? '').replace(/\D/g, '').slice(-10);

/**
 * MSG91 verifyAccessToken answers with the number the OTP went to (e.g. "919876543210").
 * False when that number is not the one in the sign-up form. A reply without a number
 * (unexpected format) is left to the caller to log.
 */
export const otpNumberMatches = (verifiedMessage: unknown, submittedPhone: unknown) => {
  const verified = lastTen(verifiedMessage);
  return verified.length < 10 || verified === lastTen(submittedPhone);
};

export const otpReplyHasNumber = (verifiedMessage: unknown) => lastTen(verifiedMessage).length === 10;

/**
 * Email or number already registered: the caller proved they own the number, so only the
 * account on that number may be updated, and only if the email is free or already that account's.
 * Returns the uid to update, or null for "already exists, please log in".
 */
export const accountToUpdate = <T extends { uid: string }>(
  byPhone: T | null,
  byEmail: T | null,
  isPrivileged: (account: T) => boolean,
): string | null => {
  if (!byPhone || isPrivileged(byPhone)) return null;
  if (byEmail && byEmail.uid !== byPhone.uid) return null;
  return byPhone.uid;
};
