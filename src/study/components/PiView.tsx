import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Play,
  Trophy,
  Wallet,
  Zap,
  Brain,
  Sparkles,
  IndianRupee,
  Star,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  Lock,
  Clock,
  Flame,
  Gift,
  ArrowRight,
  TrendingUp,
  Coins,
  ShieldCheck,
  Users,
  Bookmark,
  Target,
  Activity,
} from 'lucide-react';
import { SubPageHeader } from './SubPageHeader';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Category = 'IIT-JEE' | 'NEET' | 'UPSC';

interface PiCourse {
  id: string;
  title: string;
  category: Category;
  instructor: string;
  subject: string;
  lessons: number;
  duration: string;
  priceINR: number;
  rating: number;
  enrolled: string;
  progress?: number;
  gradient: string;
  isNew?: boolean;
  // Continue Learning specific display fields
  progressCompleted?: number;
  progressTotal?: number;
  lastViewedLabel?: string;
  nextLesson?: string;
}

interface TopTenEntry {
  rank: number;
  title: string;
  subject: string;
  category: Category;
  rating: number;
  reviews: string;
  enrolled: string;
  highYield: number;
}

interface GameDef {
  id: 'quiz' | 'reflex' | 'spin';
  title: string;
  tagline: string;
  icon: React.ComponentType<{ className?: string }>;
  reward: string;
  accent: string;
}

interface PiViewProps {
  onOpenUpgrade: () => void;
  onOpenDoubtSolver: () => void;
  onBack?: () => void;
  searchQuery?: string;
}

/* ------------------------------------------------------------------ */
/*  Dummy content                                                      */
/* ------------------------------------------------------------------ */

const COURSES: PiCourse[] = [
  // IIT-JEE
  {
    id: 'c1',
    title: 'Rotational Dynamics & Angular Momentum',
    category: 'IIT-JEE',
    instructor: 'Er. Kabir Rana',
    subject: 'Physics',
    lessons: 42,
    duration: '18h 20m',
    priceINR: 149,
    rating: 4.9,
    enrolled: '18.2k',
    progress: 72,
    gradient: 'from-teal-600 to-emerald-500',
    progressCompleted: 18,
    progressTotal: 25,
    lastViewedLabel: 'Last viewed 2h ago',
  },
  { id: 'c2', title: 'Organic Reactions Vault', category: 'IIT-JEE', instructor: 'Dr. Neha Kapoor', subject: 'Chemistry', lessons: 55, duration: '24h 10m', priceINR: 199, rating: 4.9, enrolled: '22.5k', gradient: 'from-sky-600 to-teal-500' },
  {
    id: 'c3',
    title: 'Calculus for Advanced: Integration Techniques',
    category: 'IIT-JEE',
    instructor: 'Prof. Amit Verma',
    subject: 'Mathematics',
    lessons: 38,
    duration: '16h 45m',
    priceINR: 129,
    rating: 4.8,
    enrolled: '15.9k',
    progress: 45,
    gradient: 'from-emerald-600 to-teal-500',
    progressCompleted: 17,
    progressTotal: 38,
    nextLesson: 'Next: Integration by Parts',
  },
  { id: 'c4', title: 'Electrostatics from Zero', category: 'IIT-JEE', instructor: 'Er. Kabir Rana', subject: 'Physics', lessons: 30, duration: '14h 05m', priceINR: 99, rating: 4.6, enrolled: '11.3k', isNew: true, gradient: 'from-cyan-600 to-teal-500' },
  {
    id: 'c5',
    title: 'Organic Reaction Mechanisms',
    category: 'IIT-JEE',
    instructor: 'Dr. Neha Kapoor',
    subject: 'Chemistry',
    lessons: 55,
    duration: '24h 10m',
    priceINR: 179,
    rating: 4.9,
    enrolled: '19.8k',
    progress: 88,
    gradient: 'from-sky-700 to-emerald-600',
    progressCompleted: 48,
    progressTotal: 55,
    nextLesson: 'Next: Aldol Condensation',
  },

  // NEET
  {
    id: 'n1',
    title: 'Human Physiology Deep Dive',
    category: 'NEET',
    instructor: 'Dr. Ritu Sharma',
    subject: 'Biology',
    lessons: 60,
    duration: '28h 30m',
    priceINR: 179,
    rating: 4.9,
    enrolled: '31.4k',
    progress: 54,
    gradient: 'from-emerald-600 to-lime-500',
    progressCompleted: 26,
    progressTotal: 48,
    lastViewedLabel: 'Last viewed 5h ago',
  },
  { id: 'n2', title: 'Genetics & Evolution Sprint', category: 'NEET', instructor: 'Dr. Ritu Sharma', subject: 'Biology', lessons: 34, duration: '15h 00m', priceINR: 149, rating: 4.8, enrolled: '19.7k', gradient: 'from-teal-600 to-green-500' },
  { id: 'n3', title: 'Chemical Bonding NEET Edition', category: 'NEET', instructor: 'Dr. Neha Kapoor', subject: 'Chemistry', lessons: 28, duration: '12h 40m', priceINR: 99, rating: 4.7, enrolled: '14.1k', isNew: true, gradient: 'from-sky-600 to-emerald-500' },
  {
    id: 'n4',
    title: 'NEET Physics Crash Course',
    category: 'NEET',
    instructor: 'Er. Kabir Rana',
    subject: 'Physics',
    lessons: 25,
    duration: '11h 15m',
    priceINR: 129,
    rating: 4.6,
    enrolled: '9.8k',
    progress: 80,
    gradient: 'from-teal-500 to-cyan-500',
    progressCompleted: 20,
    progressTotal: 25,
    nextLesson: 'Next: Modern Physics Basics',
  },

  // UPSC
  {
    id: 'u1',
    title: 'Indian Polity Foundations',
    category: 'UPSC',
    instructor: 'Ms. Anjali Rao',
    subject: 'GS Paper II',
    lessons: 48,
    duration: '22h 00m',
    priceINR: 199,
    rating: 4.9,
    enrolled: '27.6k',
    progress: 33,
    gradient: 'from-amber-600 to-teal-600',
    progressCompleted: 16,
    progressTotal: 48,
    lastViewedLabel: 'Last viewed 1d ago',
  },
  { id: 'u2', title: 'Modern History Timeline', category: 'UPSC', instructor: 'Mr. Suresh Iyer', subject: 'GS Paper I', lessons: 40, duration: '19h 50m', priceINR: 149, rating: 4.8, enrolled: '20.3k', gradient: 'from-teal-600 to-amber-500' },
  { id: 'u3', title: 'Ethics & Case Studies', category: 'UPSC', instructor: 'Ms. Anjali Rao', subject: 'GS Paper IV', lessons: 22, duration: '10h 30m', priceINR: 99, rating: 4.7, enrolled: '12.8k', isNew: true, gradient: 'from-emerald-600 to-amber-500' },
  { id: 'u4', title: 'Indian Economy Essentials', category: 'UPSC', instructor: 'Mr. Suresh Iyer', subject: 'GS Paper III', lessons: 36, duration: '17h 20m', priceINR: 169, rating: 4.8, enrolled: '16.5k', gradient: 'from-teal-600 to-lime-500' },
];

