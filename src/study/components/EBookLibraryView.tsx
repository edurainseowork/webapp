import React, { useState, useEffect } from 'react';
import {
  Heart,
  Star,
  Download,
  BookOpen,
  LayoutGrid,
  List,
  ChevronRight,
  CheckCircle2,
  SearchX,
  BookCheck,
} from 'lucide-react';
import { SubPageHeader } from './SubPageHeader';
import { isBookmarked, toggleBookBookmark, onBookmarksChange } from '../utils/bookmarkStorage';

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
}

interface EBookLibraryViewProps {
  onBack?: () => void;
  onGoLibrary?: () => void;
  onOpenBook?: (book: EBook) => void;
  searchQuery?: string;
}

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

export const BOOKS: EBook[] = [
  { id: 'phy-modern', title: 'Modern Physics', subject: 'Physics', totalPages: 246, pagesRead: 45, rating: 4.95, isCourseBook: true },
  { id: 'phy-pyq', title: "JEE Advanced 45-Year PYQ's", subject: 'Physics', totalPages: 420, pagesRead: 180, rating: 4.98, isCourseBook: false },
  { id: 'phy-electro', title: 'Electrodynamics & Magnetism', subject: 'Physics', totalPages: 194, pagesRead: 160, rating: 4.92, isCourseBook: true },
  { id: 'phy-mechanics', title: 'Concepts of Physics Vol. 1', subject: 'Physics', totalPages: 380, pagesRead: 110, rating: 4.89, isCourseBook: true },
  { id: 'chem-organic', title: 'Advanced Organic Chemistry', subject: 'Chemistry', totalPages: 520, pagesRead: 310, rating: 4.95, isCourseBook: true },
  { id: 'chem-inorganic', title: 'Inorganic Coordination & d-Block', subject: 'Chemistry', totalPages: 360, pagesRead: 240, rating: 4.88, isCourseBook: false },
  { id: 'chem-physical', title: 'Physical Chemistry Numerical Drills', subject: 'Chemistry', totalPages: 700, pagesRead: 300, rating: 4.91, isCourseBook: true },
  { id: 'math-calc', title: 'Differential & Integral Calculus', subject: 'Mathematics', totalPages: 580, pagesRead: 420, rating: 4.96, isCourseBook: true },
  { id: 'math-vectors', title: 'Vectors, 3D Geometry & Matrices', subject: 'Mathematics', totalPages: 340, pagesRead: 280, rating: 4.9, isCourseBook: false },
  { id: 'math-algebra', title: 'Complex Numbers & Probability', subject: 'Mathematics', totalPages: 200, pagesRead: 110, rating: 4.87, isCourseBook: true },
];

/* ------------------------------------------------------------------ */
/*  Main View                                                          */
/* ------------------------------------------------------------------ */

export function EBookLibraryView({
  onBack,
  onGoLibrary,
  onOpenBook,
  searchQuery = '',
}: EBookLibraryViewProps) {
  const [activeTab, setActiveTab] = useState<EBookTab>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setBookmarkedIds(BOOKS.filter((b) => isBookmarked(b.id)).map((b) => b.id));
    sync();
    return onBookmarksChange(sync);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const handleToggleBookmark = (book: EBook) => {
    const saved = toggleBookBookmark(book);
    setBookmarkedIds((prev) => (saved ? [...prev, book.id] : prev.filter((id) => id !== book.id)));
    showToast(saved ? `Added "${book.title}" to Bookmarks` : `Removed "${book.title}" from Bookmarks`);
  };

  const q = searchQuery.trim().toLowerCase();
  const pool = q
    ? BOOKS.filter((b) => b.title.toLowerCase().includes(q) || b.subject.toLowerCase().includes(q))
    : BOOKS;

  const visibleBooks = activeTab === 'all' ? pool : pool.filter((b) => b.isCourseBook);

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

      {/* Category Tabs: All E-Books & Courses E-Books */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-white/70 border border-white/80 p-1 rounded-2xl self-start">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'all' ? 'bg-[#0F3B42] text-white shadow-sm' : 'text-[#175A67] hover:bg-white/60'
            }`}
          >
            All E-Books ({pool.length})
          </button>
          <button
            onClick={() => setActiveTab('courses')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'courses' ? 'bg-[#0F3B42] text-white shadow-sm' : 'text-[#175A67] hover:bg-white/60'
            }`}
          >
            <BookCheck className="w-3.5 h-3.5" />
            Courses E-Books
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
      {visibleBooks.length === 0 ? (
        <div className="bg-white/70 rounded-2xl p-10 text-center">
          <SearchX className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="font-semibold text-sm text-[#0B1C30]">No e-books found</p>
          <p className="text-xs text-[#2A707C] mt-0.5">Try clearing search or switching tabs.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleBooks.map((book) => {
            const isSaved = bookmarkedIds.includes(book.id);
            const pct = book.totalPages > 0 ? Math.round((book.pagesRead / book.totalPages) * 100) : 0;
            return (
              <article
                key={book.id}
                className="bg-white rounded-2xl border border-white/80 p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#175A67] bg-[#EAF3F1] px-2.5 py-1 rounded-md">
                      {book.subject}
                    </span>
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
                      <span>{book.pagesRead} / {book.totalPages} pgs</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => showToast(`Downloading "${book.title}"…`)}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-[#0B1C30] active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5 text-[#175A67]" />
                    PDF
                  </button>
                  <button
                    onClick={() => (onOpenBook ? onOpenBook(book) : showToast(`Opening "${book.title}"…`))}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#0F3B42] hover:bg-[#0b2c31] text-white text-xs font-semibold shadow-sm active:scale-95"
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
          {visibleBooks.map((book) => {
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
                      <span>{book.pagesRead} / {book.totalPages} pgs</span>
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
                    onClick={() => (onOpenBook ? onOpenBook(book) : showToast(`Opening "${book.title}"…`))}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F3B42] text-white text-xs font-bold"
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

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-[#175A67] text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}

export default EBookLibraryView;
