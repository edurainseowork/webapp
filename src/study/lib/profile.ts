import { API_BASE_URL, ApiError, apiFetch } from './api';
import { auth } from './firebase';

// The signed-in student's profile: GET / PATCH /api/profile (same API as the mobile app),
// photo via POST / DELETE /api/profile/photo. The account always comes from the login token.

export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export interface StudentProfile {
  id: number;
  name: string | null;
  email: string;
  phone: string | null;
  gender: Gender | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  profilePhoto: string | null;
  memberSince: string;
  streak: { current: number; longest: number; lastActiveAt: string | null };
  courses: { id: number; title: string; thumbnail: string | null; category: string | null; purchasedAt: string }[];
  /** The six activity tiles; each part is null until the student has data for it */
  stats?: StudentStats | null;
}

export interface StudentStats {
  /** Avg. Mock Pace: total time in submitted tests ÷ total questions */
  pace: { secondsPerQuestion: number; tests: number } | null;
  /** AI Accuracy Rate: correct ÷ answered, with the average of all students */
  accuracy: { percent: number; correct: number; answered: number; platformPercent: number | null } | null;
  /** AIR Marks Prediction: average score %, ranked among all students who took tests */
  standing: { topPercent: number; rank: number; students: number; averagePercent: number } | null;
  /** Predictive AIR Marks Analysis: rank in the latest test and the change since the previous one */
  latestTest: { title: string; rank: number; students: number; score: number; maxMarks: number; positionsGained: number | null } | null;
  /** Overall Syllabus Velocity: lessons opened ÷ lessons in the enrolled courses */
  syllabus: { percent: number; done: number; total: number; focus: { title: string; remaining: number } | null } | null;
}

/** Records today's visit for the daily streak (call once when the app opens). */
export function recordActivity(): void {
  void apiFetch('/profile/activity', { method: 'POST' }).catch(() => undefined);
}

export type ProfileUpdate = Partial<Pick<StudentProfile, 'name' | 'phone' | 'gender' | 'address' | 'city' | 'state' | 'pincode'>>;

export async function fetchProfile(): Promise<StudentProfile> {
  return (await apiFetch<{ data: StudentProfile }>('/profile')).data;
}

export async function updateProfile(patch: ProfileUpdate): Promise<StudentProfile> {
  return (await apiFetch<{ data: StudentProfile }>('/profile', { method: 'PATCH', body: patch })).data;
}

export const PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

/** Uploads a new profile photo (PNG / JPEG / WEBP, up to 2 MB). */
export async function uploadProfilePhoto(file: File): Promise<StudentProfile> {
  const token = await auth.currentUser?.getIdToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/profile/photo`, {
      method: 'POST',
      headers: { 'Content-Type': file.type, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: file,
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your internet connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || `Upload failed (${res.status})`);
  return (data as { data: StudentProfile }).data;
}

export async function removeProfilePhoto(): Promise<StudentProfile> {
  return (await apiFetch<{ data: StudentProfile }>('/profile/photo', { method: 'DELETE' })).data;
}