import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Search,
  X,
  Sparkles,
  Waves,
  FlaskConical,
  Sigma,
  LayoutGrid,
  Rows3,
  BadgeCheck,
  Heart,
  CalendarDays,
  SearchX,
} from 'lucide-react';
import { AVAILABILITY_LABELS, MENTORS, Mentor, MentorSubject, SUBJECT_FILTERS, initialsOf } from './mentorData';

type SubjectFilter = 'All' | MentorSubject;
type ViewMode = 'list' | 'grid';

const FILTER_ICONS: Record<SubjectFilter, React.ComponentType<{ className?: string }>> = {
  All: Sparkles,
  Physics: Waves,
  Chemistry: FlaskConical,
  Mathematics: Sigma,
};

/* ------------------------------------------------------------------ */
/*  Small pieces                                                        */
/* ------------------------------------------------------------------ */

function MentorAvatar({ mentor, size = 'md' }: { mentor: Mentor; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'w-16 h-16 text-lg' : 'w-14 h-14 text-base';
  return (
    <div className="relative shrink-0">
      <div className={`${box} rounded-xl bg-gradient-to-br ${mentor.avatarTone} text-white font-bold flex items-center justify-center shadow-md`}>
        {initialsOf(mentor.name)}
      </div>
      {mentor.online && (
        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-white" title="Online" />
      )}
    </div>
  );
}

function AvailabilityPill({ mentor }: { mentor: Mentor }) {
  const meta = AVAILABILITY_LABELS[mentor.availability];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${meta.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Main view                                                           */
/* ------------------------------------------------------------------ */

interface MentorsViewProps {
  favorites: string[];
  onToggleFavorite: (mentorId: string) => void;
  onBack: () => void;
  onOpenMentor: (mentorId: string) => void;
}

export function MentorsView({ favorites, onToggleFavorite, onBack, onOpenMentor }: MentorsViewProps) {
  const [subject, setSubject] = useState<SubjectFilter>('All');
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const searchRef = useRef<HTMLInputElement>(null);

  // Ctrl/Cmd + K focuses the mentor search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const q = query.trim().toLowerCase();
  const visible = MENTORS.filter((mentor) => {
    const matchesSubject = subject === 'All' || mentor.subjects.includes(subject);
    const matchesQuery =
      !q ||
      mentor.name.toLowerCase().includes(q) ||
      mentor.credential.toLowerCase().includes(q) ||
      mentor.headline.toLowerCase().includes(q) ||
      mentor.topics.some((t) => t.toLowerCase().includes(q));
    return matchesSubject && matchesQuery;
  });

  const resetFilters = () => {
    setSubject('All');
    setQuery('');
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#DCEAE3] font-sans text-[#0B1C30]">
      {/* ---------------------------------------------------------- */}
      {/* Top bar                                                     */}
      {/* ---------------------------------------------------------- */}
      <header className="shrink-0 h-16 bg-[#FCF6F1] border-b border-[#175A67]/10 px-3 sm:px-6 flex items-center gap-2 sm:gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 bg-[#F1EBE5] hover:bg-[#E9DFD6] border border-[#175A67]/10 text-xs font-semibold px-3 py-2 rounded-full transition-colors shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>

        <div className="hidden sm:block shrink-0 leading-tight">
          <span className="inline-block text-[9px] font-bold uppercase tracking-wider bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">
            Mentorship
          </span>
          <p className="text-[10px] text-slate-500 mt-0.5">1-on-1 sessions</p>
        </div>

        <button
          onClick={() => {
            resetFilters();
            searchRef.current?.focus();
          }}
          className="hidden md:block bg-[#0F3B42] hover:bg-[#0b2c31] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shrink-0"
        >
          Find Mentors
        </button>

        <div className="flex-1 min-w-0 flex justify-center">
          <div className="relative w-full max-w-xl flex items-center">
            <Search className="absolute left-3.5 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search mentor name, 'Moment of Inertia', 'IIT Bombay'..."
              className="w-full pl-10 pr-9 py-2.5 rounded-full bg-[#F4EDE7] text-xs sm:text-sm placeholder-slate-400 border border-transparent focus:outline-none focus:bg-white focus:border-[#175A67] focus:ring-4 focus:ring-[#175A67]/10 transition-all"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-3 text-slate-400 hover:text-[#0B1C30]" title="Clear search">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------- */}
      {/* Body                                                        */}
      {/* ---------------------------------------------------------- */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-5 pb-16">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#175A67] mb-3">
            <span className="text-slate-400 font-normal">/</span> 1-on-1 Mentors <span className="text-slate-400 font-normal">/</span>
          </p>

          {/* Filter bar */}
          <div className="bg-white rounded-2xl px-3 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_6px_24px_rgb(0,0,0,0.04)] mb-6">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {SUBJECT_FILTERS.map((filter) => {
                const Icon = FILTER_ICONS[filter];
                const active = subject === filter;
                return (
                  <button
                    key={filter}
                    onClick={() => setSubject(filter)}
                    className={`flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                      active ? 'bg-[#0F3B42] text-white shadow-sm' : 'bg-[#EEF6F3] text-[#0B1C30] hover:bg-[#E2EFEA]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {filter === 'All' ? 'All Topics' : filter}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
              <span className="text-xs text-[#175A67]">
                Showing <span className="font-bold text-[#0B1C30] text-sm">{visible.length}</span> of {MENTORS.length} mentors
              </span>
              <div className="flex items-center bg-[#F4EDE7] rounded-lg p-0.5">
                {(
                  [
                    { id: 'grid', icon: LayoutGrid, title: 'Grid view' },
                    { id: 'list', icon: Rows3, title: 'List view' },
                  ] as const
                ).map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setViewMode(mode.id)}
                    title={mode.title}
                    className={`p-1.5 rounded-md transition-all ${
                      viewMode === mode.id ? 'bg-white text-[#0B1C30] shadow-sm' : 'text-slate-500 hover:text-[#0B1C30]'
                    }`}
                  >
                    <mode.icon className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mentors */}
          {visible.length === 0 ? (
            <div className="bg-white rounded-2xl py-14 px-6 flex flex-col items-center text-center">
              <SearchX className="w-6 h-6 text-slate-400 mb-2" />
              <p className="font-semibold">No mentors match your search</p>
              <p className="text-xs text-slate-500 mt-1">Try a mentor name, a topic like “Calculus”, or a college.</p>
              <button
                onClick={resetFilters}
                className="mt-4 bg-[#0F3B42] hover:bg-[#0b2c31] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                Show all mentors
              </button>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
              {visible.map((mentor) => {
                const isFavorite = favorites.includes(mentor.id);
                return (
                  <article
                    key={mentor.id}
                    onClick={() => onOpenMentor(mentor.id)}
                    className={`bg-white rounded-2xl p-5 sm:p-6 shadow-[0_6px_24px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_32px_rgb(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer flex gap-4 ${
                      viewMode === 'grid' ? 'flex-col' : 'items-center'
                    }`}
                  >
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <MentorAvatar mentor={mentor} />
                      <div className="min-w-0 flex-1">
                        <h3 className="flex items-center gap-1.5 font-semibold text-[15px]">
                          <span className="truncate">{mentor.name}</span>
                          <BadgeCheck className="w-4 h-4 text-white fill-[#175A67] shrink-0" />
                        </h3>
                        <p className="text-[11px] text-slate-600 mt-0.5 truncate">• {mentor.credential}</p>
                        <div className="mt-2">
                          <AvailabilityPill mentor={mentor} />
                        </div>
                      </div>
                    </div>

                    <div
                      className={`flex shrink-0 ${
                        viewMode === 'grid' ? 'items-center justify-between' : 'flex-col items-end justify-between gap-5 self-stretch'
                      }`}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(mentor.id);
                        }}
                        title={isFavorite ? 'Remove from favourites' : 'Add to favourites'}
                        className="p-1 rounded-full hover:bg-slate-100 transition-colors"
                      >
                        <Heart className={`w-5 h-5 transition-colors ${isFavorite ? 'text-red-600 fill-red-600' : 'text-[#0B1C30]'}`} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenMentor(mentor.id);
                        }}
                        className="flex items-center gap-1.5 bg-[#0F3B42] hover:bg-[#0b2c31] text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-all active:scale-95"
                      >
                        <CalendarDays className="w-3.5 h-3.5" />
                        Book 1:1
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MentorsView;
