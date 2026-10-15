import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Search,
  GraduationCap,
  Star,
  Timer,
  Video,
  CheckCircle2,
  Users,
  PlayCircle,
  Play,
  FileText,
  Zap,
  BookOpen,
} from 'lucide-react';
import { BATCHES, ENROLLED_COURSES, EnrolledCourse, getBatch } from './courseData';
import {
  BatchCatalog,
  Toast,
  daysHoursMinutes,
  formatINR,
  useCountdown,
  useSearchShortcut,
  useToast,
} from './CourseShared';

/* ------------------------------------------------------------------ */
/*  Hero promos                                                         */
/* ------------------------------------------------------------------ */

const PROMOS = [
  {
    batchId: 'arjuna-2027',
    badge: 'Early Bird Special • 40% OFF',
    headline: 'ARJUNA JEE 2027 • Ranker Elite Track',
    highlights: [
      { icon: Video, text: '500+ Hrs Live Classes' },
      { icon: CheckCircle2, text: 'Daily DPPs + Video Sol.' },
      { icon: Users, text: '1-on-1 Ranker Mentorship' },
    ],
    seatsFilled: 264,
    seatsMax: 300,
    note: 'Includes Free Hardcopy Formula Booklet & 30 Mock Test Series delivery to your address.',
  },
  {
    batchId: 'lakshya-2026',
    badge: 'Most Popular • 48% OFF',
    headline: 'LAKSHYA JEE 2026 • Class 12 Power Track',
    highlights: [
      { icon: FileText, text: '40 Full & Part Mock Tests' },
      { icon: Zap, text: 'AI Weakness Diagnosis' },
      { icon: BookOpen, text: 'Boards + JEE Together' },
    ],
    seatsFilled: 412,
    seatsMax: 500,
    note: 'New batch starts June 1 — includes the complete Class 12 DPP archive.',
  },
  {
    batchId: 'prayas-2026',
    badge: 'Dropper Special • 51% OFF',
    headline: 'PRAYAS JEE 2026 • 300-Day Rank Booster',
    highlights: [
      { icon: Zap, text: 'Daily 6-Hr Core Lectures' },
      { icon: Users, text: 'Micro-Batch Doubt Rooms' },
      { icon: CheckCircle2, text: 'Full Revision Cycle' },
    ],
    seatsFilled: 171,
    seatsMax: 200,
    note: 'Batch 2 admissions open — seats are capped to keep doubt rooms small.',
  },
];

const PROMO_INTERVAL_MS = 6000;

/* ------------------------------------------------------------------ */
/*  Main view                                                           */
/* ------------------------------------------------------------------ */

interface EnrolledCoursesViewProps {
  selectedBatch: string;
  enrolledBatchIds: string[];
  onBack: () => void;
  onOpenBatch: (batchId: string) => void;
  onBuyBatch: (batchId: string) => void;
}

