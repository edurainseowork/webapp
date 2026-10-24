import React from 'react';
import { 
  LayoutDashboard, 
  Sparkles, 
  Database, 
  BookOpen, 
  FileText, 
  Swords, 
  Flame, 
  Crown, 
  ChevronRight, 
  HardDriveDownload,
  X,
  Target,
  Lock,
  Award
} from 'lucide-react';
import { UserProfile } from '../types';

export type NavTabId = 'study-central' | 'pi' | 'the-vault' | 'courses' | 'test-series';

interface SidebarProps {
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  onOpenUpgrade: () => void;
  user: UserProfile;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenDoubtSolver: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  onOpenUpgrade,
  user,
  isMobileOpen,
  onCloseMobile,
  onOpenDoubtSolver
}) => {

  const menuItems = [
    {
      id: 'study-central' as NavTabId,
      label: 'Home',
      icon: LayoutDashboard,
      badge: 'Home',
      badgeColor: 'text-emerald-400 bg-emerald-950/60 border-emerald-500/30',
    },
    {
      id: 'pi' as NavTabId,
      label: 'Daily Drop',
      icon: Sparkles,
      badge: 'Daily',
      badgeColor: 'text-amber-300 bg-amber-950/60 border-amber-500/30',
      action: onOpenDoubtSolver,
    },
    {
      id: 'the-vault' as NavTabId,
      label: 'The Vault',
      icon: Database,
      badge: '4.8k Docs',
      badgeColor: 'text-teal-300 bg-teal-950/60 border-teal-500/30',
    },
  ];

  const yourStudyItems: Array<{
    id: NavTabId;
    label: string;
    icon: any;
    badge?: string;
    badgeColor?: string;
    locked?: boolean;
    highlight?: boolean;
    pulse?: boolean;
  }> = [
    {
      id: 'courses' as NavTabId,
      label: 'Courses',
      icon: BookOpen,
      badge: '3 Active',
    },
    {
      id: 'test-series' as NavTabId,
      label: 'All India Test Pass',
      icon: Award,
      badge: 'Live',
      badgeColor: 'text-emerald-300 bg-emerald-950/60 border-emerald-500/40',
      locked: false,
      highlight: true,
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between p-4 text-slate-200">
      <div className="space-y-6">
        
        {/* Mobile Header Close */}
        <div className="flex items-center justify-between lg:hidden pb-3 border-b border-emerald-500/20">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950 font-bold">
              ER
            </div>
            <div className="flex items-center font-bold">
              <span className="text-emerald-500 font-bold">Edu</span>
              <span className="text-amber-400 font-black uppercase">RAIN</span>
              <span className="text-slate-300 font-normal ml-1">Navigation</span>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SECTION: MENU */}
        <div>
          <div className="px-3 mb-2 text-[11px] font-bold text-emerald-400/80 uppercase tracking-wider flex items-center justify-between">
            <span>MENU</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/40" />
          </div>

          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.action) {
                      item.action();
                    } else {
                      onSelectTab(item.id);
                      onCloseMobile();
                    }
                  }}
                  className={`group relative w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-500/25 via-emerald-500/15 to-transparent text-white font-semibold border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                      : 'text-slate-300 hover:text-white hover:bg-[#0a231b]/60 border border-transparent'
                  }`}
                >
                  {/* Left Active Glow Indicator Bar */}
                  {isActive && (
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-emerald-400 shadow-[0_0_8px_#10B981]" />
                  )}

                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg transition-colors ${
                      isActive ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 group-hover:text-emerald-400'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${item.badgeColor || 'text-slate-400 bg-slate-900/60 border-slate-700/50'}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          {yourStudyItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.locked) return;
                    onSelectTab(item.id);
                    onCloseMobile();
                  }}
                  className={`group relative w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    item.locked
                      ? 'cursor-not-allowed opacity-70 text-slate-400'
                      : isActive
                      ? 'bg-gradient-to-r from-emerald-500/25 via-emerald-500/15 to-transparent text-white font-semibold border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                      : 'text-slate-300 hover:text-white hover:bg-[#0a231b]/60 border border-transparent'
                  }`}
                >
                  {/* Left Active Glow Indicator Bar */}
                  {isActive && (
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-emerald-400 shadow-[0_0_8px_#10B981]" />
                  )}

                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg transition-colors ${
                      isActive ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 group-hover:text-emerald-400'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span>{item.label}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {item.locked && (
                      <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                    )}
                    {item.badge && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium flex items-center gap-1 ${
                        item.pulse 
                          ? 'bg-red-950/70 border-red-500/40 text-red-300 animate-pulse'
                          : item.badgeColor || 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300'
                      }`}>
                        {item.pulse && <span className="w-1.5 h-1.5 rounded-full bg-red-400" />}
                        {item.badge}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Daily Streak Card */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#09221a]/90 to-[#04120e]/95 border border-emerald-500/30 shadow-inner">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                <Flame className="w-4 h-4 fill-amber-400" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">{user.streakDays}-Day Streak</div>
                <div className="text-[10px] text-amber-300 font-medium">+150 XP Today</div>
              </div>
            </div>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
              {user.dailyGoalPercent}%
            </span>
          </div>

          <div className="w-full bg-slate-900/80 rounded-full h-1.5 overflow-hidden border border-emerald-500/20">
            <div 
              className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${user.dailyGoalPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-slate-400 mt-1.5">
            <span>Daily Goal: 4 hrs</span>
            <span>3.1 hrs done</span>
          </div>
        </div>

        {/* Vault Sync Telemetry */}
        <div className="px-2 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <HardDriveDownload className="w-3.5 h-3.5 text-teal-400" />
            Vault Offline Cache
          </span>
          <span className="text-teal-300 font-mono font-medium">98% Synced</span>
        </div>

      </div>

      {/* Bottom Sidebar CTA: Full-width Gold Button (Hidden for now as requested) */}
      {/*
      <div className="pt-4 border-t border-emerald-500/20">
        <button
          onClick={onOpenUpgrade}
          className="w-full relative group overflow-hidden bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider py-3 px-4 rounded-xl shadow-[0_0_25px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] transition-all flex items-center justify-center gap-2"
        >
          <div className="absolute inset-0 w-1/2 h-full bg-white/20 skew-x-12 -translate-x-full group-hover:translate-x-[300%] transition-transform duration-1000 ease-out" />
          <Crown className="w-4 h-4 fill-slate-950" />
          <span>★ UPGRADE TO PRO</span>
          <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-950/70 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
      */}
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden lg:block w-64 xl:w-72 flex-shrink-0 sticky top-16 h-[calc(100vh-4rem)] backdrop-blur-md bg-[#040e0b]/80 border-r border-emerald-500/20 overflow-y-auto no-scrollbar z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div 
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[85vw] h-full bg-[#05140f] border-r border-emerald-500/30 z-10 shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
