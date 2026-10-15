import React, { useEffect, useRef, useState } from 'react';
import { MessageSquareText, ArrowRight, RotateCcw } from 'lucide-react';
import { AuthCard } from './AuthLayout';
import {
  PrimaryButton,
  FormAlert,
  StepIndicator,
  TextLink,
  formatPhone,
  formatCountdown,
  useCountdown,
} from './AuthFields';
import { AuthResult } from './authService';

interface OtpVerifyViewProps {
  phone: string;
  /** Must match the OTP length configured in your MSG91 widget. */
  length?: number;
  resendAfterSeconds?: number;
  onVerify: (code: string) => Promise<AuthResult>;
  onResend: () => Promise<AuthResult>;
  onEditPhone: () => void;
}

export function OtpVerifyView({
  phone,
  length = 4,
  resendAfterSeconds = 30,
  onVerify,
  onResend,
  onEditPhone,
}: OtpVerifyViewProps) {
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(''));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const lastAutoSubmitted = useRef<string | null>(null);
  const { remaining, restart } = useCountdown(resendAfterSeconds);

  const code = digits.join('');
  const isComplete = code.length === length;

  const focusBox = (index: number) => {
    const target = inputRefs.current[Math.max(0, Math.min(length - 1, index))];
    target?.focus();
    target?.select();
  };

  // Write a run of digits starting at `start` (handles typing, paste and SMS autofill)
  const fillFrom = (start: number, raw: string) => {
    const incoming = raw.replace(/\D/g, '');
    if (!incoming) return;
    setDigits((prev) => {
      const next = [...prev];
      for (let i = 0; i < incoming.length && start + i < length; i++) next[start + i] = incoming[i];
      return next;
    });
    setError(null);
    focusBox(start + incoming.length);
  };

  const handleChange = (index: number, value: string) => {
    if (value === '') {
      setDigits((prev) => prev.map((d, i) => (i === index ? '' : d)));
      return;
    }
    // When a box already holds a digit, the browser appends — keep only the new keystroke
    const typed = value.length > 1 && digits[index] ? value.replace(digits[index], '') : value;
    fillFrom(index, typed);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      e.preventDefault();
      setDigits((prev) => prev.map((d, i) => (i === index - 1 ? '' : d)));
      focusBox(index - 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusBox(index - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusBox(index + 1);
    }
  };

  const handlePaste = (index: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    fillFrom(index, e.clipboardData.getData('text'));
  };

  const verify = async (value: string) => {
    if (value.length !== length || isVerifying) return;
    setIsVerifying(true);
    setError(null);
    setNotice(null);
    const res = await onVerify(value);
    setIsVerifying(false);
    if (!res.ok) {
      // Clear the boxes so a corrected code isn't auto-submitted after a single keystroke
      setDigits(Array(length).fill(''));
      lastAutoSubmitted.current = null;
      setError(res.error ?? 'Incorrect OTP. Please try again.');
      setShakeKey((k) => k + 1);
    }
  };

  // Submit automatically the first time all boxes are filled with a given code
  useEffect(() => {
    if (isComplete && lastAutoSubmitted.current !== code) {
      lastAutoSubmitted.current = code;
      verify(code);
    }
  }, [code, isComplete]);

  const handleResend = async () => {
    setIsResending(true);
    setError(null);
    const res = await onResend();
    setIsResending(false);
    if (res.ok) {
      setDigits(Array(length).fill(''));
      lastAutoSubmitted.current = null;
      setNotice(`A new code has been sent to ${formatPhone(phone)}.`);
      restart();
      focusBox(0);
    } else {
      setError(res.error ?? 'Could not resend the OTP. Please try again.');
    }
  };

  return (
    <AuthCard
      header={<StepIndicator step={2} total={2} label="Verify mobile" />}
      icon={MessageSquareText}
      iconTone="emerald"
      title="Verify your mobile number"
      subtitle={
        <>
          Enter the {length}-digit code we sent to{' '}
          <span className="font-semibold text-[#0B1C30] whitespace-nowrap">{formatPhone(phone)}</span>.{' '}
          <TextLink onClick={onEditPhone}>Edit</TextLink>
        </>
      }
      footer="Didn't get an SMS? Check that the number is correct and has network coverage."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          verify(code);
        }}
        className="space-y-5"
      >
        {error && <FormAlert>{error}</FormAlert>}
        {notice && !error && <FormAlert tone="success">{notice}</FormAlert>}

        <div key={shakeKey} className={`flex justify-center gap-2.5 sm:gap-3 ${shakeKey ? 'animate-shake' : ''}`}>
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={(e) => handlePaste(index, e)}
              onFocus={(e) => e.target.select()}
              inputMode="numeric"
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              autoFocus={index === 0}
              aria-label={`Digit ${index + 1}`}
              readOnly={isVerifying}
              className={`flex-1 min-w-0 max-w-[64px] aspect-square rounded-2xl border-2 text-center text-2xl font-bold text-[#0B1C30] transition-all focus:outline-none focus:ring-4 ${
                error
                  ? 'border-red-300 bg-red-50/50 focus:border-red-400 focus:ring-red-100'
                  : digit
                  ? 'border-[#0F3B42] bg-white focus:ring-[#175A67]/10'
                  : 'border-slate-200 bg-slate-50/70 focus:border-[#175A67] focus:bg-white focus:ring-[#175A67]/10'
              }`}
            />
          ))}
        </div>

        <PrimaryButton type="submit" loading={isVerifying} loadingText="Verifying…" disabled={!isComplete}>
          Verify &amp; create account
          <ArrowRight className="w-4 h-4" />
        </PrimaryButton>

        <div className="flex items-center justify-center gap-1.5 text-sm text-slate-500">
          {remaining > 0 ? (
            <>
              Resend code in <span className="font-semibold text-[#0B1C30] tabular-nums">{formatCountdown(remaining)}</span>
            </>
          ) : (
            <>
              Didn&apos;t receive the code?
              <TextLink onClick={handleResend} disabled={isResending} className="inline-flex items-center gap-1">
                <RotateCcw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
                {isResending ? 'Sending…' : 'Resend OTP'}
              </TextLink>
            </>
          )}
        </div>
      </form>
    </AuthCard>
  );
}

export default OtpVerifyView;
