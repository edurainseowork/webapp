import { EBook } from '../components/EBookLibraryView';

const STORAGE_KEY = 'edurain_bookmarked_ebooks';
const EVENT_NAME = 'edurain_bookmarks_changed';

const SAVED_PDFS_STORAGE_KEY = 'edurain_saved_pdfs';
const SAVED_PDFS_EVENT_NAME = 'edurain_saved_pdfs_changed';

export interface SavedPdf {
  id: string;
  title: string;
  mediaUrl: string;
  courseTitle?: string;
  courseId?: number | string;
  subject?: string;
  fileSize?: string | null;
  savedAt: string;
}

/* ------------------------------------------------------------------ */
/*  E-Book Bookmarks                                                   */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Saved PDFs (Protected - In-App Only, No Device Downloads)          */
/* ------------------------------------------------------------------ */

export function getSavedPdfs(): SavedPdf[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SAVED_PDFS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function isPdfSaved(pdfId: string): boolean {
  const list = getSavedPdfs();
  return list.some((p) => p.id === pdfId);
}

export function toggleSavePdf(pdf: SavedPdf): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const current = getSavedPdfs();
    const exists = current.some((p) => p.id === pdf.id);
    let next: SavedPdf[];
    if (exists) {
      next = current.filter((p) => p.id !== pdf.id);
    } else {
      next = [pdf, ...current];
    }
    localStorage.setItem(SAVED_PDFS_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(SAVED_PDFS_EVENT_NAME, { detail: { pdfId: pdf.id, isSaved: !exists } }));
    return !exists;
  } catch (err) {
    console.error('Failed to toggle saved PDF', err);
    return false;
  }
}

export function removeSavedPdf(pdfId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getSavedPdfs();
    const next = current.filter((p) => p.id !== pdfId);
    localStorage.setItem(SAVED_PDFS_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(SAVED_PDFS_EVENT_NAME, { detail: { pdfId, isSaved: false } }));
  } catch (err) {
    console.error('Failed to remove saved PDF', err);
  }
}

export function onSavedPdfsChange(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(SAVED_PDFS_EVENT_NAME, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(SAVED_PDFS_EVENT_NAME, callback);
    window.removeEventListener('storage', callback);
  };
}
