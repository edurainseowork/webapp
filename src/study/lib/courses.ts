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
  isPurchasedBanner?: boolean;
  bannerImage?: string | null;
  /** Pro / Pro Max (paise) and what each plan includes; Basic = price / originalPrice. Missing on old backends. */
  plans?: {
    basic?: { features: string[] };
    pro?: CmsPaidPlan;
    proMax?: CmsPaidPlan;
  };
}

export interface CmsPaidPlan {
  price: number;
  originalPrice: number | null;
  features: string[];
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

const STALE_MS = 5 * 60_000; // 5-minute client staleTime to prevent tab-switch DB spam

let state: CoursesState = { status: 'loading', error: null, courses: [], categories: [], categoriesError: null, ownedIds: [] };
let inFlight: Promise<void> | null = null;
let lastLoadedAt = 0;
let currentUserId: string | null = null;
const listeners = new Set<() => void>();

export function resetCoursesForUser(uid: string | null): void {
  if (currentUserId !== uid) {
    currentUserId = uid;
    lastLoadedAt = 0;
    setState({ ownedIds: [] });
    if (uid) void resumePendingPayment();
  }
}

const setState = (next: Partial<CoursesState>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

async function fetchOwnedIds(): Promise<number[]> {
  const reqUid = currentUserId;
  try {
    const res = await apiFetch<{ data?: unknown[] }>('/razorpay/my-courses');
    return (res.data ?? []).map(Number).filter((id) => Number.isInteger(id));
  } catch {
    // Not fatal: return cached IDs only if belonging to the same user, else empty list
    return currentUserId === reqUid ? state.ownedIds : [];
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

/* ------------------------------------------------------------------ */
/*  Razorpay checkout (web)                                             */
/* ------------------------------------------------------------------ */

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open(): void; on(event: string, cb: (res: any) => void): void };
  }
}

let checkoutScript: Promise<boolean> | null = null;
const loadCheckout = () =>
  (checkoutScript ??= new Promise<boolean>((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => {
      checkoutScript = null; // let the next click try again
      resolve(false);
    };
    document.body.appendChild(script);
  }));

interface OrderResponse {
  free?: boolean;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  courseTitle: string;
  prefill?: { name?: string; email?: string };
}

const CHECK_AFTER_SECONDS = [1, 2, 4, 8, 16, 32];

/**
 * A payment that is pending with the bank (UPI waiting, window closed early): ask the server, which asks Razorpay,
 * now and then after 1s, 2s, 4s, 8s, 16s, 32s. 'cancelled' = the student closed the window before paying at all.
 */
async function waitForPayment(orderId: string): Promise<'paid' | 'failed' | 'cancelled' | 'pending'> {
  for (let i = 0; i <= CHECK_AFTER_SECONDS.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, CHECK_AFTER_SECONDS[i - 1] * 1000));
    try {
      const res = await apiFetch<{ status: 'paid' | 'failed' | 'pending'; attempts?: number }>(`/razorpay/status/${orderId}`);
      if (res.status === 'paid' || res.status === 'failed') return res.status;
      if (!res.attempts) return 'cancelled';
    } catch {
      // A network blip: the next check tries again
    }
  }
  return 'pending';
}

// The order being paid is remembered on this device, so a closed tab or a reload does not lose track of a payment
// that is still pending with the bank: the app keeps asking until it is paid or failed.
const PENDING_KEY = 'edurain.pendingPayment';
const rememberPending = (order: { orderId: string; courseId: number } | null) => {
  try {
    if (order) localStorage.setItem(PENDING_KEY, JSON.stringify({ ...order, at: Date.now() }));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    // Storage blocked: the webhook still unlocks the course
  }
};

const markOwned = (courseId: number) => {
  if (!state.ownedIds.includes(courseId)) setState({ ownedIds: [...state.ownedIds, courseId] });
  void refreshOwnedCourses();
};

let resuming = false;

/** After a sign-in or reload: finish checking a payment that was left pending. */
export async function resumePendingPayment(): Promise<void> {
  if (resuming) return;
  let saved: { orderId: string; courseId: number; at: number } | null = null;
  try {
    saved = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null');
  } catch {
    saved = null;
  }
  if (!saved?.orderId || Date.now() - saved.at > 24 * 3_600_000) {
    rememberPending(null);
    return;
  }
  resuming = true;
  try {
    const outcome = await waitForPayment(saved.orderId);
    if (outcome === 'paid') markOwned(saved.courseId);
    if (outcome !== 'pending') rememberPending(null);
  } finally {
    resuming = false;
  }
}

/**
 * Buys a plan: the server prices the order (plan + coupon). A free order enrols at once; otherwise the
 * Razorpay window opens, and after payment the server checks Razorpay's signature before it unlocks the course.
 */
