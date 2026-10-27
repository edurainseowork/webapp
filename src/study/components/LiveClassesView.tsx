import React from 'react';
import {
  Radio,
  Hammer,
  Sparkles,
  ArrowLeft,
  Clock,
  Video,
  MessagesSquare,
} from 'lucide-react';
import { SubPageHeader, type BreadcrumbCrumb } from './SubPageHeader';

interface LiveClassesViewProps {
  onBack: () => void;
  selectedBatch?: string;
  searchQuery?: string;
}

export function LiveClassesView({ onBack }: LiveClassesViewProps) {
  const crumbs: BreadcrumbCrumb[] = [
    { label: 'Home', onClick: onBack },
    { label: 'Library', onClick: onBack },
    { label: 'Your Live Class' },
  ];

  return (
    <div className="bg-[#DCEAE3] rounded-[28px] p-4 sm:p-6 lg:p-8 relative space-y-6 min-h-[calc(100vh-6rem)] flex flex-col justify-between">
      <div className="space-y-6">
        {/* 1. Header with Breadcrumbs */}
        <SubPageHeader onBack={onBack} crumbs={crumbs} />

        {/* 2. Top Title Banner */}
        <div className="bg-white/70 backdrop-blur-md border border-white/80 p-5 sm:p-6 rounded-[24px] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#175A67] text-white flex items-center justify-center shadow-md shrink-0">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-[#0B1C30]">Your Live Class</h1>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  IN DEVELOPMENT
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#2A707C] mt-0.5 font-medium">
                Live interactive streaming and real-time educator sessions.
              </p>
            </div>
          </div>
        </div>

        {/* 3. Under Development Card (Matching Platform Aesthetic) */}
        <div className="bg-white/80 backdrop-blur-md border border-white/80 rounded-[24px] p-8 sm:p-14 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-center justify-center max-w-2xl mx-auto my-6">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mb-5 border border-amber-200/60 shadow-sm animate-bounce">
            <Hammer className="w-8 h-8 sm:w-10 sm:h-10 text-amber-600" />
          </div>

          <span className="text-xs font-bold uppercase tracking-widest text-amber-700 bg-amber-100 px-3 py-1 rounded-full mb-3">
            Coming Soon
          </span>

          <h2 className="text-xl sm:text-2xl font-bold text-[#0B1C30] tracking-tight mb-2">
            This Feature Is Under Development
          </h2>

          <p className="text-xs sm:text-sm text-[#2A707C] max-w-md mx-auto leading-relaxed mb-6 font-medium">
            We are actively building the live classroom experience with high-definition video streaming, real-time doubt resolution, and interactive whiteboard tools.
          </p>

          {/* Feature Highlights Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg mb-8">
            <div className="bg-white/90 border border-slate-200/80 rounded-2xl p-3.5 flex flex-col items-center text-center shadow-xs">
              <Video className="w-5 h-5 text-[#175A67] mb-1.5" />
              <span className="text-xs font-bold text-[#0B1C30]">HD Live Streams</span>
              <span className="text-[10px] text-[#2A707C] mt-0.5">Direct Educator Feeds</span>
            </div>
            <div className="bg-white/90 border border-slate-200/80 rounded-2xl p-3.5 flex flex-col items-center text-center shadow-xs">
              <MessagesSquare className="w-5 h-5 text-[#175A67] mb-1.5" />
              <span className="text-xs font-bold text-[#0B1C30]">Live Doubt Chat</span>
              <span className="text-[10px] text-[#2A707C] mt-0.5">Instant Teacher Q&amp;A</span>
            </div>
            <div className="bg-white/90 border border-slate-200/80 rounded-2xl p-3.5 flex flex-col items-center text-center shadow-xs">
              <Clock className="w-5 h-5 text-[#175A67] mb-1.5" />
              <span className="text-xs font-bold text-[#0B1C30]">Class Replays</span>
              <span className="text-[10px] text-[#2A707C] mt-0.5">Recorded Archives</span>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={onBack}
            className="flex items-center justify-center gap-2 bg-[#0F3B42] hover:bg-[#0b2c31] text-white text-xs sm:text-sm font-bold py-3 px-6 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Library</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default LiveClassesView;
