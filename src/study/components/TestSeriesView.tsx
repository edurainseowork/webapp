import React, { useState } from 'react';
import { Lock, Sparkles, Bell, ArrowLeft, ShieldCheck, CheckCircle2, Play } from 'lucide-react';
import { SubPageHeader } from './SubPageHeader';

interface TestSeriesViewProps {
  onBack: () => void;
  onOpenUpgrade?: () => void;
  onOpenCourseTests?: () => void;
}

export const TestSeriesView: React.FC<TestSeriesViewProps> = ({ onBack, onOpenCourseTests }) => {
  const [notified, setNotified] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const handleNotify = () => {
    setNotified(true);
    setToast('You will be notified as soon as All India Test Pass is unlocked!');
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="space-y-6 pb-20 animate-fadeIn max-w-4xl mx-auto">
      {/* 1. Standardized Back Button + Breadcrumb */}
      <SubPageHeader
        onBack={onBack}
        crumbs={[
          { label: 'Home', onClick: onBack },
          { label: 'All India Test Pass' },
        ]}
      />

      {/* Locked Coming Soon Card */}
      <div className="relative overflow-hidden rounded-3xl bg-white p-8 sm:p-12 shadow-[0_12px_40px_rgb(0,0,0,0.06)] border border-[#175A67]/15 text-center">
        {/* Subtle decorative background glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 bg-amber-400/15 rounded-full blur-[90px] pointer-events-none" />

        {/* Lock Icon */}
        <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-amber-50 border border-amber-200/80 text-amber-600 shadow-md mb-6">
          <Lock className="w-10 h-10" />
          <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#0F3B42] text-white flex items-center justify-center text-[10px] font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          </span>
        </div>

        {/* Badges */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold tracking-wider uppercase border border-amber-200">
            Feature Locked
          </span>
          <span className="px-3 py-1 rounded-full bg-[#EAF3F1] text-[#175A67] text-[11px] font-bold tracking-wider uppercase border border-[#175A67]/20">
            Coming Soon
          </span>
        </div>

        {/* Heading */}
        <h1 className="text-2xl sm:text-4xl font-black text-[#0B1C30] tracking-tight">
          All India Test Pass
        </h1>
        <p className="text-xs sm:text-base text-slate-600 max-w-xl mx-auto mt-3 leading-relaxed">
          The authentic All-India Computer Based Test (CBT) engine and AI-driven percentile rank predictor are currently being fine-tuned. This feature will be unlocked soon.
        </p>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 max-w-2xl mx-auto mt-8 text-left">
          <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200/80">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-2.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold text-[#0B1C30]">Real NTA CBT Engine</p>
            <p className="text-[11px] text-slate-500 mt-1">Exact UI mirroring NEET &amp; JEE Advanced examination software.</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200/80">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold text-[#0B1C30]">All-India AIR Benchmarking</p>
            <p className="text-[11px] text-slate-500 mt-1">Instant percentile rank prediction computed across 50k+ aspirants.</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200/80">
            <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center mb-2.5">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold text-[#0B1C30]">Weak Area Diagnosis</p>
            <p className="text-[11px] text-slate-500 mt-1">Deep question-level speed, accuracy and negative marking breakdown.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3.5 mt-9">
          {onOpenCourseTests && (
            <button
              onClick={onOpenCourseTests}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-[#0F3B42] hover:opacity-95 text-white font-bold text-xs sm:text-sm transition-all active:scale-95 shadow-md"
            >
              <Play className="w-4 h-4 fill-current text-emerald-300" />
              <span>Solve Course Tests</span>
            </button>
          )}

          <button
            onClick={onBack}
            className="flex items-center gap-2 px-6 py-3 rounded-xl border border-[#175A67]/25 text-[#175A67] hover:bg-[#EAF3F1] font-bold text-xs sm:text-sm transition-all active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Study Central
          </button>

          <button
            onClick={handleNotify}
            disabled={notified}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all active:scale-95 shadow-md ${
              notified
                ? 'bg-emerald-600 text-white cursor-default'
                : 'bg-[#0F3B42] hover:bg-[#0b2c31] text-white hover:shadow-lg'
            }`}
          >
            {notified ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Notification Enabled
              </>
            ) : (
              <>
                <Bell className="w-4 h-4" />
                Notify Me When Live
              </>
            )}
          </button>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[70] bg-[#175A67] text-white text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-full shadow-2xl animate-fadeIn">
          {toast}
        </div>
      )}
    </div>
  );
};

export default TestSeriesView;
