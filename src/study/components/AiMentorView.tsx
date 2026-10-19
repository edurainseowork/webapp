import React, { useMemo, useState } from 'react';
import {
  HelpCircle,
  Search,
  Sparkles,
  Paperclip,
  ArrowUp,
} from 'lucide-react';
import { SubPageHeader } from './SubPageHeader';

/* ------------------------------------------------------------------ */
/*  Types & mock data                                                  */
/* ------------------------------------------------------------------ */

interface RecentDoubt {
  id: string;
  text: string;
  score: string;
}

const RECENT_DOUBTS: RecentDoubt[] = [
  { id: 'd1', text: 'What is the value of pie', score: '9/10' },
  { id: 'd2', text: 'what is the value of 456 k', score: '10/10' },
  { id: 'd3', text: 'What is the value of g', score: '8.5/10' },
];

interface AiMentorViewProps {
  userName: string;
  onBack: () => void;
}

/* ------------------------------------------------------------------ */
/*  Main view                                                           */
/* ------------------------------------------------------------------ */

export function AiMentorView({ userName, onBack }: AiMentorViewProps) {
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [activeDoubtId, setActiveDoubtId] = useState<string>(RECENT_DOUBTS[0].id);
  const [draft, setDraft] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const filteredDoubts = useMemo(() => {
    if (!sidebarSearch.trim()) return RECENT_DOUBTS;
    const q = sidebarSearch.toLowerCase();
    return RECENT_DOUBTS.filter((d) => d.text.toLowerCase().includes(q));
  }, [sidebarSearch]);

  const flashStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 2200);
  };

  const handleAskNewDoubt = () => {
    setActiveDoubtId('');
    setDraft('');
    flashStatus('Fresh doubt session started.');
  };

  const handleSend = () => {
    if (!draft.trim()) return;
    flashStatus('Analyzing your doubt with EduAI…');
    setDraft('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-4 pb-6 animate-fadeIn">
      {/* 1. Standardized Back Button + Breadcrumb */}
      <SubPageHeader
        onBack={onBack}
        crumbs={[
          { label: 'Home', onClick: onBack },
          { label: 'Features', onClick: onBack },
          { label: 'EduAI' },
        ]}
      />

      {/* Main Interface Layout */}
      <div className="relative w-full rounded-[24px] overflow-hidden flex bg-[#DCEAE3] font-sans min-h-[calc(100vh-10rem)] shadow-sm border border-emerald-900/10">
        {/* ---------------------------------------------------------- */}
        {/* Left Sidebar                                                */}
        {/* ---------------------------------------------------------- */}
        <aside className="w-[240px] shrink-0 bg-[#06120e] text-slate-200 flex flex-col p-3 gap-4 overflow-y-auto no-scrollbar">
          {/* Ask New Doubt */}
          <button
            onClick={handleAskNewDoubt}
            className="w-full flex items-center justify-between gap-2 bg-[#101f19] hover:bg-[#152a22] border border-emerald-500/20 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white transition-all active:scale-95"
          >
            <span className="flex items-center gap-2">
              <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
              Ask New Doubt
            </span>
            <span className="text-[10px] font-mono text-slate-400 bg-black/30 px-1.5 py-0.5 rounded">⌘K</span>
          </button>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              placeholder="Search past doubts..."
              className="w-full pl-8 pr-3 py-2 rounded-lg bg-[#0b1a14] border border-emerald-500/10 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-400/40"
            />
          </div>

          {/* Recent Doubts */}
          <div>
            <div className="flex items-center justify-between px-1 mb-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Recent Doubts</span>
              <span className="text-[10px] font-semibold text-slate-500">Today</span>
            </div>

            <div className="space-y-1">
              {filteredDoubts.map((doubt) => {
                const isActive = doubt.id === activeDoubtId;
                return (
                  <button
                    key={doubt.id}
                    onClick={() => setActiveDoubtId(doubt.id)}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition-all ${
                      isActive
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 font-semibold'
                        : 'text-slate-300 hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <span className="truncate">{doubt.text}</span>
                    <span
                      className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        isActive ? 'bg-emerald-500/25 text-emerald-200' : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      {doubt.score}
                    </span>
                  </button>
                );
              })}
              {filteredDoubts.length === 0 && (
                <p className="text-[11px] text-slate-500 px-2.5 py-2">No matching doubts.</p>
              )}
            </div>
          </div>
        </aside>

        {/* ---------------------------------------------------------- */}
        {/* Main Area                                                    */}
        {/* ---------------------------------------------------------- */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Center content */}
          <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 gap-6 overflow-y-auto">
            <span className="flex items-center gap-1.5 bg-white rounded-full px-2 py-1 shadow-sm">
              <span className="w-4 h-4 rounded-full bg-amber-400" />
            </span>

            <div className="text-center max-w-xl">
              <h1 className="text-3xl sm:text-4xl font-black text-[#0B1C30] tracking-tight">
                Welcome to EduAI
              </h1>
              <p className="text-sm sm:text-base font-semibold text-[#175A67] mt-2">
                What conceptual doubt or question are we analyzing today?
              </p>
            </div>

            {statusMessage && (
              <div className="bg-white text-[#175A67] text-xs font-semibold px-4 py-2 rounded-full shadow-sm animate-fadeIn">
                {statusMessage}
              </div>
            )}
          </div>

          {/* Bottom input bar */}
          <div className="shrink-0 px-4 sm:px-6 pb-5 sm:pb-6 pt-2">
            <div className="max-w-2xl mx-auto flex items-center gap-2.5 bg-[#0b1a14] rounded-full pl-4 pr-2 py-2 shadow-lg">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask EduAI anything or paste code solution..."
                className="flex-1 min-w-0 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
              />
              <button
                onClick={() => flashStatus('Attach a file to your doubt.')}
                className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors shrink-0"
                title="Attach file"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                onClick={handleSend}
                disabled={!draft.trim()}
                className="w-8 h-8 rounded-full bg-white text-[#0b1a14] flex items-center justify-center shrink-0 disabled:opacity-40 hover:bg-slate-100 transition-all active:scale-95"
                title="Send"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AiMentorView;
