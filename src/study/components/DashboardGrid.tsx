import React, { useState } from 'react';
import { 
  Target, 
  BookOpen, 
  FileText, 
  Database, 
  Swords, 
  ChevronRight, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  HelpCircle, 
  Flame, 
  ArrowUpRight, 
  BarChart3, 
  Zap, 
  Play, 
  ShieldCheck, 
  FolderArchive,
  GraduationCap
} from 'lucide-react';
import { UserProfile, VaultResource } from '../types';
import confetti from 'canvas-confetti';

interface DashboardGridProps {
  user: UserProfile;
  selectedBatch: string;
  onOpenVaultItem: (item: VaultResource) => void;
  onOpenDoubtSolver: () => void;
  onOpenUpgrade: () => void;
  searchFilter: string;
}

const VAULT_RESOURCES: VaultResource[] = [
  {
    id: 'vault-physics',
    title: 'Physics Intel',
    subject: 'Physics',
    second_text: 'Watch Later',
    countLabel: 'Saved Items',
    tags: ['Rotational Motion', 'Wave Optics', 'Electrodynamics'],
    iconType: 'book',
    description: 'Comprehensive high-yield notes, derivation sheets, and Irodov problem breakdowns curated by IIT Top 100 rankers.',
    downloadSize: '48.2 MB',
    rating: 4.9,
  },
  {
    id: 'vault-chemistry',
    title: 'Chemistry Intel',
    second_text: 'Watch Later',
    subject: 'Chemistry',
    countLabel: '3 Books',
    tags: ['Reaction Maps', 'Coordination Chem', 'Thermodynamics'],
    iconType: 'archive',
    description: 'Master organic synthesis pathways, NCERT line-by-line highlight maps, and inorganic memorization mnemonics.',
    downloadSize: '64.5 MB',
    rating: 4.8,
  },
  {
    id: 'vault-combat',
    title: 'Mock Tests',
    second_text: 'Watch Later',
    subject: 'Mock Tests',
    countLabel: 'All-India Predictor',
    tags: ['Full Syllabus', 'Real NTA Engine', 'AIR Predictor'],
    iconType: 'combat',
    isLive: true,
    statusText: 'LIVE NOW',
    description: 'Live 3-hour adaptive mock test mirroring actual JEE Advanced CBT interface with instant percentile and weak area diagnosis.',
    downloadSize: 'Online CBT',
    rating: 5.0,
  },
  {
    id: 'vault-math',
    title: 'Math Analytics',
    second_text: 'Watch Later',
    subject: 'Mathematics',
    countLabel: 'Starts in 2 hrs',
    tags: ['Coordinate Geometry', 'Calculus Drill', 'Vectors & 3D'],
    iconType: 'analytics',
    description: 'Step-by-step calculus mastery modules, graphical shortcuts, and high-difficulty algebra problem sets.',
    downloadSize: '32.1 MB',
    rating: 4.9,
  },
];

