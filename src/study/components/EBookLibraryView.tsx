import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Search,
  Command,
  X,
  Home,
  ChevronRight,
  Zap,
  FlaskConical,
  Calculator,
  Heart,
  Star,
  Download,
  BookOpen,
  LayoutGrid,
  List,
  Check,
  CheckCircle2,
  SearchX,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type SubjectId = 'physics' | 'chemistry' | 'mathematics';
type BookType = 'theory' | 'exemplar' | 'handbook';
type TypeFilter = 'all' | BookType;
type ViewMode = 'grid' | 'list';

export interface EBook {
  id: string;
  subject: SubjectId;
  type: BookType;
  title: string;
  coverTagline: string;
  coverMeta: string;
  badge?: { label: string; tone: 'teal' | 'amber' };
  rating?: number;
  pagesRead: number;
  totalPages: number;
  annotations: number;
  isLive: boolean;
  glow: string;
  keywords: string[];
}

interface SubjectMeta {
  id: SubjectId;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconWrap: string;
  barColor: string;
  pctColor: string;
}

interface EBookLibraryViewProps {
  onBack: () => void;
  onOpenBook?: (book: EBook) => void;
}

/* ------------------------------------------------------------------ */
/*  Dummy content                                                       */
/* ------------------------------------------------------------------ */

const SUBJECTS: SubjectMeta[] = [
  {
    id: 'physics',
    title: 'Physics E-Books',
    icon: Zap,
    iconWrap: 'bg-[#0F3B42] text-white',
    barColor: 'bg-[#0F766E]',
    pctColor: 'text-[#0F766E]',
  },
  {
    id: 'chemistry',
    title: 'Chemistry E-Books',
    icon: FlaskConical,
    iconWrap: 'bg-emerald-100 text-emerald-600',
    barColor: 'bg-emerald-500',
    pctColor: 'text-emerald-600',
  },
  {
    id: 'mathematics',
    title: 'Mathematics E-Books',
    icon: Calculator,
    iconWrap: 'bg-blue-100 text-blue-600',
    barColor: 'bg-blue-600',
    pctColor: 'text-blue-600',
  },
];

const TYPE_LABELS: Record<BookType, string> = {
  theory: 'Complete Theory Volume',
  exemplar: 'Solved Exemplar',
  handbook: 'Formula Handbook',
};

const TYPE_FILTERS: {
  id: TypeFilter;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconClass?: string;
}[] = [
  { id: 'all', label: 'All E-Books' },
  { id: 'theory', label: 'Complete Theory Volumes' },
  { id: 'handbook', label: 'Formula Handbooks', icon: Zap, iconClass: 'text-amber-500 fill-amber-400' },
  { id: 'exemplar', label: 'Solved Exemplars', icon: Check, iconClass: 'stroke-[3]' },
];

