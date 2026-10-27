import React, { useRef, useState } from 'react';
import {
  ArrowUpRight,
  Play,
  Clock3,
  BadgeCheck,
} from 'lucide-react';
import { useCatalog } from './courseData';
import { LiveBatchCatalog, Toast, useSearchShortcut, useToast } from './CourseShared';
import { SubPageHeader } from '../SubPageHeader';

interface CourseStoreViewProps {
  onBack: () => void;
  onOpenBatch: (batchId: string) => void;
  onBuyBatch: (batchId: string) => void;
  searchQuery?: string;
  /** Category key of the student's goal (its tab is always shown) */
  goalKey?: string | null;
  /** Selected category tab, owned by CoursesHub so it follows the student's goal */
  catalogFilter?: string;
  onCatalogFilterChange?: (filterId: string) => void;
}

export function CourseStoreView({
  onBack,
  onOpenBatch,
  onBuyBatch,
  searchQuery,
  goalKey,
  catalogFilter,
  onCatalogFilterChange,
}: CourseStoreViewProps) {
  const [query] = useState('');
  const [toast] = useToast();

  const searchRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const batchesRef = useRef<HTMLElement>(null);
  useSearchShortcut(searchRef);

  const { status, error, reload, batches, filters, isOwned } = useCatalog(goalKey);
  const q = (searchQuery ?? query).trim().toLowerCase();

  // Free courses (published as free in the CMS)
  const freeCourses = batches.filter((b) => b.price === 0);
  const demos = freeCourses.filter(
    (d) => !q || d.title.toLowerCase().includes(q) || d.category.toLowerCase().includes(q)
  );

  return (
    <div className="relative w-full rounded-[24px] overflow-hidden flex flex-col bg-[#DCEAE3] font-sans text-[#0B1C30] min-h-[calc(100vh-6rem)] shadow-sm">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-16 space-y-6 sm:space-y-8">
          {/* 1. Standardized Back Button */}
          <SubPageHeader onBack={onBack} />

          {/* Catalogue - Academic Batches & Crash Courses */}
          <section ref={batchesRef} className="scroll-mt-4">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-5">Academic Batches &amp; Crash Courses</h2>
            <LiveBatchCatalog
              status={status}
              error={error}
              onRetry={reload}
              batches={batches}
              filters={filters}
              showFilters
              activeFilter={catalogFilter}
              onFilterChange={onCatalogFilterChange}
              query={q}
              onOpenBatch={onOpenBatch}
              onBuyBatch={onBuyBatch}
              isOwned={isOwned}
            />
          </section>

          {/* Free courses (published as free in the CMS) */}
          {freeCourses.length > 0 && (
            <section className="scroll-mt-4">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-5">Experience The Classroom — Try Before You Buy</h2>
              {demos.length === 0 ? (
                <p className="text-sm text-slate-500 bg-white rounded-2xl p-6">No free courses match “{q}”.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {demos.map((demo) => (
                    <article key={demo.id} className="bg-white rounded-2xl overflow-hidden shadow-[0_6px_24px_rgb(0,0,0,0.05)]">
                      <button
                        onClick={() => onOpenBatch(demo.id)}
                        className="group relative block w-full h-[150px] bg-gradient-to-br from-[#10272C] to-[#071417] text-left overflow-hidden"
                      >
                        {demo.thumbnail && (
                          <img src={demo.thumbnail} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover opacity-60" onError={(e) => (e.currentTarget.style.display = 'none')} />
                        )}
                        <span className="absolute top-3 left-3 text-[9px] font-bold uppercase tracking-wide bg-amber-300 text-[#0B1C30] px-2 py-0.5 rounded">
                          No Payment Required
                        </span>
                        {demo.duration && (
                          <span className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-medium text-white/80">
                            <Clock3 className="w-3 h-3" />
                            {demo.duration}
                          </span>
                        )}
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="w-12 h-12 rounded-full bg-white/90 text-[#0B1C30] flex items-center justify-center shadow-lg transition-all opacity-90 sm:opacity-0 sm:group-hover:opacity-100 group-hover:scale-105">
                            <Play className="w-5 h-5 fill-current ml-0.5" />
                          </span>
                        </span>
                        <span className="absolute bottom-3 left-3 text-[10px] font-medium text-white/80">{demo.category}</span>
                      </button>
                      <div className="p-5">
                        <h3 className="font-semibold text-[15px]">{demo.title}</h3>
                        <p className="flex items-center gap-2 mt-3 bg-[#F8F1EC] rounded-lg px-3 py-2 text-[11px] text-slate-600">
                          <BadgeCheck className="w-3.5 h-3.5 text-[#175A67] shrink-0" />
                          {demo.features[0]?.text ?? 'Free full access'}
                        </p>
                        <button
                          onClick={() => onOpenBatch(demo.id)}
                          className="mt-4 w-full flex items-center justify-center gap-1.5 bg-[#0B1C20] hover:bg-[#15302F] text-white text-xs font-semibold py-2.5 rounded-lg transition-all active:scale-[0.98]"
                        >
                          {isOwned(demo.id) ? 'Enrolled — Continue' : 'Start Free Course'}
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      <Toast message={toast} />
    </div>
  );
}

export default CourseStoreView;