const TOP_TEN: TopTenEntry[] = [
  // IIT-JEE
  { rank: 1, title: 'Rotational Dynamics & Conservation Laws', subject: 'Physics', category: 'IIT-JEE', rating: 4.9, reviews: '3.4k', enrolled: '18.2k', highYield: 98 },
  { rank: 2, title: 'Electrostatics & Gauss Law Mastery', subject: 'Physics', category: 'IIT-JEE', rating: 4.9, reviews: '2.8k', enrolled: '15.4k', highYield: 96 },
  { rank: 3, title: 'Definite Integration & Area Under Curves', subject: 'Mathematics', category: 'IIT-JEE', rating: 4.8, reviews: '2.1k', enrolled: '13.9k', highYield: 94 },
  { rank: 4, title: 'Organic Reactions & Synthesis Vault', subject: 'Chemistry', category: 'IIT-JEE', rating: 4.8, reviews: '1.9k', enrolled: '11.9k', highYield: 92 },
  { rank: 5, title: 'Coordination Compounds & Crystal Field Theory', subject: 'Chemistry', category: 'IIT-JEE', rating: 4.7, reviews: '1.4k', enrolled: '9.6k', highYield: 91 },
  { rank: 6, title: 'Thermodynamics & Entropy Analysis', subject: 'Physics', category: 'IIT-JEE', rating: 4.7, reviews: '1.2k', enrolled: '8.8k', highYield: 89 },
  { rank: 7, title: 'Matrices & Determinants Rank Booster', subject: 'Mathematics', category: 'IIT-JEE', rating: 4.6, reviews: '1.1k', enrolled: '7.9k', highYield: 87 },
  { rank: 8, title: 'Chemical Bonding & Molecular Geometry', subject: 'Chemistry', category: 'IIT-JEE', rating: 4.7, reviews: '980', enrolled: '7.1k', highYield: 90 },
  { rank: 9, title: 'Vectors & 3D Geometry Sprint', subject: 'Mathematics', category: 'IIT-JEE', rating: 4.6, reviews: '860', enrolled: '6.4k', highYield: 85 },
  { rank: 10, title: 'Modern Physics & Photoelectric Effect', subject: 'Physics', category: 'IIT-JEE', rating: 4.8, reviews: '1.5k', enrolled: '9.9k', highYield: 93 },

  // NEET
  { rank: 1, title: 'Human Physiology Deep Dive', subject: 'Biology', category: 'NEET', rating: 4.9, reviews: '4.1k', enrolled: '21.3k', highYield: 97 },
  { rank: 2, title: 'Genetics & Evolution Sprint', subject: 'Biology', category: 'NEET', rating: 4.8, reviews: '2.6k', enrolled: '15.8k', highYield: 94 },
  { rank: 3, title: 'Cell Structure & Biomolecules Mastery', subject: 'Biology', category: 'NEET', rating: 4.8, reviews: '2.2k', enrolled: '13.1k', highYield: 93 },
  { rank: 4, title: 'Chemical Bonding NEET Edition', subject: 'Chemistry', category: 'NEET', rating: 4.7, reviews: '1.6k', enrolled: '10.4k', highYield: 90 },
  { rank: 5, title: 'Plant Physiology & Reproduction', subject: 'Biology', category: 'NEET', rating: 4.7, reviews: '1.4k', enrolled: '9.2k', highYield: 89 },
  { rank: 6, title: 'Human Health & Disease', subject: 'Biology', category: 'NEET', rating: 4.6, reviews: '1.1k', enrolled: '7.6k', highYield: 87 },
  { rank: 7, title: 'NEET Physics Crash Course', subject: 'Physics', category: 'NEET', rating: 4.6, reviews: '980', enrolled: '6.9k', highYield: 86 },
  { rank: 8, title: 'Organic Chemistry for NEET', subject: 'Chemistry', category: 'NEET', rating: 4.7, reviews: '1.2k', enrolled: '8.1k', highYield: 88 },
  { rank: 9, title: 'Ecology & Environment', subject: 'Biology', category: 'NEET', rating: 4.5, reviews: '760', enrolled: '5.4k', highYield: 83 },
  { rank: 10, title: 'Reproductive Health', subject: 'Biology', category: 'NEET', rating: 4.6, reviews: '890', enrolled: '6.1k', highYield: 85 },

  // UPSC
  { rank: 1, title: 'Indian Polity Foundations', subject: 'GS Paper II', category: 'UPSC', rating: 4.9, reviews: '3.6k', enrolled: '19.7k', highYield: 97 },
  { rank: 2, title: 'Modern History Timeline', subject: 'GS Paper I', category: 'UPSC', rating: 4.8, reviews: '2.4k', enrolled: '14.2k', highYield: 93 },
  { rank: 3, title: 'Indian Economy Essentials', subject: 'GS Paper III', category: 'UPSC', rating: 4.8, reviews: '2.0k', enrolled: '12.6k', highYield: 92 },
  { rank: 4, title: 'Ethics & Case Studies', subject: 'GS Paper IV', category: 'UPSC', rating: 4.7, reviews: '1.3k', enrolled: '9.1k', highYield: 89 },
  { rank: 5, title: 'Geography & Natural Resources', subject: 'GS Paper I', category: 'UPSC', rating: 4.6, reviews: '1.1k', enrolled: '7.8k', highYield: 87 },
  { rank: 6, title: 'Governance & Constitution Deep Dive', subject: 'GS Paper II', category: 'UPSC', rating: 4.7, reviews: '1.0k', enrolled: '7.2k', highYield: 88 },
  { rank: 7, title: 'Current Affairs Weekly Digest', subject: 'GS Paper III', category: 'UPSC', rating: 4.5, reviews: '820', enrolled: '6.0k', highYield: 84 },
  { rank: 8, title: 'International Relations Primer', subject: 'GS Paper II', category: 'UPSC', rating: 4.6, reviews: '900', enrolled: '6.5k', highYield: 86 },
  { rank: 9, title: 'Art & Culture Compendium', subject: 'GS Paper I', category: 'UPSC', rating: 4.5, reviews: '700', enrolled: '5.1k', highYield: 82 },
  { rank: 10, title: 'Disaster Management Essentials', subject: 'GS Paper III', category: 'UPSC', rating: 4.4, reviews: '560', enrolled: '4.3k', highYield: 80 },
];

