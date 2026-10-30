import { apiFetch, ApiError } from '../api'

/* ------------------------------------------------------------------ */
/*  Mentor Desk – types, API calls and small helpers                    */
/* ------------------------------------------------------------------ */

/** One 1:1 mentorship call a student booked with this mentor. */
export interface MentorSession {
  id: string;
  /** e.g. "Class 12" */
  className: string;
  /** Batch the student is enrolled in (from the backend) */
  batchName: string;
  /** What the student typed in "What topic would you like to discuss?" */
  topic: string;
  studentName: string;
  /** ISO 8601 date-times */
  startTime: string;
  endTime: string;
  /** Google Meet link for the call; null until one is attached */
  meetLink: string | null;
}

export type SessionStatus = 'live' | 'today' | 'upcoming' | 'ended';
export type SessionFilter = 'all' | 'today' | 'upcoming';

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date, e.g. "2026-10-17" */
export const toDateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const isToday = (s: MentorSession, now: Date) => toDateKey(new Date(s.startTime)) === toDateKey(now);

export const isLaterDate = (s: MentorSession, now: Date) => toDateKey(new Date(s.startTime)) > toDateKey(now);

export function getSessionStatus(s: MentorSession, now: Date): SessionStatus {
  const t = now.getTime();
  if (t >= new Date(s.endTime).getTime()) return 'ended';
  if (t >= new Date(s.startTime).getTime()) return 'live';
  return isToday(s, now) ? 'today' : 'upcoming';
}

export const matchesFilter = (s: MentorSession, filter: SessionFilter, now: Date) =>
  filter === 'all' ? true : filter === 'today' ? isToday(s, now) : isLaterDate(s, now);

const formatClock = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

/** "2026-10-17 • 06:30 PM - 07:15 PM" */
export const formatSessionTime = (s: MentorSession) =>
  `${toDateKey(new Date(s.startTime))} • ${formatClock(s.startTime)} - ${formatClock(s.endTime)}`;

export const formatStartClock = (s: MentorSession) => formatClock(s.startTime);

export const initialsOf = (name: string) =>
  name
    .replace(/^(Dr|Er|Mr|Mrs|Ms|Prof)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';

/** "shreya.sen@edurain.in" → "Shreya Sen" when the account has no display name */
export const nameFromEmail = (email: string) =>
  email
    .split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');

/* ------------------------------------------------------------------ */
/*  Data                                                                */
/* ------------------------------------------------------------------ */

/**
 * Sessions students booked with the signed-in mentor (GET /api/mentor-desk/sessions), oldest first.
 * Bookings are made on the study website from the slots in "My Availability".
 */
export async function loadMentorSessions(): Promise<MentorSession[]> {
  try {
    const res = await apiFetch<{ data: MentorSession[] }>('/mentor-desk/sessions');
    return sortSessions(res.data ?? []);
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) throw new Error('Sessions are shown to mentor accounts only.');
    throw err;
  }
}

export const sortSessions = (list: MentorSession[]) =>
  [...list].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

/* ------------------------------------------------------------------ */
/*  Availability (slots students can book)                              */
/* ------------------------------------------------------------------ */

export interface MentorSlot {
  id: number;
  startsAt: string;
  durationMinutes: number;
  status: 'open' | 'booked';
  studentName: string | null;
  topic: string | null;
}

export async function loadMentorSlots(): Promise<MentorSlot[]> {
  try {
    const res = await apiFetch<{ data: MentorSlot[] }>('/mentor-desk/slots');
    return res.data ?? [];
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) throw new Error('Availability is managed by mentor accounts only.');
    throw err;
  }
}

export async function addMentorSlot(startsAt: Date, durationMinutes: number): Promise<void> {
  await apiFetch('/mentor-desk/slots', { method: 'POST', body: { startsAt: startsAt.toISOString(), durationMinutes } });
}

export async function removeMentorSlot(id: number): Promise<void> {
  await apiFetch(`/mentor-desk/slots/${id}`, { method: 'DELETE' });
}