import { apiFetch } from '../../lib/api';

/* ------------------------------------------------------------------ */
/*  1:1 mentorship data — everything comes from the backend            */
/*                                                                      */
/*   GET    /api/mentorship/mentors?categoryId=&courseId=              */
/*   GET    /api/mentorship/mentors/:id          profile + real slots  */
/*   PUT    /api/mentorship/mentors/:id/favorite                       */
/*   DELETE /api/mentorship/mentors/:id/favorite                       */
/*   POST   /api/mentorship/bookings             { slotId, topic }     */
/*                                                                      */
/*  Mentors are the mentor accounts linked to the published courses of */
/*  the student's goal (picked in the CMS course form). Profile fields  */
/*  are set by the Super Admin; slots are added by the mentor on the    */
/*  CMS Mentor Desk. Missing fields are simply not shown.              */
/* ------------------------------------------------------------------ */

export interface Mentor {
  id: string;
  name: string;
  photo: string | null;
  /** Short description for cards */
  headline: string | null;
  /** Detailed bio ("About Mentor") */
  about: string | null;
  institute: string | null;
  achievement: string | null;
  languages: string | null;
  verified: boolean;
  sessionMinutes: number;
  courses: { id: number; title: string }[];
  /** Goal / exam names of those courses */
  goals: string[];
  /** Bookable slots in the next 30 days */
  openSlots: number;
  nextSlotAt: string | null;
  isFavorite: boolean;
}

export interface MentorSlot {
  id: number;
  startsAt: string;
  durationMinutes: number;
  available: boolean;
  /** Another student picked this time and is booking it (2-minute hold) */
  held?: boolean;
  /** When this student's own hold on the slot ends */
  heldUntil?: string | null;
}

export interface MentorCourseOption {
  id: number;
  title: string;
  mentorCount: number;
}

export interface MentorList {
  goal: { id: number; name: string } | null;
  courses: MentorCourseOption[];
  /** Mentors for the goal before the course filter */
  total: number;
  mentors: Mentor[];
}

export interface MentorBooking {
  id: number;
  mentorId: string;
  mentorName: string;
  startsAt: string;
  durationMinutes: number;
  topic: string;
}

export interface BookingDay {
  key: string;
  date: Date;
  weekday: string;
  dayOfMonth: string;
  month: string;
  isToday: boolean;
  slots: MentorSlot[];
}

/* ------------------------------------------------------------------ */
/*  API                                                                 */
/* ------------------------------------------------------------------ */

export function fetchMentors(filters: { categoryId?: number | null; courseId?: number | null } = {}): Promise<MentorList> {
  const params = new URLSearchParams();
  if (filters.categoryId) params.set('categoryId', String(filters.categoryId));
  if (filters.courseId) params.set('courseId', String(filters.courseId));
  const qs = params.toString();
  return apiFetch<MentorList & { success: boolean }>(`/mentorship/mentors${qs ? `?${qs}` : ''}`);
}

export function fetchMentor(mentorId: string): Promise<{ mentor: Mentor; slots: MentorSlot[] }> {
  return apiFetch(`/mentorship/mentors/${encodeURIComponent(mentorId)}`);
}

export async function setFavorite(mentorId: string, favorite: boolean): Promise<boolean> {
  const res = await apiFetch<{ isFavorite: boolean }>(`/mentorship/mentors/${encodeURIComponent(mentorId)}/favorite`, {
    method: favorite ? 'PUT' : 'DELETE',
  });
  return res.isFavorite;
}
/** Reserves the slot for this student for 2 minutes; rejects when another student holds it. */
export async function holdSlot(slotId: number): Promise<string> {
  const res = await apiFetch<{ heldUntil: string }>(`/mentorship/slots/${slotId}/hold`, { method: 'POST' });
  return res.heldUntil;
}

/** Gives a held slot back (best effort: holds also end by themselves after 2 minutes). */
export function releaseSlot(slotId: number): void {
  void apiFetch(`/mentorship/slots/${slotId}/hold`, { method: 'DELETE' }).catch(() => undefined);
}

export async function bookSlot(input: { slotId: number; topic: string; courseId?: number | null }): Promise<MentorBooking> {
  const res = await apiFetch<{ booking: MentorBooking }>('/mentorship/bookings', { method: 'POST', body: input });
  return res.booking;
}

/* ------------------------------------------------------------------ */
/*  Display helpers                                                     */
/* ------------------------------------------------------------------ */

export const initialsOf = (name: string) =>
  name
    .replace(/^(Dr|Er|Mr|Mrs|Ms|Prof)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';

/** The mentor's course(s) for the first line of a card, e.g. "JEE Crash Course" or "JEE Crash, JEE Physics". */
export const courseLineOf = (m: Mentor) => m.courses.map((c) => c.title).join(', ');

/**
 * Description under the course name: the short description, else "About Mentor", else
 * "IIT Bombay • JEE Advanced AIR 42". Empty when none is set (the line is then hidden).
 */
export const descriptionOf = (m: Mentor) =>
  (m.headline || m.about || [m.institute, m.achievement].filter(Boolean).join(' • ') || '').replace(/\s+/g, ' ').trim();

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/** Availability pill from the mentor's real next free slot. */
export function availabilityOf(m: Mentor, now = new Date()): { label: string; className: string; dot: string } {
  if (!m.nextSlotAt || m.openSlots === 0) return { label: 'No slots yet', className: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' };
  const next = new Date(m.nextSlotAt);
  const days = Math.round((startOfDay(next).getTime() - startOfDay(now).getTime()) / 86_400_000);
  if (days <= 0) return { label: 'Available Today', className: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' };
  if (days === 1) return { label: 'Available Tomorrow', className: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' };
  if (days < 7) return { label: `Next slot ${next.toLocaleDateString('en-IN', { weekday: 'short' })}`, className: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' };
  return { label: `Next slot ${next.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`, className: 'bg-red-50 text-red-600', dot: 'bg-red-500' };
}

/** Slots grouped into days (only days that have slots), in time order. */
export function groupSlotsByDay(slots: MentorSlot[], now = new Date()): BookingDay[] {
  const today = dayKey(now);
  const days = new Map<string, BookingDay>();
  for (const slot of [...slots].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    const date = new Date(slot.startsAt);
    const key = dayKey(date);
    if (!days.has(key)) {
      days.set(key, {
        key,
        date: startOfDay(date),
        weekday: date.toLocaleDateString('en-IN', { weekday: 'short' }),
        dayOfMonth: String(date.getDate()).padStart(2, '0'),
        month: date.toLocaleDateString('en-IN', { month: 'short' }),
        isToday: key === today,
        slots: [],
      });
    }
    days.get(key)!.slots.push(slot);
  }
  return [...days.values()];
}

export const formatSlotTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();

export const formatBookingDate = (date: Date | string) =>
  new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

export const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);