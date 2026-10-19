import { useEffect, useSyncExternalStore } from 'react';
import { apiFetch, ApiError } from './api';



export interface CmsMentor {
  name: string;
  experience: string | null;
  photo: string | null;
}

export interface CmsCourse {
  id: number;
  title: string;
  description: string;
  /** Paise */
  price: number;
  /** Paise; null = no struck-through MRP */
  originalPrice: number | null;
  thumbnail: string | null;
  category: string;
  categoryId: number | null;
  categorySlug: string | null;
  mentors: CmsMentor[] | null;
  studentsEnrolled: number | null;
  duration: string | null;
  totalLessons: number | null;
}

export interface CmsCategory {
  id: number;
  name: string;
  slug: string;
  sortOrder: number;
}

export type CmsContentType = 'folder' | 'video' | 'pdf' | 'note' | 'quiz';

export interface CmsContentItem {
  id: string;
  parentId: string | null;
  title: string;
  type: CmsContentType;
  mediaUrl: string | null;
  fileSize: string | null;
  order: number;
}

export type LoadStatus = 'loading' | 'ready' | 'error';

export interface CoursesState {
  status: LoadStatus;
  error: string | null;
  courses: CmsCourse[];
  categories: CmsCategory[];
  categoriesError: string | null;
  /** Ids of the courses the signed-in student owns */
  ownedIds: number[];
}

const REFRESH_MS = 60_000;

let state: CoursesState = { status: 'loading', error: null, courses: [], categories: [], categoriesError: null, ownedIds: [] };
let inFlight: Promise<void> | null = null;
let lastLoadedAt = 0;
const listeners = new Set<() => void>();

const setState = (next: Partial<CoursesState>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

async function fetchOwnedIds(): Promise<number[]> {
  try {
    const res = await apiFetch<{ data?: unknown[] }>('/razorpay/my-courses');
    return (res.data ?? []).map(Number).filter((id) => Number.isInteger(id));
  } catch {
    // Not fatal: the catalogue still works, the student just sees nothing as owned
    return state.ownedIds;
  }
}

/** Reloads courses, categories and the student's courses. Background refreshes keep the current data on screen. */
export function refreshCourses(): Promise<void> {
  if (inFlight) return inFlight;
  const firstLoad = state.courses.length === 0;
  if (firstLoad && state.status !== 'loading') setState({ status: 'loading', error: null });

  inFlight = (async () => {
    try {
        let categoriesError: string | null = null;
        const [courses, categories, ownedIds] = await Promise.all([
          apiFetch<CmsCourse[]>('/courses'),
          apiFetch<CmsCategory[]>('/categories').catch((err) => {
            // Keep the last good list on a background refresh; only report when there is nothing to show
            if (state.categories.length === 0) categoriesError = errorMessage(err, 'Could not load categories.');
            return state.categories;
          }),
          fetchOwnedIds(),
        ]);
        lastLoadedAt = Date.now();
        setState({
          status: 'ready',
          error: null,
          courses: Array.isArray(courses) ? courses : [],
          categories: Array.isArray(categories) ? categories : [],
          categoriesError,
          ownedIds,
        });
    } catch (err) {
      // Keep showing what we already have if a background refresh fails
      if (firstLoad) setState({ status: 'error', error: errorMessage(err, 'Could not load courses.') });
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Re-reads only the owned-course ids (after enrolling). */
export async function refreshOwnedCourses(): Promise<void> {
  setState({ ownedIds: await fetchOwnedIds() });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Live CMS catalogue. Loads on first use, then refreshes on tab focus and every minute while mounted. */
export function useCourses(): CoursesState & { reload: () => Promise<void> } {
  const snapshot = useSyncExternalStore(subscribe, () => state);

  useEffect(() => {
    if (Date.now() - lastLoadedAt > 5_000) void refreshCourses();
    const onFocus = () => {
      if (document.visibilityState === 'visible') void refreshCourses();
    };
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refreshCourses();
    }, REFRESH_MS);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  return { ...snapshot, reload: refreshCourses };
}

/* ------------------------------------------------------------------ */
/*  Course content (lessons)                                            */
/* ------------------------------------------------------------------ */

export type ContentResult = { status: 'ok'; items: CmsContentItem[] } | { status: 'locked' };

/** Every content item of a course. Students who don't own the course get { status: 'locked' }. */
export async function fetchCourseContent(courseId: number): Promise<ContentResult> {
  try {
    const res = await apiFetch<{ data?: Array<Record<string, any>> }>(`/courses/${courseId}/content?parentId=all`);
    const items = (res.data ?? []).map(
      (item): CmsContentItem => ({
        id: String(item.id),
        parentId: item.parentId ?? item.parent_id ?? null,
        title: String(item.title ?? ''),
        type: item.type,
        mediaUrl: item.mediaUrl ?? item.media_url ?? item.url ?? null,
        fileSize: item.fileSize ?? item.file_size ?? null,
        order: Number(item.order ?? 0),
      })
    );
    return { status: 'ok', items };
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return { status: 'locked' };
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Enrolment                                                           */
/* ------------------------------------------------------------------ */

export type EnrollResult = { ok: true } | { ok: false; paymentRequired: boolean; error: string };

/**
 * Enrols through the backend's free-enrolment route (only active while ALLOW_FREE_ENROLLMENT=true).
 * When it is off the backend answers 403 and the student is told online payment is coming.
 */
export async function enrollInCourse(courseId: number): Promise<EnrollResult> {
  try {
    await apiFetch('/enrollments', { body: { courseId } });
    await refreshOwnedCourses();
    return { ok: true };
  } catch (err) {
    const paymentRequired = err instanceof ApiError && err.status === 403;
    return {
      ok: false,
      paymentRequired,
      error: paymentRequired
        ? 'Online payment for this course is coming soon.'
        : errorMessage(err, 'Could not enrol. Please try again.'),
    };
  }
}
