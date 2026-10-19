import React from 'react';
import { Bot, FileText, BookOpen, Star, ShieldCheck } from 'lucide-react';
import logo from '../photos/EDURAIN_Logo-Photoroom.png';

/* ------------------------------------------------------------------ */
/*  Static content                                                      */
/* ------------------------------------------------------------------ */

const HIGHLIGHTS = [
  { icon: Bot, title: 'AI Mentor, 24/7', desc: 'Step-by-step doubt solving with full derivations' },
  { icon: FileText, title: 'All-India CBT Test Series', desc: 'Real NTA interface with an AIR predictor' },
  { icon: BookOpen, title: 'E-Book Vault', desc: 'Ranker-curated volumes with offline sync' },
];

const STATS = [
  { value: '45,000+', label: 'Aspirants' },
  { value: '4,800+', label: 'Ranker notes' },
  { value: '4.9', label: 'Avg. rating', star: true },
];

/* ------------------------------------------------------------------ */
/*  Brand                                                               */
/* ------------------------------------------------------------------ */

export function AuthBrand({ onDark = false }: { onDark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl bg-[#175A67] flex items-center justify-center shadow-md overflow-hidden">
        <img src={logo} alt="EduRain Logo" className="w-7 h-7 object-contain" />
      </div>
      <div className="flex items-center text-xl font-bold tracking-tight">
        <span className={onDark ? 'text-emerald-400' : 'text-emerald-600'}>Edu</span>
        <span className="text-amber-400 font-black uppercase">RAIN</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Card shell used by every auth screen                                */
/* ------------------------------------------------------------------ */

interface AuthCardProps {
  icon?: React.ComponentType<{ className?: string }>;
  iconTone?: 'teal' | 'emerald' | 'amber';
  header?: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const ICON_TONES: Record<NonNullable<AuthCardProps['iconTone']>, string> = {
  teal: 'bg-[#EAF3F1] text-[#175A67]',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
};

export function AuthCard({ icon: Icon, iconTone = 'teal', header, title, subtitle, children, footer }: AuthCardProps) {
  return (
    <>
      <div className="bg-white rounded-[28px] border border-slate-200/80 shadow-[0_12px_40px_rgba(11,28,32,0.06)] p-6 sm:p-8">
        {header}
        {Icon && (
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 ${ICON_TONES[iconTone]}`}>
            <Icon className="w-6 h-6" />
          </div>
        )}
        <h1 className="text-2xl font-bold text-[#0B1C30] tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="text-center text-xs text-slate-500 mt-5 leading-relaxed px-4">{footer}</div>}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Page layout: brand panel (desktop) + form column                    */
/* ------------------------------------------------------------------ */

interface AuthLayoutProps {
  children: React.ReactNode;
  topAction?: React.ReactNode;
}

export function AuthLayout({ children, topAction }: AuthLayoutProps) {
  return (
    <div className="min-h-screen w-full flex bg-[#F3F5F7] font-sans text-[#0B1C30]">
      {/* Brand panel */}
      <aside className="hidden lg:flex relative w-[46%] xl:w-[44%] shrink-0 overflow-hidden bg-[#0B1C20] text-white">
        <div className="absolute -top-28 -right-28 w-[440px] h-[440px] rounded-full bg-emerald-400/20 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-36 -left-24 w-[400px] h-[400px] rounded-full bg-amber-300/10 blur-[120px] pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)',
            backgroundSize: '22px 22px',
          }}
        />

        <div className="relative flex flex-col justify-between w-full p-10 xl:p-14">
          <AuthBrand onDark />

          <div className="my-10">
            <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-400/10 border border-emerald-400/30 px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              2026 JEE Advanced Edition Live
            </span>
            <h2 className="text-4xl xl:text-[44px] font-semibold leading-[1.1] tracking-tight mt-5">
              Your victory
              <br />
              starts here.
            </h2>
            <p className="text-sm text-white/60 mt-4 max-w-sm leading-relaxed">
              One login for your courses, AI mentor, test series and e-book library — synced across web and mobile.
            </p>

            <div className="mt-8 space-y-3 max-w-sm">
              {HIGHLIGHTS.map((item) => (
                <div
                  key={item.title}
                  className="flex items-center gap-3.5 rounded-2xl bg-white/[0.04] border border-white/10 px-4 py-3 backdrop-blur-sm"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-400/10 text-emerald-300 flex items-center justify-center shrink-0">
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-[11px] text-white/50 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="grid grid-cols-3 gap-4 border-t border-white/10 pt-6 max-w-sm">
              {STATS.map((stat) => (
                <div key={stat.label}>
                  <p className="text-xl font-bold flex items-center gap-1">
                    {stat.value}
                    {stat.star && <Star className="w-4 h-4 text-amber-400 fill-amber-400" />}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-white/45 font-semibold mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-white/35 mt-6">© {new Date().getFullYear()} EduRain. All rights reserved.</p>
          </div>
        </div>
      </aside>

      {/* Form column */}
      <main className="flex-1 min-w-0 flex flex-col min-h-screen">
        <div className="flex items-center justify-between lg:justify-end gap-3 px-5 sm:px-8 py-5">
          <div className="lg:hidden">
            <AuthBrand />
          </div>
          {topAction && <div className="text-xs sm:text-sm text-slate-500 text-right">{topAction}</div>}
        </div>

        <div className="flex-1 flex items-center justify-center px-4 sm:px-8 py-4">
          <div className="w-full max-w-[440px]">{children}</div>
        </div>

        <div className="px-5 sm:px-8 py-5 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          Secure, encrypted sign-in
        </div>
      </main>
    </div>
  );
}
