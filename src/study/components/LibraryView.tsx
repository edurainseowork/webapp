import React, { useRef, useState } from 'react';
import {
  Star,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Atom,
  Sigma,
  FlaskConical,
  Dna,
  Landmark,
  Scale,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';
import { SubPageHeader } from './SubPageHeader';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type Category = 'IIT-JEE' | 'NEET' | 'UPSC';

export interface LibraryModule {
  id: string;
  category: Category;
  subject: string;
  icon: React.ComponentType<{ className?: string }>;
  rating: number;
  title: string;
  tags: string[];
  countLabel: string;
  sizeLabel: string;
}

interface LibraryViewProps {
  onOpenUpgrade?: () => void;
  onBack?: () => void;
  searchQuery?: string;
}

/* ------------------------------------------------------------------ */
/*  Dummy content                                                       */
/* ------------------------------------------------------------------ */

const CATEGORIES: Category[] = ['IIT-JEE', 'NEET', 'UPSC'];

const MODULES: LibraryModule[] = [
  // IIT-JEE
  {
    id: 'm1',
    category: 'IIT-JEE',
    subject: 'Physics',
    icon: Atom,
    rating: 4.9,
    title: 'Rotational Dynamics & Rigid Bodies',
    tags: ['Rotational Motion', 'Wave Optics', 'Electrodynamics'],
    countLabel: '12 PDFs',
    sizeLabel: '48.2 MB',
  },
  {
    id: 'm2',
    category: 'IIT-JEE',
    subject: 'Mathematics',
    icon: Sigma,
    rating: 4.8,
    title: 'Calculus & Differential Equations',
    tags: ['Definite Integrals', 'Area Under Curve', 'Vectors'],
    countLabel: '8 PDFs',
    sizeLabel: '32.6 MB',
  },
  {
    id: 'm3',
    category: 'IIT-JEE',
    subject: 'Chemistry',
    icon: FlaskConical,
    rating: 4.9,
    title: 'Organic Reaction Mechanisms Vault',
    tags: ['Named Reactions', 'Electrophiles', 'Stereochem'],
    countLabel: '15 PDFs',
    sizeLabel: '61.0 MB',
  },
  {
    id: 'm4',
    category: 'IIT-JEE',
    subject: 'Physics',
    icon: Atom,
    rating: 4.7,
    title: 'Electrostatics & Gauss Law Notes',
    tags: ['Capacitors', 'Field Lines', 'Gauss Law'],
    countLabel: '10 PDFs',
    sizeLabel: '39.4 MB',
  },

  // NEET
  {
    id: 'n1',
    category: 'NEET',
    subject: 'Biology',
    icon: Dna,
    rating: 4.9,
    title: 'Human Physiology Master Sheet',
    tags: ['Nervous System', 'Excretion', 'Circulation'],
    countLabel: '18 PDFs',
    sizeLabel: '55.2 MB',
  },
  {
    id: 'n2',
    category: 'NEET',
    subject: 'Biology',
    icon: Dna,
    rating: 4.8,
    title: 'Genetics & Evolution Compendium',
    tags: ['Mendelian Genetics', 'Evolution', 'Molecular Basis'],
    countLabel: '14 PDFs',
    sizeLabel: '44.8 MB',
  },
  {
    id: 'n3',
    category: 'NEET',
    subject: 'Chemistry',
    icon: FlaskConical,
    rating: 4.7,
    title: 'NEET Organic Chemistry Vault',
    tags: ['Reaction Maps', 'Isomerism', 'Biomolecules'],
    countLabel: '11 PDFs',
    sizeLabel: '38.0 MB',
  },

  // UPSC
  {
    id: 'u1',
    category: 'UPSC',
    subject: 'GS Paper II',
    icon: Landmark,
    rating: 4.9,
    title: 'Indian Polity Ranker Notes',
    tags: ['Constitution', 'Parliament', 'Judiciary'],
    countLabel: '20 PDFs',
    sizeLabel: '62.5 MB',
  },
  {
    id: 'u2',
    category: 'UPSC',
    subject: 'GS Paper I',
    icon: Landmark,
    rating: 4.8,
    title: 'Modern History Timeline Sheets',
    tags: ['Freedom Struggle', 'Revolts', 'Movements'],
    countLabel: '16 PDFs',
    sizeLabel: '49.3 MB',
  },
  {
    id: 'u3',
    category: 'UPSC',
    subject: 'GS Paper IV',
    icon: Scale,
    rating: 4.7,
    title: 'Ethics & Case Study Handbook',
    tags: ['Case Studies', 'Thinkers', 'Values'],
    countLabel: '9 PDFs',
    sizeLabel: '28.7 MB',
  },
];

/* ------------------------------------------------------------------ */
/*  Module card                                                         */
/* ------------------------------------------------------------------ */

function ModuleCard({ module, onView }: { module: LibraryModule; onView: () => void }) {
  return (
    <div className="shrink-0 w-[260px] sm:w-[280px] bg-gradient-to-br from-[#0F3B42] to-[#0b2c31] rounded-2xl p-5 flex flex-col justify-between min-h-[280px] shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
      <div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-bold bg-white/15 text-white px-2.5 py-1 rounded-full">
            {module.subject}
          </span>
          <span className="flex items-center gap-1 text-xs font-bold text-amber-300">
            <Star className="w-3.5 h-3.5 fill-amber-300" />
            {module.rating}
          </span>
        </div>

        <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center mb-4">
          <module.icon className="w-5 h-5 text-white" />
        </div>

        <h3 className="font-bold text-white text-base leading-snug mb-3 min-h-[2.6rem]">{module.title}</h3>

        <div className="flex flex-wrap gap-1.5">
          {module.tags.map((tag) => (
            <span key={tag} className="text-[10px] font-semibold bg-white/10 text-white/85 px-2 py-1 rounded-md">
              #{tag}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/10 text-xs">
        <span className="text-white/60 font-medium">
          {module.countLabel} · {module.sizeLabel}
        </span>
        <button
          onClick={onView}
          className="text-white font-bold flex items-center gap-1 hover:gap-1.5 transition-all"
        >
          View Pack
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main view                                                           */
/* ------------------------------------------------------------------ */

export function LibraryView({ onOpenUpgrade, onBack, searchQuery = '' }: LibraryViewProps) {
  const [activeCategory, setActiveCategory] = useState<Category>('IIT-JEE');
  const [toast, setToast] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const q = searchQuery.trim().toLowerCase();

  const filteredModules = MODULES.filter((m) => {
    const matchesCategory = m.category === activeCategory;
    if (!matchesCategory) return false;
    if (!q) return true;
    return (
      m.title.toLowerCase().includes(q) ||
      m.subject.toLowerCase().includes(q) ||
      m.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
  };

  return (
    <div className="bg-[#DCEAE3] rounded-[28px] p-4 sm:p-6 lg:p-8 relative space-y-6">
      {/* 1. Standardized Back Button + Breadcrumb */}
      <SubPageHeader
        onBack={onBack}
        crumbs={[
          { label: 'Home', onClick: onBack },
          { label: 'Library', onClick: onBack },
          { label: 'Class Notes' },
        ]}
      />

      {/* Streamlined Minimal Header (Clean title + Category switch) */}
      <div className="bg-white/80 backdrop-blur-md border border-white/80 rounded-2xl p-5 sm:p-6 shadow-[0_6px_24px_rgb(0,0,0,0.05)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#0F3B42] text-white flex items-center justify-center shadow-md shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0B1C30]">Your Class Notes</h1>
            <p className="text-xs text-[#2A707C] mt-0.5">
              High-yield derivation sheets, NCERT maps, and ranker revision modules
            </p>
          </div>
        </div>

        {/* Clean category toggle pills */}
        <div className="flex items-center bg-white/70 border border-white rounded-full p-1 shadow-sm self-start sm:self-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeCategory === cat ? 'bg-[#0F3B42] text-white shadow-md' : 'text-[#175A67] hover:bg-white/70'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 3. High-Yield Modules Section (Brought right up to the top!) */}
      <section className="bg-white/70 backdrop-blur-md border border-white/80 p-5 sm:p-7 rounded-[24px] shadow-[0_6px_24px_rgb(0,0,0,0.04)]">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-[#0B1C30]">High-Yield Modules</h2>
            <p className="text-xs text-[#2A707C] mt-1">
              Pick up where your AI diagnostic recommended based on syllabus gaps
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <button
              onClick={() => scroll('left')}
              className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-[#175A67] hover:bg-slate-50 transition-colors"
              title="Scroll left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-[#175A67] hover:bg-slate-50 transition-colors"
              title="Scroll right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {filteredModules.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#2A707C]">
            {q
              ? `No modules found matching "${q}" in ${activeCategory}.`
              : `No modules available for ${activeCategory} yet.`}
          </div>
        ) : (
          <div ref={scrollRef} className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth pb-2 my-3">
            {filteredModules.map((module) => (
              <ModuleCard
                key={module.id}
                module={module}
                onView={() => showToast(`Opening "${module.title}" pack…`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-[#175A67] text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2 animate-fadeIn max-w-[90vw]">
          <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
          <span className="truncate">{toast}</span>
        </div>
      )}
    </div>
  );
}

export default LibraryView;
