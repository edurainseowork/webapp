import React, { useEffect, useId, useState } from 'react';
import { Eye, EyeOff, Lock, AlertCircle, CheckCircle2, Info, Loader2, Check } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 6;

export const isValidEmail = (value: string) => EMAIL_PATTERN.test(value.trim());

export const maskEmail = (email: string) => {
  const [handle, domain] = email.split('@');
  if (!handle || !domain) return email;
  return `${handle.charAt(0)}${'•'.repeat(Math.max(2, Math.min(handle.length - 1, 5)))}@${domain}`;
};

export const formatPhone = (phone: string) => `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`.trim();

export function getPasswordStrength(password: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!password) return { score: 0, label: '' };
  if (password.length < MIN_PASSWORD_LENGTH) return { score: 1, label: 'Too short' };
  const passed = [password.length >= 8, /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(
    Boolean
  ).length;
  const score = Math.max(1, passed) as 1 | 2 | 3 | 4;
  return { score, label: ['', 'Weak', 'Fair', 'Good', 'Strong'][score] };
}

/** Seconds left on a resend timer; call `restart()` to start it again. */
export function useCountdown(seconds: number) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  return { remaining, restart: () => setRemaining(seconds) };
}

export const formatCountdown = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/* ------------------------------------------------------------------ */
/*  Text field                                                          */
/* ------------------------------------------------------------------ */

interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'prefix'> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon?: React.ComponentType<{ className?: string }>;
  prefix?: string;
  error?: string;
  hint?: string;
  labelAction?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

export function TextField({
  label,
  value,
  onChange,
  icon: Icon,
  prefix,
  error,
  hint,
  labelAction,
  rightSlot,
  id,
  ...inputProps
}: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const messageId = `${inputId}-message`;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={inputId} className="text-xs font-semibold text-[#40484B]">
          {label}
        </label>
        {labelAction}
      </div>

      <div
        className={`flex items-center gap-2.5 h-12 px-3.5 rounded-xl border transition-all focus-within:bg-white focus-within:ring-4 ${
          error
            ? 'border-red-300 bg-red-50/40 focus-within:border-red-400 focus-within:ring-red-100'
            : 'border-slate-200 bg-slate-50/70 hover:border-slate-300 focus-within:border-[#175A67] focus-within:ring-[#175A67]/10'
        }`}
      >
        {Icon && <Icon className={`w-4 h-4 shrink-0 ${error ? 'text-red-400' : 'text-slate-400'}`} />}
        {prefix && (
          <span className="text-sm font-semibold text-[#0B1C30] pr-2.5 border-r border-slate-200 shrink-0">{prefix}</span>
        )}
        <input
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error || hint ? messageId : undefined}
          className="flex-1 min-w-0 h-full bg-transparent text-sm text-[#0B1C30] placeholder-slate-400 focus:outline-none"
          {...inputProps}
        />
        {rightSlot}
      </div>

      {error ? (
        <p id={messageId} className="flex items-center gap-1 text-[11px] font-medium text-red-500 mt-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-[11px] text-slate-500 mt-1.5">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Password field (show / hide)                                        */
/* ------------------------------------------------------------------ */

type PasswordFieldProps = Omit<TextFieldProps, 'type' | 'icon' | 'rightSlot'>;

export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      icon={Lock}
      rightSlot={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="p-1 -mr-1 text-slate-400 hover:text-[#0B1C30] transition-colors shrink-0"
          title={visible ? 'Hide password' : 'Show password'}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Password strength                                                   */
/* ------------------------------------------------------------------ */

const STRENGTH_COLORS = ['bg-slate-200', 'bg-red-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-600'];
const STRENGTH_TEXT = ['text-slate-400', 'text-red-500', 'text-amber-600', 'text-emerald-600', 'text-emerald-700'];

export function PasswordStrengthMeter({ password }: { password: string }) {
  const { score, label } = getPasswordStrength(password);
  if (!password) return null;
  return (
    <div className="flex items-center gap-3 mt-2">
      <div className="flex-1 grid grid-cols-4 gap-1.5">
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={`h-1.5 rounded-full transition-colors duration-300 ${step <= score ? STRENGTH_COLORS[score] : 'bg-slate-200'}`}
          />
        ))}
      </div>
      <span className={`text-[11px] font-semibold w-16 text-right ${STRENGTH_TEXT[score]}`}>{label}</span>
    </div>
  );
}

