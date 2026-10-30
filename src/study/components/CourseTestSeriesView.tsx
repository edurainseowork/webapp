import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ClipboardList,
  CheckCircle2,
  Calendar,
  Clock,
  Award,
  FileCheck2,
  Trophy,
  Play,
  RotateCw,
  Search,
  Filter,
  Check,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { SubPageHeader } from './SubPageHeader';
import { apiFetch, ApiError } from '../lib/api';
import { useCourses } from '../lib/courses';
import { TestSolverModal, type TestItem } from './TestSolverModal';

interface CourseTestSeriesViewProps {
  onBack: () => void;
  selectedBatch?: string;
  searchQuery?: string;
  onOpenUpgrade?: () => void;
  studentName?: string;
}

export function CourseTestSeriesView({
  onBack,
  selectedBatch = '12th - IIT JEE',
  searchQuery = '',
  onOpenUpgrade,
  studentName,
}: CourseTestSeriesViewProps) {
  const [toast, setToast] = useState<string | null>(null);
  const [tests, setTests] = useState<TestItem[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active test being solved
  const [activeTest, setActiveTest] = useState<TestItem | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Only the courses this student is enrolled in (never the whole catalogue)
  const { courses: catalog, ownedIds } = useCourses();
  const courses = useMemo(() => catalog.filter((c) => ownedIds.includes(c.id)), [catalog, ownedIds]);

  // 2. Fetch live tests
  const fetchTests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = selectedCourseId !== 'all' ? `/tests?courseId=${selectedCourseId}` : '/tests';
      const res = await apiFetch<{ success: boolean; data: TestItem[] }>(url);
      setTests(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      console.error('Failed to fetch tests:', err);
      setError(err?.message || 'Could not load tests from server.');
      setTests([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCourseId]);

  useEffect(() => {
    fetchTests();
  }, [fetchTests]);

  // Filter tests by search query
  const filteredTests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    // The server only sends the student's own courses; this keeps the list right even for staff accounts
    return tests.filter((t) => {
      if (!ownedIds.includes(t.courseId)) return false;
      const matchSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.courseName.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q));
      return matchSearch;
    });
  }, [tests, searchQuery, ownedIds]);

  // Batch Leaderboard sample data: switched off for now (remove the comment markers to bring it back)
  /*
  const rankers = [
    { rank: 1, name: 'Siddharth M.', points: '4,920 XP', streak: '28 Days', college: 'IIT Bombay Target' },
    { rank: 2, name: 'Ananya Verma', points: '4,650 XP', streak: '24 Days', college: 'IIT Delhi Target' },
    { rank: 3, name: 'Rohan Gupta', points: '4,310 XP', streak: '19 Days', college: 'IIT Madras Target' },
    {
      rank: 42,
      name: studentName ? `${studentName} (You)` : 'Gauransh (You)',
      points: '2,840 XP',
      streak: '14 Days',
      college: 'IIT Kharagpur Target',
      isYou: true,
    },
  ];
  */

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
        rightElement={
          <div className="flex items-center gap-2 flex-wrap">
            {courses.length > 1 && (
              <select
                aria-label="Filter by course"
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="bg-white/90 border border-[#175A67]/20 text-[#0F3B42] text-xs font-bold rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#175A67]"
              >
                <option value="all">All my courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={fetchTests}
              title="Refresh tests"
              className="p-2 rounded-xl bg-white/80 hover:bg-white text-[#175A67] border border-[#175A67]/20 shadow-sm transition-all active:rotate-180"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        }
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
              Live Mock Tests, Chapter Quizzes &amp; Periodic Course Assessments
            </p>
          </div>
        </div>
      </div>

      {/* Tests Section */}
      {loading ? (
        <section className="bg-white/70 backdrop-blur-md border border-white/80 p-12 rounded-[24px] shadow-[0_6px_24px_rgb(0,0,0,0.04)] min-h-[260px] flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-10 h-10 border-4 border-[#0F3B42] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs sm:text-sm font-semibold text-[#175A67]">
            Loading your tests...
          </p>
        </section>
      ) : error ? (
        <section className="bg-white/70 backdrop-blur-md border border-white/80 p-8 rounded-[24px] shadow-[0_6px_24px_rgb(0,0,0,0.04)] min-h-[220px] flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Failed to load tests</h3>
          <p className="text-xs text-slate-500 max-w-md">{error}</p>
          <button
            onClick={fetchTests}
            className="px-4 py-2 rounded-xl bg-[#0F3B42] text-white font-bold text-xs shadow hover:bg-[#0b2c31]"
          >
            Retry
          </button>
        </section>
      ) : filteredTests.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredTests.map((test) => {
            const isLive = test.status === 'PUBLISHED';
            const isScheduled = test.status === 'SCHEDULED';
            const isCompleted = test.status === 'COMPLETED' || test.myAttempt?.status === 'SUBMITTED';
            const inProgress = test.myAttempt?.status === 'IN_PROGRESS';

            return (
              <div
                key={test.id}
                className="bg-white/90 backdrop-blur-sm border border-white/90 hover:border-[#175A67]/30 rounded-2xl p-5 shadow-[0_6px_20px_rgb(0,0,0,0.04)] hover:shadow-lg transition-all flex flex-col justify-between space-y-4 group"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#EAF3F1] text-[#175A67] border border-[#175A67]/15 text-[10px] font-bold truncate max-w-[150px]">
                      {test.courseName}
                    </span>

                    {test.myAttempt?.status === 'SUBMITTED' ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-black uppercase flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Submitted
                      </span>
                    ) : inProgress ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-black uppercase flex items-center gap-1 animate-pulse">
                        <Clock className="w-3 h-3" />
                        In Progress
                      </span>
                    ) : isLive ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase shadow-sm">
                        ● Live
                      </span>
                    ) : isScheduled ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200 text-[10px] font-bold">
                        Scheduled
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                        {test.status}
                      </span>
                    )}
                  </div>

                  {/* Test Title & Description */}
                  <h3 className="text-base font-bold text-[#0B1C30] group-hover:text-[#175A67] transition-colors leading-snug">
                    {test.title}
                  </h3>
                  {test.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {test.description}
                    </p>
                  )}

                  {/* Metadata Chips */}
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 text-center">
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-medium">Duration</span>
                      <strong className="text-xs text-slate-800">{test.durationMinutes}m</strong>
                    </div>

                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-medium">Questions</span>
                      <strong className="text-xs text-slate-800">{test.totalQuestions} Qs</strong>
                    </div>

                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-medium">Marks</span>
                      <strong className="text-xs text-slate-800">+{test.marksPositive}/-{test.marksNegative}</strong>
                    </div>
                  </div>
                </div>

                {/* Card Action Button */}
                <div className="pt-2">
                  {test.myAttempt?.status === 'SUBMITTED' ? (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-emerald-700 font-semibold uppercase block">
                          Your Result
                        </span>
                        <strong className="text-sm font-black text-emerald-950">
                          {test.myAttempt.score ?? 0} pts
                        </strong>
                        <span className="text-[10px] text-emerald-700 ml-1.5 font-medium">
                          ({test.myAttempt.correct_count ?? 0}/{test.totalQuestions} correct)
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        Done
                      </span>
                    </div>
                  ) : inProgress ? (
                    <button
                      type="button"
                      onClick={() => setActiveTest(test)}
                      className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 animate-pulse"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Resume Test</span>
                    </button>
                  ) : isLive ? (
                    <button
                      type="button"
                      onClick={() => setActiveTest(test)}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#0F3B42] hover:bg-[#0b2c31] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5 fill-current text-emerald-300" />
                      <span>Start Test</span>
                    </button>
                  ) : isScheduled ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-100 text-slate-400 font-bold text-xs cursor-not-allowed flex items-center justify-center gap-1.5 border border-slate-200"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Starts on {new Date(test.publishTime).toLocaleDateString()}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-100 text-slate-400 font-bold text-xs cursor-not-allowed"
                    >
                      Test Closed
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Preserved original empty state when zero tests exist */
        <section className="bg-white/70 backdrop-blur-md border border-white/80 p-6 sm:p-10 rounded-[24px] shadow-[0_6px_24px_rgb(0,0,0,0.04)] min-h-[300px] flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#EAF3F1] text-[#175A67] flex items-center justify-center mb-4 shadow-sm">
            <FileCheck2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-[#0B1C30]">No Course Tests Scheduled Yet</h3>
          <p className="text-xs sm:text-sm text-[#2A707C] max-w-md mt-1.5 leading-relaxed font-medium">
            Weekly Saturday &amp; Sunday batch tests, chapter quizzes, and periodic tests for your course will appear here in compact test cards.
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
      )}

      {/* Batch Leaderboard: switched off for now (remove the comment markers to bring it back)
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
      */}

      {/* Active CBT Test Solver Modal */}
      {activeTest && (
        <TestSolverModal
          test={activeTest}
          onClose={() => setActiveTest(null)}
          onSubmitted={() => {
            fetchTests();
            showToast('Test submitted successfully! Your scorecard is recorded.');
          }}
        />
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
