import { useEffect, useState } from 'react';
import { apiFetch } from './api';

// The student's ONE active course (Your Enrolled Courses → Set as Active), shared by every screen.
// GET / PUT /api/me/active-course. Making a course active also moves the goal (cohort) to the
// course's category on the server; `goalVersion` goes up so the app re-reads the goal.

type State = { activeCourseId: number | null; loaded: boolean; goalVersion: number };

let state: State = { activeCourseId: null, loaded: false, goalVersion: 0 };
const listeners = new Set<(s: State) => void>();
const emit = (next: Partial<State>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l(state));
};

/** Reads the active course from the server (after login, and after a goal change). */
export async function loadActiveCourse(): Promise<void> {
  try {
    const res = await apiFetch<{ activeCourseId: number | null }>('/me/active-course');
    emit({ activeCourseId: res.activeCourseId ?? null, loaded: true });
  } catch {
    emit({ loaded: true });
  }
}

/** Forget the previous student's choice (sign-out / account switch). */
export function resetActiveCourse(): void {
  emit({ activeCourseId: null, loaded: false });
}

/**
 * Makes a course active. Optimistic: the UI switches at once and rolls back if the server refuses.
 * Resolves with the new goal category id (the cohort follows the course).
 */
export async function makeCourseActive(courseId: number): Promise<number | null> {
  const previous = state.activeCourseId;
  emit({ activeCourseId: courseId });
  try {
    const res = await apiFetch<{ activeCourseId: number; goalCategoryId: number | null }>('/me/active-course', {
      method: 'PUT',
      body: { courseId },
    });
    emit({ activeCourseId: res.activeCourseId, goalVersion: state.goalVersion + 1 });
    return res.goalCategoryId;
  } catch (err) {
    emit({ activeCourseId: previous });
    throw err;
  }
}

export function useActiveCourse(): State {
  const [current, setCurrent] = useState(state);
  useEffect(() => {
    listeners.add(setCurrent);
    setCurrent(state);
    return () => {
      listeners.delete(setCurrent);
    };
  }, []);
  return current;
}