export function PasswordChecklist({ password }: { password: string }) {
  const rules = [
    { label: `At least ${MIN_PASSWORD_LENGTH} characters`, met: password.length >= MIN_PASSWORD_LENGTH },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One number', met: /\d/.test(password) },
    { label: 'One special character', met: /[^A-Za-z0-9]/.test(password) },
  ];
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-3">
      {rules.map((rule) => (
        <li
          key={rule.label}
          className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${
            rule.met ? 'text-emerald-600' : 'text-slate-500'
          }`}
        >
          <span
            className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
              rule.met ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-transparent'
            }`}
          >
            <Check className="w-2.5 h-2.5 stroke-[3]" />
          </span>
          {rule.label}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/*  Buttons, alerts, checkbox                                           */
/* ------------------------------------------------------------------ */

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
}

export function PrimaryButton({ loading, loadingText, children, disabled, className = '', ...props }: PrimaryButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`w-full h-12 rounded-xl bg-[#0F3B42] hover:bg-[#0b2c31] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 ${className}`}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {loadingText ?? 'Please wait…'}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function SecondaryButton({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`w-full h-12 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-[#0B1C30] text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${className}`}
    >
      {children}
    </button>
  );
}

const ALERT_STYLES = {
  error: { wrap: 'bg-red-50 border-red-200 text-red-700', icon: AlertCircle },
  success: { wrap: 'bg-emerald-50 border-emerald-200 text-emerald-800', icon: CheckCircle2 },
  info: { wrap: 'bg-sky-50 border-sky-200 text-sky-800', icon: Info },
};

export function FormAlert({ tone = 'error', children }: { tone?: keyof typeof ALERT_STYLES; children: React.ReactNode }) {
  const style = ALERT_STYLES[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-xl border px-3.5 py-3 text-xs font-medium animate-fadeIn ${style.wrap}`}>
      <style.icon className="w-4 h-4 shrink-0 mt-px" />
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
  error,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
      <span
        className={`mt-0.5 w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center shrink-0 transition-all peer-focus-visible:ring-4 peer-focus-visible:ring-[#175A67]/15 ${
          checked ? 'bg-[#0F3B42] border-[#0F3B42]' : error ? 'border-red-400 bg-white' : 'border-slate-300 bg-white'
        }`}
      >
        {checked && <Check className="w-3 h-3 text-white stroke-[3]" />}
      </span>
      <span className={`text-xs leading-relaxed ${error ? 'text-red-600' : 'text-slate-600'}`}>{children}</span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  Log in / Sign up toggle + step indicator                            */
/* ------------------------------------------------------------------ */

export function AuthModeToggle({
  mode,
  onChange,
}: {
  mode: 'login' | 'signup';
  onChange: (mode: 'login' | 'signup') => void;
}) {
  return (
    <div className="grid grid-cols-2 bg-slate-100 rounded-xl p-1 mb-6">
      {(['login', 'signup'] as const).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className={`py-2 rounded-lg text-sm font-semibold transition-all ${
            mode === item ? 'bg-white text-[#0B1C30] shadow-sm' : 'text-slate-500 hover:text-[#0B1C30]'
          }`}
        >
          {item === 'login' ? 'Log in' : 'Sign up'}
        </button>
      ))}
    </div>
  );
}

export function StepIndicator({ step, total, label }: { step: number; total: number; label: string }) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between text-[11px] font-semibold mb-2">
        <span className="text-[#175A67] uppercase tracking-wide">
          Step {step} of {total}
        </span>
        <span className="text-slate-500">{label}</span>
      </div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`h-1 rounded-full ${i < step ? 'bg-[#0F3B42]' : 'bg-slate-200'}`} />
        ))}
      </div>
    </div>
  );
}

export function TextLink({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`font-semibold text-[#175A67] hover:text-[#0F3B42] hover:underline underline-offset-2 transition-colors disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}
