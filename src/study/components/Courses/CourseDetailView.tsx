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
  AlarmClock,
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
} from 'lucide-react';
import { Batch, Chapter, Subject, buildSyllabus, lectureIcon } from './courseData';
import { Toast, daysHoursMinutes, discountPct, formatINR, useCountdown, useToast } from './CourseShared';
import { enrollInCourse, fetchCompletedLessons, fetchCourseContent, markLessonDone } from '../../lib/courses';

type TabId = 'description' | 'syllabus' | 'tests' | 'community';

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'description', label: 'Description', icon: FileText },
  { id: 'syllabus', label: 'All Classes & Syllabus', icon: BookOpen },
  { id: 'tests', label: 'Test Series & Quizzes', icon: ClipboardList },
  { id: 'community', label: 'Ranker Community & Doubts', icon: MessagesSquare },
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
                </span>
                {lecture.url && (
                  <a
                    href={lecture.url}
                    target="_blank"
                    rel="noopener noreferrer"
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
    // Lessons this student has opened (✓ Done); also counted on the profile's Syllabus Velocity
    const [doneLessons, setDoneLessons] = useState<Set<string>>(() => new Set());
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [openChapter, setOpenChapter] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [toast, showToast] = useToast();
  const countdown = useCountdown(daysHoursMinutes(2, 14, 41));

  const scrollRef = useRef<HTMLDivElement>(null);
  const plansRef = useRef<HTMLElement>(null);
  const subjectsRef = useRef<HTMLElement>(null);
  const breakdownRef = useRef<HTMLElement>(null);

  const isFree = batch.price === 0;
  const hasDiscount = batch.mrp > batch.price;
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
    else if (tab === 'tests') showToast('Tests unlock with enrolment — preview coming soon.');
    else showToast('Ranker Community opens for enrolled students.');
  };

  const handleEnroll = async () => {
    if (enrolling) return;
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
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-[#0F3B42] via-[#0D3239] to-[#0A262C] text-white">
          <div className="absolute -top-20 right-10 w-[420px] h-[420px] rounded-full bg-teal-300/10 blur-[110px] pointer-events-none" />
          <div className="relative max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-white/10 border border-white/15 px-3 py-1 rounded-full">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                {batch.label}
              </span>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-4">{batch.title}</h1>
              {batch.description && <p className="text-sm text-white/70 mt-3 max-w-2xl leading-relaxed whitespace-pre-line">{batch.description}</p>}
              <div className="flex flex-wrap gap-2 mt-5">
                {heroMeta.map((meta) => (
                  <span key={meta.text} className="flex items-center gap-1.5 text-[11px] font-medium bg-white/[0.06] border border-white/10 px-3 py-1.5 rounded-lg">
                    {meta.icon}
                    {meta.text}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-start lg:items-end gap-3">
              {batch.thumbnail && (
                <img
                  src={batch.thumbnail}
                  alt={batch.title}
                  className="w-full max-w-[320px] aspect-video object-cover rounded-xl border border-white/15 shadow-lg"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleShare}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/15 border border-white/15 px-3 py-2 rounded-lg transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Share Course
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
              </button>
            ))}
          </div>
        </nav>

        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16 space-y-10">
          {/* What's included + summary */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
            <section ref={plansRef} className="scroll-mt-16">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#175A67]">Course Overview</p>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight mt-1">What you get with this course</h2>

              <div className="bg-white rounded-2xl p-5 border-2 border-[#175A67] shadow-[0_12px_32px_rgba(23,90,103,0.18)] mt-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-50 text-sky-700">{batch.category}</span>
                  {isEnrolled && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      <CheckCircle2 className="w-3 h-3" />
                      ENROLLED
                    </span>
                  )}
                </div>
                <p className="text-lg font-semibold mt-3">{batch.title}</p>
                <p className="flex items-baseline gap-2 mt-3">
                  <span className="text-2xl font-bold">{isFree ? 'Free' : formatINR(batch.price)}</span>
                  {hasDiscount && <span className="text-xs text-slate-400 line-through">{formatINR(batch.mrp)}</span>}
                </p>
                {hasDiscount && (
                  <p className="text-[11px] font-bold mt-0.5 text-[#175A67]">
                    {discountPct(batch.price, batch.mrp)}% OFF • One-time payment
                  </p>
                )}

                <div className="border-t border-slate-100 mt-4 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {batch.features.map((feature) => (
                    <p key={feature.text} className="flex items-start gap-2 text-[11px] text-slate-600">
                      <feature.icon className="w-3.5 h-3.5 text-[#175A67] shrink-0 mt-px" />
                      {feature.text}
                    </p>
                  ))}
                </div>
              </div>

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
            <aside className="lg:sticky lg:top-16 bg-white rounded-2xl p-5 shadow-[0_12px_40px_rgba(11,28,32,0.08)]">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold bg-sky-50 text-sky-700 px-2 py-1 rounded-md">
                <Target className="w-3.5 h-3.5" />
                {batch.category}
              </span>

              <div className="mt-4 rounded-xl border border-slate-200/80 p-4">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 leading-relaxed">
                  {hasDiscount ? 'Special offer price' : 'Course fee'}
                </p>
                <p className="flex flex-wrap items-baseline gap-2 mt-1.5">
                  <span className="text-3xl font-bold">{isFree ? 'Free' : formatINR(batch.price)}</span>
                  {hasDiscount && (
                    <>
                      <span className="text-xs text-slate-400 line-through">{formatINR(batch.mrp)}</span>
                      <span className="text-[10px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded">
                        {discountPct(batch.price, batch.mrp)}% OFF
                      </span>
                    </>
                  )}
                </p>
                {hasDiscount && (
                  <>
                    <div className="flex items-center justify-between text-xs mt-3">
                      <span className="text-slate-500">Instant Net Savings:</span>
                      <span className="font-bold text-emerald-700">SAVE {formatINR(batch.mrp - batch.price)}</span>
                    </div>
                    <p className="flex items-center justify-center gap-1.5 mt-3 bg-sky-50 border border-sky-100 rounded-lg py-2 text-xs font-semibold text-[#175A67] tabular-nums">
                      <AlarmClock className="w-4 h-4" />
                      Offer ends in: {countdown.days}d : {countdown.hours}h : {countdown.minutes}m
                    </p>
                  </>
                )}
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
                      {isFree ? 'ENROLL FOR FREE' : 'ENROLL NOW'}
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
        </div>
      </div>

      <Toast message={toast} />
    </div>
  );
}

export default CourseDetailView;