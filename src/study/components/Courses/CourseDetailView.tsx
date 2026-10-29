import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Star,
  Clock3,
  Users,
  Share2,
  Zap,
  FileText,
  BookOpen,
  ClipboardList,
  MessagesSquare,
  Target,
  MonitorPlay,
  ShieldCheck,
  Headphones,
  BarChart3,
  MonitorSmartphone,
  PhoneCall,
  CheckCircle2,
  Video,
  Loader2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  TicketPercent,
  X,
} from 'lucide-react';
import { Batch, Chapter, CoursePlan, PlanId, Subject, buildSyllabus, lectureIcon } from './courseData';
import { Toast, discountPct, formatINR, useToast } from './CourseShared';
import { enrollInCourse, enrollWithCoupon, fetchCompletedLessons, fetchCourseContent, markLessonDone } from '../../lib/courses';
import { couponLabel, fetchPublicCoupons, validateCoupon, type AppliedCoupon, type PublicCoupon } from '../../lib/coupons';
import { useSupportContacts } from '../../lib/support';
import { SupportContactList } from '../Support/SupportContactList';
import { CourseFaqs } from './CourseFaqs';
import { CourseLiveClasses } from '../LiveClasses/CourseLiveClasses';
type TabId = 'description' | 'syllabus';

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'description', label: 'Description', icon: FileText },
  { id: 'syllabus', label: 'All Classes & Syllabus', icon: BookOpen },
];

type SyllabusState =
  | { status: 'loading' }
  | { status: 'locked' }
  | { status: 'error'; message: string }
  | { status: 'ready'; subjects: Subject[] };

/* ------------------------------------------------------------------ */
/*  Chapter row                                                         */
/* ------------------------------------------------------------------ */

