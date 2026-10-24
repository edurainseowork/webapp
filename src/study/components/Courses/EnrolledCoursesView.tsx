import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Star, Users, PlayCircle, Play } from 'lucide-react';
import { Batch, toEnrolledCourse, useCatalog } from './courseData';
import {
  CatalogEmpty,
  CatalogError,
  CatalogSkeleton,
  LiveBatchCatalog,
  discountPct,
  formatINR,
} from './CourseShared';
import { SubPageHeader, BreadcrumbCrumb } from '../SubPageHeader';

/* ------------------------------------------------------------------ */
/*  Hero promos — the best CMS offers the student doesn't own yet       */
/* ------------------------------------------------------------------ */

const MAX_PROMOS = 3;
const PROMO_INTERVAL_MS = 6000;

const pickPromos = (batches: Batch[], isOwned: (id: string) => boolean): Batch[] =>
  batches
    .filter((b) => !isOwned(b.id) && b.price > 0)
    .sort((a, b) => discountPct(b.price, b.mrp) - discountPct(a.price, a.mrp))
    .slice(0, MAX_PROMOS);

/* ------------------------------------------------------------------ */
/*  Main view                                                           */
/* ------------------------------------------------------------------ */
interface EnrolledCoursesViewProps {
  selectedBatch: string;
  onBack: () => void;
  onOpenBatch: (batchId: string) => void;
  onBuyBatch: (batchId: string) => void;
  crumbs?: BreadcrumbCrumb[];
  goalKey?: string | null;
  catalogFilter?: string;
  onCatalogFilterChange?: (filterId: string) => void;
}

