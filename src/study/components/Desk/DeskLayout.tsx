import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, LogOut, type LucideIcon } from 'lucide-react';
import logo from '../photos/EDURAIN_Logo-Photoroom.png';
import { useAuth } from '../../AuthGate';
import { apiFetch, ApiError } from '../../lib/api';

/* ------------------------------------------------------------------ */
/*  Shared page for the Mentor and Teacher Assistance desks            */
/*                                                                      */
/*  The page loads its user from the desk's own API (e.g.               */
/*  GET /api/mentor-desk/me), which the backend only answers for the    */
/*  right role, so a desk is never shown to an account the server       */
/*  doesn't allow.                                                      */
/* ------------------------------------------------------------------ */

export interface DeskCard {
  icon: LucideIcon;
  title: string;
  text: string;
}

interface DeskLayoutProps {
  /** Desk API, e.g. "/mentor-desk" */
  apiPrefix: string;
  /** Badge next to the logo, e.g. "Mentor Desk" */
  deskName: string;
  subtitle: string;
  description: string;
  cards: DeskCard[];
  footer?: ReactNode;
}

type DeskState = { status: 'loading' } | { status: 'ready'; name: string } | { status: 'denied' | 'error'; message: string };

export function DeskLayout({ apiPrefix, deskName, subtitle, description, cards, footer }: DeskLayoutProps) {
  const { session, logout } = useAuth();
  const [state, setState] = useState<DeskState>({ status: 'loading' });
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ data?: { name?: string } }>(`${apiPrefix}/me`)
      .then((res) => !cancelled && setState({ status: 'ready', name: res.data?.name || session.name }))
      .catch((err) => {
        if (cancelled) return;
        const denied = err instanceof ApiError && (err.status === 401 || err.status === 403);
        setState({ status: denied ? 'denied' : 'error', message: err instanceof Error ? err.message : 'Something went wrong.' });
      });
    return () => {
      cancelled = true;
    };
  }, [apiPrefix, session.name]);

  const handleLogout = async () => {
    setSigningOut(true);
    setLogoutError(null);
    try {
      await logout();
    } catch (err) {
      console.error('Logout failed', err);
      setLogoutError(err instanceof Error ? err.message : 'Sign out failed. Please try again.');
      setSigningOut(false);
    }
  };

  const name = state.status === 'ready' ? state.name : session.name;

  return (
    <div className="min-h-screen w-full bg-[#DCEAE3] text-[#0B1C30] font-sans">
      <header className="bg-white/70 backdrop-blur-md border-b border-white/80">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src={logo} alt="EduRain" className="w-9 h-9 rounded-xl shadow-sm" />
            <span className="text-lg font-bold tracking-tight">
              <span className="text-emerald-600">Edu</span>
              <span className="text-amber-400 font-black">Rain</span>
            </span>
            <span className="hidden sm:inline-block text-[11px] font-semibold bg-[#175A67]/10 text-[#175A67] px-2.5 py-1 rounded-full">{deskName}</span>
          </div>
          <div className="flex items-center gap-3 min-w-0">
            <span className="hidden sm:block text-xs font-semibold text-[#175A67] truncate max-w-[220px]" title={session.email}>
              {session.email}
            </span>
            <button
              onClick={handleLogout}
              disabled={signingOut}
              className="flex items-center gap-1.5 bg-[#175A67] hover:bg-[#124853] disabled:opacity-60 text-white text-xs font-semibold px-3.5 py-2 rounded-full transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              {signingOut ? 'Signing out…' : 'Logout'}
            </button>
          </div>
        </div>
      </header>
      {logoutError && (
        <div className="bg-red-500/10 border-b border-red-500/20 text-red-700 px-4 py-2 text-center text-xs font-semibold flex items-center justify-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
          <span>{logoutError}</span>
        </div>
      )}

      <main className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {state.status === 'loading' ? (
          <div className="bg-white rounded-3xl p-10 flex items-center justify-center gap-3 text-sm text-[#175A67]" aria-busy="true">
            <span className="w-5 h-5 rounded-full border-2 border-[#175A67]/20 border-t-[#175A67] animate-spin" />
            Loading your desk…
          </div>
        ) : state.status !== 'ready' ? (
          <div className="bg-white rounded-3xl p-10 flex flex-col items-center text-center">
            <AlertTriangle className="w-7 h-7 text-amber-500 mb-3" />
            <h1 className="text-lg font-bold">{state.status === 'denied' ? 'You don’t have access to this page' : 'Couldn’t load your desk'}</h1>
            <p className="text-sm text-slate-500 mt-1 max-w-md">{state.message}</p>
            <button onClick={handleLogout} className="mt-5 bg-[#0B1C20] hover:bg-[#15302F] text-white text-xs font-semibold px-4 py-2 rounded-full">
              Logout
            </button>
          </div>
        ) : (
          <>
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F3B42] via-[#0D343B] to-[#0A262C] text-white p-6 sm:p-10 shadow-[0_12px_40px_rgba(15,59,66,0.25)]">
              <div className="absolute -top-24 right-0 w-[380px] h-[380px] rounded-full bg-teal-300/10 blur-[100px] pointer-events-none" />
              <div className="relative">
                <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-white/10 border border-white/15 px-3 py-1 rounded-full">{deskName}</span>
                <h1 className="text-2xl sm:text-4xl font-bold tracking-tight mt-4">Welcome, {name}!</h1>
                <p className="text-base sm:text-lg text-white/85 mt-2">{subtitle}</p>
                <p className="text-sm text-white/65 mt-3 max-w-2xl leading-relaxed">{description}</p>
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
              {cards.map((card) => (
                <article key={card.title} className="bg-white rounded-2xl p-5 shadow-[0_6px_24px_rgb(0,0,0,0.05)]">
                  <span className="w-11 h-11 rounded-xl bg-[#EAF3F1] text-[#175A67] flex items-center justify-center">
                    <card.icon className="w-5 h-5" />
                  </span>
                  <h2 className="font-semibold text-[15px] mt-4">{card.title}</h2>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{card.text}</p>
                  <span className="inline-block mt-4 text-[10px] font-bold uppercase tracking-wide bg-[#F6EFE9] text-[#40484B] px-2 py-0.5 rounded">Coming soon</span>
                </article>
              ))}
            </section>
          </>
        )}
        {footer && <footer className="mt-8">{footer}</footer>}
      </main>
    </div>
  );
}

export default DeskLayout;