import React from 'react';
import { Lock, Sparkles, BookOpen, ArrowLeft } from 'lucide-react';

interface FeatureLockedViewProps {
  feature: string;
  description: string;
  onExploreCourses: () => void;
  onBackHome: () => void;
}

export function FeatureLockedView({
  feature,
  description,
  onExploreCourses,
  onBackHome,
}: FeatureLockedViewProps) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4 sm:p-6 animate-tab-content">
      <div className="relative max-w-lg w-full bg-white/70 backdrop-blur-md border border-white/40 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-[#175A67]/10 text-center overflow-hidden">
        {/* Decorative Top Ambient Glow */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#175A67]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Lock Icon Badge */}
        <div className="relative mx-auto mb-6 w-20 h-20 rounded-2xl bg-gradient-to-tr from-[#175A67] to-[#2A707C] flex items-center justify-center shadow-lg shadow-[#175A67]/25 text-white">
          <Lock className="w-10 h-10 text-amber-300 animate-pulse" />
          <div className="absolute -top-1.5 -right-1.5 bg-amber-400 text-[#0F3C45] p-1 rounded-full shadow">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Status Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-700 text-xs font-bold tracking-wider uppercase mb-3">
          <Lock className="w-3 h-3" />
          Locked In Live Phase
        </div>

        {/* Title */}
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[#175A67] tracking-tight mb-3">
          {feature}
        </h2>

        {/* Description */}
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-8">
          {description}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onExploreCourses}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-[#175A67] to-[#1e6f7e] hover:from-[#134954] hover:to-[#175A67] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-[#175A67]/20 transition-all active:scale-95"
          >
            <BookOpen className="w-4 h-4" />
            <span>Explore Enrolled & All Courses</span>
          </button>

          <button
            onClick={onBackHome}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-white/80 hover:bg-white text-slate-700 hover:text-[#175A67] border border-slate-200/80 font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </button>
        </div>
      </div>
    </div>
  );
}

