import { EBook } from '../components/EBookLibraryView';

const STORAGE_KEY = 'edurain_bookmarked_ebooks';
const EVENT_NAME = 'edurain_bookmarks_changed';

export function getBookmarkedBooks(): EBook[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function isBookmarked(bookId: string): boolean {
  const books = getBookmarkedBooks();
  return books.some((b) => b.id === bookId);
}

export function toggleBookBookmark(book: EBook): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const current = getBookmarkedBooks();
    const exists = current.some((b) => b.id === book.id);
    let next: EBook[];
    if (exists) {
      next = current.filter((b) => b.id !== book.id);
    } else {
      next = [...current, book];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { bookId: book.id, isBookmarked: !exists } }));
    return !exists;
  } catch (err) {
    console.error('Failed to toggle bookmark', err);
    return false;
  }
}

export function removeBookmark(bookId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getBookmarkedBooks();
    const next = current.filter((b) => b.id !== bookId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { bookId, isBookmarked: false } }));
  } catch (err) {
    console.error('Failed to remove bookmark', err);
  }
}

export function onBookmarksChange(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVENT_NAME, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(EVENT_NAME, callback);
    window.removeEventListener('storage', callback);
  };
}
