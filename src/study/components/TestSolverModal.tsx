import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Send,
  RotateCcw,
  Flag,
  Award,
  BookOpen,
  X,
  FileCheck2,
} from 'lucide-react';
import { apiFetch, ApiError } from '../lib/api';

export interface TestItem {
  id: number;
  courseId: number;
  courseName: string;
  title: string;
  description: string | null;
  targetBatch: string | null;
  status: 'SCHEDULED' | 'PUBLISHED' | 'COMPLETED' | 'ARCHIVED' | 'DRAFT';
  publishTime: string;
  closeTime: string | null;
  durationMinutes: number;
  marksPositive: number;
  marksNegative: number;
  totalQuestions: number;
  myAttempt?: {
    id: number;
    status: 'IN_PROGRESS' | 'SUBMITTED';
    started_at: string;
    end_at: string;
    submitted_at?: string;
    score?: number;
    correct_count?: number;
    wrong_count?: number;
    skipped_count?: number;
    total_questions?: number;
    submission_reason?: string;
  } | null;
}

export interface TestQuestion {
  id: number;
  question_order: number;
  type: string;
  question_text: string;
  passage?: string | null;
  options?: any;
  multiple_correct?: boolean;
  marks_positive: number;
  marks_negative: number;
}

interface TestSolverModalProps {
  test: TestItem;
  onClose: () => void;
  onSubmitted: () => void;
}

type QuestionStatus = 'answered' | 'unanswered' | 'review' | 'not_visited';

