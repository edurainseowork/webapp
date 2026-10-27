import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Heart,
  Star,
  Bookmark,
  BookOpen,
  LayoutGrid,
  List,
  ChevronRight,
  CheckCircle2,
  SearchX,
  BookCheck,
  X,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { SubPageHeader } from './SubPageHeader';
import {
  isBookmarked,
  toggleBookBookmark,
  onBookmarksChange,
  toggleSavePdf,
  getSavedPdfs,
  onSavedPdfsChange,
} from '../utils/bookmarkStorage';
import { apiFetch } from '../lib/api';

/* ------------------------------------------------------------------ */
/*  Backend-Ready Types                                                */
/* ------------------------------------------------------------------ */

export type EBookTab = 'all' | 'courses';
export type ViewMode = 'grid' | 'list';

export interface EBook {
  id: string;
  title: string;
  subject: string;
  totalPages: number;
  pagesRead: number;
  rating?: number;
  isCourseBook?: boolean;
  courseId?: number;
  courseTitle?: string;
  pdfUrl?: string | null;
  fileSize?: string | null;
}

interface EBookLibraryViewProps {
  onBack?: () => void;
  onGoLibrary?: () => void;
  onOpenBook?: (book: EBook) => void;
  searchQuery?: string;
  initialCourseId?: number | null;
}

/* ------------------------------------------------------------------ */
/*  Real Storage Only (No Dummy / Mock E-Books)                        */
/* ------------------------------------------------------------------ */

export const BOOKS: EBook[] = [];

/* ------------------------------------------------------------------ */
/*  Main View                                                          */
/* ------------------------------------------------------------------ */

