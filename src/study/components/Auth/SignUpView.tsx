import React, { useState } from 'react';
import { User, Smartphone, Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
import { AuthCard } from './AuthLayout';
import {
  TextField,
  PasswordField,
  PasswordStrengthMeter,
  PrimaryButton,
  FormAlert,
  Checkbox,
  AuthModeToggle,
  StepIndicator,
  TextLink,
  isValidEmail,
  MIN_PASSWORD_LENGTH,
} from './AuthFields';
import { AuthResult, SignUpData } from './authService';

interface SignUpViewProps {
  initialData?: SignUpData | null;
  onSubmit: (data: SignUpData) => Promise<AuthResult>;
  onSwitchToLogin: () => void;
}

type FieldErrors = Partial<Record<'name' | 'phone' | 'email' | 'password' | 'confirmPassword' | 'terms', string>>;

export function SignUpView({ initialData, onSubmit, onSwitchToLogin }: SignUpViewProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [phone, setPhone] = useState(initialData?.phone ?? '');
  const [email, setEmail] = useState(initialData?.email ?? '');
  const [password, setPassword] = useState(initialData?.password ?? '');
  const [confirmPassword, setConfirmPassword] = useState(initialData?.password ?? '');
  const [acceptedTerms, setAcceptedTerms] = useState(!!initialData);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clearError = (key: keyof FieldErrors) => {
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const validate = () => {
    const next: FieldErrors = {};
    if (!name.trim()) next.name = 'Please enter your name.';
    if (phone.length !== 10) next.phone = 'Please enter a valid 10-digit phone number.';
    if (!isValidEmail(email)) next.email = 'Enter a valid email address.';
    if (password.length < MIN_PASSWORD_LENGTH) next.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    if (password !== confirmPassword) next.confirmPassword = 'Passwords do not match.';
    if (!acceptedTerms) next.terms = 'Please accept the terms to continue.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;
    setIsSubmitting(true);
    const res = await onSubmit({
      name: name.trim(),
      phone,
      email: email.trim().toLowerCase(),
      password,
    });
    setIsSubmitting(false);
    if (!res.ok) setFormError(res.error ?? 'Could not send the OTP. Please try again.');
  };

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  // Only flag a mismatch once the confirmation is at least as long as the password
  const showLiveMismatch = !passwordsMatch && confirmPassword.length > 0 && confirmPassword.length >= password.length;

  return (
    <AuthCard
      header={
        <>
          <AuthModeToggle mode="signup" onChange={(m) => m === 'login' && onSwitchToLogin()} />
          <StepIndicator step={1} total={2} label="Account details" />
        </>
      }
      title="Create your account"
      subtitle="Start your JEE & NEET prep in under a minute."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && <FormAlert>{formError}</FormAlert>}

        <TextField
          label="Full name"
          icon={User}
          value={name}
          onChange={(v) => {
            setName(v);
            clearError('name');
          }}
          placeholder="e.g. Abhinav Sharma"
          autoComplete="name"
          error={errors.name}
          autoFocus
        />

        <TextField
          label="Mobile number"
          icon={Smartphone}
          prefix="+91"
          value={phone}
          onChange={(v) => {
            setPhone(v.replace(/\D/g, '').slice(0, 10));
            clearError('phone');
          }}
          placeholder="98765 43210"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          error={errors.phone}
          hint="We'll send an OTP to verify this number."
        />

        <TextField
          label="Email address"
          icon={Mail}
          type="email"
          value={email}
          onChange={(v) => {
            setEmail(v);
            clearError('email');
          }}
          placeholder="you@example.com"
          autoComplete="email"
          error={errors.email}
        />

        <div>
          <PasswordField
            label="Password"
            value={password}
            onChange={(v) => {
              setPassword(v);
              clearError('password');
            }}
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            autoComplete="new-password"
            error={errors.password}
          />
          <PasswordStrengthMeter password={password} />
        </div>

        <PasswordField
          label="Confirm password"
          value={confirmPassword}
          onChange={(v) => {
            setConfirmPassword(v);
            clearError('confirmPassword');
          }}
          placeholder="Re-enter your password"
          autoComplete="new-password"
          error={errors.confirmPassword ?? (showLiveMismatch ? 'Passwords do not match.' : undefined)}
        />
        {passwordsMatch && !errors.confirmPassword && (
          <p className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 -mt-2.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Passwords match
          </p>
        )}

        <div>
          <Checkbox
            checked={acceptedTerms}
            onChange={(v) => {
              setAcceptedTerms(v);
              clearError('terms');
            }}
            error={!!errors.terms}
          >
            I agree to EduRain&apos;s <TextLink>Terms of Service</TextLink> and <TextLink>Privacy Policy</TextLink>.
          </Checkbox>
          {errors.terms && <p className="text-[11px] font-medium text-red-500 mt-1.5 ml-7">{errors.terms}</p>}
        </div>

        <PrimaryButton type="submit" loading={isSubmitting} loadingText="Sending OTP…">
          Send OTP &amp; continue
          <ArrowRight className="w-4 h-4" />
        </PrimaryButton>
      </form>
    </AuthCard>
  );
}

export default SignUpView;