export const DashboardGrid: React.FC<DashboardGridProps> = ({
  user,
  selectedBatch,
  onOpenVaultItem,
  onOpenDoubtSolver,
  onOpenUpgrade,
  searchFilter,
}) => {
  // Live quiz state
  const [selectedQuizOption, setSelectedQuizOption] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const handleQuizAnswer = (index: number) => {
    if (quizSubmitted) return;
    setSelectedQuizOption(index);
    setQuizSubmitted(true);
    if (index === 2) {
      // Correct answer trigger celebratory confetti
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.8 },
        colors: ['#10B981', '#F59E0B', '#34D399', '#FBBF24']
      });
    }
  };

  const filteredVaultResources = VAULT_RESOURCES.filter(res => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return (
      res.title.toLowerCase().includes(q) ||
      res.subject.toLowerCase().includes(q) ||
      res.tags.some(t => t.toLowerCase().includes(q)) ||
      res.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8 pb-24">

      {/* TOP MOTIVATIONAL HERO SECTION */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#061e16]/90 via-[#0a2f23]/80 to-[#04140f]/90 border border-emerald-500/30 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-amber-500/10 rounded-full blur-[90px] pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Target Exam: {selectedBatch}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-bold">
                <Flame className="w-3.5 h-3.5 fill-amber-400" />
                Rank Booster Mode
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Push Your Limits, <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 bg-clip-text text-transparent">{user.name}</span>.
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Your IIT-JEE sprint is <span className="text-emerald-400 font-semibold">78% on track</span> today. Complete your Thermodynamics problem drill and 1 CBT mock test to secure the weekly All-India Top 50 bracket.
            </p>

            {/* Quick Action Chips */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button 
                onClick={onOpenDoubtSolver}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all shadow-sm active:scale-95"
              >
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                Ask PI Doubt Solver
              </button>
              <button 
                onClick={() => onOpenVaultItem(VAULT_RESOURCES[2])}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all shadow-sm active:scale-95"
              >
                <Swords className="w-3.5 h-3.5 text-amber-400" />
                Launch Live Mock Test
              </button>
            </div>
          </div>

          {/* Exam Countdown & Sprint Widget */}
          <div className="flex-shrink-0 bg-[#04130d]/80 rounded-2xl p-5 border border-emerald-500/30 shadow-inner flex flex-col gap-3 min-w-[280px]">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold border-b border-emerald-500/20 pb-2">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Clock className="w-3.5 h-3.5" />
                JEE Advanced 2027 Countdown
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-900/80 rounded-xl p-2.5 border border-emerald-500/20">
                <div className="text-2xl font-black text-amber-300 font-mono">74</div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Days</div>
              </div>
              <div className="bg-slate-900/80 rounded-xl p-2.5 border border-emerald-500/20">
                <div className="text-2xl font-black text-emerald-300 font-mono">14</div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Hours</div>
              </div>
              <div className="bg-slate-900/80 rounded-xl p-2.5 border border-emerald-500/20">
                <div className="text-2xl font-black text-teal-300 font-mono">22</div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Mins</div>
              </div>
            </div>

            <div className="text-[11px] text-slate-300 flex items-center justify-between pt-1">
              <span className="text-slate-400">National Percentile Target:</span>
              <span className="text-emerald-400 font-bold font-mono">99.85% +</span>
            </div>
          </div>
        </div>
      </section>


      {/* 1. ACTIVE MISSIONS / STUDY PLANS ROW */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                Active Missions <span className="text-slate-400 font-normal text-base">/ Study Plans</span>
              </h2>
            </div>
          </div>

          <span className="text-xs text-emerald-400 font-semibold bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-500/30">
            3 Active Tracks
          </span>
        </div>

        {/* 3 Large Horizontal Glass Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          
          {/* Card 1: My Plans / My Missions */}
          <div className="group relative overflow-hidden rounded-2xl bg-[#0a1f18]/80 hover:bg-[#0d2a21]/90 border border-emerald-500/25 hover:border-emerald-400/50 p-5 backdrop-blur-xl shadow-glass transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/20 transition-all" />

            <div>
              <div className="flex items-center justify-between mb-3">
                {/* Yellow-Gold / Green Icon Box */}
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400/20 to-emerald-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-md group-hover:scale-105 transition-transform">
                  <GraduationCap className="w-6 h-6 text-amber-400" />
                </div>
                <span className="px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[11px] font-bold">
                  2 Active Enrollments
                </span>
              </div>

              <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                My Plans
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                Electrodynamics & Calculus Advanced Rank Sprint
              </p>

              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Syllabus Completed</span>
                  <span className="text-emerald-400 font-bold">68%</span>
                </div>
                <div className="w-full bg-slate-900/80 rounded-full h-2 overflow-hidden border border-emerald-500/20">
                  <div className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full rounded-full w-[68%]" />
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-emerald-500/15 flex items-center justify-between text-xs font-semibold text-emerald-400 group-hover:text-amber-300">
              <span>View Batch Roadmap</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 2: Recent Activity / Recent Intel */}
          <div className="group relative overflow-hidden rounded-2xl bg-[#0a1f18]/80 hover:bg-[#0d2a21]/90 border border-emerald-500/25 hover:border-emerald-400/50 p-5 backdrop-blur-xl shadow-glass transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/20 transition-all" />

            <div>
              <div className="flex items-center justify-between mb-3">
                {/* Accent Icon Box */}
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-600/20 border border-teal-400/40 flex items-center justify-center text-teal-300 shadow-md group-hover:scale-105 transition-transform">
                  <Play className="w-6 h-6 text-teal-400 fill-teal-400/20" />
                </div>
                <span className="px-2.5 py-1 rounded-full bg-teal-400/15 border border-teal-400/30 text-teal-300 text-[11px] font-bold">
                  Last Watched: 42m ago
                </span>
              </div>

              <h3 className="text-lg font-bold text-white group-hover:text-teal-300 transition-colors">
                Recent Activity
              </h3>
              <p className="text-xs text-emerald-300 font-semibold mt-1">
                Physics - Thermodynamics
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Lecture 07: Carnot Engines & Entropy Calculations • Score: 92% in Post-Class Quiz
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-emerald-500/15 flex items-center justify-between text-xs font-semibold text-emerald-400 group-hover:text-teal-300">
              <span>Resume Lecture (24:18)</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 3: Solved Doubts / Resolved Doubts */}
          <div 
            onClick={onOpenDoubtSolver}
            className="group relative overflow-hidden rounded-2xl bg-[#0a1f18]/80 hover:bg-[#0d2a21]/90 border border-emerald-500/25 hover:border-emerald-400/50 p-5 backdrop-blur-xl shadow-glass transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col justify-between"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/30 transition-all" />

            <div>
              <div className="flex items-center justify-between mb-3">
                {/* Emerald Green Icon Box */}
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-md group-hover:scale-105 transition-transform">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
                  1 Resolved, 2 Pending
                </span>
              </div>

              <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
                Solved Doubts
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                Latest: Optical Interference Path Difference in Thin Films
              </p>
              <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/20">
                <Sparkles className="w-3 h-3" />
                <span>PI AI Mentor resolved with step-by-step diagram</span>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-emerald-500/15 flex items-center justify-between text-xs font-semibold text-emerald-400 group-hover:text-emerald-300">
              <span className="flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5" />
                Open Doubt Workbench
              </span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

        </div>
      </section>


      {/* 2. THE VAULT ROW */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                The Vault <span className="text-slate-400 font-normal text-base">/ Master Resource Bank</span>
              </h2>
            </div>
          </div>

        </div>

        {/* Grid of 4 Modular Cards with Glassmorphism + Hover Scale */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {filteredVaultResources.map((resource) => {
            const isCombat = resource.isLive;

            return (
              <div
                key={resource.id}
                onClick={() => onOpenVaultItem(resource)}
                className={`group relative overflow-hidden rounded-2xl bg-[#0a1f18]/80 hover:bg-[#0f2e24]/90 border p-5 backdrop-blur-xl shadow-glass transition-all duration-300 hover:-translate-y-1.5 hover:shadow-glass-emerald cursor-pointer flex flex-col justify-between ${
                  isCombat 
                    ? 'border-amber-400/40 hover:border-amber-400 shadow-glass-gold' 
                    : 'border-emerald-500/25 hover:border-emerald-400/60'
                }`}
              >
                {/* Ambient glow */}
                <div className={`absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl pointer-events-none transition-all ${
                  isCombat ? 'bg-amber-500/20 group-hover:bg-amber-500/30' : 'bg-emerald-500/15 group-hover:bg-emerald-500/25'
                }`} />

                <div>
                  {/* Top Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shadow-md group-hover:scale-110 transition-transform ${
                      resource.iconType === 'book' ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300' :
                      resource.iconType === 'archive' ? 'bg-teal-500/20 border-teal-400/40 text-teal-300' :
                      resource.iconType === 'combat' ? 'bg-amber-500/20 border-amber-400/40 text-amber-300' :
                      'bg-cyan-500/20 border-cyan-400/40 text-cyan-300'
                    }`}>
                      {resource.iconType === 'book' && <BookOpen className="w-5 h-5" />}
                      {resource.iconType === 'archive' && <FolderArchive className="w-5 h-5" />}
                      {resource.iconType === 'combat' && <Swords className="w-5 h-5" />}
                      {resource.iconType === 'analytics' && <Target className="w-5 h-5" />}
                    </div>

                    {resource.isLive ? (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-950/80 border border-red-500/40 text-red-300 text-[11px] font-black tracking-wide animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                        {resource.statusText}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-slate-900/80 border border-emerald-500/20 text-slate-300 text-[11px] font-semibold">
                        {resource.countLabel}
                      </span>
                    )}
                  </div>

                  {/* Title & Subject */}
                  <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
                    {resource.title}
                  </h3>

                  <p className="text-xs text-slate-300 line-clamp-2 mt-1.5 leading-relaxed">
                    {resource.description}
                  </p>

                  {/* Topic Chips */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {resource.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-500/20 text-emerald-300 text-[10px] font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bottom CTA */}
                <div className="mt-5 pt-3 border-t border-emerald-500/15 flex items-center justify-between text-xs font-bold text-emerald-400 group-hover:text-emerald-200">
                  <span className="flex items-center gap-1">
                    Enter Vault &gt;
                  </span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </section>


      {/* 3. LIVE COMBAT ARENA & SPEED QUIZ DUEL */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Speed Quiz Daily JEE Challenge */}
        <div className="lg:col-span-2 rounded-3xl bg-gradient-to-br from-[#071f17]/90 to-[#04120e]/95 border border-emerald-500/30 p-6 backdrop-blur-xl shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Daily JEE Advanced Speed Duel</h3>
                <p className="text-xs text-slate-400">Physics • Rotational Dynamics (Moment of Inertia)</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-amber-400/20 border border-amber-400/30 text-amber-300 text-xs font-bold font-mono">
              +50 XP
            </span>
          </div>

          <div className="text-sm font-medium text-slate-200 leading-relaxed bg-[#030e0a]/80 p-4 rounded-xl border border-emerald-500/20">
            A uniform thin rod of length L and mass M is pivoted at one end. A small bead of mass m = M/3 is placed at distance L/2 from the pivot. What is the system's total Moment of Inertia about the pivot?
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {[
              { id: 0, text: 'A) (5/12) M L²' },
              { id: 1, text: 'B) (1/3) M L²' },
              { id: 2, text: 'C) (5/12) M L² (Exact: 1/3 + 1/12 = 5/12 M L²)' },
              { id: 3, text: 'D) (7/12) M L²' },
            ].map((opt) => {
              const isSelected = selectedQuizOption === opt.id;
              const isCorrect = opt.id === 2;

              let btnStyle = 'bg-[#081f18]/80 hover:bg-[#0d2a21] border-emerald-500/20 text-slate-200';
              if (quizSubmitted) {
                if (isCorrect) {
                  btnStyle = 'bg-emerald-500/30 border-emerald-400 text-emerald-200 font-bold shadow-neon-emerald';
                } else if (isSelected && !isCorrect) {
                  btnStyle = 'bg-red-500/30 border-red-400 text-red-200 font-bold';
                }
              }

              return (
                <button
                  key={opt.id}
                  onClick={() => handleQuizAnswer(opt.id)}
                  disabled={quizSubmitted}
                  className={`p-3 rounded-xl border text-left text-xs transition-all flex items-center justify-between ${btnStyle}`}
                >
                  <span>{opt.text}</span>
                  {quizSubmitted && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </button>
              );
            })}
          </div>

          {quizSubmitted && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-xs text-emerald-300 animate-fadeIn flex items-center justify-between">
              <div>
                <span className="font-bold">Explanation:</span> I = I_rod + I_bead = (1/3)ML² + m(L/2)² = (1/3)ML² + (M/3)(L²/4) = (5/12)ML².
              </div>
              <span className="font-bold text-amber-300 font-mono">+50 XP Awarded!</span>
            </div>
          )}
        </div>

        {/* Subject Mastery Diagnostic Matrix */}
        <div className="rounded-3xl bg-[#061812]/90 border border-emerald-500/30 p-6 backdrop-blur-xl shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-teal-500/20 text-teal-400">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">Subject Mastery</h3>
              </div>
              <span className="text-xs text-slate-400">AI Diagnostic</span>
            </div>

            <div className="space-y-4">
              {/* Physics */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-200">Physics (Thermodynamics & Optics)</span>
                  <span className="text-emerald-400 font-bold">84%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2">
                  <div className="bg-emerald-400 h-2 rounded-full w-[84%]" />
                </div>
              </div>

              {/* Mathematics */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-200">Mathematics (Calculus & 3D Vectors)</span>
                  <span className="text-amber-300 font-bold">91%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2">
                  <div className="bg-amber-400 h-2 rounded-full w-[91%]" />
                </div>
              </div>

              {/* Chemistry */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-200">Chemistry (Organic Reaction Maps)</span>
                  <span className="text-teal-400 font-bold">72%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2">
                  <div className="bg-teal-400 h-2 rounded-full w-[72%]" />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-emerald-500/20">
            <button
              onClick={onOpenUpgrade}
              className="w-full py-2 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Unlock AI Weak-Area Auto Doctor</span>
            </button>
          </div>
        </div>

      </section>

    </div>
  );
};
