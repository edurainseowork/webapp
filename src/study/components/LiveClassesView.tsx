import { useEffect, useState, useMemo } from 'react';
import { Radio, ShoppingBag, ChevronRight } from 'lucide-react';
import { SubPageHeader, type BreadcrumbCrumb } from './SubPageHeader';
import { useCatalog } from './Courses/courseData';
import { fetchMyLiveClasses, liveStatus, useNow, type LiveClass } from '../lib/liveClasses';
import { LiveClassCard } from './LiveClasses/LiveClassCard';

interface LiveClassesViewProps {
  onBack: () => void;
  selectedBatch?: string;
  searchQuery?: string;
  onExploreCourses?: () => void;
}

export function LiveClassesView({
  onBack,
  searchQuery = '',
  onExploreCourses,
}: LiveClassesViewProps) {
  const { ownedBatches, status: catalogStatus } = useCatalog();
  const hasActiveBatch = ownedBatches.length > 0;

  const [liveClasses, setLiveClasses] = useState<LiveClass[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const now = useNow();

  const crumbs: BreadcrumbCrumb[] = [
    { label: 'Home', onClick: onBack },
    { label: 'Library', onClick: onBack },
    { label: 'Your Live Class' },
  ];

  // Classes of every course the student is enrolled in (one call; the server checks the enrolment).
  // Reloaded every 2 minutes so classes added in the CMS show up without a page reload.
  const ownedKey = ownedBatches.map((b) => b.courseId).join(',');
  useEffect(() => {
    if (!hasActiveBatch) {
      setLiveClasses([]);
      return;
    }
    let cancelled = false;
    const load = (first: boolean) => {
      if (first) setLoadingClasses(true);
      fetchMyLiveClasses()
        .then((list) => !cancelled && setLiveClasses(list))
        .catch(() => undefined)
        .finally(() => !cancelled && first && setLoadingClasses(false));
    };
    load(true);
    const id = setInterval(() => document.visibilityState === 'visible' && load(false), 120_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [hasActiveBatch, ownedKey]);

  const q = searchQuery.trim().toLowerCase();
  const filteredClasses = useMemo(() => {
    const running = liveClasses.filter((c) => liveStatus(c, now) !== 'ended');
    if (!q) return running;
    return running.filter((c) => c.title.toLowerCase().includes(q) || (c.courseTitle ?? '').toLowerCase().includes(q));
  }, [liveClasses, q, now]);

  return (
    <div className="bg-[#DCEAE3] rounded-[28px] p-4 sm:p-6 lg:p-8 relative space-y-6 min-h-[calc(100vh-6rem)] flex flex-col justify-between">
      <div className="space-y-6">
        {/* 1. Header with Breadcrumbs */}
        <SubPageHeader onBack={onBack} crumbs={crumbs} />

        {/* 2. Top Title Banner (No Under Development badge) */}
        <div className="bg-white/70 backdrop-blur-md border border-white/80 p-5 sm:p-6 rounded-[24px] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#175A67] text-white flex items-center justify-center shadow-md shrink-0">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#0B1C30]">Your Live Class</h1>
              <p className="text-xs sm:text-sm text-[#2A707C] mt-0.5 font-medium">
                Live interactive streaming and educator sessions.
              </p>
            </div>
          </div>
          {hasActiveBatch && (
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#175A67]/10 text-[#175A67] self-start sm:self-auto">
              {ownedBatches.length} Active {ownedBatches.length === 1 ? 'Batch' : 'Batches'}
            </span>
          )}
        </div>

        {/* 3. Main Content Area */}
        {catalogStatus === 'loading' || loadingClasses ? (
          <div className="bg-white/70 backdrop-blur-md border border-white/80 rounded-[24px] p-12 text-center shadow-sm flex flex-col items-center justify-center max-w-xl mx-auto my-8">
            <div className="w-10 h-10 border-3 border-[#175A67] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs sm:text-sm text-[#2A707C] font-medium">Loading live classes…</p>
          </div>
        ) : !hasActiveBatch ? (
          /* User has NO active batches: "Buy a batch first" */
          <div className="bg-white/70 backdrop-blur-md border border-white/80 rounded-[24px] p-8 sm:p-14 text-center shadow-sm flex flex-col items-center justify-center max-w-xl mx-auto my-8">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200/60 flex items-center justify-center mb-4 shadow-sm">
              <ShoppingBag className="w-8 h-8 text-[#175A67]" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#0B1C30] tracking-tight">
              Buy a batch first
            </h2>
            <p className="text-xs sm:text-sm text-[#2A707C] mt-2 max-w-sm font-medium">
              You need an active batch or enrolled course to attend live educator classes.
            </p>
            {onExploreCourses && (
              <button
                onClick={onExploreCourses}
                className="mt-6 flex items-center gap-2 bg-[#0F3B42] hover:bg-[#0b2c31] text-white font-bold text-xs sm:text-sm px-6 py-2.5 rounded-full shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <span>Explore Courses</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : filteredClasses.length === 0 ? (
          /* User has active batch, but no classes currently live: "No live classes going on" */
          <div className="bg-white/70 backdrop-blur-md border border-white/80 rounded-[24px] p-8 sm:p-14 text-center shadow-sm flex flex-col items-center justify-center max-w-xl mx-auto my-8">
            <div className="w-16 h-16 rounded-2xl bg-[#EAF3F1] text-[#175A67] flex items-center justify-center mb-4 shadow-sm">
              <Radio className="w-8 h-8 opacity-60" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#0B1C30] tracking-tight">
              No live classes going on
            </h2>
            <p className="text-xs sm:text-sm text-[#2A707C] mt-2 max-w-sm font-medium">
              Live sessions scheduled from the educator portal will appear here automatically.
            </p>
          </div>
        ) : (
          /* Live classes sent from CMS Portal render here */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredClasses.map((item) => (
              <LiveClassCard key={item.id} item={item} now={now} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default LiveClassesView;