import React, { useState } from 'react';
import {
  ClipboardList,
  CheckCircle2,
  Calendar,
  Clock,
  Award,
  FileCheck2,
  Trophy,
} from 'lucide-react';
import { SubPageHeader } from './SubPageHeader';

interface RankerItem {
  rank: number;
  name: string;
  points: string;
  streak: string;
  college: string;
  isYou?: boolean;
}

interface CourseTestSeriesViewProps {
  onBack: () => void;
  selectedBatch?: string;
  studentName?: string;
}

export function CourseTestSeriesView({
  onBack,
  selectedBatch = '12th - IIT JEE',
}: CourseTestSeriesViewProps) {
  const [toast] = useState<string | null>(null);
  const [rankers] = useState<RankerItem[]>([]);

  return (
    <div className="bg-[#DCEAE3] rounded-[28px] p-4 sm:p-6 lg:p-8 relative space-y-6 min-h-[calc(100vh-6rem)] animate-fadeIn">
      {/* 1. Standardized Back Button + Breadcrumb */}
      <SubPageHeader
        onBack={onBack}
        crumbs={[
          { label: 'Home', onClick: onBack },
          { label: 'Library', onClick: onBack },
          { label: 'Course Test Series' },
        ]}
      />

      {/* Streamlined Header (Matching Your Class Material interface) */}
      <div className="bg-white/80 backdrop-blur-md border border-white/80 rounded-2xl p-5 sm:p-6 shadow-[0_6px_24px_rgb(0,0,0,0.05)] flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#0F3B42] text-white flex items-center justify-center shadow-md shrink-0">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-[#0B1C30]">Course Test Series</h1>
              <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-[#EAF3F1] text-[#175A67] border border-[#175A67]/20 text-[10px] font-bold">
                {selectedBatch}
              </span>
            </div>
            <p className="text-xs text-[#2A707C] mt-0.5 font-medium">
              Saturday &amp; Sunday Batch Tests and Periodic Course Assessments
            </p>
          </div>
        </div>
      </div>

      {/* White surface container kept intact for CMS content (compact test tiles) */}
      <section className="bg-white/70 backdrop-blur-md border border-white/80 p-6 sm:p-10 rounded-[24px] shadow-[0_6px_24px_rgb(0,0,0,0.04)] min-h-[300px] flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#EAF3F1] text-[#175A67] flex items-center justify-center mb-4 shadow-sm">
          <FileCheck2 className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-[#0B1C30]">No Course Tests Scheduled Yet</h3>
        <p className="text-xs sm:text-sm text-[#2A707C] max-w-md mt-1.5 leading-relaxed font-medium">
          Weekly Saturday &amp; Sunday batch tests, chapter quizzes, and periodic tests published from the Admin CMS will appear here in compact test cards.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 mt-6 text-xs text-slate-600 bg-white/80 border border-slate-200/60 rounded-xl px-5 py-3">
          <span className="flex items-center gap-1.5 font-medium">
            <Calendar className="w-4 h-4 text-[#175A67]" />
            Saturday &amp; Sunday Live Tests
          </span>
          <span className="w-1 h-1 rounded-full bg-slate-300 hidden sm:block" />
          <span className="flex items-center gap-1.5 font-medium">
            <Clock className="w-4 h-4 text-[#175A67]" />
            Timed CBT Interface
          </span>
          <span className="w-1 h-1 rounded-full bg-slate-300 hidden sm:block" />
          <span className="flex items-center gap-1.5 font-medium">
            <Award className="w-4 h-4 text-[#175A67]" />
            Batch Rank &amp; Solutions
          </span>
        </div>
      </section>

      {/* 2. Batch Leaderboard Section (Visible only when real CMS data is available) */}
      {rankers.length > 0 && (
        <div className="rounded-2xl bg-white/70 backdrop-blur-md border border-white/80 p-5 sm:p-6 shadow-[0_6px_24px_rgb(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-[#175A67] text-base">Batch Leaderboard</h3>
            </div>
            
            <span className="text-xs text-[#2A707C] font-semibold bg-[#EAF3F1] px-2.5 py-1 rounded-full border border-[#175A67]/15">
              Weekly Cycle
            </span>
          </div>

          <div className="space-y-2.5">
            {rankers.map((ranker) => (
              <div
                key={ranker.rank}
                className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                  ranker.isYou
                    ? 'bg-[#175A67]/15 border-[#175A67]/35 shadow-sm'
                    : 'bg-white/80 border-slate-200/60 hover:bg-white/95 backdrop-blur-sm'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                      ranker.rank === 1
                        ? 'bg-amber-400 text-slate-900 shadow-sm'
                        : ranker.rank === 2
                        ? 'bg-slate-300 text-slate-800'
                        : ranker.rank === 3
                        ? 'bg-amber-700 text-white'
                        : 'bg-[#175A67] text-white'
                    }`}
                  >
                    #{ranker.rank}
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-[#175A67] flex items-center gap-1.5">
                      <span>{ranker.name}</span>
                      {ranker.isYou && (
                        <span className="px-1.5 py-0.2 bg-[#10B981] text-white text-[9px] font-bold rounded">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#2A707C]">{ranker.college}</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs sm:text-sm font-bold text-[#175A67]">{ranker.points}</div>
                  <div className="text-[10px] text-[#10B981] font-semibold">{ranker.streak} streak 🔥</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-[#175A67] text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2 animate-fadeIn max-w-[90vw]">
          <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
          <span className="truncate">{toast}</span>
        </div>
      )}
    </div>
  );
}

export default CourseTestSeriesView;