const BOOKS: EBook[] = [
  // Physics
  {
    id: 'phy-modern',
    subject: 'physics',
    type: 'theory',
    title: 'Modern Physics',
    coverTagline: 'Core Theory Edition',
    coverMeta: 'JEE Advanced',
    pagesRead: 0,
    totalPages: 246,
    annotations: 0,
    isLive: true,
    glow: 'bg-teal-300/10',
    keywords: ['Photoelectric Effect', 'Atoms', 'Nuclei', 'Dual Nature'],
  },
  {
    id: 'phy-pyq',
    subject: 'physics',
    type: 'exemplar',
    title: "JEE Advanced 45-Year PYQ's",
    coverTagline: 'Multi-Concept Bank',
    coverMeta: 'Past 45 Years',
    badge: { label: '2026 Master Series', tone: 'teal' },
    rating: 4.98,
    pagesRead: 180,
    totalPages: 420,
    annotations: 22,
    isLive: true,
    glow: 'bg-emerald-400/20',
    keywords: ['PYQ', 'Previous Year', 'Mechanics', 'Optics'],
  },
  {
    id: 'phy-electro',
    subject: 'physics',
    type: 'handbook',
    title: 'Electrodynamics',
    coverTagline: 'Summary & Shortcuts',
    coverMeta: 'Speed Revision',
    badge: { label: 'Updated 2026', tone: 'amber' },
    rating: 4.92,
    pagesRead: 160,
    totalPages: 194,
    annotations: 18,
    isLive: true,
    glow: 'bg-amber-300/25',
    keywords: ['Electrostatics', 'Gauss Law', 'Capacitors', 'EMI & AC'],
  },
  {
    id: 'phy-hcv',
    subject: 'physics',
    type: 'theory',
    title: 'Concepts of Physics Vol. 1',
    coverTagline: 'HC Verma Edition',
    coverMeta: 'Mechanics & Waves',
    rating: 4.95,
    pagesRead: 380,
    totalPages: 380,
    annotations: 12,
    isLive: true,
    glow: 'bg-sky-300/15',
    keywords: ['HC Verma', 'Kinematics', 'Rotational Motion', 'Waves'],
  },

  // Chemistry
  {
    id: 'chem-physical',
    subject: 'chemistry',
    type: 'theory',
    title: 'Physical Chemistry',
    coverTagline: 'Core Theory Edition',
    coverMeta: 'JEE Advanced',
    pagesRead: 410,
    totalPages: 620,
    annotations: 9,
    isLive: true,
    glow: 'bg-teal-300/10',
    keywords: ['Thermodynamics', 'Equilibrium', 'Electrochemistry', 'Kinetics'],
  },
  {
    id: 'chem-organic',
    subject: 'chemistry',
    type: 'handbook',
    title: 'Organic Reaction Mechanisms',
    coverTagline: 'Named Reactions Map',
    coverMeta: 'Speed Revision',
    badge: { label: 'Updated 2026', tone: 'amber' },
    rating: 4.9,
    pagesRead: 150,
    totalPages: 280,
    annotations: 11,
    isLive: true,
    glow: 'bg-amber-300/25',
    keywords: ['Named Reactions', 'Reagents', 'Stereochemistry', 'Aldol'],
  },
  {
    id: 'chem-inorganic',
    subject: 'chemistry',
    type: 'exemplar',
    title: 'Inorganic NCERT Exemplar',
    coverTagline: 'Line-by-Line Solved',
    coverMeta: 'NCERT + JEE',
    badge: { label: '2026 Master Series', tone: 'teal' },
    rating: 4.94,
    pagesRead: 300,
    totalPages: 680,
    annotations: 7,
    isLive: true,
    glow: 'bg-emerald-400/20',
    keywords: ['NCERT', 'p-Block', 'Coordination Compounds', 'Metallurgy'],
  },

  // Mathematics
  {
    id: 'math-calculus',
    subject: 'mathematics',
    type: 'theory',
    title: 'Differential & Integral Calculus',
    coverTagline: 'Core Theory Edition',
    coverMeta: 'JEE Advanced',
    pagesRead: 380,
    totalPages: 480,
    annotations: 3,
    isLive: true,
    glow: 'bg-blue-300/15',
    keywords: ['Limits', 'Definite Integrals', 'Area Under Curve', 'Differential Equations'],
  },
  {
    id: 'math-coordinate',
    subject: 'mathematics',
    type: 'handbook',
    title: 'Coordinate Geometry',
    coverTagline: 'Curves & Conics',
    coverMeta: 'Speed Revision',
    badge: { label: 'Updated 2026', tone: 'amber' },
    rating: 4.9,
    pagesRead: 140,
    totalPages: 160,
    annotations: 2,
    isLive: true,
    glow: 'bg-amber-300/25',
    keywords: ['Parabola', 'Ellipse', 'Hyperbola', 'Straight Lines'],
  },
  {
    id: 'math-algebra',
    subject: 'mathematics',
    type: 'exemplar',
    title: 'Algebra Problem Bank',
    coverTagline: 'Multi-Concept Bank',
    coverMeta: 'Past 25 Years',
    badge: { label: '2026 Master Series', tone: 'teal' },
    rating: 4.96,
    pagesRead: 290,
    totalPages: 480,
    annotations: 0,
    isLive: true,
    glow: 'bg-emerald-400/20',
    keywords: ['Complex Numbers', 'Probability', 'Matrices', 'Sequences'],
  },
];

const BADGE_STYLES: Record<'teal' | 'amber', string> = {
  teal: 'border-teal-400/60 text-teal-300 bg-teal-400/10',
  amber: 'border-amber-400/60 text-amber-300 bg-amber-400/10',
};

const readPct = (read: number, total: number) => (total === 0 ? 0 : Math.round((read / total) * 100));

const matchesQuery = (book: EBook, query: string) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    book.title.toLowerCase().includes(q) ||
    book.coverTagline.toLowerCase().includes(q) ||
    TYPE_LABELS[book.type].toLowerCase().includes(q) ||
    book.keywords.some((k) => k.toLowerCase().includes(q))
  );
};

