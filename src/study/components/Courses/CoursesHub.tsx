import { useState } from 'react';
import { ENROLLED_COURSES, PlanId, getBatch } from './courseData';
import { CourseStoreView } from './CourseStoreView';
import { EnrolledCoursesView } from './EnrolledCoursesView';
import { CourseDetailView } from './CourseDetailView';

type HubView = 'catalog' | 'enrolled';

interface CoursesHubProps {
  /** "catalog" = sidebar COURSES (all courses), "enrolled" = home Library "Test Series" card */
  mode: HubView;
  selectedBatch: string;
  enrolledBatchIds: string[];
  onEnroll: (batchId: string, plan: PlanId) => void;
  onExit: () => void;
}

/**
 * Shared course screens:
 *  - catalog  → all courses (try before you enroll)
 *  - enrolled → "Your Enrolled Courses"
 *  - clicking any course or batch from either one → course detail page
 */
export function CoursesHub({ mode, selectedBatch, enrolledBatchIds, onEnroll, onExit }: CoursesHubProps) {
  const [view, setView] = useState<HubView>(mode);
  const [openBatchId, setOpenBatchId] = useState<string | null>(null);
  const [jumpToPlans, setJumpToPlans] = useState(false);

  const openBatch = (batchId: string, toPlans = false) => {
    setJumpToPlans(toPlans);
    setOpenBatchId(batchId);
  };

  const isEnrolledIn = (batchId: string) =>
    enrolledBatchIds.includes(batchId) || ENROLLED_COURSES.some((course) => course.batchId === batchId);

  if (openBatchId) {
    return (
      <CourseDetailView
        key={openBatchId}
        batch={getBatch(openBatchId)}
        isEnrolled={isEnrolledIn(openBatchId)}
        selectedBatch={selectedBatch}
        scrollToPlans={jumpToPlans}
        onBack={() => setOpenBatchId(null)}
        onExit={onExit}
        onEnroll={(plan) => onEnroll(openBatchId, plan)}
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
        enrolledBatchIds={enrolledBatchIds}
        // Opened from the courses page → back returns there; opened from home → back to home
        onBack={mode === 'catalog' ? () => setView('catalog') : onExit}
        onOpenBatch={(id) => openBatch(id)}
        onBuyBatch={(id) => openBatch(id, true)}
      />
    );
  }

  return <CourseStoreView onBack={onExit} onOpenBatch={(id) => openBatch(id)} onBuyBatch={(id) => openBatch(id, true)} />;
}

export default CoursesHub;
