import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { resendSignupOtp, sendSignupOtp, verifySignupOtp } from '../Auth/msg91';
import { changeLoginPhone } from '../../lib/profile';

// Change (or add) the login number: OTP goes to the NEW number, then the backend switches it
// (POST /api/auth/change-phone). Same MSG91 web widget as sign-up.

const RESEND_SECONDS = 30;
const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message) || fallback;

interface Props {
  open: boolean;
  hasPhone: boolean;
  onClose: () => void;
  onChanged: (phone: string) => void;
}

export function ChangePhoneDialog({ open, hasPhone, onClose, onChanged }: Props) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'number' | 'otp'>('number');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!open) return;
    setPhone('');
    setOtp('');
    setStep('number');
    setError(null);
    setBusy(false);
  }, [open]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [secondsLeft]);

  if (!open) return null;

  const run = async (task: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(errorText(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  const sendOtp = () =>
    run(async () => {
      if (!/^[6-9][0-9]{9}$/.test(phone)) throw new Error('Enter a valid 10-digit mobile number.');
      await sendSignupOtp(phone);
      setOtp('');
      setStep('otp');
      setSecondsLeft(RESEND_SECONDS);
    }, 'Could not send the OTP. Please try again.');

  const resend = () =>
    run(async () => {
      await resendSignupOtp();
      setSecondsLeft(RESEND_SECONDS);
    }, 'Could not resend the OTP. Please try again.');

  const verify = () =>
    run(async () => {
      const token = await verifySignupOtp(otp);
      const saved = await changeLoginPhone(phone, token);
      onChanged(saved);
    }, 'Could not change the number. Please try again.');

  const inputClass =
    'w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold tracking-wide focus:outline-none focus:ring-2 focus:ring-[#175A67]/30';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true" aria-label="Change mobile number">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-[#0B1C30]">{hasPhone ? 'Change Mobile Number' : 'Add Mobile Number'}</h2>
          <button onClick={onClose} disabled={busy} className="rounded-full p-1.5 hover:bg-slate-100 disabled:opacity-50" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === 'number' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendOtp();
            }}
          >
            <p className="mb-3 text-xs text-slate-500">This becomes your login number. We will send an OTP to it.</p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-600">+91</span>
              <input
                className={inputClass}
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={10}
                value={phone}
                placeholder="10-digit mobile number"
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                aria-label="New mobile number"
                autoFocus
              />
            </div>
            {error && <p role="alert" className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={phone.length !== 10 || busy}
              className="mt-4 flex w-full items-center justify-center rounded-xl bg-[#175A67] py-2.5 text-sm font-semibold text-white hover:bg-[#124853] disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void verify();
            }}
          >
            <p className="mb-3 text-xs text-slate-500">Enter the OTP sent to +91 {phone}</p>
            <input
              className={`${inputClass} text-center tracking-[0.5em]`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              placeholder="OTP"
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              aria-label="OTP"
              autoFocus
            />
            {error && <p role="alert" className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={otp.length < 4 || busy}
              className="mt-4 flex w-full items-center justify-center rounded-xl bg-[#175A67] py-2.5 text-sm font-semibold text-white hover:bg-[#124853] disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify & Save Number'}
            </button>
            <div className="mt-3 flex items-center justify-between text-xs font-semibold">
              <button type="button" onClick={() => setStep('number')} disabled={busy} className="text-[#175A67] hover:underline disabled:opacity-50">
                Change number
              </button>
              <button type="button" onClick={() => void resend()} disabled={busy || secondsLeft > 0} className="text-[#175A67] hover:underline disabled:text-slate-400 disabled:no-underline">
                {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : 'Resend OTP'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default ChangePhoneDialog;
