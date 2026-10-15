import React, { useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Search,
  ChevronDown,
  PlayCircle,
  Play,
  Timer,
  CloudDownload,
  Clock3,
  BadgeCheck,
  Zap,
  Check,
  Radio,
  MonitorPlay,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { BATCHES, DEMO_CLASSES, getBatch } from './courseData';
import { BatchCatalog, Toast, discountPct, formatINR, useSearchShortcut, useToast } from './CourseShared';

/* ------------------------------------------------------------------ */
/*  Batch finder options                                                */
/* ------------------------------------------------------------------ */

type ClassId = 'class11' | 'class12' | 'dropper';
type ExamId = 'jee' | 'neet' | 'cbse';
type FormatId = 'live' | 'recorded';
type TabId = 'overview' | 'demos' | 'batches' | 'faculty' | 'national-test';

const CLASS_OPTIONS: { id: ClassId; title: string; sub: string }[] = [
  { id: 'class11', title: 'Class 11', sub: '2-Year Roadmap' },
  { id: 'class12', title: 'Class 12', sub: '1-Year Intensive' },
  { id: 'dropper', title: 'Dropper / Repeater', sub: 'Rank Booster' },
];

const EXAM_OPTIONS: { id: ExamId; title: string; sub: string }[] = [
  { id: 'jee', title: 'IIT-JEE', sub: '(Mains + Advanced)' },
  { id: 'neet', title: 'NEET-UG', sub: '(Medical Entrance)' },
  { id: 'cbse', title: 'CBSE Boards', sub: '(Full Board Support)' },
];

const FORMAT_OPTIONS: { id: FormatId; title: string; sub: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'live', title: 'Live Daily Classes', sub: 'Real-time doubt resolution', icon: Radio },
  { id: 'recorded', title: 'Self-Paced Recorded', sub: 'Flexible library access', icon: MonitorPlay },
];

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'demos', label: 'Live Demos' },
  { id: 'batches', label: 'Syllabus & Batches' },
  { id: 'faculty', label: 'Top Faculty' },
  { id: 'national-test', label: 'National Test (KSAT)' },
];

const STREAM_LABELS: Record<ExamId, string> = { jee: 'IIT-JEE', neet: 'NEET-UG', cbse: 'CBSE Boards' };

const pickBestFit = (cls: ClassId, exam: ExamId) => {
  if (exam === 'neet') return 'neet-drill-2026';
  if (exam === 'cbse') return 'udaan-2027';
  if (cls === 'class12') return 'lakshya-2026';
  if (cls === 'dropper') return 'prayas-2026';
  return 'arjuna-2027';
};

/* ------------------------------------------------------------------ */
/*  Small pieces                                                        */
/* ------------------------------------------------------------------ */

function StepHeader({ step, title, hint }: { step: number; title: string; hint: string }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-2.5">
      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-full bg-[#0F3B42] text-white text-[10px] font-bold flex items-center justify-center">{step}</span>
        <h3 className="text-sm font-semibold text-[#0B1C30]">{title}</h3>
      </div>
      <span className="text-[10px] font-semibold text-[#175A67]">{hint}</span>
    </div>
  );
}

