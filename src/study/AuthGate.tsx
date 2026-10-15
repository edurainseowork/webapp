import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './lib/firebase';
import { apiFetch } from './lib/api';
import { AuthFlow } from './components/Auth/AuthFlow';
import { authService } from './components/Auth/authService';

// Admins and faculty work in the CMS portal; students stay on the study page
const CMS_URL = (import.meta.env.VITE_CMS_URL || '').trim();

export interface Session {
  uid: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextValue {
  session: Session;
  /** First name for greetings, e.g. "Abhinav" */
  firstName: string;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** The signed-in student. Only usable inside <AuthGate>, which renders its children only when signed in. */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthGate>');
  return value;
}

type Phase = 'checking' | 'signed-out' | 'redirecting' | 'signed-in';

// The backend decides the role from the verified token (GET /api/auth/me)
async function loadSession(user: User): Promise<Session> {
  const base = { uid: user.uid, name: user.displayName || user.email?.split('@')[0] || 'Student', email: user.email ?? '' };
  try {
    const me = await apiFetch<{ user?: { name?: string; role?: string } }>('/auth/me');
    return { ...base, name: me.user?.name || base.name, role: (me.user?.role || 'student').toLowerCase() };
  } catch {
    // Backend unreachable: let the student in; nothing on the study page depends on the role
    return { ...base, role: 'student' };
  }
}
// CMS address with a one-time sign-in handover, so the admin arrives in the CMS already signed in.
// If the handover can't be created, the plain CMS address still works (the admin logs in there).
async function cmsUrlWithHandoff(): Promise<string> {
  try {
    const { token } = await apiFetch<{ token: string }>('/auth/cms-handoff', { method: 'POST' });
    return `${CMS_URL}#handoff=${encodeURIComponent(token)}`;
  } catch {
    return CMS_URL;
  }
}

function FullScreenMessage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center gap-4 bg-[#DCEAE3] text-[#175A67] px-4 text-center">
      <div className="w-10 h-10 rounded-full border-4 border-[#175A67]/20 border-t-[#175A67] animate-spin" />
      <div className="text-sm font-semibold">{children}</div>
    </div>
  );
}

// Shows the login / sign-up screens until the user is signed in, then renders the app untouched.
// The Firebase session survives reloads ("Keep me signed in" = local persistence, otherwise this tab only).
export function AuthGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('checking');
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let current = 0;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const run = ++current;
      if (!user) {
        setSession(null);
        setPhase('signed-out');
        return;
      }
      setPhase('checking');
      const next = await loadSession(user);
      if (run !== current) return; // a newer sign-in/out happened meanwhile
      setSession(next);
      // An email or phone that belongs to a CMS admin/faculty account goes to the CMS
      if ((next.role === 'admin' || next.role === 'faculty') && CMS_URL) {
        setPhase('redirecting');
        const target = await cmsUrlWithHandoff();
        if (run === current) window.location.replace(target);
        return;
      }
      setPhase('signed-in');
    });
    return () => unsubscribe();
  }, []);

  if (phase === 'checking') return <FullScreenMessage>Checking your session…</FullScreenMessage>;
  if (phase === 'redirecting') return <FullScreenMessage>Opening the admin CMS…</FullScreenMessage>;
  // Signing in triggers onAuthStateChanged above, which moves the gate on; nothing to do here
  if (phase === 'signed-out' || !session) return <AuthFlow onAuthenticated={() => {}} />;

  const value: AuthContextValue = {
    session,
    firstName: session.name.split(' ')[0] || session.name,
    logout: () => authService.logout(),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthGate;