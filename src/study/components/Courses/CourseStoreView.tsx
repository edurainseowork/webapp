import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Play,
  Clock3,
  BadgeCheck,
  Target,
  ChevronRight,
} from 'lucide-react';
import { useCatalog } from './courseData';
import { LiveBatchCatalog, Toast, useSearchShortcut, useToast } from './CourseShared';
import { SubPageHeader } from '../SubPageHeader';

interface CourseStoreViewProps {
  onBack: () => void;
  onOpenBatch: (batchId: string) => void;
  onBuyBatch: (batchId: string) => void;
  searchQuery?: string;
  /** Category id of the student's selected cohort */
  goalCategoryId?: number | null;
  /** Name of the student's selected cohort (e.g. "JEE", "NEET") */
  goalName?: string | null;
  /** Allows the student to switch their cohort directly */
  onChangeGoal?: () => void;
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
  goalCategoryId,
  goalName,
  onChangeGoal,
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

  const { status, error, reload, batches, filters } = useCatalog(goalKey);
  const q = (searchQuery ?? query).trim().toLowerCase();

  // Filter courses strictly by the selected cohort
  const hasSelectedCohort = Boolean(goalCategoryId || goalKey);
  const cohortBatches = useMemo(() => {
    if (!hasSelectedCohort) return [];
    return batches.filter((b) => {
      if (goalCategoryId && b.categoryId === goalCategoryId) return true;
      if (goalKey && b.categories.includes(goalKey)) return true;
      return false;
    });
  }, [batches, goalCategoryId, goalKey, hasSelectedCohort]);

  // Free courses (published as free in the CMS within the selected cohort)
  const freeCourses = useMemo(() => cohortBatches.filter((b) => b.price === 0), [cohortBatches]);
  const demos = useMemo(
    () => freeCourses.filter((d) => !q || d.title.toLowerCase().includes(q) || d.category.toLowerCase().includes(q)),
    [freeCourses, q]
  );

  return (
    <div className="relative w-full rounded-[24px] overflow-hidden flex flex-col bg-[#DCEAE3] font-sans text-[#0B1C30] min-h-[calc(100vh-6rem)] shadow-sm">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-16 space-y-6 sm:space-y-8">
          {/* 1. Standardized Back Button */}
          <SubPageHeader onBack={onBack} />

          {/* 2. Cohort Status & Switcher Banner */}
          {hasSelectedCohort ? (
            <div className="bg-white/70 backdrop-blur-md border border-white/80 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[#175A67] text-white flex items-center justify-center shadow-sm shrink-0">
                  <Target className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#2A707C]">Selected Cohort</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Active
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-[#0B1C30] mt-0.5">
                    {goalName ?? 'Your Target Exam'}
                    <span className="text-xs font-normal text-[#2A707C] ml-2">
                      ({cohortBatches.length} {cohortBatches.length === 1 ? 'course' : 'courses'})
                    </span>
                  </h3>
                </div>
              </div>
              {onChangeGoal && (
                <button
                  onClick={onChangeGoal}
                  className="self-start sm:self-auto text-xs font-semibold px-4 py-2 rounded-full bg-[#175A67]/10 hover:bg-[#175A67]/20 text-[#175A67] transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
                >
                  <span>Switch Cohort</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white/80 backdrop-blur-md border border-white/80 rounded-2xl p-6 sm:p-8 text-center shadow-sm flex flex-col items-center max-w-xl mx-auto my-6">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center mb-4 shadow-sm">
                <Target className="w-7 h-7 text-[#175A67]" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-[#0B1C30]">Select Your Cohort to View Courses</h2>
              <p className="text-xs sm:text-sm text-[#2A707C] mt-1.5 max-w-md">
                Choose your target exam (JEE, NEET, Foundation, etc.) to see all academic batches, lectures, and test materials tailored for you.
              </p>
              {onChangeGoal && (
                <button
                  onClick={onChangeGoal}
                  className="mt-5 flex items-center gap-2 bg-[#0F3B42] hover:bg-[#0b2c31] text-white font-bold text-xs sm:text-sm px-6 py-2.5 rounded-full shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <Target className="w-4 h-4 text-amber-300" />
                  <span>Choose Your Cohort</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* 3. Catalogue - Academic Batches & Crash Courses (Shown only when cohort is selected) */}
          {hasSelectedCohort && (
            <section ref={batchesRef} className="scroll-mt-4">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-5">
                Academic Batches &amp; Crash Courses
              </h2>
              <LiveBatchCatalog
                status={status}
                error={error}
                onRetry={reload}
                batches={cohortBatches}
                filters={filters}
                showFilters={false}
                activeFilter={catalogFilter}
                onFilterChange={onCatalogFilterChange}
                query={q}
                onOpenBatch={onOpenBatch}
                onBuyBatch={onBuyBatch}
              />
            </section>
          )}

          {/* 4. Free courses (published as free in the CMS for this cohort) */}
          {hasSelectedCohort && freeCourses.length > 0 && (
            <section className="scroll-mt-4">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-5">
                Experience The Classroom — Try Before You Buy
              </h2>
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
                          <img
                            src={demo.thumbnail}
                            alt=""
                            loading="lazy"
                            className="absolute inset-0 w-full h-full object-cover opacity-60"
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                          />
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
                          Start Free Course
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