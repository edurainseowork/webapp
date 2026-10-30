import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Mask an email address for safe logging (e.g. "gauransh@example.com" ➔ "g***@example.com")
 */
export function maskEmail(email?: string | null): string {
  if (!email || typeof email !== "string") return "";
  const parts = email.split("@");
  if (parts.length !== 2) return "***";
  const user = parts[0];
  const domain = parts[1];
  const maskedUser = user.length > 2 ? `${user[0]}***${user[user.length - 1]}` : `${user[0]}***`;
  return `${maskedUser}@${domain}`;
}

/**
 * Mask a phone number for safe logging (e.g. "+91 9876543210" ➔ "+91 98****3210")
 */
export function maskPhone(phone?: string | null): string {
  if (!phone || typeof phone !== "string") return "";
  const clean = phone.trim();
  if (clean.length < 6) return "***";
  return `${clean.slice(0, 4)}****${clean.slice(-4)}`;
}

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "password",
      "newPassword",
      "token",
      "refreshToken",
      "secret",
      "apiKey",
      "razorpay_signature",
      "razorpay_secret",
      "creditCard",
      "card_number",
      "cvv",
      "*.password",
      "*.token",
      "*.secret",
    ],
    censor: "[REDACTED_SECRET]",
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