const GAMES: GameDef[] = [
  { id: 'quiz', title: 'Speed Quiz', tagline: '5 rapid-fire questions, 25 pts each', icon: Brain, reward: 'Up to 125 pts', accent: 'from-teal-600 to-emerald-500' },
  { id: 'reflex', title: 'Reflex Tap', tagline: 'Tap the instant it turns green', icon: Zap, reward: 'Up to 100 pts', accent: 'from-amber-500 to-teal-600' },
  { id: 'spin', title: 'Daily Spin', tagline: 'One free spin, guaranteed reward', icon: Gift, reward: '10 – 100 pts', accent: 'from-emerald-500 to-sky-600' },
];

const STREAK_ACTIONS: { gameId: GameDef['id']; label: string; xp?: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { gameId: 'quiz', label: 'Speed Quiz', xp: '+25 XP', icon: Zap },
  { gameId: 'reflex', label: 'Reflex Formula Tap', xp: '+15 XP', icon: Target },
  { gameId: 'spin', label: 'Spin Daily Bonus', icon: Gift },
];

const QUIZ_QUESTIONS = [
  { q: 'What is the SI unit of electric resistance?', options: ['Ohm', 'Henry', 'Farad', 'Tesla'], correct: 0 },
  { q: 'Which organelle is the "powerhouse of the cell"?', options: ['Ribosome', 'Golgi body', 'Mitochondria', 'Lysosome'], correct: 2 },
  { q: 'The Indian Constitution was adopted on?', options: ['15 Aug 1947', '26 Jan 1950', '26 Nov 1949', '2 Oct 1950'], correct: 2 },
  { q: 'What is the derivative of sin(x)?', options: ['cos(x)', '-cos(x)', 'tan(x)', '-sin(x)'], correct: 0 },
  { q: 'Which gas is released during photosynthesis?', options: ['Carbon dioxide', 'Nitrogen', 'Oxygen', 'Hydrogen'], correct: 2 },
];

const CATEGORIES: Category[] = ['IIT-JEE', 'NEET', 'UPSC'];
const POINTS_PER_RUPEE = 10; // 10 points = ₹1

/* ------------------------------------------------------------------ */
/*  Small shared bits (used by the unchanged Games & Courses sections) */
/* ------------------------------------------------------------------ */

