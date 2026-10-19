import React, { useEffect, useState } from 'react';
import {
  X,
  CheckCircle2,
  ArrowRight,
  Info,
  ChevronRight,
  GraduationCap,
  Stethoscope,
  School,
  BookOpen,
  Target,
  Sparkles,
  Award,
  Medal,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type GoalId = 'iit-jee' | 'neet' | 'foundation' | string;
export type TargetCategory = 'iit-jee' | 'neet' | 'foundation';

interface TargetOption {
  id: TargetCategory;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface StreamTile {
  id: string;
  title: string;
  subtitle: string;
  batchLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  iconStyle: string;
}

interface CohortGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeGoal: GoalId;
  selectedBatch?: string;
  onConfirm: (goal: GoalId, batchLabel?: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Target Categories (Top Row)                                        */
/* ------------------------------------------------------------------ */

const TARGET_CATEGORIES: TargetOption[] = [
  { id: 'iit-jee', title: 'IIT-JEE', subtitle: 'Class 11, 12, Repeater', icon: GraduationCap },
  { id: 'neet', title: 'NEET', subtitle: 'UG Medical Entrance', icon: Stethoscope },
  { id: 'foundation', title: 'Foundation', subtitle: 'Class 6th to 10th', icon: School },
];

/* ------------------------------------------------------------------ */
/*  Stream / Class Tiles by Category (Explore All Streams)             */
/* ------------------------------------------------------------------ */

const STREAMS_BY_CATEGORY: Record<TargetCategory, StreamTile[]> = {
  'iit-jee': [
    {
      id: 'jee-11',
      title: 'Class 11th',
      subtitle: 'Target JEE 2028',
      batchLabel: '11th - IIT JEE',
      icon: BookOpen,
      iconStyle: 'bg-emerald-50 text-emerald-600',
    },
    {
      id: 'jee-12',
      title: 'Class 12th',
      subtitle: 'Target JEE 2027',
      batchLabel: '12th - IIT JEE',
      icon: GraduationCap,
      iconStyle: 'bg-teal-50 text-[#175A67]',
    },
    {
      id: 'jee-dropper',
      title: 'Dropper',
      subtitle: 'JEE Advanced Repeater',
      batchLabel: 'Dropper - JEE Advanced',
      icon: Target,
      iconStyle: 'bg-amber-50 text-amber-600',
    },
  ],
  neet: [
    {
      id: 'neet-11',
      title: 'Class 11th',
      subtitle: 'Target NEET 2028',
      batchLabel: '11th - NEET',
      icon: BookOpen,
      iconStyle: 'bg-emerald-50 text-emerald-600',
    },
    {
      id: 'neet-12',
      title: 'Class 12th',
      subtitle: 'Target NEET 2027',
      batchLabel: '12th - NEET',
      icon: Stethoscope,
      iconStyle: 'bg-teal-50 text-[#175A67]',
    },
    {
      id: 'neet-dropper',
      title: 'Dropper',
      subtitle: 'NEET UG Repeater',
      batchLabel: 'Dropper - NEET Premier',
      icon: Target,
      iconStyle: 'bg-amber-50 text-amber-600',
    },
  ],
  foundation: [
    {
      id: 'found-6',
      title: 'Class 6th',
      subtitle: 'Science & Maths Foundation',
      batchLabel: 'Class 6th - Foundation',
      icon: Sparkles,
      iconStyle: 'bg-blue-50 text-blue-600',
    },
    {
      id: 'found-7',
      title: 'Class 7th',
      subtitle: 'Science & Maths Foundation',
      batchLabel: 'Class 7th - Foundation',
      icon: BookOpen,
      iconStyle: 'bg-emerald-50 text-emerald-600',
    },
    {
      id: 'found-8',
      title: 'Class 8th',
      subtitle: 'Pre-Foundation & Olympiad',
      batchLabel: 'Class 8th - Foundation',
      icon: Award,
      iconStyle: 'bg-purple-50 text-purple-600',
    },
    {
      id: 'found-9',
      title: 'Class 9th',
      subtitle: 'Foundation & Olympiad',
      batchLabel: 'Class 9th - Foundation',
      icon: Medal,
      iconStyle: 'bg-amber-50 text-amber-600',
    },
    {
      id: 'found-10',
      title: 'Class 10th',
      subtitle: 'Board Exams & Foundation',
      batchLabel: 'Class 10th - Foundation',
      icon: GraduationCap,
      iconStyle: 'bg-teal-50 text-[#175A67]',
    },
  ],
};

const CATEGORY_LABELS: Record<TargetCategory, string> = {
  'iit-jee': 'IIT-JEE',
  neet: 'NEET',
  foundation: 'Foundation',
};

/* ------------------------------------------------------------------ */
/*  Main Modal Component                                               */
/* ------------------------------------------------------------------ */

export function CohortGoalModal({
  isOpen,
  onClose,
  activeGoal,
  selectedBatch,
  onConfirm,
}: CohortGoalModalProps) {
  const detectCategory = (): TargetCategory => {
    const raw = (activeGoal || selectedBatch || '').toLowerCase();
    if (raw.includes('neet')) return 'neet';
    if (
      raw.includes('found') ||
      raw.includes('class 6') ||
      raw.includes('class 7') ||
      raw.includes('class 8') ||
      raw.includes('class 9') ||
      raw.includes('class 10')
    ) {
      return 'foundation';
    }
    return 'iit-jee';
  };

  const [selectedCategory, setSelectedCategory] = useState<TargetCategory>(detectCategory);
  const [selectedStreamId, setSelectedStreamId] = useState<string>('');

  // Sync state whenever modal opens or active goal / batch changes
  useEffect(() => {
    if (!isOpen) return;
    const cat = detectCategory();
    setSelectedCategory(cat);

    const streams = STREAMS_BY_CATEGORY[cat];
    const match = streams.find(
      (s) => selectedBatch && s.batchLabel.toLowerCase() === selectedBatch.toLowerCase()
    );
    if (match) {
      setSelectedStreamId(match.id);
    } else {
      setSelectedStreamId(streams[0]?.id ?? '');
    }
  }, [isOpen, activeGoal, selectedBatch]);

  if (!isOpen) return null;

  const currentStreams = STREAMS_BY_CATEGORY[selectedCategory];
  const selectedStream = currentStreams.find((s) => s.id === selectedStreamId) || currentStreams[0];

  const handleSelectCategory = (cat: TargetCategory) => {
    setSelectedCategory(cat);
    const streams = STREAMS_BY_CATEGORY[cat];
    setSelectedStreamId(streams[0]?.id ?? '');
  };

  const handleConfirm = () => {
    onConfirm(selectedCategory, selectedStream?.batchLabel);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 sm:px-7 pt-6 pb-5 shrink-0 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#EAF3F1] hover:bg-[#dcece7] text-[#175A67] flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Adaptive Learning Path
          </span>

          <h2 className="text-xl sm:text-2xl font-bold text-[#0C2E35] mt-3">Select your Goal</h2>
          <p className="text-xs sm:text-sm text-[#64748B] mt-1.5 max-w-lg">
            Choose your primary target exam to personalize your syllabus, diagnostic tests, and ranker notes.
          </p>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 sm:px-7 pb-2 flex-1">
          {/* Popular targets */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">
              Target Category
            </span>
            <span className="text-[11px] font-semibold text-emerald-600">
              Active: {selectedBatch || CATEGORY_LABELS[selectedCategory]}
            </span>
          </div>

          {/* 3 Categories: IIT-JEE, NEET, Foundation */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {TARGET_CATEGORIES.map((target) => {
              const isSelected = selectedCategory === target.id;
              return (
                <button
                  key={target.id}
                  onClick={() => handleSelectCategory(target.id)}
                  className={`relative text-left rounded-2xl p-4 border-2 transition-all ${
                    isSelected
                      ? 'bg-[#0F3B42] border-[#0F3B42] shadow-md'
                      : 'bg-white border-[#EAF3F1] hover:border-[#175A67]/20 hover:bg-[#EAF3F1]/30'
                  }`}
                >
                  {isSelected && (
                    <span className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-emerald-400 flex items-center justify-center">
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    </span>
                  )}
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${
                      isSelected ? 'bg-white/15 text-white' : 'bg-[#EAF3F1] text-[#175A67]'
                    }`}
                  >
                    <target.icon className="w-4.5 h-4.5" />
                  </div>
                  <p className={`font-semibold text-sm ${isSelected ? 'text-white' : 'text-[#0C2E35]'}`}>
                    {target.title}
                  </p>
                  <p className={`text-[11px] mt-0.5 ${isSelected ? 'text-white/70' : 'text-[#64748B]'}`}>
                    {target.subtitle}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Explore all streams */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-[#2A707C] uppercase tracking-wide">
              Explore All Streams
            </span>
            <span className="text-[11px] text-[#70787C] font-medium">
              Showing classes for {CATEGORY_LABELS[selectedCategory]}
            </span>
          </div>

          {/* Dynamic Stream / Class Tiles */}
          <div
            className={`grid gap-2.5 mb-3 ${
              selectedCategory === 'foundation'
                ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
                : 'grid-cols-1 sm:grid-cols-3'
            }`}
          >
            {currentStreams.map((stream) => {
              const isSelected = selectedStreamId === stream.id;
              return (
                <button
                  key={stream.id}
                  onClick={() => setSelectedStreamId(stream.id)}
                  className={`flex items-center justify-between gap-3 rounded-2xl p-3.5 border-2 transition-all text-left ${
                    isSelected
                      ? 'bg-[#EAF3F1] border-[#175A67] shadow-sm ring-2 ring-[#175A67]/20'
                      : 'bg-white border-[#EAF3F1] hover:bg-[#EAF3F1]/40 hover:border-[#175A67]/30'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${stream.iconStyle}`}
                    >
                      <stream.icon className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                      <p
                        className={`font-bold text-xs sm:text-sm truncate ${
                          isSelected ? 'text-[#175A67]' : 'text-[#0C2E35]'
                        }`}
                      >
                        {stream.title}
                      </p>
                      <p className="text-[11px] text-[#2A707C] font-medium truncate">
                        {stream.subtitle}
                      </p>
                    </div>
                  </div>
                  {isSelected ? (
                    <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[#2A707C]/40 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 sm:px-7 py-4 border-t border-[#EAF3F1] shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-[11px] text-[#2A707C]">
            <Info className="w-3.5 h-3.5 shrink-0" />
            You can switch your goal anytime from the top navigation.
          </p>
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <button
              onClick={onClose}
              className="text-sm font-bold text-[#2A707C] hover:text-[#175A67] px-2 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex items-center gap-2 bg-[#0F3B42] hover:bg-[#0b2c31] text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-sm transition-all active:scale-95"
            >
              Confirm &amp; Set Goal
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CohortGoalModal;