export async function payForCourse(courseId: number, plan: 'basic' | 'pro' | 'proMax', couponCode?: string): Promise<EnrollResult> {
  let order: OrderResponse;
  try {
    order = await apiFetch<OrderResponse>('/razorpay/order', { body: { courseId, plan, couponCode } });
  } catch (err) {
    return { ok: false, paymentRequired: false, error: errorMessage(err, 'Could not start the payment. Please try again.') };
  }
  if (order.free) {
    markOwned(courseId);
    return { ok: true };
  }
  rememberPending({ orderId: order.orderId, courseId });
  if (!(await loadCheckout()) || !window.Razorpay) {
    return { ok: false, paymentRequired: false, error: 'Could not load the payment window. Check your internet and try again.' };
  }

  return new Promise<EnrollResult>((resolve) => {
    let paid = false;
    const checkout = new window.Razorpay!({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: 'EduRain',
      description: order.courseTitle,
      prefill: order.prefill,
      theme: { color: '#175A67' },
      handler: async (res: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        paid = true;
        try {
          await apiFetch('/razorpay/verify', {
            body: { razorpay_order_id: res.razorpay_order_id, razorpay_payment_id: res.razorpay_payment_id, razorpay_signature: res.razorpay_signature },
          });
          rememberPending(null);
          markOwned(courseId);
          resolve({ ok: true });
        } catch {
          // The money is taken; Razorpay's webhook unlocks the course even when this call failed
          void refreshOwnedCourses();
          resolve({ ok: false, paymentRequired: false, error: 'Payment received, but we could not confirm it yet. The course unlocks on its own within a minute.' });
        }
      },
      modal: {
        // Closed without a success callback: it may still be pending with the bank, so check before giving up
        ondismiss: async () => {
          if (paid) return;
          const outcome = await waitForPayment(order.orderId);
          if (paid) return;
          if (outcome === 'paid') {
            rememberPending(null);
            markOwned(courseId);
            resolve({ ok: true });
            return;
          }
          if (outcome !== 'pending') rememberPending(null);
          void refreshOwnedCourses();
          const error = {
            cancelled: 'Payment cancelled.',
            failed: 'Payment failed. Please try again.',
            pending: 'Your bank is still confirming the payment. The course unlocks on its own once it is confirmed.',
          }[outcome];
          resolve({ ok: false, paymentRequired: false, error });
        },
      },
    });
    checkout.on('payment.failed', (res) => {
      void apiFetch('/razorpay/failed', { body: { razorpay_order_id: order.orderId, reason: res?.error?.description } }).catch(() => undefined);
    });
    checkout.open();
  });
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
    if (Date.now() - lastLoadedAt > STALE_MS) void refreshCourses();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoadedAt > STALE_MS) {
        void refreshCourses();
      }
    }, STALE_MS);
    const onFocus = () => {
      if (Date.now() - lastLoadedAt > 60_000) void refreshCourses(); // the browser keeps /courses for 60s anyway
    };
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
      (item): CmsContentItem => {
        const rawParent = item.parentId ?? item.parent_id ?? null;
        return {
          id: String(item.id),
          parentId: rawParent != null ? String(rawParent) : null,
          title: String(item.title ?? ''),
          type: item.type,
          mediaUrl: item.mediaUrl ?? item.media_url ?? item.url ?? null,
          fileSize: item.fileSize ?? item.file_size ?? null,
          order: Number(item.order ?? 0),
        };
      }
    );
    return { status: 'ok', items };
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return { status: 'locked' };
    throw err;
  }
}
/* ------------------------------------------------------------------ */
/*  FAQs (CMS → FAQs, shown at the end of the course page)              */
/* ------------------------------------------------------------------ */

export interface CourseFaq {
  id: number;
  question: string;
  /** Markdown (bold, italic, lists, links) */
  answer: string;
}

/** FAQs for a course: its own and the "All courses" ones, lowest sort order first. */
export async function fetchCourseFaqs(courseId: number): Promise<CourseFaq[]> {
  const res = await apiFetch<{ data?: CourseFaq[] }>(`/courses/${courseId}/faqs`);
  return Array.isArray(res.data) ? res.data : [];
}

/* ------------------------------------------------------------------ */
/*  Lesson progress (profile → Overall Syllabus Velocity)               */
/* ------------------------------------------------------------------ */

/** Ids of the lessons the student has opened in this course. */
export async function fetchCompletedLessons(courseId: number): Promise<string[]> {
  const res = await apiFetch<{ completed?: string[] }>(`/progress/${courseId}`);
  return Array.isArray(res.completed) ? res.completed : [];
}

/** Records that the student opened a lesson (counts as done). */
export async function markLessonDone(courseId: number, contentId: string): Promise<void> {
  await apiFetch(`/progress/${courseId}/lessons/${encodeURIComponent(contentId)}`, { method: 'POST' });
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
    if (!state.ownedIds.includes(courseId)) {
      setState({ ownedIds: [...state.ownedIds, courseId] });
    }
    void refreshOwnedCourses();
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

/**
 * Enrols with a coupon that makes the chosen plan free (100% off). The server re-checks the coupon and the
 * price (POST /razorpay/order); when anything is still to pay it does not enrol and the student is told.
 */
export async function enrollWithCoupon(courseId: number, couponCode: string, plan: 'basic' | 'pro' | 'proMax'): Promise<EnrollResult> {
  try {
    const res = await apiFetch<{ free?: boolean }>('/razorpay/order', { body: { courseId, couponCode, plan } });
    if (!res.free) return { ok: false, paymentRequired: true, error: 'Online payment for this course is coming soon.' };
    if (!state.ownedIds.includes(courseId)) setState({ ownedIds: [...state.ownedIds, courseId] });
    void refreshOwnedCourses();
    return { ok: true };
  } catch (err) {
    return { ok: false, paymentRequired: false, error: errorMessage(err, 'Could not apply the coupon. Please try again.') };
  }
}