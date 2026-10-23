import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Bell, 
  Sparkles, 
  ChevronDown, 
  Crown, 
  Flame, 
  X, 
  Command, 
  BookOpen, 
  Award, 
  CheckCircle2,
  Menu
} from 'lucide-react';
import { UserProfile } from '../types';
import logoImage from './photos/EDURAIN_Logo-Photoroom.png';

interface HeaderProps {
  user: UserProfile;
  selectedBatch: string;
  onSelectBatch: (batch: string) => void;
  onOpenUpgrade: () => void;
  onToggleNotifications: () => void;
  unreadCount: number;
  onSearch: (query: string) => void;
  onToggleSidebarMobile: () => void;
}

const BATCH_OPTIONS = [
  { id: '12th - IIT JEE', label: '12th - IIT JEE', desc: 'Target 2027 Advanced', badge: 'Active Batch' },
  { id: '11th - IIT JEE', label: '11th - IIT JEE', desc: 'Foundation & Concepts', badge: 'Enrolled' },
  { id: 'Dropper - JEE Advanced', label: 'Dropper - JEE Advanced', desc: 'Intensive Rank Booster', badge: 'Pro Batch' },
  { id: 'NEET-UG Premier', label: 'NEET-UG Premier', desc: 'Medical Focus Batch', badge: 'Alternative' },
];

export const Header: React.FC<HeaderProps> = ({
  user,
  selectedBatch,
  onSelectBatch,
  onOpenUpgrade,
  onToggleNotifications,
  unreadCount,
  onSearch,
  onToggleSidebarMobile
}) => {
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const batchDropdownRef = useRef<HTMLDivElement>(null);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside to close batch dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (batchDropdownRef.current && !batchDropdownRef.current.contains(event.target as Node)) {
        setIsBatchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    onSearch(e.target.value);
  };

  const clearSearch = () => {
    setSearchQuery('');
    onSearch('');
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-[#040e0b]/85 border-b border-emerald-500/20 shadow-lg transition-all">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* Left: Brand Logo & Target Class Selector */}
        <div className="flex items-center gap-4 lg:gap-6 flex-shrink-0">
          <button
            onClick={onToggleSidebarMobile}
            className="lg:hidden p-2 rounded-lg text-slate-300 hover:text-emerald-400 hover:bg-emerald-950/40 transition-colors"
            title="Toggle Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Logo */}
          <div className="flex items-center gap-2.5 group cursor-pointer">
            <img src={logoImage} alt="EduRAIN Logo" className="h-10 w-auto object-contain group-hover:scale-105 transition-transform" />
            <div className="flex items-center text-xl font-black tracking-tight font-sans">
              <span className="text-emerald-600 font-bold">Edu</span>
              <span className="text-amber-400 font-black uppercase">RAIN</span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 ml-1.5">
                LMS
              </span>
            </div>
          </div>

          {/* Class Dropdown */}
          <div className="relative hidden sm:block" ref={batchDropdownRef}>
            <button
              onClick={() => setIsBatchOpen(!isBatchOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0a2019]/90 hover:bg-[#0e2a21] border border-emerald-500/30 text-xs font-semibold text-emerald-300 transition-all shadow-sm"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{selectedBatch}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isBatchOpen ? 'rotate-180' : ''}`} />
            </button>

            {isBatchOpen && (
              <div className="absolute left-0 top-full mt-2 w-64 rounded-xl bg-[#061712] border border-emerald-500/30 shadow-2xl p-2 z-50 animate-fadeIn">
                <div className="px-2 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Target Curriculum
                </div>
                {BATCH_OPTIONS.map((batch) => (
                  <button
                    key={batch.id}
                    onClick={() => {
                      onSelectBatch(batch.id);
                      setIsBatchOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg flex items-center justify-between text-xs transition-colors ${
                      selectedBatch === batch.id
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                        : 'text-slate-300 hover:bg-emerald-950/40 hover:text-white'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{batch.label}</div>
                      <div className="text-[10px] text-slate-400">{batch.desc}</div>
                    </div>
                    {selectedBatch === batch.id && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center: Rounded Search Bar */}
        <div className="flex-1 max-w-xl mx-2 relative">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 w-4 h-4 text-emerald-400/70 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              placeholder="Search in Resources, Formulae, Mock Tests..."
              className="w-full pl-10 pr-20 py-2 rounded-full bg-[#081b15]/90 border border-emerald-500/25 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 transition-all shadow-inner"
            />
            <div className="absolute right-3 flex items-center gap-1">
              {searchQuery ? (
                <button
                  onClick={clearSearch}
                  className="p-1 text-slate-400 hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-900/80 border border-slate-700/60 rounded">
                  <Command className="w-2.5 h-2.5" /> K
                </kbd>
              )}
            </div>
          </div>

          {/* Quick search suggestion drop */}
          {isSearchFocused && !searchQuery && (
            <div className="absolute left-0 right-0 top-full mt-2 p-3 bg-[#061712]/95 backdrop-blur-xl border border-emerald-500/30 rounded-2xl shadow-2xl z-50 animate-fadeIn text-xs">
              <div className="text-[11px] font-semibold text-slate-400 mb-2">Quick Shortcuts</div>
              <div className="flex flex-wrap gap-1.5">
                {['Thermodynamics', 'Calculus Formula Sheet', 'JEE Mock 04', 'Organic Reactions', 'Rotational Mechanics'].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      setSearchQuery(tag);
                      onSearch(tag);
                    }}
                    className="px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-400 text-[11px] transition-all"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Gold CTA, Notifications & User Profile */}
        <div className="flex items-center gap-3 lg:gap-4 flex-shrink-0">
          {/* Gold CTA Button (Hidden for now as requested) */}
          {/*
          <button
            onClick={onOpenUpgrade}
            className="hidden sm:flex items-center gap-1.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-extrabold text-xs uppercase tracking-wider px-4 py-2 rounded-lg shadow-[0_0_20px_rgba(245,158,11,0.35)] hover:shadow-[0_0_25px_rgba(245,158,11,0.6)] hover:brightness-105 active:scale-95 transition-all"
          >
            <Crown className="w-3.5 h-3.5 fill-slate-950" />
            <span>UPGRADE TO PRO</span>
          </button>
          */}

          {/* Notification Bell */}
          <button
            onClick={onToggleNotifications}
            className="relative p-2 rounded-xl bg-[#091f18]/80 hover:bg-[#0d2a21] border border-emerald-500/25 text-slate-300 hover:text-white transition-all"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-slate-950 animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* User Profile */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-emerald-500/20">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-800 p-0.5 shadow-md">
                <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-xs font-bold text-emerald-300">
                  AB
                </div>
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-950" />
            </div>

            <div className="hidden xl:flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-100">Hi, {user.name}</span>
                <span className="px-1.5 py-0.2 bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded text-[9px] font-extrabold uppercase">
                  AIR #{user.airRank}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-medium">
                <span className="flex items-center gap-0.5">
                  <Flame className="w-3 h-3 text-amber-400 fill-amber-400" />
                  {user.streakDays}d Streak
                </span>
                <span>•</span>
                <span>{user.xp.toLocaleString()} XP</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </header>
  );
};
