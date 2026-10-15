import React, { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  ArrowRight,
  Search,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Star,
  Clock3,
  Languages,
  Users,
  Share2,
  Bell,
  Zap,
  FileText,
  BookOpen,
  ClipboardList,
  MessagesSquare,
  Scale,
  Target,
  AlarmClock,
  MonitorPlay,
  ShieldCheck,
  Headphones,
  BarChart3,
  MonitorSmartphone,
  PhoneCall,
  Check,
  X,
  Lock,
  PlayCircle,
  Play,
  CheckCircle2,
  Megaphone,
} from 'lucide-react';
import {
  Batch,
  Chapter,
  PlanId,
  BATCH_NOTICES,
  COMPARE_ROWS,
  INFINITY_PERKS,
  PLAN_META,
  PLAN_ORDER,
  SUBJECTS,
  getPlanPrices,
} from './courseData';
import { Toast, daysHoursMinutes, discountPct, formatINR, useCountdown, useToast } from './CourseShared';

type TabId = 'description' | 'syllabus' | 'infinity' | 'tests' | 'community';

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }>; extra?: React.ReactNode }[] = [
  { id: 'description', label: 'Description', icon: FileText },
  { id: 'syllabus', label: 'All Classes & Syllabus', icon: BookOpen },
  {
    id: 'infinity',
    label: 'Infinity Learning (Pro)',
    icon: Star,
    extra: <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">PRO</span>,
  },
  {
    id: 'tests',
    label: 'Test Series & Quizzes',
    icon: ClipboardList,
    extra: <span className="text-[#175A67] font-bold">(140+)</span>,
  },
  { id: 'community', label: 'Ranker Community & Doubts', icon: MessagesSquare },
];

/* ------------------------------------------------------------------ */
/*  Chapter row                                                         */
/* ------------------------------------------------------------------ */