/* ------------------------------------------------------------------ */
/*  Small shared bits                                                   */
/* ------------------------------------------------------------------ */

function LiveDot() {
  return (
    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase tracking-wide">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      Live Now
    </span>
  );
}

function TypePill({ type }: { type: BookType }) {
  return (
    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wide text-slate-600 bg-slate-50 border border-slate-200 px-2 py-1 rounded-md whitespace-nowrap">
      {TYPE_LABELS[type]}
    </span>
  );
}

function BookCover({ book, compact = false }: { book: EBook; compact?: boolean }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-gradient-to-br from-[#14363C] via-[#0F2A2F] to-[#0A1C20] flex flex-col ${
        compact ? 'h-[104px] p-3' : 'h-[120px] p-3.5'
      }`}
    >
      <div className={`absolute -right-8 -bottom-10 w-36 h-36 rounded-full blur-2xl pointer-events-none ${book.glow}`} />

      <div className="relative flex items-start justify-between gap-2 min-h-[18px]">
        {book.badge ? (
          <span
            className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-wider whitespace-nowrap border px-1.5 py-0.5 rounded ${BADGE_STYLES[book.badge.tone]}`}
          >
            {book.badge.label}
          </span>
        ) : (
          <span />
        )}
        {book.rating && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-white">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            {book.rating}
          </span>
        )}
      </div>

      <div className="relative flex-1 flex items-center">
        <h4 className={`font-semibold text-white leading-tight line-clamp-2 ${compact ? 'text-sm' : 'text-base sm:text-[17px]'}`}>
          {book.title}
        </h4>
      </div>

      <div className="relative flex items-center justify-between gap-2 pt-2 border-t border-white/15 text-[9px] sm:text-[10px] text-white/60 font-medium">
        <span className="truncate">{book.coverTagline}</span>
        <span className="truncate text-right">{book.coverMeta}</span>
      </div>
    </div>
  );
}

function ReadProgress({ book }: { book: EBook }) {
  const pct = readPct(book.pagesRead, book.totalPages);
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] font-semibold">
        <span className={pct > 0 ? 'text-emerald-600' : 'text-slate-500'}>
          {pct === 100 ? 'Completed' : `${pct}% Read`}
        </span>
        <span className="text-slate-500 font-medium">
          {book.pagesRead} / {book.totalPages} pgs
        </span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full bg-emerald-600 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function BookActions({ onDownload, onOpen }: { onDownload: () => void; onOpen: () => void }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <button
        onClick={onDownload}
        className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-[#0B1C30] transition-all active:scale-95"
      >
        <Download className="w-3.5 h-3.5" />
        PDF
      </button>
      <button
        onClick={onOpen}
        className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#0B1C20] hover:bg-[#15302F] text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
      >
        <BookOpen className="w-3.5 h-3.5" />
        Enter Library
        <ChevronRight className="w-3.5 h-3.5 -ml-0.5" />
      </button>
    </div>
  );
}

