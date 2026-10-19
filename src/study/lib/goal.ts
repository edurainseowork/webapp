import { apiFetch } from './api';
import { auth } from './firebase';

export interface StudentGoal {
  /** CMS category id (stable; used to pick the matching Courses tab) */
  id: number;
  name: string;
  slug: string;
}

const storageKey = () => {
  const uid = auth.currentUser?.uid;
  return uid ? `edurain.goal.${uid}` : null;
};

function readStored(): StudentGoal | null {
  const key = storageKey();
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && Number.isInteger(parsed.id) ? (parsed as StudentGoal) : null;
  } catch {
    return null; // storage blocked (private mode) or bad data
  }
}

function writeStored(goal: StudentGoal | null) {
  const key = storageKey();
  if (!key) return;
  try {
    if (goal) localStorage.setItem(key, JSON.stringify(goal));
    else localStorage.removeItem(key);
  } catch {
    // storage blocked: the goal still applies for this visit
  }
}

type CategoryRow = { id: number; name: string; slug: string };

/** The goal saved for this student, refreshed from the CMS; null when none is set or its category was deleted. */
export async function fetchGoal(): Promise<StudentGoal | null> {
  const stored = readStored();
  if (!stored) return null;
  let categories: CategoryRow[];
  try {
    categories = await apiFetch<CategoryRow[]>('/categories');
  } catch {
    return stored; // CMS unreachable: keep using the saved goal
  }
  const current = Array.isArray(categories) ? categories.find((c) => c.id === stored.id) : undefined;
  if (!current) {
    writeStored(null); // category removed in the CMS → ask again
    return null;
  }
  const fresh = { id: current.id, name: current.name, slug: current.slug };
  writeStored(fresh); // picks up a rename
  return fresh;
}

/** Saves the chosen CMS category as the student's goal. */
export async function saveGoal(category: CategoryRow): Promise<StudentGoal> {
  const goal = { id: category.id, name: category.name, slug: category.slug };
  writeStored(goal);
  return goal;
}