import React, { useState } from 'react';
import { Swords, Trophy, Zap, Flame, Crown, Users, Award, Play, ArrowLeft } from 'lucide-react';
import confetti from 'canvas-confetti';
import { SubPageHeader } from './SubPageHeader';

interface ArenaViewProps {
  onBack: () => void;
  onOpenUpgrade: () => void;
}

export const ArenaView: React.FC<ArenaViewProps> = ({ onBack, onOpenUpgrade }) => {
  const [inMatchmaking, setInMatchmaking] = useState(false);

  const startMatch = () => {
    setInMatchmaking(true);
    setTimeout(() => {
      setInMatchmaking(false);
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#F59E0B', '#10B981', '#175A67']
      });
      alert('Opponent Found: Arjun R. (AIR #38). Live 60-second Speed Duel Starting!');
    }, 1800);
  };

  const topRankers = [
    { rank: 1, name: 'Siddharth M.', points: '4,920 XP', streak: '28 Days', college: 'IIT Bombay Target' },
    { rank: 2, name: 'Ananya Verma', points: '4,650 XP', streak: '24 Days', college: 'IIT Delhi Target' },
    { rank: 3, name: 'Rohan Gupta', points: '4,310 XP', streak: '19 Days', college: 'IIT Madras Target' },
    { rank: 42, name: 'ABHINAV (You)', points: '2,840 XP', streak: '14 Days', college: 'IIT Kharagpur Target', isYou: true },
  ];

  return (
    <div className="space-y-6 pb-20 animate-fadeIn">
      {/* 1. Standardized Back Button + Breadcrumb */}
      <SubPageHeader
        onBack={onBack}
        crumbs={[
          { label: 'Home', onClick: onBack },
          { label: 'Arena' },
        ]}
      />

      {/* Banner */}
      <div className="rounded-2xl bg-white/60 backdrop-blur-md border border-white/80 p-5 sm:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.05)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#10B981]/15 border border-[#10B981]/30 text-[#059669] text-[10px] font-black animate-pulse flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                  LIVE SPEED DUEL
                </span>
                <span className="text-xs text-[#2A707C] font-bold">1,240 Online Warriors</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#175A67]">The EduRain Arena</h1>
              <p className="text-xs sm:text-sm text-[#2A707C] max-w-xl font-medium">
                Real-time 1v1 speed duels on IIT-JEE Advanced questions. Climb the national leaderboard and unlock Pro badges.
              </p>
            </div>
          </div>

          <button
            onClick={startMatch}
            disabled={inMatchmaking}
            className="px-6 py-3 rounded-xl bg-[#175A67] hover:bg-[#124853] text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95 self-start lg:self-auto"
          >
            {inMatchmaking ? (
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4 animate-spin text-amber-300" />
                Matching Opponent...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Swords className="w-4 h-4 text-amber-300" />
                Find Live 1v1 Duel
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Leaderboard & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Leaderboard (2 cols) */}
        <div className="lg:col-span-2 rounded-2xl bg-white/60 backdrop-blur-md border border-white/80 p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.05)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-[#175A67] text-base">National Speed Duel Leaderboard</h3>
            </div>
            <span className="text-xs text-[#2A707C] font-semibold">Weekly Cycle</span>
          </div>

          <div className="space-y-2">
            {topRankers.map((ranker) => (
              <div
                key={ranker.rank}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  ranker.isYou
                    ? 'bg-[#175A67]/15 border-[#175A67]/35 shadow-sm'
                    : 'bg-white/60 border-slate-200/60 hover:bg-white/90 backdrop-blur-sm'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${
                    ranker.rank === 1 ? 'bg-amber-400 text-slate-900 shadow-sm' :
                    ranker.rank === 2 ? 'bg-slate-300 text-slate-800' :
                    ranker.rank === 3 ? 'bg-amber-700 text-white' :
                    'bg-[#175A67] text-white'
                  }`}>
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

        {/* Right: Personal Rank Status */}
        <div className="rounded-2xl bg-white/60 backdrop-blur-md border border-white/80 p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.05)] flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-5 h-5 text-[#175A67]" />
              <h3 className="font-bold text-[#175A67] text-base">Your Combat Stats</h3>
            </div>

            <div className="space-y-3 mt-4">
              <div className="p-3 rounded-xl bg-white/60 border border-slate-200/60 backdrop-blur-sm flex justify-between items-center">
                <span className="text-xs text-[#2A707C] font-semibold">Duel Win Rate</span>
                <span className="text-sm font-bold text-[#10B981]">76.4% (38/50)</span>
              </div>
              <div className="p-3 rounded-xl bg-white/60 border border-slate-200/60 backdrop-blur-sm flex justify-between items-center">
                <span className="text-xs text-[#2A707C] font-semibold">Avg Answer Speed</span>
                <span className="text-sm font-bold text-[#175A67]">14.2 seconds</span>
              </div>
              <div className="p-3 rounded-xl bg-white/60 border border-slate-200/60 backdrop-blur-sm flex justify-between items-center">
                <span className="text-xs text-[#2A707C] font-semibold">Current Division</span>
                <span className="text-sm font-bold text-[#175A67]">Diamond III</span>
              </div>
            </div>
          </div>

          <button
            onClick={onOpenUpgrade}
            className="mt-6 w-full py-2.5 rounded-xl bg-[#175A67] hover:bg-[#124853] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
          >
            <span>Unlock Pro Tournaments</span>
          </button>
        </div>
      </div>
    </div>
  );
};
