import React, { useState } from 'react';
import { LockKeyhole, CheckCircle2, ArrowRight } from 'lucide-react';
import { AuthCard } from './AuthLayout';
import {
  PasswordField,
  PasswordStrengthMeter,
  PasswordChecklist,
  PrimaryButton,
  FormAlert,
  maskEmail,
  MIN_PASSWORD_LENGTH,
} from './AuthFields';
import { AuthResult } from './authService';

interface ResetPasswordViewProps {
  email?: string;
  onSubmit: (newPassword: string) => Promise<AuthResult>;
  onBackToLogin: () => void;
}

export function ResetPasswordView({ email, onSubmit, onBackToLogin }: ResetPasswordViewProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const next: typeof errors = {};
    if (password.length < MIN_PASSWORD_LENGTH) next.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    if (password !== confirmPassword) next.confirmPassword = 'Passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setIsSubmitting(true);
    const res = await onSubmit(password);
    setIsSubmitting(false);
    if (res.ok) setIsDone(true);
    else setFormError(res.error ?? 'This reset link is invalid or has expired. Request a new one.');
  };

  if (isDone) {
    return (
      <AuthCard
        icon={CheckCircle2}
        iconTone="emerald"
        title="Password updated"
        subtitle="Your password has been changed successfully. Log in with your new password to continue your prep."
      >
        <PrimaryButton type="button" onClick={onBackToLogin}>
          Back to log in
          <ArrowRight className="w-4 h-4" />
        </PrimaryButton>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      icon={LockKeyhole}
      title="Set a new password"
      subtitle={
        email ? (
          <>
            Choose a strong password for <span className="font-semibold text-[#0B1C30]">{maskEmail(email)}</span>.
          </>
        ) : (
          'Choose a strong password you haven’t used before.'
        )
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && <FormAlert>{formError}</FormAlert>}

        <div>
          <PasswordField
            label="New password"
            value={password}
            onChange={(v) => {
              setPassword(v);
              if (errors.password) setErrors((er) => ({ ...er, password: undefined }));
            }}
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            autoComplete="new-password"
            error={errors.password}
            autoFocus
          />
          <PasswordStrengthMeter password={password} />
          <PasswordChecklist password={password} />
        </div>

        <PasswordField
          label="Confirm new password"
          value={confirmPassword}
          onChange={(v) => {
            setConfirmPassword(v);
            if (errors.confirmPassword) setErrors((er) => ({ ...er, confirmPassword: undefined }));
          }}
          placeholder="Re-enter your new password"
          autoComplete="new-password"
          error={errors.confirmPassword}
        />

        <PrimaryButton type="submit" loading={isSubmitting} loadingText="Updating password…">
          Update password
        </PrimaryButton>
      </form>
    </AuthCard>
  );
}

export default ResetPasswordView;