export const TestSolverModal: React.FC<TestSolverModalProps> = ({
  test,
  onClose,
  onSubmitted,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Student answer mapping: questionId -> value (e.g. "A", "A,C", "42", "TRUE")
  const [answers, setAnswers] = useState<Record<number, any>>({});
  // Review flags: questionId -> boolean
  const [reviewFlags, setReviewFlags] = useState<Record<number, boolean>>({});
  // Visited set
  const [visited, setVisited] = useState<Record<number, boolean>>({});

  // Timer
  const [remainingSeconds, setRemainingSeconds] = useState<number>(test.durationMinutes * 60);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [violationCount, setViolationCount] = useState(0);

  // 1. Start attempt & load questions
  useEffect(() => {
    let isMounted = true;
    async function initTest() {
      setLoading(true);
      setError(null);
      try {
        // Start or resume test
        const startRes = await apiFetch<{
          success: boolean;
          data: {
            test_id: number;
            started_at: string;
            end_at: string;
            server_time: string;
            duration_minutes: number;
          };
        }>(`/tests/${test.id}/start`, { method: 'POST' });

        // Calculate timer from end_at & server_time
        if (startRes.data?.end_at && startRes.data?.server_time) {
          const end = new Date(startRes.data.end_at).getTime();
          const serverNow = new Date(startRes.data.server_time).getTime();
          const diffSec = Math.max(0, Math.floor((end - serverNow) / 1000));
          if (isMounted) setRemainingSeconds(diffSec);
        }

        // Fetch questions
        const qRes = await apiFetch<{
          success: boolean;
          data: {
            questions: TestQuestion[];
            violation_count?: number;
          };
        }>(`/tests/${test.id}/questions`);

        if (isMounted) {
          const qs = qRes.data?.questions || [];
          setQuestions(qs);
          if (qs.length > 0) {
            setVisited({ [qs[0].id]: true });
          }
          if (typeof qRes.data?.violation_count === 'number') {
            setViolationCount(qRes.data.violation_count);
          }
        }
      } catch (err: any) {
        console.error('Failed to init test:', err);
        if (isMounted) {
          setError(err?.message || 'Failed to start or load test questions.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initTest();
    return () => {
      isMounted = false;
    };
  }, [test.id, test.durationMinutes]);

  // 2. Anti-cheat window blur tracking
  useEffect(() => {
    if (result) return;
    const handleBlur = () => {
      apiFetch(`/tests/${test.id}/violations`, {
        method: 'POST',
        body: { type: 'TAB_SWITCH' },
      })
        .then((res: any) => {
          if (res?.data?.violation_count) {
            setViolationCount(res.data.violation_count);
          }
        })
        .catch(() => {});
    };

    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [test.id, result]);

  // 3. Countdown timer
  useEffect(() => {
    if (loading || result) return;
    if (remainingSeconds <= 0) {
      // Auto submit on time expired
      handleSubmitTest('TIME_EXPIRED');
      return;
    }

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitTest('TIME_EXPIRED');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, remainingSeconds, result]);

  // Format time string HH:MM:SS
  const timeFormatted = useMemo(() => {
    const h = Math.floor(remainingSeconds / 3600);
    const m = Math.floor((remainingSeconds % 3600) / 60);
    const s = remainingSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
  }, [remainingSeconds]);

  const currentQ = questions[currentIndex];

  // Record visited question when index changes
  const goToQuestion = (index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentIndex(index);
      const q = questions[index];
      if (q) {
        setVisited((prev) => ({ ...prev, [q.id]: true }));
      }
    }
  };

  // Helper to get question status
  const getStatus = useCallback(
    (qId: number): QuestionStatus => {
      const isAnswered = answers[qId] !== undefined && answers[qId] !== null && String(answers[qId]).trim() !== '';
      const isReview = !!reviewFlags[qId];
      if (isReview) return 'review';
      if (isAnswered) return 'answered';
      if (visited[qId]) return 'unanswered';
      return 'not_visited';
    },
    [answers, reviewFlags, visited]
  );

  // Status counts for palette
  const counts = useMemo(() => {
    let answered = 0;
    let review = 0;
    let notAnswered = 0;
    let notVisited = 0;

    questions.forEach((q) => {
      const st = getStatus(q.id);
      if (st === 'answered') answered++;
      else if (st === 'review') review++;
      else if (st === 'unanswered') notAnswered++;
      else notVisited++;
    });

    return { answered, review, notAnswered, notVisited };
  }, [questions, getStatus]);

  // Submit test handler
  const handleSubmitTest = async (reason: 'MANUAL_SUBMIT' | 'TIME_EXPIRED' = 'MANUAL_SUBMIT') => {
    if (submitting) return;
    setSubmitting(true);
    setShowSubmitConfirm(false);

    try {
      const payloadAnswers = questions.map((q) => {
        const val = answers[q.id];
        const isAnswered = val !== undefined && val !== null && String(val).trim() !== '';
        return {
          question_id: q.id,
          my_answer: isAnswered ? val : null,
        };
      });

      const res = await apiFetch<{
        success: boolean;
        message: string;
        data: any;
      }>(`/tests/${test.id}/submit`, {
        method: 'POST',
        body: {
          submission_reason: reason,
          violation_count: violationCount,
          answers: payloadAnswers,
        },
      });

      setResult(res.data);
      onSubmitted();
    } catch (err: any) {
      console.error('Failed to submit test:', err);
      alert(err?.message || 'Failed to submit test. Please try again.');
      setSubmitting(false);
    }
  };

  // Answer interaction helpers
  const handleSingleOption = (key: string) => {
    if (!currentQ) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: key,
    }));
  };

  const handleMultipleOption = (key: string) => {
    if (!currentQ) return;
    const currentVal = answers[currentQ.id];
    let selected: string[] = [];
    if (Array.isArray(currentVal)) {
      selected = [...currentVal];
    } else if (typeof currentVal === 'string' && currentVal) {
      selected = currentVal.split(',').map((s) => s.trim());
    }

    if (selected.includes(key)) {
      selected = selected.filter((k) => k !== key);
    } else {
      selected.push(key);
    }
    selected.sort();
    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: selected.length > 0 ? selected.join(',') : null,
    }));
  };

  const handleClear = () => {
    if (!currentQ) return;
    setAnswers((prev) => {
      const copy = { ...prev };
      delete copy[currentQ.id];
      return copy;
    });
  };

  const handleToggleReview = () => {
    if (!currentQ) return;
    setReviewFlags((prev) => ({
      ...prev,
      [currentQ.id]: !prev[currentQ.id],
    }));
  };

  // Render question options safely
  const renderOptions = () => {
    if (!currentQ) return null;
    const q = currentQ;
    const val = answers[q.id];

    // True / False
    if (q.type === 'true_false') {
      return (
        <div className="grid grid-cols-2 gap-4 max-w-md mt-4">
          {['TRUE', 'FALSE'].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => handleSingleOption(opt)}
              className={`p-4 rounded-xl border-2 font-bold text-sm sm:text-base transition-all ${
                val === opt
                  ? 'border-[#0F3B42] bg-[#EAF3F1] text-[#0F3B42] shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      );
    }

    // Integer / Numerical
    if (q.type === 'integer' || q.type === 'numerical') {
      return (
        <div className="mt-4 max-w-xs space-y-2">
          <label className="text-xs font-semibold text-slate-600 block">
            Enter Whole Number Answer:
          </label>
          <input
            type="number"
            value={val ?? ''}
            onChange={(e) =>
              setAnswers((prev) => ({
                ...prev,
                [q.id]: e.target.value.trim() === '' ? null : e.target.value.trim(),
              }))
            }
            placeholder="e.g. 42"
            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0F3B42] text-lg font-mono font-bold"
          />
        </div>
      );
    }

    // Fill in the blanks
    if (q.type === 'fill_ups') {
      return (
        <div className="mt-4 max-w-md space-y-2">
          <label className="text-xs font-semibold text-slate-600 block">
            Enter Text Answer:
          </label>
          <input
            type="text"
            value={val ?? ''}
            onChange={(e) =>
              setAnswers((prev) => ({
                ...prev,
                [q.id]: e.target.value.trim() === '' ? null : e.target.value,
              }))
            }
            placeholder="Type your answer..."
            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0F3B42] text-sm font-medium"
          />
        </div>
      );
    }

    // Standard Multiple Choice / Options Array
    let opts: Array<{ key: string; text: string }> = [];
    if (Array.isArray(q.options)) {
      opts = q.options.map((item: any, i: number) => {
        if (typeof item === 'string') {
          return { key: String.fromCharCode(65 + i), text: item };
        }
        return { key: item.key || String.fromCharCode(65 + i), text: item.text || '' };
      });
    }

    const isMulti = q.multiple_correct;
    const selectedKeys =
      typeof val === 'string'
        ? val.split(',').map((s) => s.trim())
        : Array.isArray(val)
        ? val
        : val
        ? [String(val)]
        : [];

    return (
      <div className="space-y-3 mt-4">
        {opts.map((opt) => {
          const isSelected = selectedKeys.includes(opt.key);
          return (
            <div
              key={opt.key}
              onClick={() => (isMulti ? handleMultipleOption(opt.key) : handleSingleOption(opt.key))}
              className={`p-3.5 sm:p-4 rounded-xl border-2 flex items-start gap-3.5 cursor-pointer transition-all ${
                isSelected
                  ? 'border-[#0F3B42] bg-[#EAF3F1] shadow-sm'
                  : 'border-slate-200/90 hover:border-slate-300 bg-white hover:bg-slate-50'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                  isSelected
                    ? 'bg-[#0F3B42] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                {opt.key}
              </div>
              <div className="text-sm sm:text-base text-slate-800 font-medium leading-relaxed pt-0.5">
                {opt.text}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center p-2 sm:p-4 animate-fadeIn">
      {/* Full CBT Container */}
      <div className="w-full max-w-6xl h-full max-h-[96vh] bg-[#F8FAFC] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        
        {/* Top Header */}
        <header className="bg-[#0F3B42] text-white px-4 sm:px-6 py-3 flex items-center justify-between gap-4 shrink-0 shadow-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-emerald-300" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 uppercase">
                  {test.courseName}
                </span>
                <span className="text-xs text-slate-300 hidden sm:inline">
                  • {test.totalQuestions} Questions
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-bold truncate text-white mt-0.5">
                {test.title}
              </h2>
            </div>
          </div>

          {/* Timer & Finish button */}
          {!result && (
            <div className="flex items-center gap-3 shrink-0">
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono text-sm sm:text-base font-bold border transition-colors ${
                  remainingSeconds < 300
                    ? 'bg-rose-500/20 border-rose-400 text-rose-300 animate-pulse'
                    : 'bg-white/10 border-white/20 text-emerald-300'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>{timeFormatted}</span>
              </div>

              <button
                type="button"
                onClick={() => setShowSubmitConfirm(true)}
                disabled={submitting}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow transition-all active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit</span>
              </button>
            </div>
          )}

          {result && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/10 text-white"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </header>

        {/* Body Content */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3">
            <div className="w-10 h-10 border-4 border-[#0F3B42] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-slate-600">
              Loading test questions &amp; initializing exam session...
            </p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Unable to Start Test</h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md">{error}</p>
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-[#0F3B42] text-white font-bold text-sm shadow hover:bg-[#0b2c31]"
            >
              Return to Test Series
            </button>
          </div>
        ) : result ? (
          /* RESULT SCREEN */
          <div className="flex-1 overflow-y-auto p-6 sm:p-10 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-lg mb-4">
              <Award className="w-10 h-10" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Test Completed!
            </h2>
            <p className="text-sm text-slate-600 mt-1 max-w-md">
              Your responses have been evaluated and recorded successfully.
            </p>

            {/* Scorecard */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 max-w-xl w-full mt-6 text-left">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                <span className="text-xs text-emerald-700 font-semibold uppercase">Score</span>
                <p className="text-2xl font-black text-emerald-900 mt-0.5">
                  {result.score ?? 0} pts
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200">
                <span className="text-xs text-blue-700 font-semibold uppercase">Correct</span>
                <p className="text-2xl font-black text-blue-900 mt-0.5">
                  {result.correct_count ?? 0} / {result.total_questions ?? questions.length}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200">
                <span className="text-xs text-rose-700 font-semibold uppercase">Wrong</span>
                <p className="text-2xl font-black text-rose-900 mt-0.5">
                  {result.wrong_count ?? 0}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200">
                <span className="text-xs text-slate-600 font-semibold uppercase">Skipped</span>
                <p className="text-2xl font-black text-slate-800 mt-0.5">
                  {result.skipped_count ?? 0}
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={onClose}
                className="px-6 py-3 rounded-xl bg-[#0F3B42] text-white font-bold text-sm shadow-md hover:bg-[#0b2c31] transition-all"
              >
                Back to Test Series
              </button>
            </div>
          </div>
        ) : (
          /* ACTIVE CBT INTERFACE */
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            
            {/* Left/Center: Question Surface */}
            <div className="flex-1 flex flex-col overflow-y-auto p-4 sm:p-6 lg:p-8 bg-white border-b lg:border-b-0 lg:border-r border-slate-200">
              {currentQ ? (
                <div className="space-y-4 max-w-3xl">
                  {/* Question Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base sm:text-lg font-black text-[#0B1C30]">
                        Question {currentIndex + 1}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        of {questions.length}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 uppercase border border-slate-200">
                        {currentQ.type.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-bold">
                      <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                        +{currentQ.marks_positive ?? test.marksPositive}
                      </span>
                      <span className="text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                        -{currentQ.marks_negative ?? test.marksNegative}
                      </span>
                    </div>
                  </div>

                  {/* Comprehension Passage if present */}
                  {currentQ.passage && (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700 leading-relaxed font-serif">
                      <strong className="block text-slate-900 mb-1 font-sans">
                        Reading Comprehension:
                      </strong>
                      {currentQ.passage}
                    </div>
                  )}

                  {/* Question Text */}
                  <div className="text-base sm:text-lg text-slate-900 font-semibold leading-relaxed">
                    {currentQ.question_text}
                  </div>

                  {/* Options */}
                  {renderOptions()}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  No questions available in this test.
                </div>
              )}

              {/* Bottom Question Actions */}
              <div className="mt-auto pt-6 border-t border-slate-200 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleReview}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                      currentQ && reviewFlags[currentQ.id]
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>{currentQ && reviewFlags[currentQ.id] ? 'Marked for Review' : 'Mark for Review'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClear}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Clear Response</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentIndex === 0}
                    onClick={() => goToQuestion(currentIndex - 1)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (currentIndex < questions.length - 1) {
                        goToQuestion(currentIndex + 1);
                      } else {
                        setShowSubmitConfirm(true);
                      }
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0F3B42] hover:bg-[#0b2c31] text-white shadow-sm flex items-center gap-1 transition-all active:scale-95"
                  >
                    <span>{currentIndex === questions.length - 1 ? 'Save & Review' : 'Save & Next'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Question Navigation Palette */}
            <aside className="w-full lg:w-72 bg-[#F8FAFC] p-4 flex flex-col justify-between shrink-0 overflow-y-auto">
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                  Question Palette
                </h4>

                {/* Status Legend */}
                <div className="grid grid-cols-2 gap-2 text-[11px] mb-4 p-2.5 rounded-xl bg-white border border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-emerald-500" />
                    <span className="text-slate-600 font-medium">Answered ({counts.answered})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-purple-500" />
                    <span className="text-slate-600 font-medium">Review ({counts.review})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-rose-500" />
                    <span className="text-slate-600 font-medium">Unanswered ({counts.notAnswered})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-slate-200" />
                    <span className="text-slate-600 font-medium">Not Visited ({counts.notVisited})</span>
                  </div>
                </div>

                {/* Question Grid Buttons */}
                <div className="grid grid-cols-5 gap-2 max-h-[300px] overflow-y-auto p-1">
                  {questions.map((q, idx) => {
                    const st = getStatus(q.id);
                    const isCurrent = idx === currentIndex;

                    let bgClass = 'bg-slate-200 text-slate-700';
                    if (st === 'answered') bgClass = 'bg-emerald-500 text-white font-bold';
                    else if (st === 'review') bgClass = 'bg-purple-600 text-white font-bold';
                    else if (st === 'unanswered') bgClass = 'bg-rose-500 text-white font-bold';

                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => goToQuestion(idx)}
                        className={`h-9 rounded-lg text-xs font-bold transition-all relative flex items-center justify-center ${bgClass} ${
                          isCurrent
                            ? 'ring-2 ring-[#0F3B42] ring-offset-2 scale-105 shadow-md'
                            : 'hover:opacity-90'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Anti-cheat flag indicator */}
              {violationCount > 0 && (
                <div className="mt-4 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Tab switch warnings: {violationCount}</span>
                </div>
              )}

              {/* Submit Test Trigger */}
              <div className="pt-4 border-t border-slate-200 mt-4">
                <button
                  type="button"
                  onClick={() => setShowSubmitConfirm(true)}
                  disabled={submitting}
                  className="w-full py-2.5 rounded-xl bg-[#0F3B42] hover:bg-[#0b2c31] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
                >
                  <Send className="w-4 h-4 text-emerald-400" />
                  <span>Submit Exam</span>
                </button>
              </div>
            </aside>
          </div>
        )}

      </div>

      {/* Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Confirm Submission</h3>
                <p className="text-xs text-slate-500">Are you sure you want to finish this test?</p>
              </div>
            </div>

            {/* Summary List */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 font-medium block">Total Questions:</span>
                <strong className="text-slate-900 text-sm">{questions.length}</strong>
              </div>
              <div>
                <span className="text-emerald-700 font-medium block">Answered:</span>
                <strong className="text-emerald-700 text-sm">{counts.answered}</strong>
              </div>
              <div>
                <span className="text-rose-600 font-medium block">Unanswered:</span>
                <strong className="text-rose-600 text-sm">{counts.notAnswered + counts.notVisited}</strong>
              </div>
              <div>
                <span className="text-purple-700 font-medium block">Marked for Review:</span>
                <strong className="text-purple-700 text-sm">{counts.review}</strong>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Once submitted, you cannot change your answers. Your score will be evaluated immediately.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100"
              >
                Continue Test
              </button>
              <button
                type="button"
                onClick={() => handleSubmitTest('MANUAL_SUBMIT')}
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-[#0F3B42] hover:bg-[#0b2c31] text-white font-bold text-xs flex items-center gap-1.5 shadow"
              >
                {submitting ? 'Submitting...' : 'Yes, Submit Test'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
