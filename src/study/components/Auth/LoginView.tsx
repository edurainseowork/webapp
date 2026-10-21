import React, { useState } from 'react';
import { Mail, Smartphone, ArrowRight } from 'lucide-react';
import { AuthCard } from './AuthLayout';
import {
  TextField,
  PasswordField,
  PrimaryButton,
  FormAlert,
  Checkbox,
  AuthModeToggle,
  TextLink,
  isValidEmail,
  MIN_PASSWORD_LENGTH,
} from './AuthFields';
import { AuthResult } from './authService';

interface LoginViewProps {
  onSubmit: (identifier: string, password: string, remember: boolean) => Promise<AuthResult>;
  onForgotPassword: (prefillEmail: string) => void;
  onSwitchToSignup: () => void;
  notice?: string | null;
}

export function LoginView({ onSubmit, onForgotPassword, onSwitchToSignup, notice }: LoginViewProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Digits-only input is treated as an Indian mobile number, anything else as an email
  const trimmed = identifier.trim();
  const isPhone = trimmed.length > 0 && /^\d+$/.test(trimmed);

  const validate = () => {
    const next: typeof errors = {};
    if (!trimmed) next.identifier = 'Enter your email or mobile number.';
    else if (isPhone && trimmed.length !== 10) next.identifier = 'Enter a valid 10-digit mobile number.';
    else if (!isPhone && !isValidEmail(trimmed)) next.identifier = 'Enter a valid email or 10-digit mobile number.';
    if (password.length < MIN_PASSWORD_LENGTH) next.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;
    setIsSubmitting(true);
    const res = await onSubmit(isPhone ? trimmed : trimmed.toLowerCase(), password, remember);
    setIsSubmitting(false);
    if (!res.ok) setFormError(res.error ?? 'Invalid email or password.');
  };

  return (
    <AuthCard
      header={<AuthModeToggle mode="login" onChange={(m) => m === 'signup' && onSwitchToSignup()} />}
      title="Welcome back"
      subtitle="Log in to pick up right where you left off."
      footer={
        <>
          By continuing, you agree to EduRain&apos;s <TextLink>Terms of Service</TextLink> and{' '}
          <TextLink>Privacy Policy</TextLink>.
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {notice && <FormAlert tone="success">{notice}</FormAlert>}
        {formError && <FormAlert>{formError}</FormAlert>}

        <TextField
          label="Email or mobile number"
          icon={isPhone ? Smartphone : Mail}
          prefix={isPhone ? '+91' : undefined}
          value={identifier}
          onChange={(v) => {
            setIdentifier(v);
            if (errors.identifier) setErrors((er) => ({ ...er, identifier: undefined }));
          }}
          placeholder="you@example.com or 98765 43210"
          autoComplete="username"
          error={errors.identifier}
          autoFocus
        />

        <PasswordField
          label="Password"
          value={password}
          onChange={(v) => {
            setPassword(v);
            if (errors.password) setErrors((er) => ({ ...er, password: undefined }));
          }}
          placeholder="Enter your password"
          autoComplete="current-password"
          error={errors.password}
          labelAction={
            <TextLink className="text-xs" onClick={() => onForgotPassword(isPhone ? '' : trimmed)}>
              Forgot password?
            </TextLink>
          }
        />

        <Checkbox checked={remember} onChange={setRemember}>
          Keep me signed in on this device
        </Checkbox>

        <PrimaryButton type="submit" loading={isSubmitting} loadingText="Logging in…">
          Log in
          <ArrowRight className="w-4 h-4" />
        </PrimaryButton>
      </form>
    </AuthCard>
  );
}

export default LoginView;