function ChoiceButton({ active, title, sub, onClick }: { active: boolean; title: string; sub: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-2 py-3 text-center transition-all ${
        active ? 'bg-[#0F3B42] text-white shadow-md' : 'bg-[#F8F1EC] text-[#0B1C30] hover:bg-[#F1E6DD]'
      }`}
    >
      <p className="text-xs font-semibold">{title}</p>
      <p className={`text-[10px] mt-0.5 ${active ? 'text-white/70' : 'text-slate-500'}`}>{sub}</p>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main view                                                           */
/* ------------------------------------------------------------------ */

interface CourseStoreViewProps {
  onBack: () => void;
  onOpenBatch: (batchId: string) => void;
  onBuyBatch: (batchId: string) => void;
}

export function CourseStoreView({ onBack, onOpenBatch, onBuyBatch }: CourseStoreViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [query, setQuery] = useState('');
  const [isStreamMenuOpen, setIsStreamMenuOpen] = useState(false);
  const [classId, setClassId] = useState<ClassId>('class11');
  const [exam, setExam] = useState<ExamId>('jee');
  const [format, setFormat] = useState<FormatId>('live');
  const [toast, showToast] = useToast();

  const searchRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const demosRef = useRef<HTMLElement>(null);
  const batchesRef = useRef<HTMLElement>(null);
  useSearchShortcut(searchRef);

  const bestFit = getBatch(pickBestFit(classId, exam));
  const catalog = BATCHES.filter((b) => !b.featured);
  const q = query.trim().toLowerCase();
  const demos = DEMO_CLASSES.filter((d) => !q || d.title.toLowerCase().includes(q) || d.meta.toLowerCase().includes(q));

  const scrollTo = (el: HTMLElement | null) => el?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const handleTab = (tab: TabId) => {
    setActiveTab(tab);
    if (tab === 'overview') scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    else if (tab === 'demos') scrollTo(demosRef.current);
    else if (tab === 'batches') scrollTo(batchesRef.current);
    else if (tab === 'faculty') showToast('Top Faculty profiles are coming soon.');
    else showToast('National Test (KSAT) registrations open soon.');
  };

  const heroTiles = [
    {
      icon: PlayCircle,
      iconWrap: 'bg-sky-200 text-[#0F3B42]',
      badge: '3 Lectures Ready',
      title: 'Free Masterclasses',
      cta: 'Stream now',
      onClick: () => handleTab('demos'),
    },
    {
      icon: Timer,
      iconWrap: 'bg-amber-400 text-[#0B1C30]',
      badge: 'Instant Scorecard',
      title: '15-Min Rank Diagnostic Test',
      cta: 'Start diagnostic',
      onClick: () => showToast('Starting your 15-min rank diagnostic…'),
    },
    {
      icon: CloudDownload,
      iconWrap: 'bg-white text-[#0F3B42]',
      badge: '180 Pages Free',
      title: 'Download Starter Notes',
      cta: 'View files',
      onClick: () => showToast('Preparing your free starter notes…'),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#DCEAE3] font-sans text-[#0B1C30]">
      {/* ---------------------------------------------------------- */}
      {/* Top bar + tabs                                              */}
      {/* ---------------------------------------------------------- */}
      <header className="shrink-0 bg-white border-b border-slate-200/70">
        <div className="h-14 sm:h-16 px-3 sm:px-6 flex items-center gap-2 sm:gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 bg-[#F6EFE9] hover:bg-[#EEE2D8] text-[#0B1C30] text-xs font-semibold px-3 py-2 rounded-full transition-colors shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>

          <div className="relative shrink-0">
            <button
              onClick={() => setIsStreamMenuOpen((o) => !o)}
              className="text-left bg-[#F6EFE9] hover:bg-[#EEE2D8] rounded-lg px-3 py-1 transition-colors"
            >
              <span className="block text-[9px] font-medium text-slate-500 leading-tight">Target Stream</span>
              <span className="flex items-center gap-1 text-xs font-semibold leading-tight">
                {STREAM_LABELS[exam]}
                <ChevronDown className="w-3 h-3" />
              </span>
            </button>
            {isStreamMenuOpen && (
              <div className="absolute left-0 top-full mt-2 w-44 bg-white rounded-xl shadow-xl border border-slate-100 p-1 z-30">
                {EXAM_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => {
                      setExam(option.id);
                      setIsStreamMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold ${
                      exam === option.id ? 'bg-[#0F3B42] text-white' : 'text-[#0B1C30] hover:bg-[#F6EFE9]'
                    }`}
                  >
                    {option.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1" />

          <div className="relative w-full max-w-md flex items-center min-w-0">
            <Search className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search demo classes, teachers, syllabus..."
              className="w-full pl-10 pr-14 py-2 rounded-full bg-[#F6EFE9] text-xs sm:text-sm placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[#175A67]/10 border border-transparent focus:border-[#175A67] transition-all"
            />
            <kbd className="hidden sm:block absolute right-3 text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 rounded px-1.5 py-0.5">
              Ctrl K
            </kbd>
          </div>
        </div>

        <nav className="px-3 sm:px-6 flex gap-5 sm:gap-7 overflow-x-auto no-scrollbar">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTab(tab.id)}
              className={`whitespace-nowrap py-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === tab.id ? 'border-[#0F3B42] text-[#0B1C30]' : 'border-transparent text-slate-500 hover:text-[#0B1C30]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* ---------------------------------------------------------- */}
      {/* Body                                                        */}
      {/* ---------------------------------------------------------- */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-16 space-y-10">
          {/* Hero */}
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F3B42] via-[#0D343B] to-[#0A262C] p-6 sm:p-10 text-white shadow-[0_12px_40px_rgba(15,59,66,0.25)]">
            <div className="absolute -top-24 right-0 w-[420px] h-[420px] rounded-full bg-teal-300/10 blur-[100px] pointer-events-none" />
            <div className="relative">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-400/10 border border-amber-300/40 px-3 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
                Zero Risk • 100% Unrestricted Access
              </span>
              <h1 className="text-3xl sm:text-[40px] font-bold tracking-tight mt-4">Try Before You Enroll</h1>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-7">
                {heroTiles.map((tile) => (
                  <button
                    key={tile.title}
                    onClick={tile.onClick}
                    className="text-left rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 p-5 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${tile.iconWrap}`}>
                        <tile.icon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-semibold text-white/80 bg-white/10 border border-white/15 px-2 py-0.5 rounded-full">
                        {tile.badge}
                      </span>
                    </div>
                    <p className="font-semibold mt-4">{tile.title}</p>
                    <p className="text-xs font-semibold text-amber-300 mt-2 flex items-center gap-1">
                      {tile.cta}
                      <ArrowRight className="w-3 h-3" />
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Demo classes */}
          <section ref={demosRef} className="scroll-mt-4">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-5">Experience The Classroom — Try Before You Buy</h2>
            {demos.length === 0 ? (
              <p className="text-sm text-slate-500 bg-white rounded-2xl p-6">No demo classes match “{query.trim()}”.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {demos.map((demo) => (
                  <article key={demo.id} className="bg-white rounded-2xl overflow-hidden shadow-[0_6px_24px_rgb(0,0,0,0.05)]">
                    <button
                      onClick={() => showToast(`Playing free demo: ${demo.title}`)}
                      className="group relative block w-full h-[150px] bg-gradient-to-br from-[#10272C] to-[#071417] text-left"
                    >
                      <span className="absolute top-3 left-3 text-[9px] font-bold uppercase tracking-wide bg-amber-300 text-[#0B1C30] px-2 py-0.5 rounded">
                        No Payment Required
                      </span>
                      <span className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-medium text-white/80">
                        <Clock3 className="w-3 h-3" />
                        {demo.duration}
                      </span>
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="w-12 h-12 rounded-full bg-white/90 text-[#0B1C30] flex items-center justify-center shadow-lg transition-all opacity-90 sm:opacity-0 sm:group-hover:opacity-100 group-hover:scale-105">
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </span>
                      </span>
                      <span className="absolute bottom-3 left-3 text-[10px] font-medium text-white/70">{demo.meta}</span>
                    </button>
                    <div className="p-5">
                      <h3 className="font-semibold text-[15px]">{demo.title}</h3>
                      <p className="flex items-center gap-2 mt-3 bg-[#F8F1EC] rounded-lg px-3 py-2 text-[11px] text-slate-600">
                        <BadgeCheck className="w-3.5 h-3.5 text-[#175A67] shrink-0" />
                        Includes free PDF notes + 10 DPPs
                      </p>
                      <button
                        onClick={() => showToast(`Playing free demo: ${demo.title}`)}
                        className="mt-4 w-full flex items-center justify-center gap-1.5 bg-[#0B1C20] hover:bg-[#15302F] text-white text-xs font-semibold py-2.5 rounded-lg transition-all active:scale-[0.98]"
                      >
                        Watch Free Class
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Batch finder */}
          <section>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-5">Find Your Batch</h2>
            <div className="bg-white rounded-3xl p-5 sm:p-8 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 lg:gap-8 items-center shadow-[0_6px_24px_rgb(0,0,0,0.04)]">
              <div className="space-y-6">
                <div>
                  <StepHeader step={1} title="Select Your Class" hint="Target Year 2026/2027" />
                  <div className="grid grid-cols-3 gap-2.5">
                    {CLASS_OPTIONS.map((option) => (
                      <ChoiceButton
                        key={option.id}
                        active={classId === option.id}
                        title={option.title}
                        sub={option.sub}
                        onClick={() => setClassId(option.id)}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <StepHeader step={2} title="Select Your Target Examination" hint="NCERT + Advanced Prep" />
                  <div className="grid grid-cols-3 gap-2.5">
                    {EXAM_OPTIONS.map((option) => (
                      <ChoiceButton
                        key={option.id}
                        active={exam === option.id}
                        title={option.title}
                        sub={option.sub}
                        onClick={() => setExam(option.id)}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <StepHeader step={3} title="Preferred Learning Format" hint="Switch anytime" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {FORMAT_OPTIONS.map((option) => {
                      const active = format === option.id;
                      return (
                        <button
                          key={option.id}
                          onClick={() => setFormat(option.id)}
                          className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all ${
                            active ? 'bg-[#0F3B42] text-white shadow-md' : 'bg-[#F8F1EC] text-[#0B1C30] hover:bg-[#F1E6DD]'
                          }`}
                        >
                          <option.icon className="w-4 h-4 shrink-0" />
                          <span className="flex-1 min-w-0">
                            <span className="block text-xs font-semibold">{option.title}</span>
                            <span className={`block text-[10px] ${active ? 'text-white/70' : 'text-slate-500'}`}>{option.sub}</span>
                          </span>
                          {active ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <Circle className="w-4 h-4 text-slate-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Best-fit recommendation */}
              <div className="rounded-2xl bg-gradient-to-br from-[#0F2E35] to-[#0A1F24] text-white p-6 shadow-xl">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-white text-[#0B1C30] px-2 py-0.5 rounded">Best Fit Batch</span>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-300">
                    <Zap className="w-3.5 h-3.5" />
                    Admissions Open
                  </span>
                </div>
                <h3 className="text-xl font-semibold mt-3 leading-snug">
                  {bestFit.title} <span className="text-white/60 font-normal text-base">{bestFit.subtitle}</span>
                </h3>
                <p className="text-xs text-white/60 mt-1">
                  Starts {bestFit.startDate} • {format === 'live' ? bestFit.schedule : 'Learn at your own pace'}
                </p>

                <div className="mt-5 rounded-xl bg-white/[0.06] border border-white/10 p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-white/50">Course Fee</p>
                    <p className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-3xl font-bold">{formatINR(bestFit.price)}</span>
                      <span className="text-xs text-white/40 line-through">{formatINR(bestFit.mrp)}</span>
                    </p>
                  </div>
                  <span className="text-[11px] font-bold bg-amber-300 text-[#0B1C30] px-2.5 py-1 rounded-md">
                    {discountPct(bestFit.price, bestFit.mrp)}% OFF
                  </span>
                </div>

                <ul className="mt-5 space-y-2.5">
                  {[
                    ...bestFit.features.map((f) => f.text),
                    format === 'live' ? 'Live daily classes with real-time doubt resolution' : 'Full recorded library — switch to live anytime',
                  ].map((line) => (
                    <li key={line} className="flex items-start gap-2 text-xs text-white/75">
                      <Check className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-px" />
                      {line}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => onOpenBatch(bestFit.id)}
                  className="mt-6 w-full flex items-center justify-center gap-2 bg-amber-300 hover:bg-amber-200 text-[#0B1C30] font-semibold text-sm py-3 rounded-xl transition-all active:scale-[0.98]"
                >
                  Explore Batch Details
                  <ArrowRight className="w-4 h-4" />
                </button>
                <p className="text-[10px] text-white/50 text-center mt-3">7-Day Unconditional Money Back Guarantee</p>
              </div>
            </div>
          </section>

          {/* Catalogue */}
          <section ref={batchesRef} className="scroll-mt-4">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-5">Academic Batches &amp; Crash Courses</h2>
            <BatchCatalog batches={catalog} query={query} onOpenBatch={onOpenBatch} onBuyBatch={onBuyBatch} />
          </section>
        </div>
      </div>

      <Toast message={toast} />
    </div>
  );
}

export default CourseStoreView;