export function EnrolledCoursesView({ selectedBatch, enrolledBatchIds, onBack, onOpenBatch, onBuyBatch }: EnrolledCoursesViewProps) {
  const [query, setQuery] = useState('');
  const [promoIndex, setPromoIndex] = useState(0);
  const [toast, showToast] = useToast();
  const searchRef = useRef<HTMLInputElement>(null);
  const catalogRef = useRef<HTMLElement>(null);
  const countdown = useCountdown(daysHoursMinutes(3, 14, 22));
  useSearchShortcut(searchRef);

  // Rotate the hero promo; restarts whenever the student picks a slide
  useEffect(() => {
    const timer = setTimeout(() => setPromoIndex((i) => (i + 1) % PROMOS.length), PROMO_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [promoIndex]);

  const promo = PROMOS[promoIndex];
  const promoBatch = getBatch(promo.batchId);
  const seatsPct = Math.round((promo.seatsFilled / promo.seatsMax) * 100);

  // Batches bought in this session show up first, ahead of the existing enrolments
  const newlyEnrolled: EnrolledCourse[] = [...enrolledBatchIds]
    .reverse()
    .filter((id) => !ENROLLED_COURSES.some((c) => c.batchId === id))
    .map((id) => {
      const batch = getBatch(id);
      return {
        id: `new-${id}`,
        batchId: id,
        batchLabel: batch.chips[0],
        title: `${batch.title} ${batch.subtitle}`,
        progress: 0,
        completedLectures: 0,
        totalLectures: 0,
        currentTopic: `Orientation • Starts ${batch.startDate}`,
      };
    });
  const allCourses = [...newlyEnrolled, ...ENROLLED_COURSES];

  const catalog = BATCHES.filter((b) => !b.featured);
  const q = query.trim().toLowerCase();
  const courses = allCourses.filter(
    (c) => !q || c.title.toLowerCase().includes(q) || c.currentTopic.toLowerCase().includes(q)
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#DCEAE3] font-sans text-[#0B1C30]">
      {/* ---------------------------------------------------------- */}
      {/* Top bar                                                     */}
      {/* ---------------------------------------------------------- */}
      <header className="shrink-0 h-14 sm:h-16 bg-[#FBF8F5] border-b border-slate-200/70 px-3 sm:px-6 flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 lg:w-[360px]">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 bg-[#F1EBE5] hover:bg-[#E9DFD6] text-xs font-semibold px-3 py-2 rounded-full transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <div className="hidden sm:flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-[#0F3B42] text-white flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </span>
            <span className="text-sm font-bold">EduRain</span>
          </div>
          <span className="hidden md:flex items-center gap-1.5 text-[11px] font-semibold bg-white border border-slate-200 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#175A67]" />
            {selectedBatch}
          </span>
        </div>

        <div className="flex-1 flex justify-center">
          <button
            onClick={() => showToast('Opening today’s live classes…')}
            className="bg-[#0F3B42] hover:bg-[#0b2c31] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all active:scale-95 whitespace-nowrap"
          >
            Live Classes
          </button>
        </div>

        <div className="flex justify-end shrink-0 lg:w-[360px]">
          <div className="relative w-36 sm:w-64 lg:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search formulas, tests..."
              className="w-full pl-9 pr-3 sm:pr-12 py-2 rounded-full bg-[#F1EBE5] text-xs placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[#175A67]/10 border border-transparent focus:border-[#175A67] transition-all"
            />
            <kbd className="hidden sm:block absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 rounded px-1.5 py-0.5">
              ⌘K
            </kbd>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------- */}
      {/* Body                                                        */}
      {/* ---------------------------------------------------------- */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-16 space-y-10">
          {/* Hero promo carousel */}
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F3B42] via-[#0D3238] to-[#0A2329] text-white p-6 sm:p-8 shadow-[0_12px_40px_rgba(15,59,66,0.25)]">
            <div className="absolute -top-24 -left-10 w-[380px] h-[380px] rounded-full bg-teal-300/10 blur-[100px] pointer-events-none" />
            <div key={promo.batchId} className="relative grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-center animate-fadeIn">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide bg-amber-200 text-[#5B3A00] px-3 py-1 rounded-full">
                    <Star className="w-3 h-3 fill-current" />
                    {promo.badge}
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold text-white/80 bg-white/10 border border-white/15 px-3 py-1 rounded-full tabular-nums">
                    <Timer className="w-3 h-3" />
                    ENDS IN: {countdown.days}d : {countdown.hours}h : {countdown.minutes}m
                  </span>
                </div>

                <h1 className="text-2xl sm:text-4xl font-bold tracking-tight mt-4 leading-tight">{promo.headline}</h1>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-5">
                  {promo.highlights.map((h) => (
                    <span key={h.text} className="flex items-center gap-2 text-xs text-white/85 bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2">
                      <h.icon className="w-3.5 h-3.5 shrink-0" />
                      {h.text}
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-6">
                  <button
                    onClick={() => onOpenBatch(promo.batchId)}
                    className="flex items-center gap-2 bg-[#FAD9B5] hover:bg-[#F7CC9C] text-[#0B1C30] text-sm font-semibold px-5 py-3 rounded-xl transition-all active:scale-95"
                  >
                    Explore Batch &amp; Enroll
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => showToast(`Playing a sample class from ${promoBatch.title}…`)}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/15 text-sm font-semibold px-4 py-3 rounded-xl transition-all"
                  >
                    <PlayCircle className="w-4 h-4" />
                    Watch Sample
                  </button>
                </div>
              </div>

              <div>
                <div className="rounded-2xl bg-white/[0.07] border border-white/15 p-5 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70">Batch Admissions Status</span>
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-white/70 mt-3">
                    <span>Seats Filled</span>
                    <span>
                      {seatsPct}% ({promo.seatsFilled} / {promo.seatsMax} Max)
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-white/15 overflow-hidden">
                    <div className="h-full rounded-full bg-amber-400 transition-all duration-700" style={{ width: `${seatsPct}%` }} />
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-4">
                    <p className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold">{formatINR(promoBatch.price)}</span>
                      <span className="text-xs text-white/40 line-through">{formatINR(promoBatch.mrp)}</span>
                    </p>
                    <span className="text-[10px] font-bold bg-white/10 border border-white/15 px-2 py-1 rounded-md">
                      SAVE {formatINR(promoBatch.mrp - promoBatch.price)}
                    </span>
                  </div>
                  <p className="text-xs text-white/60 mt-2 leading-relaxed">{promo.note}</p>
                </div>

                <div className="flex justify-center gap-1.5 mt-4">
                  {PROMOS.map((p, i) => (
                    <button
                      key={p.batchId}
                      onClick={() => setPromoIndex(i)}
                      title={`Show offer ${i + 1}`}
                      className={`h-1.5 rounded-full transition-all ${i === promoIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60'}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Enrolled courses */}
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-3">
                <button
                  onClick={onBack}
                  title="Back to Dashboard"
                  className="w-8 h-8 rounded-full bg-[#F1E6DD] hover:bg-[#E9DACD] flex items-center justify-center transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Your Enrolled Courses</h2>
                <span className="text-[10px] font-bold bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">
                  {allCourses.length} ACTIVE
                </span>
              </div>
              <button
                onClick={() => catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="flex items-center gap-1.5 bg-[#F6EFE9] hover:bg-[#EEE2D8] text-xs font-semibold px-4 py-2 rounded-full transition-colors"
              >
                Explore All Batches
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {courses.length === 0 ? (
              <p className="text-sm text-slate-500 bg-white rounded-2xl p-6">None of your courses match “{query.trim()}”.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {courses.map((course) => {
                  const justEnrolled = course.totalLectures === 0;
                  return (
                    <article
                      key={course.id}
                      onClick={() => onOpenBatch(course.batchId)}
                      className="bg-white rounded-2xl p-5 flex flex-col shadow-[0_6px_24px_rgb(0,0,0,0.05)] hover:shadow-[0_14px_36px_rgb(0,0,0,0.10)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold bg-[#F6EFE9] px-2 py-0.5 rounded">{course.batchLabel}</span>
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-[#175A67]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#175A67]" />
                          {justEnrolled ? 'Just Enrolled' : `${course.progress}% Completed`}
                        </span>
                      </div>

                      <h3 className="font-semibold text-[15px] leading-snug mt-3">{course.title}</h3>

                      <div className="mt-4 bg-[#F8F1EC] rounded-xl p-3">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                          {justEnrolled ? 'Up Next' : 'Current Topic'}
                        </p>
                        <p className="text-sm font-semibold mt-1 leading-snug">{course.currentTopic}</p>
                      </div>

                      <div className="mt-auto pt-4">
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span>Syllabus Covered</span>
                          <span>
                            {justEnrolled ? 'Not started yet' : `${course.completedLectures} / ${course.totalLectures} Lectures`}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-[#F1E6DD] overflow-hidden">
                          <div className="h-full rounded-full bg-[#175A67]" style={{ width: `${course.progress}%` }} />
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            showToast(justEnrolled ? `Opening orientation for ${course.title}` : `Resuming ${course.currentTopic}`);
                          }}
                          className="mt-4 w-full flex items-center justify-center gap-1.5 bg-[#0B1C20] hover:bg-[#15302F] text-white text-xs font-semibold py-2.5 rounded-full transition-all active:scale-[0.98]"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          {justEnrolled ? 'Start Learning' : 'Resume Lecture'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* Catalogue */}
          <section ref={catalogRef} className="scroll-mt-4">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-5">Academic Batches &amp; Crash Courses</h2>
            <BatchCatalog batches={catalog} query={query} showFilters onOpenBatch={onOpenBatch} onBuyBatch={onBuyBatch} />
          </section>
        </div>
      </div>

      <Toast message={toast} />
    </div>
  );
}

export default EnrolledCoursesView;
