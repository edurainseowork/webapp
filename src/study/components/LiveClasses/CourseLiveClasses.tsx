import { useEffect, useState } from 'react';
import { Lock, Radio } from 'lucide-react';
import { fetchCourseLiveClasses, liveStatus, useNow, type LiveClass } from '../../lib/liveClasses';
import { LiveClassCard } from './LiveClassCard';

/**
 * Live classes on the course page. Enrolled students see the classes with the Google Meet Join button;
 * everyone else sees a locked note (the server never sends them the link).
 */
export function CourseLiveClasses({ courseId, isEnrolled }: { courseId: number; isEnrolled: boolean }) {
  const [classes, setClasses] = useState<LiveClass[] | null>(null);
  const now = useNow();

  useEffect(() => {
    if (!isEnrolled) {
      setClasses(null);
      return;
    }
    let cancelled = false;
    const load = () =>
      fetchCourseLiveClasses(courseId)
        .then((list) => !cancelled && setClasses(list))
        .catch(() => !cancelled && setClasses((prev) => prev ?? []));
    void load();
    const id = setInterval(() => document.visibilityState === 'visible' && void load(), 120_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [courseId, isEnrolled]);

  if (!isEnrolled) {
    return (
      <div className="mt-6 flex items-start gap-3 bg-white rounded-2xl p-5 shadow-[0_6px_24px_rgb(0,0,0,0.04)]">
        <span className="w-10 h-10 rounded-xl bg-[#EAF3F1] text-[#175A67] flex items-center justify-center shrink-0">
          <Lock className="w-5 h-5" />
        </span>
        <div>
          <h3 className="text-base font-semibold">Live Classes</h3>
          <p className="text-xs text-slate-500 mt-1">
            Live classes run on Google Meet. Enroll in this course to get the joining link and a notification for every class.
          </p>
        </div>
      </div>
    );
  }

  const running = (classes ?? []).filter((c) => liveStatus(c, now) !== 'ended');

  return (
    <section className="mt-6" aria-label="Live classes">
      <div className="flex items-center gap-2 mb-3">
        <Radio className="w-4 h-4 text-[#175A67]" />
        <h3 className="text-base sm:text-lg font-semibold">Live Classes</h3>
        {running.some((c) => liveStatus(c, now) === 'live') && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">LIVE NOW</span>
        )}
      </div>
      {classes === null ? (
        <div className="bg-white rounded-2xl p-5 text-xs text-slate-500">Loading live classes…</div>
      ) : running.length === 0 ? (
        <div className="bg-white rounded-2xl p-5 text-xs text-slate-500">
          No live classes scheduled right now. You'll get a notification as soon as one is added.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {running.map((item) => (
            <LiveClassCard key={item.id} item={item} now={now} showCourse={false} />
          ))}
        </div>
      )}
    </section>
  );
}