function FavoriteButton({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title={active ? 'Remove from favourites' : 'Add to favourites'}
      className="p-1 rounded-full hover:bg-slate-100 transition-colors shrink-0"
    >
      <Heart className={`w-4 h-4 transition-colors ${active ? 'text-red-500 fill-red-500' : 'text-slate-400'}`} />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main view                                                           */
/* ------------------------------------------------------------------ */

export function EBookLibraryView({ onBack, onOpenBook }: EBookLibraryViewProps) {
  const [activeSubject, setActiveSubject] = useState<SubjectId>('physics');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>(['phy-pyq']);
  const [toast, setToast] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Ctrl+K / Cmd+K focuses the vault search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const subjectStats = useMemo(
    () =>
      SUBJECTS.map((subject) => {
        const books = BOOKS.filter((b) => b.subject === subject.id);
        const pages = books.reduce((sum, b) => sum + b.totalPages, 0);
        const read = books.reduce((sum, b) => sum + b.pagesRead, 0);
        return { ...subject, volumes: books.length, pages, pct: readPct(read, pages) };
      }),
    []
  );

  const totalAnnotations = BOOKS.reduce((sum, b) => sum + b.annotations, 0);

  // Searching looks across every subject; otherwise show the active subject's shelf
  const pool = query.trim() ? BOOKS.filter((b) => matchesQuery(b, query)) : BOOKS.filter((b) => b.subject === activeSubject);
  const visibleBooks = typeFilter === 'all' ? pool : pool.filter((b) => b.type === typeFilter);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const toggleFavorite = (id: string) =>
    setFavorites((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));

  const handleDownload = (book: EBook) => showToast(`Downloading "${book.title}" PDF to your offline vault…`);

  const handleOpenBook = (book: EBook) => {
    if (onOpenBook) onOpenBook(book);
    else showToast(`Opening "${book.title}" in the reader…`);
  };

  const resetFilters = () => {
    setQuery('');
    setTypeFilter('all');
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F3F5F7] font-sans text-[#0B1C30]">
      {/* ---------------------------------------------------------- */}
      {/* Top bar                                                     */}
      {/* ---------------------------------------------------------- */}
      <header className="shrink-0 h-14 sm:h-16 bg-white border-b border-slate-200/80 px-3 sm:px-6 flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 md:w-[220px]">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg text-[#0B1C30] hover:bg-slate-100 transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded-full whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            E-Book Vault
          </span>
        </div>

        <div className="flex-1 min-w-0 flex justify-center">
          <div className="relative w-full max-w-md flex items-center">
            <Search className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setQuery('');
                  e.currentTarget.blur();
                }
              }}
              placeholder="Search e-books, HC Verma, 'Electrostatics'..."
              className="w-full pl-10 pr-12 py-2 rounded-full bg-slate-50 border border-slate-200 text-xs sm:text-sm text-[#0B1C30] placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#175A67] focus:ring-4 focus:ring-[#175A67]/10 transition-all"
            />
            <div className="absolute right-3 flex items-center">
              {query ? (
                <button onClick={() => setQuery('')} className="p-0.5 text-slate-400 hover:text-[#0B1C30]" title="Clear search">
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-white border border-slate-200 rounded">
                  <Command className="w-2.5 h-2.5" />K
                </kbd>
              )}
            </div>
          </div>
        </div>

        <div className="hidden md:block w-[220px] shrink-0" />
      </header>

      {/* ---------------------------------------------------------- */}
      {/* Body                                                        */}
      {/* ---------------------------------------------------------- */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-5 pb-16">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs text-slate-500 flex-wrap mb-5">
            <button onClick={onBack} className="hover:text-[#0B1C30] transition-colors" title="Home">
              <Home className="w-3.5 h-3.5" />
            </button>
            <span className="text-slate-300">/</span>
            <button onClick={onBack} className="hover:text-[#0B1C30] transition-colors">
              Dashboard
            </button>
            <span className="text-slate-300">/</span>
            <button onClick={onBack} className="hover:text-[#0B1C30] transition-colors">
              My Revision Desk
            </button>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-[#0B1C30] bg-slate-200/70 px-2.5 py-1 rounded-md">Your E-Books (Live Library)</span>
          </nav>

          {/* Hero */}
          <section className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_6px_24px_rgb(0,0,0,0.03)] p-5 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 mb-5">
            <div>
              <span className="inline-flex items-center gap-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Live Now • 2026 JEE Advanced Edition
              </span>
              <h1 className="text-2xl sm:text-[32px] font-bold text-[#0B1C30] tracking-tight mt-4 leading-tight">
                E-Books &amp; Reference Library
              </h1>
            </div>

            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 shrink-0">
              {[
                { value: BOOKS.length, label: 'Volumes', highlight: false },
                { value: totalAnnotations, label: 'Annotations', highlight: false },
                { value: '100%', label: 'Offline Sync', highlight: true },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className={`min-w-[84px] sm:min-w-[92px] px-3 py-3.5 rounded-2xl border text-center ${
                    stat.highlight ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50/70 border-slate-200'
                  }`}
                >
                  <p className={`text-xl sm:text-2xl font-bold ${stat.highlight ? 'text-emerald-600' : 'text-[#0B1C30]'}`}>
                    {stat.value}
                  </p>
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Subject shelves */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-7">
            {subjectStats.map((subject) => {
              const isActive = subject.id === activeSubject && !query.trim();
              return (
                <button
                  key={subject.id}
                  onClick={() => {
                    setActiveSubject(subject.id);
                    setQuery('');
                    setTypeFilter('all');
                  }}
                  className={`text-left bg-white rounded-2xl p-5 border transition-all ${
                    isActive
                      ? 'border-[#159A85] ring-1 ring-[#159A85] shadow-[0_8px_24px_rgba(15,118,110,0.10)]'
                      : 'border-slate-200/80 hover:border-slate-300 hover:shadow-[0_8px_24px_rgb(0,0,0,0.04)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${subject.iconWrap}`}>
                        <subject.icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-[15px] text-[#0B1C30] leading-snug">{subject.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{subject.volumes} Theory Volumes</p>
                      </div>
                    </div>
                    {isActive && (
                      <span className="text-[10px] font-bold tracking-wide bg-[#0B1C20] text-white px-2.5 py-1 rounded-md shrink-0">
                        ACTIVE
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-6 text-xs">
                    <span className="text-slate-600 font-medium">
                      {subject.pages.toLocaleString('en-IN')} Pages • {subject.volumes} Volumes
                    </span>
                    <span className={`font-semibold ${subject.pctColor}`}>{subject.pct}% Read</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full ${subject.barColor}`} style={{ width: `${subject.pct}%` }} />
                  </div>
                </button>
              );
            })}
          </section>

          {/* Toolbar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
              {TYPE_FILTERS.map((filter) => {
                const isActive = typeFilter === filter.id;
                const label = filter.id === 'all' ? `${filter.label} (${pool.length})` : filter.label;
                return (
                  <button
                    key={filter.id}
                    onClick={() => setTypeFilter(filter.id)}
                    className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold border transition-all ${
                      isActive
                        ? 'bg-[#0B1C20] text-white border-[#0B1C20] shadow-sm'
                        : 'bg-white text-[#0B1C30] border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {filter.icon && <filter.icon className={`w-3.5 h-3.5 ${filter.iconClass ?? ''}`} />}
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0">
              <span className="text-xs text-slate-500">
                Showing {visibleBooks.length} of {pool.length} volumes
                {query.trim() && <span className="text-[#0B1C30] font-semibold"> for “{query.trim()}”</span>}
              </span>
              <div className="flex items-center bg-slate-200/60 rounded-lg p-0.5">
                {(
                  [
                    { id: 'grid', icon: LayoutGrid, title: 'Grid view' },
                    { id: 'list', icon: List, title: 'List view' },
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
                    <mode.icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Books */}
          {visibleBooks.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 py-14 px-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mb-3">
                <SearchX className="w-6 h-6" />
              </div>
              <p className="font-semibold text-[#0B1C30]">No e-books match your filters</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Try a different chapter, author or formula — or clear the filters to see the full shelf.
              </p>
              <button
                onClick={resetFilters}
                className="mt-4 px-4 py-2 rounded-xl bg-[#0B1C20] hover:bg-[#15302F] text-white text-xs font-semibold transition-all active:scale-95"
              >
                Clear search &amp; filters
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {visibleBooks.map((book) => (
                <article
                  key={book.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 flex flex-col gap-4 shadow-[0_6px_24px_rgb(0,0,0,0.03)] hover:shadow-[0_12px_32px_rgb(0,0,0,0.07)] hover:-translate-y-0.5 transition-all duration-300"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <TypePill type={book.type} />
                      {book.isLive && <LiveDot />}
                    </div>
                    <FavoriteButton active={favorites.includes(book.id)} onToggle={() => toggleFavorite(book.id)} />
                  </div>

                  <BookCover book={book} />

                  <h3 className="font-semibold text-[15px] text-[#0B1C30] leading-snug">{book.title}</h3>

                  <ReadProgress book={book} />

                  <div className="mt-auto pt-1">
                    <BookActions onDownload={() => handleDownload(book)} onOpen={() => handleOpenBook(book)} />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {visibleBooks.map((book) => (
                <article
                  key={book.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-4 shadow-[0_6px_24px_rgb(0,0,0,0.03)]"
                >
                  <div className="sm:w-[200px] shrink-0">
                    <BookCover book={book} compact />
                  </div>

                  <div className="flex-1 min-w-0 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <TypePill type={book.type} />
                        {book.isLive && <LiveDot />}
                      </div>
                      <FavoriteButton active={favorites.includes(book.id)} onToggle={() => toggleFavorite(book.id)} />
                    </div>
                    <h3 className="font-semibold text-[15px] text-[#0B1C30] leading-snug truncate">{book.title}</h3>
                    <ReadProgress book={book} />
                  </div>

                  <div className="sm:w-[250px] shrink-0">
                    <BookActions onDownload={() => handleDownload(book)} onOpen={() => handleOpenBook(book)} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-[#175A67] text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2 animate-fadeIn max-w-[90vw]">
          <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
          <span className="truncate">{toast}</span>
        </div>
      )}
    </div>
  );
}

export default EBookLibraryView;
