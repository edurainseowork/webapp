import { useEffect, useState } from 'react';
import { categoryKey, useCatalog } from './courseData';
import { CourseStoreView } from './CourseStoreView';
import { EnrolledCoursesView } from './EnrolledCoursesView';
import { CourseDetailView } from './CourseDetailView';
import { CatalogError, CatalogSkeleton } from './CourseShared';
import { SubPageHeader } from '../SubPageHeader';

type HubView = 'catalog' | 'enrolled';

interface CoursesHubProps {
  /** "catalog" = sidebar COURSES (all courses), "enrolled" = home Library "Test Series" card */
  mode: HubView;
  selectedBatch: string;
  searchQuery?: string;
  /** CMS category id of the student's goal: its tab is selected when the courses open */
  goalCategoryId?: number | null;
  onExit: () => void;
}

/**
 * Shared course screens (all data from the admin CMS):
 *  - catalog  → all published courses
 *  - enrolled → "Your Enrolled Courses"
 *  - clicking any course from either one → course detail page
 */
export function CoursesHub({ mode, selectedBatch, searchQuery, goalCategoryId, onExit }: CoursesHubProps) {
  const [view, setView] = useState<HubView>(mode);
  const [openBatchId, setOpenBatchId] = useState<string | null>(null);
  const [jumpToPlans, setJumpToPlans] = useState(false);
  const goalKey = goalCategoryId ? categoryKey(goalCategoryId) : null;
  // Category tab: starts on the student's goal and follows it when the goal changes;
  // the student can still switch tabs (e.g. "All Courses") while browsing
  const [catalogFilter, setCatalogFilter] = useState(goalKey ?? 'all');
  useEffect(() => setCatalogFilter(goalKey ?? 'all'), [goalKey]);
  const catalog = useCatalog(goalKey);
  const tabProps = { goalKey, catalogFilter, onCatalogFilterChange: setCatalogFilter };

  const openBatch = (batchId: string, toPlans = false) => {
    setJumpToPlans(toPlans);
    setOpenBatchId(batchId);
  };

  if (openBatchId) {
    const batch = catalog.getBatch(openBatchId);
    if (!batch) return <MissingCourse status={catalog.status} error={catalog.error} onRetry={catalog.reload} onBack={() => setOpenBatchId(null)} />;
    return (
      <CourseDetailView
        key={openBatchId}
        batch={batch}
        isEnrolled={catalog.isOwned(openBatchId)}
        selectedBatch={selectedBatch}
        scrollToPlans={jumpToPlans}
        onBack={() => setOpenBatchId(null)}
        onExit={onExit}
        onGoToMyCourses={() => {
          setOpenBatchId(null);
          setView('enrolled');
        }}
      />
    );
  }

  if (view === 'enrolled') {
    return (
      <EnrolledCoursesView
        selectedBatch={selectedBatch}
        // Opened from the courses page → back returns there; opened from home → back to home
        onBack={mode === 'catalog' ? () => setView('catalog') : onExit}
        onOpenBatch={(id) => openBatch(id)}
        onBuyBatch={(id) => openBatch(id, true)}
        {...tabProps}
      />
    );
  }

  return (
    <CourseStoreView
      searchQuery={searchQuery}
      onBack={onExit}
      onOpenBatch={(id) => openBatch(id)}
      onBuyBatch={(id) => openBatch(id, true)}
      {...tabProps}
    />
  );
}

/** Shown when an opened course is still loading, failed to load, or was unpublished by an admin. */
export function MissingCourse({
  status,
  error,
  onRetry,
  onBack,
}: {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <div className="relative w-full rounded-[24px] overflow-hidden bg-[#DCEAE3] font-sans text-[#0B1C30] min-h-[calc(100vh-6rem)] shadow-sm">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <SubPageHeader onBack={onBack} />
        {status === 'loading' ? (
          <CatalogSkeleton count={1} />
        ) : status === 'error' ? (
          <CatalogError message={error} onRetry={onRetry} />
        ) : (
          <div className="bg-white rounded-2xl py-12 px-6 flex flex-col items-center text-center">
            <p className="font-semibold">This course is no longer available</p>
            <p className="text-xs text-slate-500 mt-1">It may have been unpublished. Browse the other courses instead.</p>
            <button onClick={onBack} className="mt-4 bg-[#0B1C20] hover:bg-[#15302F] text-white text-xs font-semibold px-4 py-2 rounded-full">
              Back to courses
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default CoursesHub;