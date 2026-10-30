import Razorpay from "razorpay";

const sanitize = (val?: string) => val?.trim().replace(/^["']|["']$/g, "") || undefined;

export const getRazorpayCredentials = () => ({
  keyId: sanitize(process.env.RAZORPAY_KEY_ID),
  keySecret: sanitize(process.env.RAZORPAY_SECRET) || sanitize(process.env.RAZORPAY_KEY_SECRET),
});

let cached: { id: string; secret: string; client: Razorpay } | null = null;

/** One client per key pair, reused across requests (null when the keys are not configured). */
export const getRazorpayClient = (): Razorpay | null => {
  const { keyId, keySecret } = getRazorpayCredentials();
  if (!keyId || !keySecret) return null;
  if (!cached || cached.id !== keyId || cached.secret !== keySecret) {
    cached = { id: keyId, secret: keySecret, client: new Razorpay({ key_id: keyId, key_secret: keySecret }) };
  }
  return cached.client;
};
