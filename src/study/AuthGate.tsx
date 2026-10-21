import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './lib/firebase';
import { apiFetch, ApiError } from './lib/api';
import { AuthFlow } from './components/Auth/AuthFlow';
import { authService } from './components/Auth/authService';
import { MentorDesk } from './components/Desk/MentorDesk';
import { TeacherAssistantDesk } from './components/Desk/TeacherAssistantDesk';
import { DESK_HOME, STUDY_HOME, isCmsRole, isDeskPath, isDeskRole, isWithin, replacePath } from './lib/roles';

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
    // Backend unreachable: fall back to the role claim in the Firebase token (only the backend can
    // set it), so a Mentor / Teacher Assistance account never lands in the student app
    try {
      const { claims } = await user.getIdTokenResult();
      const claimRole = typeof claims.role === 'string' ? claims.role.toLowerCase() : claims.admin === true ? 'admin' : 'student';
      return { ...base, role: claimRole };
    } catch {
      return { ...base, role: 'student' };
    }
  }
}
// CMS address with a one-time sign-in handover, so the admin / mentor arrives in the CMS already
// signed in. If the handover can't be created, the plain CMS address still works (they log in there).
async function cmsUrlWithHandoff(path = ''): Promise<string> {
  const target = `${CMS_URL.replace(/\/+$/, '')}${path}`;
  try {
    const { token } = await apiFetch<{ token: string }>('/auth/cms-handoff', { method: 'POST' });
    if (!token) throw new Error('The backend returned no sign-in token');
    return `${target}#handoff=${encodeURIComponent(token)}`;
  } catch (err) {
    const status = err instanceof ApiError ? ` (HTTP ${err.status})` : '';
    const reason = `${err instanceof Error && err.message ? err.message : 'Unknown error'}${status}`;
    console.error('[cms-handoff] could not sign you in to the CMS automatically:', reason);
    return `${target}#handoff_error=${encodeURIComponent(reason)}`;
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
      if (isCmsRole(next.role) && CMS_URL) {
        setPhase('redirecting');
        const target = await cmsUrlWithHandoff();
        if (run === current) window.location.replace(target);
        return;
      }
      // Mentors work in the CMS Mentor Desk (they have no other CMS access)
      if (next.role === 'mentor' && CMS_URL) {
        setPhase('redirecting');
        const target = await cmsUrlWithHandoff('/mentorDesk');
        if (run === current) window.location.replace(target);
        return;
      }
      // Role-based landing page: desk accounts always end up on their desk, everyone else
      // is moved off desk URLs (typed in by hand or left over from a previous sign-in)
      if (isDeskRole(next.role)) {
        if (!isWithin(window.location.pathname, DESK_HOME[next.role])) replacePath(DESK_HOME[next.role]);
      } else if (isDeskPath(window.location.pathname)) {
        replacePath(STUDY_HOME);
      }
      setPhase('signed-in');
    });
    return () => unsubscribe();
  }, []);

  // Desk accounts can't navigate away with Back/Forward either: any other URL snaps back to their desk
  const deskRole = phase === 'signed-in' && isDeskRole(session?.role) ? session!.role : null;
  useEffect(() => {
    if (!isDeskRole(deskRole)) return;
    const home = DESK_HOME[deskRole];
    const keepOnDesk = () => {
      if (!isWithin(window.location.pathname, home)) replacePath(home);
    };
    window.addEventListener('popstate', keepOnDesk);
    return () => window.removeEventListener('popstate', keepOnDesk);
  }, [deskRole]);

  if (phase === 'checking') return <FullScreenMessage>Checking your session…</FullScreenMessage>;
  if (phase === 'redirecting') return <FullScreenMessage>Opening the CMS portal…</FullScreenMessage>;
  // Signing in triggers onAuthStateChanged above, which moves the gate on; nothing to do here
  if (phase === 'signed-out' || !session) return <AuthFlow onAuthenticated={() => {}} />;

  const value: AuthContextValue = {
    session,
    firstName: session.name.split(' ')[0] || session.name,
    logout: async () => {
      await authService.logout();
      // The next person signs in from the normal study address
      replacePath(STUDY_HOME);
    },
  };

  // Mentor / Teacher Assistance only ever get their desk; the study app is never rendered for them
  if (session.role === 'mentor') {
    return (
      <AuthContext.Provider value={value}>
        <MentorDesk />
      </AuthContext.Provider>
    );
  }
  if (session.role === 'teacher_assistant') {
    return (
      <AuthContext.Provider value={value}>
        <TeacherAssistantDesk />
      </AuthContext.Provider>
    );
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthGate;