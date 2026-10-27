import React, { useState, useRef, useEffect } from 'react';
import { Lock, Bell, CheckCircle2, ArrowRight } from 'lucide-react';
import { SubPageHeader } from './SubPageHeader';

interface TestSeriesViewProps {
  onBack: () => void;
  onOpenUpgrade?: () => void;
  onOpenCourseTests?: () => void;
}

export const TestSeriesView: React.FC<TestSeriesViewProps> = ({
  onBack,
  onOpenCourseTests,
}) => {
  const [notified, setNotified] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const handleNotify = () => {
    setNotified(true);
    setToast('You will be notified as soon as All India Test Pass unlocks.');
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => setToast(null), 3200);
  };

  return (
    <div className="space-y-8 pb-20 max-w-3xl mx-auto px-4 sm:px-6">
      {/* 1. Standardized Breadcrumb Navigation */}
      <SubPageHeader
        onBack={onBack}
        crumbs={[
          { label: 'Home', onClick: onBack },
          { label: 'All India Test Pass' },
        ]}
      />

      {/* 2. Minimalist Locked State Card */}
      <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200/80 shadow-[0_4px_24px_rgba(15,23,42,0.04)] p-8 sm:p-14 text-center">
        {/* Subtle, restrained lock indicator */}
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
          <Lock className="h-6 w-6" strokeWidth={1.75} />
        </div>

        {/* Quiet status badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold text-[#175A67] bg-[#175A67]/10 mb-4 tracking-wide uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-[#175A67]" />
          <span>Locked • Coming Soon</span>
        </div>

        {/* Confident, clear typography */}
        <h1 className="text-2xl sm:text-4xl font-bold text-[#0B1C30] tracking-tight">
          All India Test Pass
        </h1>

        <p className="mt-3 text-sm sm:text-base text-slate-600 max-w-lg mx-auto leading-relaxed">
          This feature is currently locked while our all-India CBT testing engine and percentile benchmarking system are being finalized. It will unlock soon ahead of the examination season.
        </p>

        {/* Single primary action: Notification trigger */}
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={handleNotify}
            disabled={notified}
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
              notified
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-default'
                : 'bg-[#175A67] hover:bg-[#124853] text-white shadow-sm hover:shadow'
            }`}
          >
            {notified ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Notification Enabled</span>
              </>
            ) : (
              <>
                <Bell className="w-4 h-4" />
                <span>Notify Me When Unlocked</span>
              </>
            )}
          </button>
        </div>

        {/* Contextual quiet secondary link for Course Tests */}
        {onOpenCourseTests && (
          <div className="mt-10 pt-6 border-t border-slate-100 flex items-center justify-center gap-1.5 text-xs sm:text-sm text-slate-500">
            <span>Looking to practice today?</span>
            <button
              type="button"
              onClick={onOpenCourseTests}
              className="inline-flex items-center gap-1 font-semibold text-[#175A67] hover:text-[#124853] hover:underline transition-colors"
            >
              <span>Solve Course Tests</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Toast Feedback */}
      {toast && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#0B1C30] text-white text-xs sm:text-sm font-medium px-5 py-2.5 rounded-full shadow-lg"
        >
          {toast}
        </aside>
      )}
    </div>
  );
};

export default TestSeriesView;
