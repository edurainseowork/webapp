import { Clock, ExternalLink, Lock, Play } from 'lucide-react';
import { canJoin, formatClassTime, liveStatus, startsIn, type LiveClass } from '../../lib/liveClasses';

/** One live class: LIVE NOW / UPCOMING badge, time, and a Join button that opens Google Meet 15 min before start. */
export function LiveClassCard({ item, now, showCourse = true }: { item: LiveClass; now: number; showCourse?: boolean }) {
  const status = liveStatus(item, now);
  const joinable = canJoin(item, now) && Boolean(item.meetUrl);
  const countdown = startsIn(item, now);

  return (
    <div className="bg-white/80 backdrop-blur-md border border-white/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-[11px] font-bold text-[#2A707C] uppercase tracking-wide truncate">
            {showCourse ? item.courseTitle || 'Live Session' : 'Live Session'}
          </span>
          {status === 'live' ? (
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 shrink-0">
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex w-full h-full rounded-full bg-rose-500 opacity-75 animate-ping" />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-rose-600" />
              </span>
              LIVE NOW
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
              <Clock className="w-3 h-3" />
              UPCOMING
            </span>
          )}
        </div>

        <h3 className="font-bold text-[#0B1C30] text-base mb-1 line-clamp-2 [overflow-wrap:anywhere]">{item.title}</h3>

        <div className="flex items-center gap-2 text-xs text-[#2A707C] mt-3">
          <Clock className="w-3.5 h-3.5 text-[#175A67] shrink-0" />
          <span>{formatClassTime(item, new Date(now))}</span>
        </div>
        {status === 'upcoming' && countdown && <p className="text-[11px] font-semibold text-amber-700 mt-1.5">{countdown}</p>}
      </div>

      <div className="mt-5 pt-3 border-t border-slate-100">
        {joinable ? (
          <a
            href={item.meetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-[#0F3B42] hover:bg-[#0b2c31] text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Join on Google Meet</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        ) : (
          <button
            disabled
            className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-500 text-xs font-semibold py-2.5 px-4 rounded-xl cursor-not-allowed"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Join opens 15 min before start</span>
          </button>
        )}
      </div>
    </div>
  );
}