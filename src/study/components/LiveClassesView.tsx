import React, { useEffect, useState, useMemo } from 'react';
import {
  Radio,
  Clock,
  Video,
  Play,
  ShoppingBag,
  ChevronRight,
  ExternalLink,
  Users,
} from 'lucide-react';
import { SubPageHeader, type BreadcrumbCrumb } from './SubPageHeader';
import { useCatalog } from './Courses/courseData';
import { apiFetch } from '../lib/api';

export interface LiveClassItem {
  id: number;
  courseId: number;
  title: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  status: 'UPCOMING' | 'LIVE' | 'COMPLETED';
  meetingUrl?: string | null;
  courseTitle?: string;
}

interface LiveClassesViewProps {
  onBack: () => void;
  selectedBatch?: string;
  searchQuery?: string;
  onExploreCourses?: () => void;
}

export function LiveClassesView({
  onBack,
  selectedBatch,
  searchQuery = '',
  onExploreCourses,
}: LiveClassesViewProps) {
  const { ownedBatches, status: catalogStatus } = useCatalog();
  const hasActiveBatch = ownedBatches.length > 0;

  const [liveClasses, setLiveClasses] = useState<LiveClassItem[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  const crumbs: BreadcrumbCrumb[] = [
    { label: 'Home', onClick: onBack },
    { label: 'Library', onClick: onBack },
    { label: 'Your Live Class' },
  ];

  // Fetch live classes for all active enrolled courses
  useEffect(() => {
    if (!hasActiveBatch) {
      setLiveClasses([]);
      return;
    }

    let isMounted = true;
    async function loadLiveClasses() {
      setLoadingClasses(true);
      try {
        const results = await Promise.all(
          ownedBatches.map(async (batch) => {
            try {
              const res = await apiFetch<{ success: boolean; data: LiveClassItem[] }>(
                `/courses/${batch.courseId}/live-classes`
              );
              if (res?.data && Array.isArray(res.data)) {
                return res.data.map((item) => ({
                  ...item,
                  courseTitle: batch.title,
                }));
              }
              return [];
            } catch {
              return [];
            }
          })
        );

        if (isMounted) {
          const all = results.flat();
          // Filter out completed classes
          const activeOrUpcoming = all.filter((c) => c.status === 'LIVE' || c.status === 'UPCOMING');
          setLiveClasses(activeOrUpcoming);
        }
      } catch (err) {
        console.warn('Could not load live classes:', err);
      } finally {
        if (isMounted) setLoadingClasses(false);
      }
    }

    loadLiveClasses();
    return () => {
      isMounted = false;
    };
  }, [hasActiveBatch, ownedBatches]);

  const q = searchQuery.trim().toLowerCase();
  const filteredClasses = useMemo(() => {
    if (!q) return liveClasses;
    return liveClasses.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.courseTitle && c.courseTitle.toLowerCase().includes(q)) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [liveClasses, q]);

  const formatSchedule = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

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
              <div
                key={item.id}
                className="bg-white/80 backdrop-blur-md border border-white/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[11px] font-bold text-[#2A707C] uppercase tracking-wide truncate">
                      {item.courseTitle || 'Live Session'}
                    </span>
                    {item.status === 'LIVE' ? (
                      <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                        <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                        LIVE NOW
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        <Clock className="w-3 h-3" />
                        UPCOMING
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-[#0B1C30] text-base mb-1 line-clamp-2">
                    {item.title}
                  </h3>

                  {item.description && (
                    <p className="text-xs text-[#2A707C] line-clamp-2 mb-3">
                      {item.description}
                    </p>
                  )}

                  <div className="flex items-center gap-2 text-xs text-[#2A707C] mt-3">
                    <Clock className="w-3.5 h-3.5 text-[#175A67]" />
                    <span>Starts {formatSchedule(item.startTime)}</span>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  {item.meetingUrl ? (
                    <a
                      href={item.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 bg-[#0F3B42] hover:bg-[#0b2c31] text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Join Live Class</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <button
                      disabled
                      className="w-full flex items-center justify-center gap-2 bg-slate-200 text-slate-500 text-xs font-semibold py-2.5 px-4 rounded-xl cursor-not-allowed"
                    >
                      <span>Link Available at Start Time</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default LiveClassesView;