function ChapterRow({
  chapter,
  subjectName,
  isOpen,
  onToggle,
  onAction,
}: {
  chapter: Chapter;
  subjectName?: string;
  isOpen: boolean;
  onToggle: () => void;
  onAction: (message: string) => void;
}) {
  const locked = chapter.status === 'locked';
  const num = String(chapter.num).padStart(2, '0');

  return (
    <div className="py-4">
      <button
        onClick={locked ? undefined : onToggle}
        disabled={locked}
        className={`w-full flex items-center gap-3 text-left ${locked ? 'cursor-default' : ''}`}
      >
        <span
          className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
            chapter.status === 'done'
              ? 'bg-emerald-50 text-emerald-600'
              : chapter.status === 'live'
              ? 'bg-[#0F3B42] text-white'
              : 'bg-[#F6EFE9] text-slate-500'
          }`}
        >
          {chapter.status === 'done' ? <Check className="w-4 h-4" /> : num}
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[#0B1C30]">
              {subjectName && <span className="text-[#175A67]">{subjectName} • </span>}
              Chapter {num}: {chapter.title}
            </span>
            {chapter.status === 'live' && (
              <span className="flex items-center gap-1 text-[9px] font-bold uppercase bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                Live Cohort
              </span>
            )}
          </span>
          {chapter.summary && <span className="block text-[11px] text-slate-400 mt-0.5">{chapter.summary}</span>}
        </span>
        {locked ? (
          <Lock className="w-4 h-4 text-slate-400 shrink-0" />
        ) : (
          <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {isOpen && chapter.lectures && (
        <div className="mt-3 sm:pl-11 space-y-2 animate-fadeIn">
          {chapter.lectures.map((lecture) => {
            const live = lecture.kind === 'live';
            return (
              <div
                key={lecture.code}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5 ${
                  live ? 'border-[#175A67]/30 bg-[#F4FAFB]' : 'border-slate-200/80'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {live ? (
                    <MonitorPlay className="w-4 h-4 text-red-500 shrink-0" />
                  ) : (
                    <PlayCircle className="w-4 h-4 text-[#175A67] shrink-0" />
                  )}
                  <span className="text-xs font-semibold text-[#0B1C30]">
                    {lecture.code}: {lecture.title}
                  </span>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">{live ? lecture.meta : `(${lecture.meta})`}</span>
                </span>
                {live ? (
                  <span className="flex items-center gap-2">
                    <button
                      onClick={() => onAction(`Joining live demo: ${lecture.code} ${lecture.title}`)}
                      className="flex items-center gap-1 bg-[#175A67] hover:bg-[#124853] text-white text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      Watch Live Demo
                    </button>
                    <button
                      onClick={() => onAction(`Downloading handout for ${lecture.code}…`)}
                      className="text-[10px] font-semibold border border-slate-200 hover:bg-slate-50 px-2.5 py-1 rounded-md transition-colors"
                    >
                      Handout PDF
                    </button>
                  </span>
                ) : (
                  lecture.extra && <span className="text-[10px] font-medium text-slate-500">{lecture.extra}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Compare plans modal                                                 */
/* ------------------------------------------------------------------ */

function ComparePlansModal({
  batch,
  selected,
  onSelect,
  onClose,
}: {
  batch: Batch;
  selected: PlanId;
  onSelect: (plan: PlanId) => void;
  onClose: () => void;
}) {
  const prices = getPlanPrices(batch);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[88vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fadeIn">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-bold">Compare Plans</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#F6EFE9] hover:bg-[#EEE2D8] flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left">
                <th className="px-6 py-3 font-semibold text-slate-500">Feature</th>
                {PLAN_ORDER.map((plan) => (
                  <th key={plan} className="px-3 py-3 text-center">
                    <button
                      onClick={() => onSelect(plan)}
                      className={`w-full rounded-xl px-2 py-2 transition-colors ${
                        selected === plan ? 'bg-[#0F3B42] text-white' : 'bg-[#F6EFE9] hover:bg-[#EEE2D8]'
                      }`}
                    >
                      <span className="block font-semibold">{PLAN_META[plan].name}</span>
                      <span className="block text-[11px] opacity-80">{formatINR(prices[plan].price)}</span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row) => (
                <tr key={row.label} className="border-t border-slate-100">
                  <td className="px-6 py-3 font-medium text-slate-600">{row.label}</td>
                  {PLAN_ORDER.map((plan) => {
                    const value = row.plans[plan];
                    return (
                      <td key={plan} className="px-3 py-3 text-center">
                        {value === true ? (
                          <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                        ) : value === false ? (
                          <X className="w-4 h-4 text-slate-300 mx-auto" />
                        ) : (
                          <span className="font-semibold text-[#0B1C30]">{value}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="bg-[#0B1C20] hover:bg-[#15302F] text-white text-sm font-semibold px-5 py-2.5 rounded-xl"
          >
            Continue with {PLAN_META[selected].name}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main view                                                           */
/* ------------------------------------------------------------------ */

interface CourseDetailViewProps {
  batch: Batch;
  isEnrolled: boolean;
  selectedBatch: string;
  scrollToPlans?: boolean;
  onBack: () => void;
  onExit: () => void;
  onEnroll: (plan: PlanId) => void;
  onGoToMyCourses: () => void;
}

export function CourseDetailView({
  batch,
  isEnrolled,
  selectedBatch,
  scrollToPlans = false,
  onBack,
  onExit,
  onEnroll,
  onGoToMyCourses,
}: CourseDetailViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>('description');
  const [plan, setPlan] = useState<PlanId>('infinity');
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [activeSubjectId, setActiveSubjectId] = useState(SUBJECTS[0].id);
  const [openChapter, setOpenChapter] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [toast, showToast] = useToast();
  const countdown = useCountdown(daysHoursMinutes(2, 14, 41));

  const scrollRef = useRef<HTMLDivElement>(null);
  const plansRef = useRef<HTMLElement>(null);
  const perksRef = useRef<HTMLElement>(null);
  const subjectsRef = useRef<HTMLElement>(null);
  const breakdownRef = useRef<HTMLElement>(null);

  const prices = getPlanPrices(batch);
  const selectedPrice = prices[plan];
  const subject = SUBJECTS.find((s) => s.id === activeSubjectId) ?? SUBJECTS[0];

  // Open the live chapter of whichever subject is selected
  useEffect(() => {
    const live = subject.chapters.find((c) => c.status === 'live');
    setOpenChapter(live ? `${subject.id}-${live.num}` : null);
  }, [subject]);

  useEffect(() => {
    if (scrollToPlans) plansRef.current?.scrollIntoView({ block: 'start' });
  }, [scrollToPlans]);

  // Searching shows matching chapters from every subject
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return SUBJECTS.flatMap((s) =>
      s.chapters
        .filter(
          (c) =>
            c.title.toLowerCase().includes(q) || (c.lectures ?? []).some((l) => l.title.toLowerCase().includes(q))
        )
        .map((c) => ({ subject: s, chapter: c }))
    );
  }, [query]);

  const scrollTo = (el: HTMLElement | null) => el?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const handleTab = (tab: TabId) => {
    setActiveTab(tab);
    if (tab === 'description') scrollTo(plansRef.current);
    else if (tab === 'syllabus') scrollTo(subjectsRef.current);
    else if (tab === 'infinity') scrollTo(perksRef.current);
    else if (tab === 'tests') showToast('140+ tests unlock with enrolment — preview coming soon.');
    else showToast('Ranker Community opens for enrolled students.');
  };

  const handleEnroll = () => {
    // TODO: open your payment flow here and call onEnroll only after payment succeeds
    onEnroll(plan);
    confetti({ particleCount: 110, spread: 80, origin: { y: 0.6 }, colors: ['#10B981', '#175A67', '#F59E0B'] });
    showToast(`You're enrolled in ${batch.title} (${PLAN_META[plan].name})!`);
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href).catch(() => undefined);
    showToast('Batch link copied to clipboard.');
  };

  const openNotices = () => {
    setActiveSubjectId('notices');
    setQuery('');
    scrollTo(breakdownRef.current);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#DCEAE3] font-sans text-[#0B1C30]">
      {/* ---------------------------------------------------------- */}
      {/* Top bar                                                     */}
      {/* ---------------------------------------------------------- */}
      <header className="shrink-0 bg-[#FBF8F5] border-b border-slate-200/70">
        <div className="h-14 px-3 sm:px-6 flex items-center gap-2 sm:gap-4">
          <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg shrink-0">
            <GraduationCap className="w-4 h-4 text-[#175A67]" />
            <span className="text-[#175A67] font-bold">COHORT</span>
            {selectedBatch}
          </span>
          <div className="flex-1 flex justify-center min-w-0">
            <div className="relative w-full max-w-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => scrollTo(breakdownRef.current)}
                placeholder="Search syllabus, lectures, formula sheets..."
                className="w-full pl-9 pr-3 py-2 rounded-full bg-[#F1EBE5] text-xs placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[#175A67]/10 border border-transparent focus:border-[#175A67] transition-all"
              />
            </div>
          </div>
          <button
            onClick={() => handleTab('description')}
            className="bg-[#0F3B42] hover:bg-[#0b2c31] text-white text-xs font-semibold px-3 sm:px-4 py-2 rounded-lg transition-all shrink-0"
          >
            Course Details
          </button>
        </div>

        <div className="h-11 bg-white border-t border-slate-100 px-3 sm:px-6 flex items-center gap-2 text-xs overflow-x-auto no-scrollbar">
          <button onClick={onBack} className="flex items-center gap-1.5 font-semibold text-[#175A67] hover:underline whitespace-nowrap">
            <ArrowLeft className="w-4 h-4" />
            All Batches
          </button>
          <span className="text-slate-300">/</span>
          <button onClick={onExit} className="text-slate-500 hover:text-[#0B1C30] whitespace-nowrap">
            Home
          </button>
          <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
          <button onClick={onBack} className="text-slate-500 hover:text-[#0B1C30] whitespace-nowrap">
            {batch.breadcrumb}
          </button>
          <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="font-semibold whitespace-nowrap">{batch.title}</span>
        </div>
      </header>

      {/* ---------------------------------------------------------- */}
      {/* Body                                                        */}
      {/* ---------------------------------------------------------- */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-[#0F3B42] via-[#0D3239] to-[#0A262C] text-white">
          <div className="absolute -top-20 right-10 w-[420px] h-[420px] rounded-full bg-teal-300/10 blur-[110px] pointer-events-none" />
          <div className="relative max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-white/10 border border-white/15 px-3 py-1 rounded-full">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                {batch.cohortLabel}
              </span>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-4">
                {batch.title} <span className="text-base sm:text-lg font-normal text-white/70">{batch.subtitle}</span>
              </h1>
              <p className="text-sm text-white/70 mt-3 max-w-2xl leading-relaxed">{batch.description}</p>
              <div className="flex flex-wrap gap-2 mt-5">
                {[
                  { icon: <span className="w-1.5 h-1.5 rounded-full bg-red-500" />, text: `Starts: ${batch.startDate}` },
                  { icon: <Clock3 className="w-3.5 h-3.5" />, text: `Validity: ${batch.validity}` },
                  { icon: <Languages className="w-3.5 h-3.5" />, text: `Language: ${batch.language}` },
                  { icon: <Users className="w-3.5 h-3.5" />, text: `Enrolled: ${batch.enrolled}` },
                ].map((meta) => (
                  <span key={meta.text} className="flex items-center gap-1.5 text-[11px] font-medium bg-white/[0.06] border border-white/10 px-3 py-1.5 rounded-lg">
                    {meta.icon}
                    {meta.text}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-start lg:items-end gap-3">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleShare}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/15 border border-white/15 px-3 py-2 rounded-lg transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Share Batch
                </button>
                <button
                  onClick={openNotices}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/15 border border-white/15 px-3 py-2 rounded-lg transition-colors"
                >
                  <Bell className="w-3.5 h-3.5" />
                  Announcements
                  <span className="text-[9px] font-bold bg-red-500 px-1.5 py-0.5 rounded-full">
                    {BATCH_NOTICES.filter((n) => n.isNew).length} New
                  </span>
                </button>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-white/10 border border-white/15 px-4 py-3">
                <span className="w-10 h-10 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center">
                  <Zap className="w-5 h-5 fill-current" />
                </span>
                <span>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-300">Cohort Bonus</span>
                  <span className="block text-sm font-semibold">{isEnrolled ? '500 XP credited to your account' : 'Earn 500 XP on Enrollment'}</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Tabs */}
        <nav className="sticky top-0 z-20 bg-white border-b border-slate-200/70">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 flex gap-6 overflow-x-auto no-scrollbar">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTab(tab.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap py-3.5 text-xs font-semibold border-b-2 transition-colors ${
                  activeTab === tab.id ? 'border-[#0F3B42] text-[#0B1C30]' : 'border-transparent text-slate-500 hover:text-[#0B1C30]'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.extra}
              </button>
            ))}
          </div>
        </nav>

        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16 space-y-10">
          {/* Plans + summary */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
            <section ref={plansRef} className="scroll-mt-16">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#175A67]">Enrollment Pathways</p>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight mt-1">Choose a Plan tailored for your preparation</h2>
                </div>
                <button
                  onClick={() => setIsCompareOpen(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold border-2 border-[#0F3B42] hover:bg-[#0F3B42] hover:text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Scale className="w-3.5 h-3.5" />
                  Compare Plans
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 items-start">
                {PLAN_ORDER.map((planId) => {
                  const meta = PLAN_META[planId];
                  const price = prices[planId];
                  const selected = plan === planId;
                  return (
                    <button
                      key={planId}
                      onClick={() => setPlan(planId)}
                      className={`relative text-left bg-white rounded-2xl p-4 border-2 transition-all ${
                        selected ? 'border-[#175A67] shadow-[0_12px_32px_rgba(23,90,103,0.18)]' : 'border-transparent hover:border-[#175A67]/25'
                      }`}
                    >
                      {planId === 'infinity' && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-wider bg-[#0F3B42] text-white px-2.5 py-1 rounded-full whitespace-nowrap">
                          Most Popular
                        </span>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${meta.tagClass}`}>{meta.tag}</span>
                        <span
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            selected ? 'border-[#175A67]' : 'border-slate-300'
                          }`}
                        >
                          {selected && <span className="w-2.5 h-2.5 rounded-full bg-[#175A67]" />}
                        </span>
                      </div>
                      <p className="flex items-center gap-1.5 text-lg font-semibold mt-3">
                        {meta.name}
                        {planId === 'infinity' && <Star className="w-4 h-4 text-[#175A67] fill-[#175A67]" />}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 min-h-[2rem]">{meta.description}</p>
                      <p className="flex items-baseline gap-2 mt-3">
                        <span className="text-2xl font-bold">{formatINR(price.price)}</span>
                        <span className="text-xs text-slate-400 line-through">{formatINR(price.mrp)}</span>
                      </p>
                      <p className={`text-[11px] font-bold mt-0.5 ${planId === 'standard' ? 'text-red-500' : 'text-[#175A67]'}`}>
                        {discountPct(price.price, price.mrp)}% OFF • {meta.suffix}
                      </p>

                      <div className="border-t border-slate-100 mt-4 pt-4 space-y-2.5">
                        {meta.lead && (
                          <p className="flex items-start gap-2 text-[11px] font-semibold text-[#0B1C30]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#175A67] shrink-0 mt-px" />
                            {meta.lead}
                          </p>
                        )}
                        {meta.features.map((feature) => (
                          <p key={feature.text} className="flex items-start gap-2 text-[11px] text-slate-600">
                            <feature.icon className="w-3.5 h-3.5 text-[#175A67] shrink-0 mt-px" />
                            {feature.text}
                          </p>
                        ))}
                      </div>
                      <p className={`border-t border-slate-100 mt-4 pt-3 text-[11px] ${meta.footerClass}`}>{meta.footer}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Summary / checkout card */}
            <aside className="lg:sticky lg:top-16 bg-white rounded-2xl p-5 shadow-[0_12px_40px_rgba(11,28,32,0.08)]">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold bg-sky-50 text-sky-700 px-2 py-1 rounded-md">
                <Target className="w-3.5 h-3.5" />
                {batch.audience}
              </span>

              <div className="mt-4 rounded-xl border border-slate-200/80 p-4">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 leading-relaxed">
                  Special offer price (EduRain {PLAN_META[plan].name}
                  {plan === 'infinity' ? ' • Recommended' : ''})
                </p>
                <p className="flex flex-wrap items-baseline gap-2 mt-1.5">
                  <span className="text-3xl font-bold">{formatINR(selectedPrice.price)}</span>
                  <span className="text-xs text-slate-400 line-through">{formatINR(selectedPrice.mrp)}</span>
                  <span className="text-[10px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded">
                    {discountPct(selectedPrice.price, selectedPrice.mrp)}% OFF
                  </span>
                </p>
                <div className="flex items-center justify-between text-xs mt-3">
                  <span className="text-slate-500">Instant Net Savings:</span>
                  <span className="font-bold text-emerald-700">SAVE {formatINR(selectedPrice.mrp - selectedPrice.price)}</span>
                </div>
                <p className="flex items-center justify-center gap-1.5 mt-3 bg-sky-50 border border-sky-100 rounded-lg py-2 text-xs font-semibold text-[#175A67] tabular-nums">
                  <AlarmClock className="w-4 h-4" />
                  Offer ends in: {countdown.days}d : {countdown.hours}h : {countdown.minutes}m
                </p>
              </div>

              {isEnrolled ? (
                <button
                  onClick={onGoToMyCourses}
                  className="mt-4 w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-3.5 rounded-xl transition-all active:scale-[0.98]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Enrolled — Go to My Courses
                </button>
              ) : (
                <button
                  onClick={handleEnroll}
                  className="mt-4 w-full flex items-center justify-center gap-2 bg-[#0B1C20] hover:bg-[#15302F] text-white font-bold text-sm tracking-wide py-3.5 rounded-xl transition-all active:scale-[0.98]"
                >
                  ENROLL NOW
                  <Zap className="w-4 h-4 fill-current" />
                </button>
              )}
              <button
                onClick={() => {
                  setActiveSubjectId(SUBJECTS[0].id);
                  setQuery('');
                  scrollTo(breakdownRef.current);
                }}
                className="mt-2.5 w-full flex items-center justify-center gap-2 border border-[#175A67]/40 hover:bg-[#F4FAFB] text-[#175A67] text-xs font-semibold py-3 rounded-xl transition-colors"
              >
                <MonitorPlay className="w-4 h-4" />
                Explore Free Demo Classes (3 Free)
              </button>

              <ul className="mt-4 pt-4 border-t border-slate-100 space-y-2.5">
                {[
                  { icon: ShieldCheck, text: '100% Refund Guarantee within 7 days' },
                  { icon: Headphones, text: '24x7 Live Doubt Solving Engine on Mobile App' },
                  { icon: BarChart3, text: 'All-India Rank Prediction Engine included' },
                  { icon: MonitorSmartphone, text: 'Access on Web, Android, iOS & Smart TV' },
                ].map((item) => (
                  <li key={item.text} className="flex items-center gap-2 text-[11px] text-slate-600">
                    <item.icon className="w-4 h-4 text-[#175A67] shrink-0" />
                    {item.text}
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200/80 p-3">
                <span className="w-9 h-9 rounded-full bg-sky-50 text-[#175A67] flex items-center justify-center shrink-0">
                  <PhoneCall className="w-4 h-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] text-slate-500">Need guidance before joining?</span>
                  <a href="tel:+919876543210" className="block text-[11px] font-semibold text-[#175A67] hover:underline">
                    +91 98765 43210 • Call Student Advisor
                  </a>
                </span>
              </div>
            </aside>
          </div>

          {/* Infinity perks */}
          <section ref={perksRef} className="scroll-mt-16 bg-white rounded-2xl p-5 sm:p-6 shadow-[0_6px_24px_rgb(0,0,0,0.04)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 font-semibold">
                <Star className="w-4 h-4 text-[#175A67] fill-[#175A67]" />
                What makes EduRain Infinity the #1 Choice:
              </h3>
              <span className="text-[10px] font-semibold bg-sky-100 text-sky-700 px-2.5 py-1 rounded-full">Included in Infinity Plans</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
              {INFINITY_PERKS.map((perk) => (
                <div key={perk.label} className="flex items-center gap-3 rounded-xl border border-slate-200/80 px-3 py-3">
                  <span className="w-9 h-9 rounded-lg bg-sky-50 text-[#175A67] flex items-center justify-center shrink-0">
                    <perk.icon className="w-4 h-4" />
                  </span>
                  <span className="text-sm font-semibold leading-snug">{perk.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Subjects */}
          <section ref={subjectsRef} className="scroll-mt-16">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#175A67]">Curriculum Framework</p>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight mt-1 mb-5">Subjects &amp; Syllabus Directory</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {SUBJECTS.map((s) => {
                const active = s.id === activeSubjectId && !query.trim();
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setActiveSubjectId(s.id);
                      setQuery('');
                      scrollTo(breakdownRef.current);
                    }}
                    className={`text-left bg-white rounded-2xl p-4 border-2 flex flex-col min-h-[156px] transition-all ${
                      active ? 'border-[#175A67] shadow-md' : 'border-transparent hover:border-[#175A67]/25'
                    }`}
                  >
                    <span className="w-10 h-10 rounded-xl bg-sky-50 text-[#175A67] flex items-center justify-center">
                      <s.icon className="w-5 h-5" />
                    </span>
                    <span className="flex items-start justify-between gap-1.5 mt-3">
                      <span className="text-sm font-semibold leading-snug">{s.name}</span>
                      <span
                        className={`text-[9px] font-semibold px-1.5 py-0.5 rounded text-center shrink-0 ${
                          active ? 'bg-sky-100 text-sky-700' : 'bg-sky-50 text-[#175A67]'
                        }`}
                      >
                        {active ? 'Active' : s.badge}
                      </span>
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1">{s.stats}</span>
                    <span className="mt-auto pt-3 flex items-center justify-between text-[11px] font-semibold text-[#175A67]">
                      {s.isNotices ? 'View Notices' : 'View Syllabus'}
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Chapter breakdown / notices / search results */}
          <section ref={breakdownRef} className="scroll-mt-16 bg-white rounded-2xl p-5 sm:p-6 shadow-[0_6px_24px_rgb(0,0,0,0.04)]">
            <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#175A67]">
                  {searchResults ? 'Syllabus Search' : subject.isNotices ? 'Batch Notices' : `${subject.name} Chapter Breakdown`}
                </p>
                <h3 className="font-semibold mt-0.5">
                  {searchResults ? `${searchResults.length} chapter${searchResults.length === 1 ? '' : 's'} match “${query.trim()}”` : subject.moduleTitle}
                </h3>
              </div>
              {!subject.isNotices && !searchResults && (
                <button
                  onClick={() => showToast(`Downloading ${subject.name} syllabus PDF…`)}
                  className="text-[11px] font-semibold bg-[#F6EFE9] hover:bg-[#EEE2D8] px-3 py-1.5 rounded-full transition-colors"
                >
                  Download Full PDF Syllabus
                </button>
              )}
            </div>

            {searchResults ? (
              searchResults.length === 0 ? (
                <p className="text-sm text-slate-500 py-6">Try a chapter name like “Kinematics” or “Bonding”.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {searchResults.map(({ subject: s, chapter }) => {
                    const id = `${s.id}-${chapter.num}`;
                    return (
                      <ChapterRow
                        key={id}
                        chapter={chapter}
                        subjectName={s.name}
                        isOpen={openChapter === id}
                        onToggle={() => setOpenChapter(openChapter === id ? null : id)}
                        onAction={showToast}
                      />
                    );
                  })}
                </div>
              )
            ) : subject.isNotices ? (
              <ul className="divide-y divide-slate-100">
                {BATCH_NOTICES.map((notice) => (
                  <li key={notice.id} className="flex items-start gap-3 py-4">
                    <span className="w-8 h-8 rounded-full bg-sky-50 text-[#175A67] flex items-center justify-center shrink-0">
                      <Megaphone className="w-4 h-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold">{notice.title}</span>
                      <span className="block text-[11px] text-slate-400 mt-0.5">{notice.time}</span>
                    </span>
                    {notice.isNew && <span className="text-[9px] font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded-full shrink-0">NEW</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="divide-y divide-slate-100">
                {subject.chapters.map((chapter) => {
                  const id = `${subject.id}-${chapter.num}`;
                  return (
                    <ChapterRow
                      key={id}
                      chapter={chapter}
                      isOpen={openChapter === id}
                      onToggle={() => setOpenChapter(openChapter === id ? null : id)}
                      onAction={showToast}
                    />
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {isCompareOpen && (
        <ComparePlansModal batch={batch} selected={plan} onSelect={setPlan} onClose={() => setIsCompareOpen(false)} />
      )}
      <Toast message={toast} />
    </div>
  );
}

export default CourseDetailView;
