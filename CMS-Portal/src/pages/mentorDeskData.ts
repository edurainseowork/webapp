/* ------------------------------------------------------------------ */
/*  Mentor Desk – types, sample data and small helpers                  */
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

const at = (dayOffset: number, hours: number, minutes: number) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
};

// Sample sessions so the page can be designed and tested before the API exists
function buildSampleSessions(): MentorSession[] {
  return [
    {
      id: 'sample-1',
      className: 'Class 12',
      batchName: 'Lakshya JEE 2026',
      topic: 'Rotational Motion: Moment of Inertia Doubts',
      studentName: 'Aarav Sharma',
      startTime: at(0, 18, 30),
      endTime: at(0, 19, 15),
      meetLink: 'https://meet.google.com/abc-defg-hij',
    },
    {
      id: 'sample-2',
      className: 'Class 10',
      batchName: 'Udaan Class 10 2026',
      topic: 'Quadratic Equations & Roots',
      studentName: 'Priya Nair',
      startTime: at(0, 20, 0),
      endTime: at(0, 20, 45),
      meetLink: 'https://meet.google.com/klm-nopq-rst',
    },
    {
      id: 'sample-3',
      className: 'Class 12',
      batchName: 'Arjuna NEET 2026',
      topic: 'Organic Chemistry: Aldehydes & Ketones',
      studentName: 'Rohan Mehta',
      startTime: at(2, 16, 0),
      endTime: at(2, 16, 45),
      meetLink: 'https://meet.google.com/uvw-xyza-bcd',
    },
    {
      id: 'sample-4',
      className: 'Class 10',
      batchName: 'Udaan Class 10 2026',
      topic: 'Light: Reflection and Refraction',
      studentName: 'Ananya Gupta',
      startTime: at(2, 17, 30),
      endTime: at(2, 18, 15),
      meetLink: 'https://meet.google.com/efg-hijk-lmn',
    },
  ];
}

/**
 * Sessions booked with the signed-in mentor, oldest first.
 *
 * TODO: the Backend has no mentorship-booking API yet. When it does, replace the
 * sample data with the real call, e.g.
 *   import { apiFetch } from '../api';
 *   const res = await apiFetch<{ data: MentorSession[] }>('/mentor/sessions');
 *   return sortSessions(res.data);
 */
export async function loadMentorSessions(): Promise<MentorSession[]> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  return sortSessions(buildSampleSessions());
}

export const sortSessions = (list: MentorSession[]) =>
  [...list].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
