import React, { useState } from 'react';
import { KeyRound, MailCheck, Mail, ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import { AuthCard } from './AuthLayout';
import {
  TextField,
  PrimaryButton,
  SecondaryButton,
  FormAlert,
  TextLink,
  isValidEmail,
  maskEmail,
  formatCountdown,
  useCountdown,
} from './AuthFields';
import { AuthResult } from './authService';

interface ForgotPasswordViewProps {
  initialEmail?: string;
  onSubmit: (email: string) => Promise<AuthResult>;
  onBackToLogin: () => void;
}

const RESEND_AFTER_SECONDS = 30;

export function ForgotPasswordView({ initialEmail = '', onSubmit, onBackToLogin }: ForgotPasswordViewProps) {
  const [email, setEmail] = useState(initialEmail);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendNotice, setResendNotice] = useState(false);
  const { remaining, restart } = useCountdown(RESEND_AFTER_SECONDS);

  const send = async (target: string) => {
    setFormError(null);
    setIsSubmitting(true);
    const res = await onSubmit(target);
    setIsSubmitting(false);
    if (!res.ok) {
      setFormError(res.error ?? 'Failed to send reset link.');
      return false;
    }
    restart();
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!isValidEmail(normalized)) {
      setFieldError('Please enter the email address linked to your account.');
      return;
    }
    if (await send(normalized)) {
      setSentTo(normalized);
      setResendNotice(false);
    }
  };

  const handleResend = async () => {
    if (sentTo && (await send(sentTo))) setResendNotice(true);
  };

  if (sentTo) {
    return (
      <AuthCard
        icon={MailCheck}
        iconTone="emerald"
        title="Check your inbox"
        subtitle={
          <>
            We&apos;ve sent a password reset link to <span className="font-semibold text-[#0B1C30]">{maskEmail(sentTo)}</span>.
            The link expires in 1 hour.
          </>
        }
        footer={
          <>
            Wrong address? <TextLink onClick={() => setSentTo(null)}>Use a different email</TextLink>
          </>
        }
      >
        <div className="space-y-4">
          {formError && <FormAlert>{formError}</FormAlert>}
          {resendNotice && !formError && <FormAlert tone="success">A fresh reset link is on its way.</FormAlert>}

          <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 space-y-2.5">
            {[
              'Open the email from EduRain and tap “Reset password”.',
              'Choose a new password on the page that opens.',
              'Come back here and log in with your new password.',
            ].map((step, i) => (
              <div key={step} className="flex items-start gap-2.5 text-xs text-slate-600">
                <span className="w-5 h-5 rounded-full bg-[#0F3B42] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span className="leading-relaxed pt-0.5">{step}</span>
              </div>
            ))}
          </div>

          <PrimaryButton type="button" onClick={onBackToLogin}>
            Back to log in
            <ArrowRight className="w-4 h-4" />
          </PrimaryButton>

          <div className="flex items-center justify-center gap-1.5 text-sm text-slate-500">
            {remaining > 0 ? (
              <>
                Resend available in <span className="font-semibold text-[#0B1C30] tabular-nums">{formatCountdown(remaining)}</span>
              </>
            ) : (
              <>
                Didn&apos;t get it? Check spam, or
                <TextLink onClick={handleResend} disabled={isSubmitting} className="inline-flex items-center gap-1">
                  <RotateCcw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
                  {isSubmitting ? 'Sending…' : 'resend'}
                </TextLink>
              </>
            )}
          </div>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      icon={KeyRound}
      iconTone="amber"
      title="Forgot your password?"
      subtitle="No worries — enter the email linked to your EduRain account and we'll send you a link to reset it."
      footer="Use the email address you entered when you signed up — it's linked to your mobile number too."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && <FormAlert>{formError}</FormAlert>}

        <TextField
          label="Email address"
          icon={Mail}
          type="email"
          value={email}
          onChange={(v) => {
            setEmail(v);
            setFieldError(undefined);
          }}
          placeholder="you@example.com"
          autoComplete="email"
          error={fieldError}
          autoFocus
        />

        <PrimaryButton type="submit" loading={isSubmitting} loadingText="Sending link…">
          Send reset link
          <ArrowRight className="w-4 h-4" />
        </PrimaryButton>

        <SecondaryButton type="button" onClick={onBackToLogin}>
          <ArrowLeft className="w-4 h-4" />
          Back to log in
        </SecondaryButton>
      </form>
    </AuthCard>
  );
}

export default ForgotPasswordView;