function SectionHeader({
  icon: Icon,
  title,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <Icon className="w-5 h-5 text-[#175A67]" />
        <h2 className="text-lg sm:text-xl font-bold text-[#0B4A4F]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function ScrollRow({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 'left' | 'right') => {
    ref.current?.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' });
  };
  return (
    <div className="relative group/row">
      <div ref={ref} className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth pb-1">
        {children}
      </div>
      <button
        onClick={() => scroll('left')}
        className="hidden lg:flex absolute -left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 border border-white shadow-md items-center justify-center text-[#175A67] opacity-0 group-hover/row:opacity-100 transition-opacity"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        onClick={() => scroll('right')}
        className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 border border-white shadow-md items-center justify-center text-[#175A67] opacity-0 group-hover/row:opacity-100 transition-opacity"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function CourseCard({
  course,
  owned,
  onBuy,
}: {
  course: PiCourse;
  owned: boolean;
  onBuy: (course: PiCourse) => void;
}) {
  return (
    <div className="shrink-0 w-[230px] sm:w-[250px] bg-white/60 hover:bg-white/85 backdrop-blur-md border border-white/80 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.05)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.09)] transition-all duration-300 hover:-translate-y-1">
      <div className={`relative h-28 bg-gradient-to-br ${course.gradient} flex items-center justify-center`}>
        <Play className="w-9 h-9 text-white/90 fill-white/20" />
        {course.isNew && (
          <span className="absolute top-2 left-2 text-[10px] font-bold bg-white/90 text-[#175A67] px-2 py-0.5 rounded-full">NEW</span>
        )}
        <span className="absolute top-2 right-2 text-[10px] font-bold bg-black/30 text-white px-2 py-0.5 rounded-full backdrop-blur-sm">{course.subject}</span>
        {typeof course.progress === 'number' && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/20">
            <div className="h-full bg-[#10B981]" style={{ width: `${course.progress}%` }} />
          </div>
        )}
      </div>
      <div className="p-3.5">
        <h3 className="font-semibold text-[#0F172A] text-sm leading-snug line-clamp-2 min-h-[2.5rem]">{course.title}</h3>
        <p className="text-[11px] text-[#64748B] mt-0.5">{course.instructor}</p>
        <div className="flex items-center gap-1 mt-1.5 text-[11px] text-[#2A707C]">
          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
          <span className="font-semibold text-[#175A67]">{course.rating}</span>
          <span>· {course.lessons} lessons · {course.duration}</span>
        </div>
        <div className="flex items-center justify-between mt-3">
          {owned ? (
            <span className="text-xs font-bold text-[#10B981] flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Enrolled
            </span>
          ) : (
            <span className="text-sm font-bold text-[#175A67] flex items-center">
              <IndianRupee className="w-3.5 h-3.5" />{course.priceINR}
            </span>
          )}
          {!owned && (
            <button
              onClick={() => onBuy(course)}
              className="text-[11px] font-bold bg-[#175A67] hover:bg-[#124853] text-white px-3 py-1.5 rounded-lg transition-all active:scale-95"
            >
              Buy
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Continue Learning card (new design)                                */
/* ------------------------------------------------------------------ */

function ContinueLearningCard({
  course,
  bookmarked,
  onToggleBookmark,
  onResume,
}: {
  course: PiCourse;
  bookmarked: boolean;
  onToggleBookmark: () => void;
  onResume: () => void;
}) {
  const completed = course.progressCompleted ?? 0;
  const total = course.progressTotal ?? course.lessons;
  const pct = course.progress ?? Math.round((completed / Math.max(total, 1)) * 100);
  const cornerLabel = course.lastViewedLabel ?? course.nextLesson;

  return (
    <div className="shrink-0 w-[290px] sm:w-[310px] bg-white rounded-2xl overflow-hidden shadow-[0_6px_24px_rgb(0,0,0,0.06)] hover:shadow-[0_12px_34px_rgb(0,0,0,0.10)] transition-all duration-300 hover:-translate-y-1">
      {/* Thumbnail */}
      <div className={`relative h-36 bg-gradient-to-br ${course.gradient} overflow-hidden flex items-center justify-center`}>
        <div className="absolute inset-0 opacity-25 flex items-center justify-center">
          {course.subject === 'Physics' && <Target className="w-24 h-24 text-white" />}
          {course.subject === 'Mathematics' && <Activity className="w-24 h-24 text-white" />}
          {(course.subject === 'Chemistry' || course.subject === 'Biology') && <Sparkles className="w-24 h-24 text-white" />}
          {course.subject.startsWith('GS') && <Bookmark className="w-24 h-24 text-white" />}
        </div>

        <span className="absolute top-2.5 left-2.5 text-[10px] font-bold bg-[#0F3B42]/90 text-white px-2.5 py-1 rounded-lg">
          {course.subject}
        </span>

        {cornerLabel && (
          <span className="absolute top-2.5 right-2.5 flex items-center gap-1 text-[10px] font-semibold bg-white/90 text-[#175A67] px-2.5 py-1 rounded-full">
            {course.lastViewedLabel ? <Clock className="w-3 h-3" /> : <Play className="w-3 h-3 fill-[#175A67]" />}
            {cornerLabel}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="flex items-center gap-1.5 text-[11px] text-[#2A707C]">
          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
          <span className="font-bold text-[#175A67]">{course.rating}</span>
          <span>· {course.lessons} lessons · {course.duration}</span>
        </div>

        <h3 className="font-semibold text-[#0B1C30] text-[15px] leading-snug mt-1.5 line-clamp-2 min-h-[2.6rem]">
          {course.title}
        </h3>

        <div className="flex items-center gap-1.5 text-xs text-[#2A707C] mt-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
          <span className="truncate text-[#40484B]">{course.instructor} · {course.category === 'IIT-JEE' ? 'Senior Faculty' : 'Faculty'}</span>
        </div>

        <div className="mt-3.5">
          <div className="flex items-center justify-between text-[11px] font-semibold mb-1.5">
            <span className="text-[#10B981] font-bold">{pct}% Completed</span>
            <span className="text-[#2A707C]">{completed}/{total} Lessons</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[#175A67]/10 overflow-hidden">
            <div className="h-full bg-[#10B981] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={onResume}
            className="flex-1 flex items-center justify-center gap-1.5 bg-[#0F3B42] hover:bg-[#0b2c31] text-white font-semibold text-xs py-2.5 rounded-xl transition-all active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            Resume Lecture
          </button>
          <button
            onClick={onToggleBookmark}
            title={bookmarked ? 'Remove bookmark' : 'Bookmark'}
            className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center border transition-all ${
              bookmarked ? 'bg-[#175A67] border-[#175A67] text-white' : 'bg-[#EAF3F1] border-[#EAF3F1] text-[#175A67] hover:bg-[#dcece7]'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${bookmarked ? 'fill-white' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Top 10 row (new design)                                            */
/* ------------------------------------------------------------------ */

function TopTenRow({ entry }: { entry: TopTenEntry }) {
  const isTop = entry.rank === 1;
  return (
    <div className="flex items-center gap-3 sm:gap-4 bg-white rounded-2xl px-3.5 sm:px-4 py-3 sm:py-3.5 shadow-[0_4px_18px_rgb(0,0,0,0.05)]">
      <div
        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-black text-xs sm:text-sm shrink-0 ${
          isTop ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white font-semiBold' : 'bg-[#EAF3F1] text-[#003441]'
        }`}
      >
        #{entry.rank}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-semibold text-[#0B1C30] text-xs sm:text-sm truncate">{entry.title}</h4>
          <span className="text-[10px] font-bold bg-[#EAF3F1] text-[#175A67] px-2 py-0.5 rounded-full shrink-0">{entry.subject}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-[#2A707C] mt-1 flex-wrap">
          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
          <span className="font-semibold text-[#175A67]">{entry.rating}</span>
          <span>({entry.reviews} reviews)</span>
          <span className="hidden sm:inline">·</span>
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" /> {entry.enrolled} enrolled this week
          </span>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-2 shrink-0">
        <span className="flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">
          <ShieldCheck className="w-3 h-3" />
          {entry.highYield}% High-Yield
        </span>
        <button className="text-xs font-bold text-[#003441] hover:underline flex items-center gap-1 whitespace-nowrap">
          Preview Syllabus
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Game panel (unchanged — used by Play & Earn Points)                */
/* ------------------------------------------------------------------ */

function GamePanel({
  game,
  onClose,
  onReward,
}: {
  game: GameDef;
  onClose: () => void;
  onReward: (points: number, message: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#F8FAFC] rounded-3xl shadow-2xl border border-white/80 overflow-hidden">
        <div className={`bg-gradient-to-br ${game.accent} p-5 flex items-center justify-between`}>
          <div className="flex items-center gap-2.5 text-white">
            <game.icon className="w-5 h-5" />
            <h3 className="font-bold text-base">{game.title}</h3>
          </div>
          <button onClick={onClose} className="text-white/90 hover:text-white p-1 rounded-full hover:bg-white/15">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">
          {game.id === 'quiz' && <QuizGame onReward={onReward} onClose={onClose} />}
          {game.id === 'reflex' && <ReflexGame onReward={onReward} onClose={onClose} />}
          {game.id === 'spin' && <SpinGame onReward={onReward} onClose={onClose} />}
        </div>
      </div>
    </div>
  );
}

function QuizGame({ onReward, onClose }: { onReward: (p: number, m: string) => void; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const question = QUIZ_QUESTIONS[step];

  const handleSelect = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    const correct = idx === question.correct;
    const gained = correct ? 25 : 0;
    setScore((s) => s + gained);
    setTimeout(() => {
      if (step + 1 < QUIZ_QUESTIONS.length) {
        setStep((s) => s + 1);
        setSelected(null);
      } else {
        setDone(true);
      }
    }, 700);
  };

  if (done) {
    return (
      <div className="text-center py-4">
        <Trophy className="w-10 h-10 text-amber-400 mx-auto mb-2" />
        <p className="text-[#175A67] font-bold text-lg">You scored {score} points!</p>
        <p className="text-xs text-[#2A707C] mt-1">{score >= 100 ? 'Outstanding run.' : score >= 50 ? 'Solid effort, keep going.' : 'Play again to sharpen up.'}</p>
        <button
          onClick={() => {
            if (score > 0) onReward(score, `Speed Quiz: +${score} pts`);
            onClose();
          }}
          className="mt-4 w-full bg-[#175A67] hover:bg-[#124853] text-white font-bold text-sm py-2.5 rounded-xl transition-all active:scale-95"
        >
          Collect & Close
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between text-xs font-semibold text-[#2A707C] mb-3">
        <span>Question {step + 1} / {QUIZ_QUESTIONS.length}</span>
        <span className="text-[#175A67]">Score: {score}</span>
      </div>
      <p className="text-[#175A67] font-bold text-sm mb-4">{question.q}</p>
      <div className="space-y-2">
        {question.options.map((opt, idx) => {
          const isCorrect = selected !== null && idx === question.correct;
          const isWrong = selected === idx && idx !== question.correct;
          return (
            <button
              key={opt}
              onClick={() => handleSelect(idx)}
              disabled={selected !== null}
              className={`w-full text-left text-sm font-semibold px-4 py-2.5 rounded-xl border transition-all ${
                isCorrect
                  ? 'bg-[#10B981]/15 border-[#10B981] text-[#0f766e]'
                  : isWrong
                  ? 'bg-red-50 border-red-300 text-red-600'
                  : 'bg-white/70 border-white/90 text-[#175A67] hover:bg-white'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReflexGame({ onReward, onClose }: { onReward: (p: number, m: string) => void; onClose: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'waiting' | 'go' | 'result' | 'early'>('idle');
  const [reactionMs, setReactionMs] = useState<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
  }, []);

  const start = () => {
    setPhase('waiting');
    const delay = 1000 + Math.random() * 2000;
    timeoutRef.current = window.setTimeout(() => {
      startRef.current = performance.now();
      setPhase('go');
    }, delay);
  };

  const handleTap = () => {
    if (phase === 'waiting') {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      setPhase('early');
      return;
    }
    if (phase === 'go') {
      const ms = Math.round(performance.now() - startRef.current);
      setReactionMs(ms);
      setPhase('result');
    }
  };

  const points = reactionMs === null ? 0 : reactionMs < 200 ? 100 : reactionMs < 400 ? 60 : reactionMs < 600 ? 30 : 10;

  return (
    <div>
      {phase === 'idle' && (
        <div className="text-center py-4">
          <p className="text-sm text-[#2A707C] mb-4">Wait for the box to turn green, then tap as fast as you can. Tap early and you score nothing.</p>
          <button onClick={start} className="w-full bg-[#175A67] hover:bg-[#124853] text-white font-bold text-sm py-2.5 rounded-xl transition-all active:scale-95">
            Start
          </button>
        </div>
      )}

      {(phase === 'waiting' || phase === 'go') && (
        <button
          onClick={handleTap}
          className={`w-full h-40 rounded-2xl flex items-center justify-center font-bold text-lg transition-colors ${
            phase === 'go' ? 'bg-[#10B981] text-white' : 'bg-[#175A67]/15 text-[#175A67]'
          }`}
        >
          {phase === 'go' ? 'TAP NOW!' : 'Wait for green…'}
        </button>
      )}

      {phase === 'early' && (
        <div className="text-center py-4">
          <p className="text-red-600 font-bold text-sm mb-3">Too soon! That's a false start.</p>
          <button onClick={start} className="w-full bg-[#175A67] hover:bg-[#124853] text-white font-bold text-sm py-2.5 rounded-xl transition-all active:scale-95">
            Try Again
          </button>
        </div>
      )}

      {phase === 'result' && (
        <div className="text-center py-4">
          <p className="text-[#175A67] font-bold text-lg">{reactionMs} ms</p>
          <p className="text-xs text-[#2A707C] mt-1 mb-4">+{points} points</p>
          <button
            onClick={() => {
              if (points > 0) onReward(points, `Reflex Tap: +${points} pts`);
              onClose();
            }}
            className="w-full bg-[#175A67] hover:bg-[#124853] text-white font-bold text-sm py-2.5 rounded-xl transition-all active:scale-95"
          >
            Collect & Close
          </button>
        </div>
      )}
    </div>
  );
}

function SpinGame({ onReward, onClose }: { onReward: (p: number, m: string) => void; onClose: () => void }) {
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const rewards = [10, 20, 30, 50, 75, 100];

  const spin = () => {
    setSpinning(true);
    setTimeout(() => {
      const reward = rewards[Math.floor(Math.random() * rewards.length)];
      setResult(reward);
      setSpinning(false);
    }, 1200);
  };

  return (
    <div className="text-center py-4">
      <div
        className={`w-28 h-28 mx-auto rounded-full border-4 border-[#175A67]/20 flex items-center justify-center bg-gradient-to-br from-emerald-500 to-sky-600 text-white font-bold text-xl mb-5 ${
          spinning ? 'animate-spin' : ''
        }`}
      >
        {result !== null && !spinning ? `+${result}` : <Gift className="w-9 h-9" />}
      </div>
      {result === null ? (
        <button
          onClick={spin}
          disabled={spinning}
          className="w-full bg-[#175A67] hover:bg-[#124853] disabled:opacity-60 text-white font-bold text-sm py-2.5 rounded-xl transition-all active:scale-95"
        >
          {spinning ? 'Spinning…' : 'Spin Now'}
        </button>
      ) : (
        <button
          onClick={() => {
            onReward(result, `Daily Spin: +${result} pts`);
            onClose();
          }}
          className="w-full bg-[#175A67] hover:bg-[#124853] text-white font-bold text-sm py-2.5 rounded-xl transition-all active:scale-95"
        >
          Collect & Close
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Convert points panel (unchanged)                                   */
/* ------------------------------------------------------------------ */

function ConvertPanel({
  points,
  onClose,
  onConvert,
}: {
  points: number;
  onClose: () => void;
  onConvert: (pointsToConvert: number) => void;
}) {
  const maxConvertible = Math.floor(points / POINTS_PER_RUPEE) * POINTS_PER_RUPEE;
  const [value, setValue] = useState(Math.min(100, maxConvertible));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#F8FAFC] rounded-3xl shadow-2xl border border-white/80 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-[#175A67] font-bold">
            <Coins className="w-5 h-5" />
            <span>Convert Points</span>
          </div>
          <button onClick={onClose} className="text-[#2A707C] hover:text-[#175A67] p-1 rounded-full hover:bg-black/5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {maxConvertible < POINTS_PER_RUPEE ? (
          <p className="text-sm text-[#2A707C]">You need at least {POINTS_PER_RUPEE} points to convert. Play a game to earn more.</p>
        ) : (
          <>
            <p className="text-xs text-[#2A707C] mb-3">{POINTS_PER_RUPEE} points = ₹1. You have {points} points available.</p>
            <input
              type="range"
              min={POINTS_PER_RUPEE}
              max={maxConvertible}
              step={POINTS_PER_RUPEE}
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              className="w-full accent-[#175A67]"
            />
            <div className="flex items-center justify-between mt-3 mb-5">
              <span className="text-sm font-semibold text-[#175A67]">{value} points</span>
              <span className="text-sm font-bold text-[#10B981] flex items-center">
                <ArrowRight className="w-3.5 h-3.5 mx-1" /> <IndianRupee className="w-3.5 h-3.5" />{value / POINTS_PER_RUPEE}
              </span>
            </div>
            <button
              onClick={() => {
                onConvert(value);
                onClose();
              }}
              className="w-full bg-[#175A67] hover:bg-[#124853] text-white font-bold text-sm py-2.5 rounded-xl transition-all active:scale-95"
            >
              Convert to Wallet
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main view                                                          */
/* ------------------------------------------------------------------ */

export function PiView({
  onOpenUpgrade,
  onOpenDoubtSolver,
  onBack,
  searchQuery = '',
}: PiViewProps) {
  const [activeCategory, setActiveCategory] = useState<Category>('IIT-JEE');
  const [points, setPoints] = useState(240);
  const [inrBalance, setInrBalance] = useState(0);
  const [ownedCourses, setOwnedCourses] = useState<string[]>([]);
  const [bookmarkedCourses, setBookmarkedCourses] = useState<string[]>([]);
  const [activeGame, setActiveGame] = useState<GameDef | null>(null);
  const [showConvert, setShowConvert] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [insufficientFor, setInsufficientFor] = useState<PiCourse | null>(null);
  const continueScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const categoryCourses = useMemo(
    () =>
      COURSES.filter((c) => c.category === activeCategory).filter(
        (c) =>
          !searchQuery ||
          c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.instructor.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [activeCategory, searchQuery]
  );

  const continueLearning = useMemo(
    () => COURSES.filter((c) => c.category === activeCategory && typeof c.progress === 'number'),
    [activeCategory]
  );

  const topTenFiltered = useMemo(() => TOP_TEN.filter((t) => t.category === activeCategory), [activeCategory]);

  const handleReward = (gained: number, message: string) => {
    setPoints((p) => p + gained);
    setToast(message);
  };

  const handleBuy = (course: PiCourse) => {
    if (ownedCourses.includes(course.id)) return;
    if (inrBalance >= course.priceINR) {
      setInrBalance((b) => b - course.priceINR);
      setOwnedCourses((o) => [...o, course.id]);
      setToast(`Enrolled in "${course.title}"`);
    } else {
      setInsufficientFor(course);
    }
  };

  const toggleBookmark = (id: string) => {
    setBookmarkedCourses((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));
  };

  const scrollContinue = (dir: 'left' | 'right') => {
    continueScrollRef.current?.scrollBy({ left: dir === 'left' ? -330 : 330, behavior: 'smooth' });
  };

  return (
    <div className="bg-[#DCEAE3] rounded-[28px] p-4 sm:p-6 lg:p-8 relative">
      {/* 1. Standardized Back Button + Wallet */}
      <SubPageHeader
        onBack={onBack}
        crumbs={[
          { label: 'Home', onClick: onBack },
          { label: 'Daily Drop' },
        ]}
        rightElement={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white/80 border border-white rounded-full px-3 py-1.5 shadow-sm">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-bold text-[#175A67]">{points} pts</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/80 border border-white rounded-full px-3 py-1.5 shadow-sm">
              <Wallet className="w-3.5 h-3.5 text-[#10B981]" />
              <span className="text-xs font-bold text-[#175A67] flex items-center">
                <IndianRupee className="w-3 h-3" />{inrBalance}
              </span>
            </div>
            <button
              onClick={() => setShowConvert(true)}
              className="text-[11px] font-bold bg-[#175A67] hover:bg-[#124853] text-white px-3.5 py-1.5 rounded-full transition-all active:scale-95 shadow-sm"
            >
              Convert
            </button>
          </div>
        }
      />

      {/* Title + category tabs + Ask Doubt */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#003441]">
            Daily Drop
          </h1>
        </div>

        {/* <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center bg-white/70 border border-white  rounded-[12px] p-1 shadow-sm">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all ${
                  activeCategory === cat ? 'bg-[#0F3B42] text-white shadow-md' : 'text-[#175A67] hover:bg-white/70'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <button
            onClick={onOpenDoubtSolver}
            className="flex items-center gap-1.5 bg-white hover:bg-white/90 border border-white rounded-full pl-4 pr-2 py-2 text-xs sm:text-sm font-bold text-[#175A67] shadow-sm transition-all active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#175A67]" />
            Ask Doubt
            <span className="text-[9px] font-black bg-[#0F3B42] text-white px-2 py-1 rounded-full">AI</span>
          </button>
        </div> */}
      </div>

      {/* Daily Streak banner */}
      <section className="mb-8">
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-[0_6px_24px_rgb(0,0,0,0.05)] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center shrink-0">
              <Flame className="w-6 h-6 text-orange-500 fill-orange-400" />
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 ring-2 ring-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-[#0B1C30] text-sm sm:text-base">Daily Streak: 5 Days</h3>
                {/* <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full ">2x Multiplier Active</span> */}
              </div>
              <p className="text-xs text-[#2A707C] mt-1">Solve 2 more questions before 11:59 PM to safeguard your streak</p>
            </div>
          </div>

          {/* <div className="flex flex-wrap items-center gap-2">
            {STREAK_ACTIONS.map((action) => (
              <button
                key={action.gameId}
                onClick={() => setActiveGame(GAMES.find((g) => g.id === action.gameId) ?? null)}
                className="flex items-center gap-1.5 bg-[#EAF3F1] hover:bg-[#dcece7] text-[#175A67] text-xs font-bold px-3.5 py-2 rounded-full transition-all active:scale-95"
              >
                <action.icon className="w-3.5 h-3.5" />
                {action.label}
                {action.xp && <span className="text-[#10B981]">{action.xp}</span>}
                {!action.xp && <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />}
              </button>
            ))}
          </div> */}
        </div>
      </section>

      {/* Continue Learning */}
      {continueLearning.length > 0 && (
        <section className="mb-9">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-[#003441]">Continue Learning</h2>
              <p className="text-xs text-[#40484B] mt-1">Pick up right where you left off · Synchronized with your revision plan</p>
            </div>
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <button
                onClick={() => scrollContinue('left')}
                className="w-9 h-9 rounded-[12px] !bg-white shadow-sm flex items-center justify-center text-[#175A67] transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => scrollContinue('right')}
                className="w-9 h-9 rounded-[12px] !bg-white shadow-sm flex items-center justify-center text-[#175A67] transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div ref={continueScrollRef} className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth pb-1">
            {continueLearning.map((course) => (
              <ContinueLearningCard
                key={course.id}
                course={course}
                bookmarked={bookmarkedCourses.includes(course.id)}
                onToggleBookmark={() => toggleBookmark(course.id)}
                onResume={() => setToast(`Resuming: ${course.nextLesson ?? course.title}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Top 10 This Week */}
      <section className="mb-9">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg sm:text-xl font-bold text-[#003441]">Top 10 This Week</h2>
            <span className="flex items-center gap-1 text-[10px] font-bold bg-sky-100 text-sky-700 px-2.5 py-1 rounded-full">
              <TrendingUp className="w-3 h-3" />
              Trending among top 1% aspirants
            </span>
          </div>
          <button className="text-xs font-bold text-[#175A67] hover:underline flex items-center gap-1">
            View All Leaderboards
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-2.5">
          {topTenFiltered.map((entry) => (
            <TopTenRow key={`${entry.category}-${entry.rank}`} entry={entry} />
          ))}
        </div>

      </section>

      {/* Games — UNCHANGED */}
      <section className="mb-9">
        <SectionHeader icon={Flame} title="Play & Earn Points" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {GAMES.map((game) => (
            <div
              key={game.id}
              onClick={() => setActiveGame(game)}
              className="group cursor-pointer bg-white/50 hover:bg-white/70 backdrop-blur-xl border border-white/70 hover:border-white rounded-2xl p-5 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] hover:shadow-[0_14px_44px_0_rgba(31,38,135,0.12)] transition-all duration-300 ease-out hover:-translate-y-1 active:scale-[0.98]"
            >
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${game.accent} text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform`}>
                <game.icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-[#1E293B] text-sm mt-3">{game.title}</h3>
              <p className="text-[#64748B] text-xs mt-1">{game.tagline}</p>
              <p className="text-[11px] font-bold text-[#10B981] mt-2">{game.reward}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Category courses — UNCHANGED */}
      <section className="pb-2">
        <SectionHeader icon={Play} title={`${activeCategory} Courses`} />
        {categoryCourses.length === 0 ? (
          <p className="text-sm text-[#2A707C]">No content matches "{searchQuery}" in {activeCategory}.</p>
        ) : (
          <ScrollRow>
            {categoryCourses.map((c) => (
              <CourseCard key={c.id} course={c} owned={ownedCourses.includes(c.id)} onBuy={handleBuy} />
            ))}
          </ScrollRow>
        )}
      </section>

      {/* Game overlay */}
      {activeGame && <GamePanel game={activeGame} onClose={() => setActiveGame(null)} onReward={handleReward} />}

      {/* Convert overlay */}
      {showConvert && (
        <ConvertPanel
          points={points}
          onClose={() => setShowConvert(false)}
          onConvert={(p) => {
            setPoints((prev) => prev - p);
            setInrBalance((prev) => prev + p / POINTS_PER_RUPEE);
            setToast(`Converted ${p} pts to ₹${p / POINTS_PER_RUPEE}`);
          }}
        />
      )}

      {/* Insufficient balance prompt */}
      {insufficientFor && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setInsufficientFor(null)} />
          <div className="relative w-full max-w-sm bg-[#F8FAFC] rounded-3xl shadow-2xl border border-white/80 p-5 text-center">
            <Lock className="w-8 h-8 text-[#175A67] mx-auto mb-2" />
            <p className="font-bold text-[#175A67]">Not enough balance</p>
            <p className="text-xs text-[#2A707C] mt-1 mb-4">
              "{insufficientFor.title}" costs ₹{insufficientFor.priceINR}. Play a game or convert points to top up.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setInsufficientFor(null);
                  setShowConvert(true);
                }}
                className="flex-1 bg-white/80 border border-[#175A67]/20 text-[#175A67] font-bold text-xs py-2.5 rounded-xl transition-all active:scale-95"
              >
                Convert Points
              </button>
              <button
                onClick={() => {
                  setInsufficientFor(null);
                  onOpenUpgrade();
                }}
                className="flex-1 bg-[#175A67] hover:bg-[#124853] text-white font-bold text-xs py-2.5 rounded-xl transition-all active:scale-95"
              >
                Go Pro Instead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-[#175A67] text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
          {toast}
        </div>
      )}
    </div>
  );
}

export default PiView;