function ChapterRow({
  chapter,
  subjectName,
  isOpen,
  onToggle,
  done,
  onOpenLesson,
}: {
  chapter: Chapter;
  subjectName?: string;
  isOpen: boolean;
  onToggle: () => void;
  /** Lessons the student has opened */
  done: Set<string>;
  onOpenLesson: (lessonId: string) => void;
}) {
  const num = String(chapter.num).padStart(2, '0');
  const empty = chapter.lectures.length === 0;

  return (
    <div className="py-4">
      <button onClick={empty ? undefined : onToggle} disabled={empty} className={`w-full flex items-center gap-3 text-left ${empty ? 'cursor-default' : ''}`}>
        <span
          className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
            isOpen ? 'bg-[#0F3B42] text-white' : 'bg-[#F6EFE9] text-slate-500'
          }`}
        >
          {num}
        </span>
        <span className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-[#0B1C30]">
            {subjectName && <span className="text-[#175A67]">{subjectName} • </span>}
            Chapter {num}: {chapter.title}
          </span>
          <span className="block text-[11px] text-slate-400 mt-0.5">{empty ? 'Lessons coming soon' : chapter.summary}</span>
        </span>
        {!empty && <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
      </button>

      {isOpen && !empty && (
        <div className="mt-3 sm:pl-11 space-y-2 animate-fadeIn">
          {chapter.lectures.map((lecture) => {
            const Icon = lectureIcon(lecture.type);
            return (
              <div key={lecture.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 px-3 py-2.5">
                <span className="flex items-center gap-2 min-w-0">
                  <Icon className="w-4 h-4 text-[#175A67] shrink-0" />
                  <span className="text-xs font-semibold text-[#0B1C30]">
                    {lecture.code}: {lecture.title}
                  </span>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">({lecture.meta})</span>
                  {done.has(lecture.id) && (
                    <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 whitespace-nowrap">
                      <CheckCircle2 className="w-3 h-3" />
                      Done
                    </span>
                  )}
                </span>
                {lecture.url && (
                  <a
                    href={lecture.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onOpenLesson(lecture.id)}
                    className="flex items-center gap-1 bg-[#175A67] hover:bg-[#124853] text-white text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors"
                  >
                    {lecture.type === 'video' ? 'Watch' : 'Open'}
                    <ExternalLink className="w-3 h-3" />
                  </a>
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
/*  Plan cards (Basic / Pro / Pro Max) — prices from the CMS           */
/* ------------------------------------------------------------------ */

const PLAN_STYLE: Record<PlanId, { tag: string; tagClass: string; suffix: string }> = {
  basic: { tag: 'Essential Prep', tagClass: 'bg-[#EAF3F1] text-[#175A67]', suffix: 'Full Validity' },
  pro: { tag: 'Best Value for Rankers', tagClass: 'bg-sky-100 text-sky-700', suffix: 'Recommended' },
  proMax: { tag: 'Complete Package', tagClass: 'bg-amber-50 text-amber-700', suffix: 'All-inclusive' },
};

/** The plan shown as "Most Popular" and selected first: Pro when offered, otherwise the first one. */
const recommendedPlan = (plans: CoursePlan[]): PlanId => (plans.some((p) => p.id === 'pro') ? 'pro' : plans[0]?.id ?? 'basic');

function PlanCard({
  plan,
  previous,
  selected,
  popular,
  fallbackFeatures,
  onSelect,
}: {
  plan: CoursePlan;
  /** Name of the plan below this one ("Everything in Basic, plus:") */
  previous: string | null;
  selected: boolean;
  popular: boolean;
  /** Shown on Basic when the CMS has no "What's included" lines (duration, lessons, mentors) */
  fallbackFeatures: Batch['features'];
  onSelect: () => void;
}) {
  const style = PLAN_STYLE[plan.id];
  const off = discountPct(plan.price, plan.mrp);
  const showFallback = plan.id === 'basic' && plan.features.length === 0;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`relative min-w-0 text-left bg-white rounded-2xl p-4 border-2 transition-all [overflow-wrap:anywhere] ${
        selected ? 'border-[#175A67] shadow-[0_12px_32px_rgba(23,90,103,0.18)]' : 'border-transparent hover:border-[#175A67]/25'
      }`}
    >
      {popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-wider bg-[#0F3B42] text-white px-2.5 py-1 rounded-full whitespace-nowrap">
          Most Popular
        </span>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${style.tagClass}`}>{style.tag}</span>
        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selected ? 'border-[#175A67]' : 'border-slate-300'}`}>
          {selected && <span className="w-2.5 h-2.5 rounded-full bg-[#175A67]" />}
        </span>
      </div>
      <p className="flex items-center gap-1.5 text-lg font-semibold mt-3">
        {plan.name}
        {popular && <Star className="w-4 h-4 text-[#175A67] fill-[#175A67]" />}
      </p>
      <p className="flex items-baseline gap-2 mt-3">
        <span className="text-2xl font-bold">{plan.price === 0 ? 'Free' : formatINR(plan.price)}</span>
        {plan.mrp > plan.price && <span className="text-xs text-slate-400 line-through">{formatINR(plan.mrp)}</span>}
      </p>
      <p className={`text-[11px] font-bold mt-0.5 ${plan.id === 'basic' ? 'text-red-500' : 'text-[#175A67]'}`}>
        {off > 0 ? `${off}% OFF • ` : ''}
        {style.suffix}
      </p>

      <div className="border-t border-slate-100 mt-4 pt-4 space-y-2.5">
        {previous && (
          <p className="flex items-start gap-2 text-[11px] font-semibold text-[#0B1C30]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#175A67] shrink-0 mt-px" />
            Everything in {previous}
            {plan.features.length ? ', plus:' : ''}
          </p>
        )}
        {plan.features.map((text) => (
          <p key={text} className="flex items-start gap-2 text-[11px] text-slate-600">
            <ShieldCheck className="w-3.5 h-3.5 text-[#175A67] shrink-0 mt-px" />
            {text}
          </p>
        ))}
        {showFallback &&
          fallbackFeatures.map((feature) => (
            <p key={feature.text} className="flex items-start gap-2 text-[11px] text-slate-600">
              <feature.icon className="w-3.5 h-3.5 text-[#175A67] shrink-0 mt-px" />
              {feature.text}
            </p>
          ))}
      </div>
    </button>
  );
}

/** "<Plan> Includes" box: CMS lines (or the course facts when there are none), in 3 columns, collapsible. */
function IncludesBox({
  title,
  lead,
  lines,
  fallback,
  badge = null,
}: {
  title: string;
  lead: string | null;
  lines: string[];
  fallback: Batch['features'];
  badge?: string | null;
}) {
  const [open, setOpen] = useState(true);
  const items: { icon: React.ComponentType<{ className?: string }>; text: string; strong?: boolean }[] = [
    ...(lead ? [{ icon: CheckCircle2, text: lead, strong: true }] : []),
    ...(lines.length ? lines.map((text) => ({ icon: Star, text })) : fallback),
  ];
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 bg-slate-50 hover:bg-slate-100/70 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm sm:text-base font-semibold text-[#0B1C30]">
          {title}
          {badge && (
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              <CheckCircle2 className="w-3 h-3" />
              {badge}
            </span>
          )}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 sm:px-5 py-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-3">
          {items.length === 0 ? (
            <p className="text-[13px] text-slate-500">Full course access after enrolment.</p>
          ) : (
            items.map((item) => (
              <p key={item.text} className={`flex items-start gap-2 min-w-0 [overflow-wrap:anywhere] text-[13px] ${item.strong ? 'font-semibold text-[#0B1C30]' : 'text-slate-700'}`}>
                <item.icon className="w-4 h-4 text-[#175A67] shrink-0 mt-0.5" />
                {item.text}
              </p>
            ))
          )}
        </div>
      )}
    </div>
  );
}
/* ------------------------------------------------------------------ */
/*  Coupons (CMS → Private/Public Coupons)                              */
/* ------------------------------------------------------------------ */

function CouponBox({
  coupons,
  applied,
  busyCode,
  error,
  onApply,
  onRemove,
}: {
  coupons: PublicCoupon[];
  applied: AppliedCoupon | null;
  busyCode: string | null;
  error: string | null;
  onApply: (code: string) => void;
  onRemove: () => void;
}) {
  const [code, setCode] = useState('');
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? coupons : coupons.slice(0, 3);

  if (applied) {
    return (
      <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
        <span className="flex items-center gap-2 min-w-0">
          <TicketPercent className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="min-w-0">
            <span className="block text-xs font-bold text-emerald-800 truncate">{applied.code} applied</span>
            <span className="block text-[11px] text-emerald-700">You save {formatINR(applied.discountAmount)}</span>
          </span>
        </span>
        <button onClick={onRemove} className="flex items-center gap-1 text-[11px] font-semibold text-emerald-800 hover:underline shrink-0" aria-label="Remove coupon">
          <X className="w-3.5 h-3.5" />
          Remove
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-200/80 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-[#0B1C30]">
        <TicketPercent className="w-4 h-4 text-[#175A67]" />
        Apply coupon
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) onApply(code);
        }}
        className="mt-2 flex gap-2"
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Enter coupon code"
          aria-label="Coupon code"
          maxLength={30}
          className="flex-1 min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-[#175A67]/30"
        />
        <button
          type="submit"
          disabled={!code.trim() || busyCode !== null}
          className="rounded-lg bg-[#175A67] hover:bg-[#124853] disabled:opacity-50 text-white text-xs font-semibold px-3.5"
        >
          {busyCode !== null && busyCode === code.trim() ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Apply'}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-1.5 text-[11px] font-semibold text-red-600">
          {error}
        </p>
      )}

      {coupons.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Available coupons</p>
          {visible.map((c) => (
            <div key={c.code} className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-[#175A67]/40 bg-[#F4FAFB] px-3 py-2">
              <span className="min-w-0">
                <span className="block text-xs font-bold tracking-wide text-[#0B1C30] truncate">{c.code}</span>
                <span className="block text-[11px] text-emerald-700 font-semibold">{couponLabel(c)}</span>
              </span>
              <button
                onClick={() => onApply(c.code)}
                disabled={busyCode !== null}
                className="shrink-0 text-[11px] font-bold text-[#175A67] hover:underline disabled:opacity-50"
              >
                {busyCode === c.code ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'APPLY'}
              </button>
            </div>
          ))}
          {coupons.length > 3 && (
            <button onClick={() => setShowAll((v) => !v)} className="text-[11px] font-semibold text-[#175A67] hover:underline">
              {showAll ? 'Show less' : `View all ${coupons.length} coupons`}
            </button>
          )}
        </div>
      )}
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
  onGoToMyCourses: () => void;
}

export function CourseDetailView({
  batch,
  isEnrolled,
  selectedBatch,
  scrollToPlans = false,
  onBack,
  onExit,
  onGoToMyCourses,
}: CourseDetailViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>('description');
  const [syllabus, setSyllabus] = useState<SyllabusState>({ status: 'loading' });
  const { contacts: supportContacts } = useSupportContacts();
    // Lessons this student has opened (✓ Done); also counted on the profile's Syllabus Velocity
    const [doneLessons, setDoneLessons] = useState<Set<string>>(() => new Set());
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [openChapter, setOpenChapter] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [toast, showToast] = useToast();

  const scrollRef = useRef<HTMLDivElement>(null);
  const plansRef = useRef<HTMLElement>(null);
  const subjectsRef = useRef<HTMLElement>(null);
  const breakdownRef = useRef<HTMLElement>(null);

  // Plans (Basic / Pro / Pro Max) are offered when the CMS has a Pro or Pro Max price; owners see their course card
  const showPlans = batch.plans.length > 1 && !isEnrolled;
  const [planId, setPlanId] = useState<PlanId>(() => recommendedPlan(batch.plans));
  const [thumbFailed, setThumbFailed] = useState(false);
  const selectedPlan = (showPlans ? batch.plans.find((p) => p.id === planId) : null) ?? { id: 'basic' as const, name: 'Basic', price: batch.price, mrp: batch.mrp, features: [] };
  const planPrice = selectedPlan.price;
  const mrp = selectedPlan.mrp;

  // Coupons: public ones for this course are listed; any code can be typed. The price is re-checked on the server.
  const [coupons, setCoupons] = useState<PublicCoupon[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponBusy, setCouponBusy] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const couponable = !isEnrolled && batch.plans.some((p) => p.price > 0);

  const price = appliedCoupon ? appliedCoupon.finalPrice : planPrice;
  const isFree = price === 0;
  const hasDiscount = mrp > price;
  const subjects = syllabus.status === 'ready' ? syllabus.subjects : [];
  const subject = subjects.find((s) => s.id === activeSubjectId) ?? subjects[0] ?? null;

  // Lessons come from the CMS content tree; the backend only returns them to enrolled students
  const loadSyllabus = useCallback(async () => {
    if (!isEnrolled) {
      setSyllabus({ status: 'locked' });
      return;
    }
    setSyllabus({ status: 'loading' });
    try {
      const result = await fetchCourseContent(batch.courseId);
      setSyllabus(result.status === 'locked' ? { status: 'locked' } : { status: 'ready', subjects: buildSyllabus(result.items) });
      if (result.status !== 'locked') {
        fetchCompletedLessons(batch.courseId)
          .then((ids) => setDoneLessons(new Set(ids)))
          .catch(() => undefined);
      }
    } catch (err) {
      setSyllabus({ status: 'error', message: err instanceof Error ? err.message : 'Could not load the syllabus.' });
    }
  }, [batch.courseId, isEnrolled]);

  useEffect(() => {
    void loadSyllabus();
  }, [loadSyllabus, isEnrolled]);

  const openLesson = (lessonId: string) => {
    if (doneLessons.has(lessonId)) return;
    setDoneLessons((prev) => new Set(prev).add(lessonId));
    markLessonDone(batch.courseId, lessonId).catch(() => undefined); // progress only; never blocks opening the lesson
  };
  // Open the first chapter of whichever subject is selected
  useEffect(() => {
    const first = subject?.chapters.find((c) => c.lectures.length > 0);
    setOpenChapter(first ? first.id : null);
  }, [subject]);

  useEffect(() => {
    if (scrollToPlans) plansRef.current?.scrollIntoView({ block: 'start' });
  }, [scrollToPlans]);

  useEffect(() => {
    if (!couponable) return;
    let cancelled = false;
    fetchPublicCoupons(batch.courseId)
      .then((list) => !cancelled && setCoupons(list))
      .catch(() => undefined); // coupons are extra: the page works without them
    return () => {
      cancelled = true;
    };
  }, [batch.courseId, couponable]);

  const applyCoupon = async (code: string) => {
    const clean = code.trim().toUpperCase();
    if (!clean || couponBusy) return;
    setCouponBusy(clean);
    setCouponError(null);
    try {
      const result = await validateCoupon(clean, batch.courseId, selectedPlan.id);
      setAppliedCoupon(result);
      showToast(`${result.code} applied — you save ${formatINR(result.discountAmount)}`);
    } catch (err) {
      setCouponError(err instanceof Error && err.message ? err.message : 'Could not apply this coupon.');
    } finally {
      setCouponBusy(null);
    }
  };

  // A different plan has a different price: work the applied coupon out again (or drop it if it no longer applies)
  const appliedCode = appliedCoupon?.code ?? null;
  useEffect(() => {
    if (!appliedCode) return;
    let cancelled = false;
    validateCoupon(appliedCode, batch.courseId, selectedPlan.id)
      .then((result) => !cancelled && setAppliedCoupon(result))
      .catch((err) => {
        if (cancelled) return;
        setAppliedCoupon(null);
        setCouponError(err instanceof Error && err.message ? err.message : 'This coupon does not apply to this plan.');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlan.id]);
  // Searching shows matching chapters from every subject
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return subjects.flatMap((s) =>
      s.chapters
        .filter((c) => c.title.toLowerCase().includes(q) || c.lectures.some((l) => l.title.toLowerCase().includes(q)))
        .map((c) => ({ subject: s, chapter: c }))
    );
  }, [query, subjects]);

  const scrollTo = (el: HTMLElement | null) => el?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const handleTab = (tab: TabId) => {
    setActiveTab(tab);
    if (tab === 'description') scrollTo(plansRef.current);
    else if (tab === 'syllabus') {
      if (syllabus.status !== 'locked' && subjectsRef.current) {
        scrollTo(subjectsRef.current);
      } else {
        showToast('Lessons unlock after enrollment.');
      }
    }
  };

  const handleEnroll = async () => {
    if (enrolling) return;
        // A coupon that makes the plan free enrols right away (the server checks the coupon and the price again)
        if (appliedCoupon && appliedCoupon.finalPrice === 0) {
          setEnrolling(true);
          const result = await enrollWithCoupon(batch.courseId, appliedCoupon.code, selectedPlan.id);
          setEnrolling(false);
          if (!result.ok) {
            showToast(result.error);
            return;
          }
          confetti({ particleCount: 110, spread: 80, origin: { y: 0.6 }, colors: ['#10B981', '#175A67', '#F59E0B'] });
          showToast(`You're enrolled in ${batch.title}!`);
          return;
        }
    // A paid Pro / Pro Max must never fall through to the free Basic enrolment
    if (showPlans && selectedPlan.id !== 'basic' && !isFree) {
      showToast(`Online payment for ${selectedPlan.name} is coming soon.`);
      return;
    }
    setEnrolling(true);
    const result = await enrollInCourse(batch.courseId);
    setEnrolling(false);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    confetti({ particleCount: 110, spread: 80, origin: { y: 0.6 }, colors: ['#10B981', '#175A67', '#F59E0B'] });
    showToast(`You're enrolled in ${batch.title}!`);
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href).catch(() => undefined);
    showToast('Course link copied to clipboard.');
  };

  const heroMeta = [
    { icon: <BookOpen className="w-3.5 h-3.5" />, text: `Category: ${batch.category}` },
    batch.duration && { icon: <Clock3 className="w-3.5 h-3.5" />, text: `Duration: ${batch.duration}` },
    batch.totalLessons && { icon: <Video className="w-3.5 h-3.5" />, text: `Lessons: ${batch.totalLessons}` },
    batch.studentsEnrolled && { icon: <Users className="w-3.5 h-3.5" />, text: `Enrolled: ${batch.studentsEnrolled.toLocaleString('en-IN')}+` },
  ].filter((m): m is { icon: React.ReactElement; text: string } => !!m);

  return (
    <div className="relative w-full rounded-[24px] overflow-hidden flex flex-col bg-[#DCEAE3] font-sans text-[#0B1C30] min-h-[calc(100vh-6rem)] shadow-sm">
      {/* Top bar - Breadcrumb & Back */}
      <header className="shrink-0 bg-white border-b border-slate-200/70">
        <div className="h-12 px-3 sm:px-6 flex items-center gap-2 text-xs overflow-x-auto no-scrollbar">
          <button onClick={onBack} className="flex items-center gap-1.5 font-semibold text-[#175A67] hover:underline whitespace-nowrap">
            <ArrowLeft className="w-4 h-4" />
            All Courses
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

      {/* Body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {/* Title band */}
        <section className="relative overflow-hidden bg-gradient-to-r from-[#175A67] via-[#145160] to-[#0F3B42] text-white">
          <span className="absolute -top-10 right-[22%] w-48 h-24 rounded-3xl bg-white/[0.07] pointer-events-none" aria-hidden />
          <span className="absolute -bottom-12 right-6 w-40 h-32 rounded-3xl bg-white/[0.07] pointer-events-none" aria-hidden />
          <div className="relative max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-white/10 border border-white/15 px-3 py-1 rounded-full">
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              {batch.label}
            </span>
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight mt-3">{batch.title}</h1>
            {heroMeta.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {heroMeta.map((meta) => (
                  <span key={meta.text} className="flex items-center gap-1.5 text-[11px] font-medium bg-white/[0.08] border border-white/15 px-3 py-1.5 rounded-lg">
                    {meta.icon}
                    {meta.text}
                  </span>
                ))}
              </div>
            )}
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
              </button>
            ))}
          </div>
        </nav>

        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16 space-y-10">
          {/* What's included + summary */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
            <section ref={plansRef} className="scroll-mt-16">
            {showPlans && (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#175A67]">Enrollment Pathways</p>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight mt-1">Choose a Plan tailored for your preparation</h2>

                  <div className={`grid grid-cols-1 gap-4 mt-6 items-start ${batch.plans.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                    {batch.plans.map((plan, i) => (
                      <PlanCard
                        key={plan.id}
                        plan={plan}
                        previous={i > 0 ? batch.plans[i - 1].name : null}
                        selected={plan.id === selectedPlan.id}
                        popular={plan.id === recommendedPlan(batch.plans) && plan.id !== 'basic'}
                        fallbackFeatures={batch.features}
                        onSelect={() => setPlanId(plan.id)}
                      />
                    ))}
                  </div>
                </>
              )}
              {!showPlans && (
                <IncludesBox
                  title="Course Includes"
                  badge={isEnrolled ? 'Enrolled' : null}
                  lead={null}
                  lines={batch.plans[0]?.features ?? []}
                  fallback={batch.features}
                />
              )}
              {/* Live classes (CMS → Go Live): Join link only for enrolled students */}
              <CourseLiveClasses courseId={batch.courseId} isEnrolled={isEnrolled} />

              {/* Description from the CMS, below the plans */}
              {batch.description && (
                <div className="mt-6 bg-white rounded-2xl p-5 sm:p-6 shadow-[0_6px_24px_rgb(0,0,0,0.04)]">
                  <h3 className="text-base sm:text-lg font-semibold">About this course</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mt-3 whitespace-pre-line [overflow-wrap:anywhere]">{batch.description}</p>
                </div>
              )}

              {batch.mentors.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold mb-3">Your Mentors</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {batch.mentors.map((mentor) => (
                      <div key={mentor.name} className="flex items-center gap-3 bg-white rounded-2xl p-3">
                        {mentor.photo ? (
                          <img src={mentor.photo} alt={mentor.name} className="w-11 h-11 rounded-full object-cover shrink-0" />
                        ) : (
                          <span className="w-11 h-11 rounded-full bg-sky-50 text-[#175A67] flex items-center justify-center font-bold shrink-0">
                            {mentor.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold truncate">{mentor.name}</span>
                          {mentor.experience && <span className="block text-[11px] text-slate-500">{mentor.experience}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Summary / checkout card */}
            <aside className="lg:sticky lg:top-16 bg-white rounded-2xl p-3 shadow-[0_12px_40px_rgba(11,28,32,0.08)]">
              {batch.thumbnail && !thumbFailed && (
                <img
                  src={batch.thumbnail}
                  alt={batch.title}
                  className="w-full aspect-[2/1] object-cover rounded-xl"
                  onError={() => setThumbFailed(true)}
                />
              )}
              <div className="px-2 pt-3 pb-2">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[12px] text-slate-600 min-w-0">
                  <Target className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="truncate">For {batch.category} aspirants</span>
                </span>
                {(batch.duration || batch.totalLessons) && (
                  <span className="shrink-0 text-[11px] font-semibold text-[#175A67] bg-sky-50 px-2.5 py-1 rounded-md">
                    {batch.duration ?? `${batch.totalLessons} lessons`}
                  </span>
                )}
              </div>

              <div className="mt-4 rounded-xl border border-slate-200/80 p-4">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 leading-relaxed">
                  {showPlans
                    ? `${hasDiscount ? 'Special offer price' : 'Plan fee'} (EduRain ${selectedPlan.name}${selectedPlan.id === recommendedPlan(batch.plans) && selectedPlan.id !== 'basic' ? ' • Recommended' : ''})`
                    : hasDiscount
                    ? 'Special offer price'
                    : 'Course fee'}
                </p>
                <p className="flex flex-wrap items-baseline gap-2 mt-1.5">
                  <span className="text-3xl font-bold">{isFree ? 'Free' : formatINR(price)}</span>
                  {hasDiscount && (
                    <>
                      <span className="text-xs text-slate-400 line-through">{formatINR(mrp)}</span>
                      <span className="text-[10px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded">
                        {discountPct(price, mrp)}% OFF
                      </span>
                    </>
                  )}
                </p>
                {appliedCoupon && (
                  <div className="flex items-center justify-between text-xs mt-3">
                    <span className="text-slate-500">Coupon ({appliedCoupon.code}):</span>
                    <span className="font-bold text-emerald-700">− {formatINR(appliedCoupon.discountAmount)}</span>
                  </div>
                )}
                {hasDiscount && (
                  <>
                    <div className="flex items-center justify-between text-xs mt-3">
                      <span className="text-slate-500">Instant Net Savings:</span>
                      <span className="font-bold text-emerald-700">SAVE {formatINR(mrp - price)}</span>
                    </div>
                  </>
                )}
              </div>

              {couponable && (
                <CouponBox
                  coupons={coupons}
                  applied={appliedCoupon}
                  busyCode={couponBusy}
                  error={couponError}
                  onApply={(code) => void applyCoupon(code)}
                  onRemove={() => {
                    setAppliedCoupon(null);
                    setCouponError(null);
                  }}
                />
              )}

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
                  disabled={enrolling}
                  className="mt-4 w-full flex items-center justify-center gap-2 bg-[#0B1C20] hover:bg-[#15302F] disabled:opacity-70 text-white font-bold text-sm tracking-wide py-3.5 rounded-xl transition-all active:scale-[0.98]"
                >
                  {enrolling ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      ENROLLING…
                    </>
                  ) : (
                    <>
                      {isFree ? 'ENROLL FOR FREE' : showPlans ? `ENROLL IN ${selectedPlan.name.toUpperCase()}` : 'ENROLL NOW'}
                      <Zap className="w-4 h-4 fill-current" />
                    </>
                  )}
                </button>
              )}
              <button
                onClick={() => {
                  setQuery('');
                  scrollTo(subjectsRef.current);
                }}
                className="mt-2.5 w-full flex items-center justify-center gap-2 border border-[#175A67]/40 hover:bg-[#F4FAFB] text-[#175A67] text-xs font-semibold py-3 rounded-xl transition-colors"
              >
                <MonitorPlay className="w-4 h-4" />
                View Course Syllabus
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

              {/* Support numbers from CMS → Support Contacts (hidden until one is added) */}
              {supportContacts.length > 0 && (
                <div className="mt-4 rounded-xl border border-slate-200/80 p-3">
                  <p className="flex items-center gap-2 text-[11px] text-slate-500 mb-2">
                    <PhoneCall className="w-3.5 h-3.5 text-[#175A67]" />
                    Need guidance before joining?
                  </p>
                  <SupportContactList contacts={supportContacts} compact />
                </div>
              )}
              </div>
            </aside>
          </div>

          {/* Subjects (rendered when syllabus is available / unlocked) */}
          {syllabus.status !== 'locked' && (
            <section ref={subjectsRef} className="scroll-mt-16">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#175A67]">Curriculum Framework</p>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight mt-1 mb-5">Subjects &amp; Syllabus Directory</h2>

              {syllabus.status === 'loading' ? (
                <div className="bg-white rounded-2xl py-10 flex items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading syllabus…
                </div>
              ) : syllabus.status === 'error' ? (
                <div className="bg-white rounded-2xl py-10 px-6 flex flex-col items-center text-center">
                  <AlertTriangle className="w-6 h-6 text-amber-500 mb-2" />
                  <p className="font-semibold">Couldn't load the syllabus</p>
                  <p className="text-xs text-slate-500 mt-1">{syllabus.message}</p>
                  <button
                    onClick={() => void loadSyllabus()}
                    className="mt-4 flex items-center gap-1.5 bg-[#0B1C20] hover:bg-[#15302F] text-white text-xs font-semibold px-4 py-2 rounded-full"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Try again
                  </button>
                </div>
              ) : subjects.length === 0 ? (
                <div className="bg-white rounded-2xl py-10 px-6 text-center">
                  <p className="font-semibold">Lessons are being added</p>
                  <p className="text-xs text-slate-500 mt-1">Your teachers are uploading this course's content. Check back soon.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {subjects.map((s) => {
                    const active = s.id === subject?.id && !query.trim();
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
                          View Syllabus
                          <ArrowRight className="w-4 h-4" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Chapter breakdown / search results */}
          {subject && (
            <section ref={breakdownRef} className="scroll-mt-16 bg-white rounded-2xl p-5 sm:p-6 shadow-[0_6px_24px_rgb(0,0,0,0.04)]">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#175A67]">
                    {searchResults ? 'Syllabus Search' : `${subject.name} Chapter Breakdown`}
                  </p>
                  <h3 className="font-semibold mt-0.5">
                    {searchResults
                      ? `${searchResults.length} chapter${searchResults.length === 1 ? '' : 's'} match “${query.trim()}”`
                      : subject.moduleTitle}
                  </h3>
                </div>
              </div>

              {searchResults ? (
                searchResults.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6">No chapters or lessons match that search.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {searchResults.map(({ subject: s, chapter }) => (
                      <ChapterRow
                        key={chapter.id}
                        chapter={chapter}
                        subjectName={s.name}
                        isOpen={openChapter === chapter.id}
                        onToggle={() => setOpenChapter(openChapter === chapter.id ? null : chapter.id)}
                        done={doneLessons}
                        onOpenLesson={openLesson}
                      />
                    ))}
                  </div>
                )
              ) : subject.chapters.length === 0 ? (
                <p className="text-sm text-slate-500 py-6">No chapters in this subject yet.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {subject.chapters.map((chapter) => (
                    <ChapterRow
                      key={chapter.id}
                      chapter={chapter}
                      isOpen={openChapter === chapter.id}
                      onToggle={() => setOpenChapter(openChapter === chapter.id ? null : chapter.id)}
                      done={doneLessons}
                      onOpenLesson={openLesson}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* FAQs from CMS → FAQs (hidden when the course has none) */}
          <CourseFaqs courseId={batch.courseId} />
        </div>
      </div>

      <Toast message={toast} />
    </div>
  );
}

export default CourseDetailView;