export function EnrolledCoursesView({
  onBack,
  onOpenBatch,
  onBuyBatch,
  crumbs,
  goalKey,
  catalogFilter,
  onCatalogFilterChange,
}: EnrolledCoursesViewProps) {
  const [query] = useState('');
  const [promoIndex, setPromoIndex] = useState(0);
  const catalogRef = useRef<HTMLElement>(null);

  const { status, error, reload, batches, filters, ownedBatches, isOwned } = useCatalog(goalKey);
  const promos = pickPromos(batches, isOwned);

  // Rotate the hero promo; restarts whenever the student picks a slide
  useEffect(() => {
    if (promos.length < 2) return;
    const timer = setTimeout(() => setPromoIndex((i) => (i + 1) % promos.length), PROMO_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [promoIndex, promos.length]);

  const promoBatch: Batch | undefined = promos[promoIndex % Math.max(promos.length, 1)];
  const promoOff = promoBatch ? discountPct(promoBatch.price, promoBatch.mrp) : 0;

  // The student's courses, straight from the backend (GET /razorpay/my-courses)
  const allCourses = ownedBatches.map(toEnrolledCourse);
  const q = query.trim().toLowerCase();
  const courses = allCourses.filter(
    (c) => !q || c.title.toLowerCase().includes(q) || c.batchLabel.toLowerCase().includes(q)
  );

  return (
    <div className="relative w-full rounded-[24px] overflow-hidden flex flex-col bg-[#DCEAE3] font-sans text-[#0B1C30] min-h-[calc(100vh-6rem)] shadow-sm">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-16 space-y-6 sm:space-y-8">
          {/* 1. Standardized Back Button + Breadcrumb */}
          <SubPageHeader
            onBack={onBack}
            crumbs={
              crumbs || [
                { label: 'Home', onClick: onBack },
                { label: 'My Purchases', onClick: onBack },
                { label: 'Your Enrolled Courses' },
              ]
            }
          />

          {/* Hero promo carousel */}
          {promoBatch && (
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F3B42] via-[#0D3238] to-[#0A2329] text-white p-6 sm:p-8 shadow-[0_12px_40px_rgba(15,59,66,0.25)]">
              <div className="absolute -top-24 -left-10 w-[380px] h-[380px] rounded-full bg-teal-300/10 blur-[100px] pointer-events-none" />
              <div key={promoBatch.id} className="relative grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-center animate-fadeIn">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide bg-amber-200 text-[#5B3A00] px-3 py-1 rounded-full">
                      <Star className="w-3 h-3 fill-current" />
                      {promoOff > 0 ? `${promoBatch.category} • ${promoOff}% OFF` : promoBatch.category}
                    </span>
                  </div>

                  <h1 className="text-2xl sm:text-4xl font-bold tracking-tight mt-4 leading-tight">{promoBatch.title}</h1>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-5">
                    {promoBatch.features.slice(0, 3).map((h) => (
                      <span key={h.text} className="flex items-center gap-2 text-xs text-white/85 bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2">
                        <h.icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{h.text}</span>
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mt-6">
                    <button
                      onClick={() => onOpenBatch(promoBatch.id)}
                      className="flex items-center gap-2 bg-[#FAD9B5] hover:bg-[#F7CC9C] text-[#0B1C30] text-sm font-semibold px-5 py-3 rounded-xl transition-all active:scale-95"
                    >
                      Explore Course &amp; Enroll
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onBuyBatch(promoBatch.id)}
                      className="flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/15 text-sm font-semibold px-4 py-3 rounded-xl transition-all"
                    >
                      <PlayCircle className="w-4 h-4" />
                      View Price
                    </button>
                  </div>
                </div>

                <div>
                  <div className="rounded-2xl bg-white/[0.07] border border-white/15 overflow-hidden backdrop-blur-sm">
                    {promoBatch.thumbnail && (
                      <img src={promoBatch.thumbnail} alt="" className="w-full h-36 object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    )}
                    <div className="p-5">
                      {promoBatch.studentsEnrolled ? (
                        <p className="flex items-center gap-1.5 text-[11px] text-white/70">
                          <Users className="w-3.5 h-3.5" />
                          {promoBatch.studentsEnrolled.toLocaleString('en-IN')}+ students enrolled
                        </p>
                      ) : null}
                      <div className="flex items-center justify-between gap-2 mt-3">
                        <p className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold">{formatINR(promoBatch.price)}</span>
                          {promoBatch.mrp > promoBatch.price && <span className="text-xs text-white/40 line-through">{formatINR(promoBatch.mrp)}</span>}
                        </p>
                        {promoBatch.mrp > promoBatch.price && (
                          <span className="text-[10px] font-bold bg-white/10 border border-white/15 px-2 py-1 rounded-md">
                            SAVE {formatINR(promoBatch.mrp - promoBatch.price)}
                          </span>
                        )}
                      </div>
                      {promoBatch.description && <p className="text-xs text-white/60 mt-2 leading-relaxed line-clamp-2">{promoBatch.description}</p>}
                    </div>
                  </div>

                  {promos.length > 1 && (
                    <div className="flex justify-center gap-1.5 mt-4">
                      {promos.map((p, i) => (
                        <button
                          key={p.id}
                          onClick={() => setPromoIndex(i)}
                          title={`Show offer ${i + 1}`}
                          className={`h-1.5 rounded-full transition-all ${i === promoIndex % promos.length ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60'}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Enrolled courses */}
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-3">
                <button
                  onClick={onBack}
                  title="Back to Dashboard"
                  className="w-8 h-8 rounded-full bg-[#F1E6DD] hover:bg-[#E9DACD] flex items-center justify-center transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Your Enrolled Courses</h2>
                <span className="text-[10px] font-bold bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">
                  {allCourses.length} ACTIVE
                </span>
              </div>
              <button
                onClick={() => catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="flex items-center gap-1.5 bg-[#F6EFE9] hover:bg-[#EEE2D8] text-xs font-semibold px-4 py-2 rounded-full transition-colors"
              >
                Explore All Courses
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {status === 'loading' && allCourses.length === 0 ? (
              <CatalogSkeleton />
            ) : status === 'error' && allCourses.length === 0 ? (
              <CatalogError message={error} onRetry={reload} />
            ) : allCourses.length === 0 ? (
              <CatalogEmpty title="You haven't enrolled in a course yet" hint="Pick a course below to get started." />
            ) : courses.length === 0 ? (
              <p className="text-sm text-slate-500 bg-white rounded-2xl p-6">None of your courses match “{query.trim()}”.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {courses.map((course) => {
                  // Lesson progress isn't tracked by the backend yet
                  const justEnrolled = course.progress === 0;
                  return (
                    <article
                      key={course.id}
                      onClick={() => onOpenBatch(course.batchId)}
                      className="bg-white rounded-2xl p-5 flex flex-col shadow-[0_6px_24px_rgb(0,0,0,0.05)] hover:shadow-[0_14px_36px_rgb(0,0,0,0.10)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold bg-[#F6EFE9] px-2 py-0.5 rounded">{course.batchLabel}</span>
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-[#175A67]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#175A67]" />
                          {justEnrolled ? 'Just Enrolled' : `${course.progress}% Completed`}
                        </span>
                      </div>

                      <h3 className="font-semibold text-[15px] leading-snug mt-3">{course.title}</h3>

                      <div className="mt-4 bg-[#F8F1EC] rounded-xl p-3">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                          {justEnrolled ? 'Up Next' : 'Current Topic'}
                        </p>
                        <p className="text-sm font-semibold mt-1 leading-snug">{course.currentTopic}</p>
                      </div>

                      <div className="mt-auto pt-4">
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span>Syllabus Covered</span>
                          <span>
                            {justEnrolled
                              ? course.totalLectures
                                ? `${course.totalLectures} Lectures`
                                : 'Not started yet'
                              : `${course.completedLectures} / ${course.totalLectures} Lectures`}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-[#F1E6DD] overflow-hidden">
                          <div className="h-full rounded-full bg-[#175A67]" style={{ width: `${course.progress}%` }} />
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenBatch(course.batchId);
                          }}
                          className="mt-4 w-full flex items-center justify-center gap-1.5 bg-[#0B1C20] hover:bg-[#15302F] text-white text-xs font-semibold py-2.5 rounded-full transition-all active:scale-[0.98]"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          {justEnrolled ? 'Start Learning' : 'Resume Lecture'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* Catalogue */}
          <section ref={catalogRef} className="scroll-mt-4">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-5">Academic Batches &amp; Crash Courses</h2>
            <LiveBatchCatalog
              status={status}
              error={error}
              onRetry={reload}
              batches={batches}
              filters={filters}
              activeFilter={catalogFilter}
              onFilterChange={onCatalogFilterChange}
              query={query}
              showFilters
              onOpenBatch={onOpenBatch}
              onBuyBatch={onBuyBatch}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

export default EnrolledCoursesView;