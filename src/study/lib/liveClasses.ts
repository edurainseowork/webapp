import { useEffect, useState } from 'react';
import { apiFetch } from './api';

// Live classes scheduled in CMS → Go Live. The backend sends a class (and its Google Meet link) only to
// students enrolled in that course: GET /api/live-classes/my (all my courses) and
// GET /api/courses/:id/live-classes (one course; 403 when not enrolled).

export type LiveClassStatus = 'live' | 'upcoming' | 'ended';

export interface LiveClass {
  id: number;
  courseId: number;
  title: string;
  startTime: string;
  endTime: string;
  meetUrl: string;
  status: LiveClassStatus;
  courseTitle?: string | null;
}

/** The Join button opens this long before the start time */
export const JOIN_EARLY_MS = 15 * 60 * 1000;

export async function fetchMyLiveClasses(): Promise<LiveClass[]> {
  const res = await apiFetch<{ data?: LiveClass[] }>('/live-classes/my');
  return Array.isArray(res.data) ? res.data : [];
}

export async function fetchCourseLiveClasses(courseId: number): Promise<LiveClass[]> {
  const res = await apiFetch<{ data?: LiveClass[] }>(`/courses/${courseId}/live-classes`);
  return Array.isArray(res.data) ? res.data : [];
}

/** Status worked out on this device, so a class turns "live" / disappears without reloading */
export function liveStatus(c: Pick<LiveClass, 'startTime' | 'endTime'>, now = Date.now()): LiveClassStatus {
  if (now >= new Date(c.endTime).getTime()) return 'ended';
  if (now >= new Date(c.startTime).getTime()) return 'live';
  return 'upcoming';
}

export const canJoin = (c: Pick<LiveClass, 'startTime' | 'endTime'>, now = Date.now()) =>
  now >= new Date(c.startTime).getTime() - JOIN_EARLY_MS && now < new Date(c.endTime).getTime();

/** "Today, 6:30 pm – 8:00 pm" / "Tomorrow, …" / "Sat, 2 Nov, …" */
export function formatClassTime(c: Pick<LiveClass, 'startTime' | 'endTime'>, now = new Date()): string {
  const start = new Date(c.startTime);
  const end = new Date(c.endTime);
  const time = (d: Date) => d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  const dayDiff = Math.round(
    (new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86_400_000,
  );
  const day =
    dayDiff === 0 ? 'Today' : dayDiff === 1 ? 'Tomorrow' : start.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day}, ${time(start)} – ${time(end)}`;
}

/** "Starts in 25 min" / "Starts in 3 h" / "" (more than a day away or already started) */
export function startsIn(c: Pick<LiveClass, 'startTime'>, now = Date.now()): string {
  const ms = new Date(c.startTime).getTime() - now;
  if (ms <= 0 || ms > 86_400_000) return '';
  const min = Math.ceil(ms / 60_000);
  return min < 60 ? `Starts in ${min} min` : `Starts in ${Math.floor(min / 60)} h ${min % 60 ? `${min % 60} min` : ''}`.trim();
}

/** Re-renders every 30 s so badges and Join buttons follow the clock */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}