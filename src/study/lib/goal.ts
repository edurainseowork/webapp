import { apiFetch } from './api';
import { auth } from './firebase';

// The student's goal (exam / cohort) is a CMS category, saved in the database against the signed-in
// account (GET / PUT /api/me/goal), so it is the same after logout, on another device or browser.

export interface StudentGoal {
  /** CMS category id (stable; used to pick the matching Courses tab) */
  id: number;
  name: string;
  slug: string;
}

type CategoryRow = { id: number; name: string; slug: string };

// Goals picked before they were saved on the server lived only in this browser. Moved to the
// account once, then removed here.
const legacyKey = () => (auth.currentUser?.uid ? `edurain.goal.${auth.currentUser.uid}` : null);

function takeLegacyGoal(): number | null {
  const key = legacyKey();
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    localStorage.removeItem(key);
    const id = raw ? Number(JSON.parse(raw)?.id) : NaN;
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null; // storage blocked or bad data
  }
}

/** The goal saved on this student's account; null when none is set yet (or its category was deleted). */
export async function fetchGoal(): Promise<StudentGoal | null> {
  const res = await apiFetch<{ goal: StudentGoal | null }>('/me/goal');
  if (res.goal) {
    takeLegacyGoal(); // the account already has a goal; drop any old browser copy
    return res.goal;
  }
  const legacy = takeLegacyGoal();
  if (!legacy) return null;
  try {
    return await saveGoalId(legacy);
  } catch {
    return null; // that category no longer exists: ask again
  }
}

async function saveGoalId(categoryId: number): Promise<StudentGoal> {
  const res = await apiFetch<{ goal: StudentGoal | null }>('/me/goal', { method: 'PUT', body: { categoryId } });
  if (!res.goal) throw new Error('Could not save your goal. Please try again.');
  return res.goal;
}

/** Saves (or changes) the student's goal on their account. Rejects with a readable error. */
export function saveGoal(category: CategoryRow): Promise<StudentGoal> {
  return saveGoalId(category.id);
}