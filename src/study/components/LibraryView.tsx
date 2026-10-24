import React, { useState } from 'react';
import {
  BookOpen,
  FolderOpen,
  CheckCircle2,
  FileText,
  Video,
} from 'lucide-react';
import { SubPageHeader } from './SubPageHeader';

interface LibraryViewProps {
  onBack?: () => void;
}

export function LibraryView({ onBack }: LibraryViewProps) {

  return (
    <div className="bg-[#DCEAE3] rounded-[28px] p-4 sm:p-6 lg:p-8 relative space-y-6 min-h-[calc(100vh-6rem)]">
      {/* 1. Standardized Back Button + Breadcrumb */}
      <SubPageHeader
        onBack={onBack}
        crumbs={[
          { label: 'Home', onClick: onBack },
          { label: 'Library', onClick: onBack },
          { label: 'Class Material' },
        ]}
      />

      {/* Streamlined Header (Clean title + New Subtitle, category pills removed) */}
      <div className="bg-white/80 backdrop-blur-md border border-white/80 rounded-2xl p-5 sm:p-6 shadow-[0_6px_24px_rgb(0,0,0,0.05)] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#0F3B42] text-white flex items-center justify-center shadow-md shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0B1C30]">Your Class Material</h1>
            <p className="text-xs text-[#2A707C] mt-0.5 font-medium">
              Your Daily Class Notes and Recorded Lectures
            </p>
          </div>
        </div>
      </div>

      {/* White surface container kept intact for CMS content (smaller compact tiles) */}
      <section className="bg-white/70 backdrop-blur-md border border-white/80 p-6 sm:p-10 rounded-[24px] shadow-[0_6px_24px_rgb(0,0,0,0.04)] min-h-[380px] flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#EAF3F1] text-[#175A67] flex items-center justify-center mb-4 shadow-sm">
          <FolderOpen className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-[#0B1C30]">No Class Material Published Yet</h3>
        <p className="text-xs sm:text-sm text-[#2A707C] max-w-md mt-1.5 leading-relaxed font-medium">
          Daily class notes and recorded lecture folders published from the Admin CMS will appear here in compact folders.
        </p>

        <div className="flex items-center gap-4 mt-6 text-xs text-slate-500 bg-white/80 border border-slate-200/60 rounded-xl px-4 py-2.5">
          <span className="flex items-center gap-1.5 font-medium">
            <FileText className="w-4 h-4 text-[#175A67]" />
            PDF Notes
          </span>
          <span className="w-1 h-1 rounded-full bg-slate-300" />
          <span className="flex items-center gap-1.5 font-medium">
            <Video className="w-4 h-4 text-[#175A67]" />
            Recorded Lectures
          </span>
        </div>
      </section>
    </div>
  );
}

export default LibraryView;
