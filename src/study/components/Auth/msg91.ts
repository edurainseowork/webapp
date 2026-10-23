/* ------------------------------------------------------------------ */
/*  MSG91 OTP widget (web)                                              */
/*                                                                      */
/*  Same widget as the mobile app (Frontend/app/index.tsx). With        */
/*  exposeMethods the widget draws no UI of its own: OtpVerifyView is   */
/*  the UI and calls sendOtp / retryOtp / verifyOtp below. A verified   */
/*  code returns an access token that the backend checks with MSG91     */
/*  (POST /api/auth/verify-otp-and-signup).                             */
/* ------------------------------------------------------------------ */

const SCRIPT_URL = 'https://verify.msg91.com/otp-provider.js';
const WIDGET_ID = import.meta.env.VITE_MSG91_WIDGET_ID || '';
const TOKEN_AUTH = import.meta.env.VITE_MSG91_TOKEN_AUTH || '';

type WidgetCallback = (data: any) => void;

declare global {
  interface Window {
    initSendOTP?: (config: Record<string, unknown>) => void;
    sendOtp?: (identifier: string, success: WidgetCallback, failure: WidgetCallback) => void;
    retryOtp?: (channel: string | null, success: WidgetCallback, failure: WidgetCallback, reqId?: string) => void;
    verifyOtp?: (otp: string, success: WidgetCallback, failure: WidgetCallback, reqId?: string) => void;
  }
}

let ready: Promise<void> | null = null;

/** Loads the widget script once and initialises it in exposeMethods mode. */
function loadWidget(): Promise<void> {
  if (ready) return ready;
  ready = new Promise<void>((resolve, reject) => {
    const init = () => {
      if (!window.initSendOTP) {
        reject(new Error('The verification service did not load. Please refresh and try again.'));
        return;
      }
      window.initSendOTP({
        widgetId: WIDGET_ID,
        tokenAuth: TOKEN_AUTH,
        exposeMethods: true,
        success: () => {},
        failure: () => {},
      });
      // The widget attaches sendOtp/verifyOtp to window shortly after init
      const started = Date.now();
      const poll = () => {
        if (window.sendOtp && window.verifyOtp) resolve();
        else if (Date.now() - started > 8000) reject(new Error('The verification service did not start. Please refresh and try again.'));
        else setTimeout(poll, 100);
      };
      poll();
    };
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = init;
    script.onerror = () => reject(new Error('Could not load the verification service. Check your connection and try again.'));
    document.head.appendChild(script);
  });
  // Allow a retry after a failed load
  ready.catch(() => {
    ready = null;
  });
  return ready;
}

const errorText = (err: any, fallback: string) =>
  (typeof err?.message === 'string' && err.message) || (typeof err === 'string' && err) || fallback;

let reqId: string | undefined;

/** Sends the OTP to an Indian mobile number (10 digits, without +91). */
export async function sendSignupOtp(phone: string): Promise<void> {
  await loadWidget();
  await new Promise<void>((resolve, reject) => {
    window.sendOtp!(
      `91${phone}`,
      (data) => {
        reqId = data?.message ?? data?.reqId;
        resolve();
      },
      (err) => reject(new Error(errorText(err, 'Could not send the OTP. Please try again.'))),
    );
  });
}

export async function resendSignupOtp(): Promise<void> {
  await loadWidget();
  await new Promise<void>((resolve, reject) => {
    if (!window.retryOtp) {
      reject(new Error('Resend is not available right now. Please try again.'));
      return;
    }
    // null channel = resend on the widget's default channel (SMS)
    window.retryOtp(
      null,
      () => resolve(),
      (err) => reject(new Error(errorText(err, 'Could not resend the OTP. Please try again.'))),
      reqId,
    );
  });
}

/** Verifies the code and returns the MSG91 access token for the backend. */
export async function verifySignupOtp(code: string): Promise<string> {
  await loadWidget();
  return new Promise<string>((resolve, reject) => {
    window.verifyOtp!(
      code,
      (data) => {
        const token = data?.message ?? data?.accessToken;
        if (typeof token === 'string' && token) resolve(token);
        else reject(new Error('Verification failed. Please try again.'));
      },
      (err) => reject(new Error(errorText(err, 'Incorrect OTP. Please check the code and try again.'))),
      reqId,
    );
  });
}