export function EBookLibraryView({
  onBack,
  onGoLibrary,
  onOpenBook,
  searchQuery = '',
  initialCourseId = null,
}: EBookLibraryViewProps) {
  const [courses, setCourses] = useState<Array<{ id: number; title: string; category?: string }>>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | 'all'>(initialCourseId || 'all');
  const [activeTab, setActiveTab] = useState<EBookTab>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [savedPdfIds, setSavedPdfIds] = useState<string[]>([]);
  const [activeReadingBook, setActiveReadingBook] = useState<EBook | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [uploadedBooks, setUploadedBooks] = useState<EBook[]>([]);
  const [isLoadingBooks, setIsLoadingBooks] = useState(true);

  useEffect(() => {
    const syncSaved = () => setSavedPdfIds(getSavedPdfs().map((p) => p.id));
    syncSaved();
    return onSavedPdfsChange(syncSaved);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const handleToggleSavePdf = (book: EBook) => {
    if (!book.pdfUrl) {
      showToast('PDF file is not available for this e-book.');
      return;
    }
    const isSaved = toggleSavePdf({
      id: book.id,
      title: book.title,
      mediaUrl: book.pdfUrl,
      courseTitle: book.courseTitle,
      courseId: book.courseId,
      subject: book.subject,
      fileSize: book.fileSize,
      savedAt: new Date().toISOString(),
    });
    showToast(
      isSaved
        ? `Saved "${book.title}" to Your Saved PDF in Bookmarks`
        : `Removed "${book.title}" from Saved PDFs`
    );
  };

  useEffect(() => {
    async function loadCourses() {
      try {
        const data = await apiFetch<Array<{ id: number; title: string; category?: string }>>('/courses');
        if (Array.isArray(data)) {
          setCourses(data);
        }
      } catch (err) {
        console.warn('Could not fetch courses for ebooks:', err);
      }
    }
    loadCourses();
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadUploadedBooks() {
      setIsLoadingBooks(true);
      try {
        const res = await apiFetch<{ success: boolean; ebooks: EBook[] }>('/ebooks');
        if (mounted && res && Array.isArray(res.ebooks)) {
          setUploadedBooks(res.ebooks.filter((b) => Boolean(b.pdfUrl)));
        }
      } catch (err) {
        console.warn('Could not fetch uploaded ebooks:', err);
      } finally {
        if (mounted) setIsLoadingBooks(false);
      }
    }
    loadUploadedBooks();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const sync = () =>
      setBookmarkedIds(uploadedBooks.filter((b) => isBookmarked(b.id)).map((b) => b.id));
    sync();
    return onBookmarksChange(sync);
  }, [uploadedBooks]);

  const handleToggleBookmark = (book: EBook) => {
    const saved = toggleBookBookmark(book);
    setBookmarkedIds((prev) => (saved ? [...prev, book.id] : prev.filter((id) => id !== book.id)));
    showToast(saved ? `Added "${book.title}" to Bookmarks` : `Removed "${book.title}" from Bookmarks`);
  };

  const handleReadBook = (book: EBook) => {
    if (book.pdfUrl) {
      setPdfLoading(true);
      setPdfError(null);
      setActiveReadingBook(book);
    } else if (onOpenBook) {
      onOpenBook(book);
    } else {
      showToast('PDF file is not available for this e-book.');
    }
  };

  const q = searchQuery.trim().toLowerCase();
  const pool = useMemo(
    () =>
      q
        ? uploadedBooks.filter(
            (b) =>
              b.title.toLowerCase().includes(q) ||
              b.subject.toLowerCase().includes(q) ||
              (b.courseTitle && b.courseTitle.toLowerCase().includes(q))
          )
        : uploadedBooks,
    [uploadedBooks, q]
  );

  const courseFilteredBooks = useMemo(() => {
    if (selectedCourseId === 'all') return pool;
    const directMatches = pool.filter((b) => Number(b.courseId) === Number(selectedCourseId));
    if (directMatches.length > 0) return directMatches;
    const matchedCourse = courses.find((c) => c.id === selectedCourseId);
    if (!matchedCourse) return [];
    return pool.filter(
      (b) =>
        b.subject.toLowerCase().includes((matchedCourse.category || '').toLowerCase()) ||
        matchedCourse.title.toLowerCase().includes(b.subject.toLowerCase())
    );
  }, [pool, selectedCourseId, courses]);

  const visibleBooks: EBook[] =
    activeTab === 'all' ? courseFilteredBooks : courseFilteredBooks.filter((b: EBook) => b.isCourseBook);

  return (
    <div className="bg-[#DCEAE3] rounded-[28px] p-4 sm:p-6 lg:p-8 space-y-5">
      {/* 1. Standardized Back Button + Breadcrumb */}
      <SubPageHeader
        onBack={onBack}
        crumbs={[
          { label: 'Home', onClick: onBack },
          { label: 'Library', onClick: onGoLibrary || onBack },
          { label: 'E-Books' },
        ]}
      />

      {/* 2. Course Structure Tabs (Matching Courses / Class Material Structure) */}
      {courses.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setSelectedCourseId('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              selectedCourseId === 'all'
                ? 'bg-[#0F3B42] text-white shadow-sm'
                : 'bg-white/80 hover:bg-white text-[#175A67] border border-white/80'
            }`}
          >
            All Courses ({pool.length})
          </button>
          {courses.map((course) => (
            <button
              key={course.id}
              onClick={() => setSelectedCourseId(course.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                selectedCourseId === course.id
                  ? 'bg-[#0F3B42] text-white shadow-sm'
                  : 'bg-white/80 hover:bg-white text-[#175A67] border border-white/80'
              }`}
            >
              {course.title}
            </button>
          ))}
        </div>
      )}

      {/* 3. Category Tabs: All E-Books & Courses E-Books + View Mode */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-white/70 border border-white/80 p-1 rounded-2xl self-start">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'all' ? 'bg-[#0F3B42] text-white shadow-sm' : 'text-[#175A67] hover:bg-white/60'
            }`}
          >
            All E-Books ({courseFilteredBooks.length})
          </button>
          <button
            onClick={() => setActiveTab('courses')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'courses' ? 'bg-[#0F3B42] text-white shadow-sm' : 'text-[#175A67] hover:bg-white/60'
            }`}
          >
            <BookCheck className="w-3.5 h-3.5" />
            Course Recommended
          </button>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <span className="text-xs text-[#2A707C]">
            Showing <strong className="text-[#175A67]">{visibleBooks.length}</strong> books
          </span>
          <div className="flex items-center bg-white/70 border border-white/80 rounded-xl p-1 shadow-sm">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg ${viewMode === 'grid' ? 'bg-[#0F3B42] text-white' : 'text-[#175A67]'}`}
              title="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg ${viewMode === 'list' ? 'bg-[#0F3B42] text-white' : 'text-[#175A67]'}`}
              title="List view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* E-Book Cards */}
      {isLoadingBooks ? (
        <div className="bg-white/70 rounded-2xl p-12 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-[#0F3B42] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-semibold text-sm text-[#0B1C30]">Loading e-books…</p>
        </div>
      ) : visibleBooks.length === 0 ? (
        <div className="bg-white/70 rounded-2xl p-10 text-center">
          <SearchX className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="font-semibold text-sm text-[#0B1C30]">
            {uploadedBooks.length === 0 && !q ? 'No e-books available yet.' : 'No e-books found'}
          </p>
          <p className="text-xs text-[#2A707C] mt-0.5">
            {uploadedBooks.length === 0 && !q
              ? 'E-books uploaded to the library will appear here.'
              : 'Try clearing search or switching tabs.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleBooks.map((book: EBook) => {
            const isSaved = bookmarkedIds.includes(book.id);
            const pct = book.totalPages > 0 ? Math.round((book.pagesRead / book.totalPages) * 100) : 0;
            return (
              <article
                key={book.id}
                className="bg-white rounded-2xl border border-white/80 p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0 pr-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#175A67] bg-[#EAF3F1] px-2.5 py-1 rounded-md">
                        {book.subject}
                      </span>
                      {book.courseTitle && (
                        <span
                          className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[140px]"
                          title={book.courseTitle}
                        >
                          {book.courseTitle}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleToggleBookmark(book)}
                      title={isSaved ? 'Remove from bookmarks' : 'Save to bookmarks'}
                      className="p-1 rounded-full hover:bg-slate-100 transition-colors"
                    >
                      <Heart className={`w-4 h-4 ${isSaved ? 'text-red-500 fill-red-500' : 'text-slate-400'}`} />
                    </button>
                  </div>

                  <div className="h-24 rounded-xl bg-gradient-to-br from-[#14363C] via-[#0F2A2F] to-[#0A1C20] flex items-center justify-between px-4 text-white mb-3.5">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-teal-300" />
                    </div>
                    {book.rating && (
                      <span className="flex items-center gap-1 text-xs font-bold text-amber-300 bg-black/30 px-2 py-1 rounded-md">
                        <Star className="w-3.5 h-3.5 fill-amber-300" />
                        {book.rating}
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-[15px] text-[#0B1C30] leading-snug min-h-[2.5rem]">
                    {book.title}
                  </h3>

                  <div className="mt-2.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-[#2A707C]">
                      <span>{pct}% Read</span>
                      <span>
                        {book.pagesRead} / {book.totalPages} pgs
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-600 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => handleToggleSavePdf(book)}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-semibold active:scale-95 cursor-pointer transition-all ${
                      savedPdfIds.includes(book.id)
                        ? 'bg-amber-50 border-amber-300 text-amber-700 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-[#0B1C30]'
                    }`}
                    title={savedPdfIds.includes(book.id) ? 'Saved in Bookmarks' : 'Save PDF to Bookmarks'}
                  >
                    <Bookmark
                      className={`w-3.5 h-3.5 ${
                        savedPdfIds.includes(book.id) ? 'fill-current text-amber-600' : 'text-[#175A67]'
                      }`}
                    />
                    {savedPdfIds.includes(book.id) ? 'Saved' : 'Save PDF'}
                  </button>
                  <button
                    onClick={() => handleReadBook(book)}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#0F3B42] hover:bg-[#0b2c31] text-white text-xs font-semibold shadow-sm active:scale-95 cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Read
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {visibleBooks.map((book: EBook) => {
            const isSaved = bookmarkedIds.includes(book.id);
            const pct = book.totalPages > 0 ? Math.round((book.pagesRead / book.totalPages) * 100) : 0;
            return (
              <article
                key={book.id}
                className="bg-white rounded-2xl border border-white/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-[#0F3B42] text-teal-300 flex items-center justify-center shrink-0">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#175A67] bg-[#EAF3F1] px-2 py-0.5 rounded">
                        {book.subject}
                      </span>
                      {book.rating && (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-amber-500">
                          <Star className="w-3 h-3 fill-amber-500" />
                          {book.rating}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-sm text-[#0B1C30] truncate">{book.title}</h3>
                    <div className="flex items-center gap-3 text-[11px] text-[#2A707C] mt-1">
                      <span>{pct}% Read</span>
                      <span>·</span>
                      <span>
                        {book.pagesRead} / {book.totalPages} pgs
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleBookmark(book)}
                    className="p-2 rounded-xl hover:bg-slate-100"
                    title={isSaved ? 'Remove' : 'Bookmark'}
                  >
                    <Heart className={`w-4 h-4 ${isSaved ? 'text-red-500 fill-red-500' : 'text-slate-400'}`} />
                  </button>
                  <button
                    onClick={() => handleToggleSavePdf(book)}
                    className={`p-2 rounded-xl transition-all cursor-pointer ${
                      savedPdfIds.includes(book.id) ? 'text-amber-500 bg-amber-50' : 'text-[#175A67] hover:bg-slate-100'
                    }`}
                    title={savedPdfIds.includes(book.id) ? 'Saved in Bookmarks' : 'Save PDF to Bookmarks'}
                  >
                    <Bookmark className={`w-4 h-4 ${savedPdfIds.includes(book.id) ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    onClick={() => handleReadBook(book)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F3B42] text-white text-xs font-bold cursor-pointer hover:bg-[#0b2c31] active:scale-95"
                  >
                    Read
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Protected In-App E-Book Reader Modal (Rendered via Portal to document.body) */}
      {activeReadingBook &&
        activeReadingBook.pdfUrl &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[100] m-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
            <div className="bg-[#0B1C30] rounded-3xl overflow-hidden max-w-4xl w-full h-[90vh] flex flex-col shadow-2xl border border-white/10">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 py-3.5 bg-[#0F3B42] text-white border-b border-white/10">
                <div className="flex items-center gap-2.5 min-w-0 pr-4">
                  <BookOpen className="w-5 h-5 text-teal-300 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm sm:text-base truncate">{activeReadingBook.title}</h3>
                    <p className="text-[11px] text-teal-200/80 flex items-center gap-1.5">
                      <span>🔒 Protected E-Book</span>
                      <span>•</span>
                      <span>Device download disabled</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleSavePdf(activeReadingBook)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      savedPdfIds.includes(activeReadingBook.id)
                        ? 'bg-amber-400 text-slate-900 font-bold'
                        : 'bg-white/15 hover:bg-white/25 text-white'
                    }`}
                    title="Save to your Bookmarks"
                  >
                    <Bookmark
                      className={`w-3.5 h-3.5 ${
                        savedPdfIds.includes(activeReadingBook.id) ? 'fill-current' : ''
                      }`}
                    />
                    <span className="hidden sm:inline">
                      {savedPdfIds.includes(activeReadingBook.id) ? 'Saved in Bookmarks' : 'Save to Bookmarks'}
                    </span>
                  </button>

                  <a
                    href={activeReadingBook.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>

                  <button
                    onClick={() => setActiveReadingBook(null)}
                    className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    title="Close viewer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Embedded PDF iframe with loading & error states */}
              <div className="flex-1 bg-slate-900 relative">
                {pdfLoading && !pdfError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 z-10 text-white space-y-2">
                    <div className="w-8 h-8 border-3 border-teal-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-slate-300">Loading PDF from storage…</span>
                  </div>
                )}
                {pdfError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center space-y-3">
                    <AlertCircle className="w-10 h-10 text-rose-400" />
                    <p className="text-sm font-semibold">{pdfError}</p>
                    <a
                      href={activeReadingBook.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold"
                    >
                      Open PDF Directly
                    </a>
                  </div>
                ) : (
                  <iframe
                    src={`${activeReadingBook.pdfUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                    className="w-full h-full border-0"
                    title={activeReadingBook.title}
                    onLoad={() => setPdfLoading(false)}
                    onError={() => {
                      setPdfLoading(false);
                      setPdfError('Unable to load PDF inside viewer.');
                    }}
                  />
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {toast &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] m-0 bg-[#175A67] text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
            <span>{toast}</span>
          </div>,
          document.body
        )}
    </div>
  );
}

export default EBookLibraryView;
