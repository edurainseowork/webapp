import { useState } from 'react';
import { AuthLayout } from './AuthLayout';
import { TextLink } from './AuthFields';
import { LoginView } from './LoginView';
import { SignUpView } from './SignUpView';
import { OtpVerifyView } from './OtpVerifyView';
import { ForgotPasswordView } from './ForgotPasswordView';
import { ResetPasswordView } from './ResetPasswordView';
import { authService, AuthUser, SignUpData } from './authService';

export type AuthScreen = 'login' | 'signup' | 'verify-otp' | 'forgot-password' | 'reset-password';

interface AuthFlowProps {
  onAuthenticated: (user: AuthUser) => void;
  initialScreen?: AuthScreen;
}

// Firebase reset emails open ?mode=resetPassword&oobCode=… once the project's action URL points at this app
const readResetCode = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get('mode') === 'resetPassword' ? params.get('oobCode') : null;
};

const clearResetParams = () => {
  const url = new URL(window.location.href);
  ['mode', 'oobCode', 'apiKey', 'continueUrl', 'lang'].forEach((key) => url.searchParams.delete(key));
  window.history.replaceState(null, '', url.toString());
};

export function AuthFlow({ onAuthenticated, initialScreen = 'login' }: AuthFlowProps) {
  const [resetCode] = useState(readResetCode);
  const [screen, setScreen] = useState<AuthScreen>(resetCode ? 'reset-password' : initialScreen);
  const [pendingSignup, setPendingSignup] = useState<SignUpData | null>(null);
  const [forgotEmail, setForgotEmail] = useState('');
  const [loginNotice, setLoginNotice] = useState<string | null>(null);
  const [passwordWasReset, setPasswordWasReset] = useState(false);

  const goTo = (next: AuthScreen) => {
    setScreen(next);
    window.scrollTo({ top: 0 });
  };

  const goToLogin = (notice: string | null = null) => {
    if (resetCode) clearResetParams();
    setLoginNotice(notice);
    goTo('login');
  };

  // The OTP step needs the details from step 1; fall back to the form if they're missing
  const activeScreen: AuthScreen = screen === 'verify-otp' && !pendingSignup ? 'signup' : screen;

  const topAction =
    activeScreen === 'login' ? (
      <>
        New to EduRain? <TextLink onClick={() => goTo('signup')}>Sign up</TextLink>
      </>
    ) : activeScreen === 'forgot-password' || activeScreen === 'reset-password' ? (
      <>
        Remembered your password? <TextLink onClick={() => goToLogin()}>Log in</TextLink>
      </>
    ) : (
      <>
        Already have an account? <TextLink onClick={() => goToLogin()}>Log in</TextLink>
      </>
    );

  return (
    <AuthLayout topAction={topAction}>
      <div key={activeScreen} className="animate-fadeIn">
        {activeScreen === 'login' && (
          <LoginView
            notice={loginNotice}
            onSubmit={async (identifier, password, remember) => {
              const res = await authService.login(identifier, password, remember);
              if (res.ok && res.user) onAuthenticated(res.user);
              return res;
            }}
            onForgotPassword={(email) => {
              setForgotEmail(email);
              goTo('forgot-password');
            }}
            onSwitchToSignup={() => goTo('signup')}
          />
        )}

        {activeScreen === 'signup' && (
          <SignUpView
            initialData={pendingSignup}
            onSubmit={async (data) => {
              const res = await authService.sendSignupOtp(data.phone);
              if (res.ok) {
                setPendingSignup(data);
                goTo('verify-otp');
              }
              return res;
            }}
            onSwitchToLogin={() => goToLogin()}
          />
        )}

        {activeScreen === 'verify-otp' && pendingSignup && (
          <OtpVerifyView
            phone={pendingSignup.phone}
            onVerify={async (code) => {
              const res = await authService.verifyOtpAndSignup(pendingSignup, code);
              if (res.ok && res.user) onAuthenticated(res.user);
              return res;
            }}
            onResend={() => authService.resendSignupOtp(pendingSignup.phone)}
            onEditPhone={() => goTo('signup')}
          />
        )}

        {activeScreen === 'forgot-password' && (
          <ForgotPasswordView
            initialEmail={forgotEmail}
            onSubmit={(email) => authService.sendPasswordReset(email)}
            onBackToLogin={() => goToLogin()}
          />
        )}

        {activeScreen === 'reset-password' && (
          <ResetPasswordView
            onSubmit={async (newPassword) => {
              const res = await authService.confirmPasswordReset(resetCode ?? '', newPassword);
              if (res.ok) setPasswordWasReset(true);
              return res;
            }}
            onBackToLogin={() => goToLogin(passwordWasReset ? 'Password updated — log in with your new password.' : null)}
          />
        )}
      </div>
    </AuthLayout>
  );
}

export default AuthFlow;
