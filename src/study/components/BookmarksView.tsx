import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bookmark,
  History,
  RotateCcw,
  Play,
  Clock3,
  ArrowRight,
  FolderOpen,
  Files,
  ExternalLink,
  FilePlus2,
  BookOpen,
  Heart,
  BookMarked,
  FileText,
  Trash2,
  Eye,
  Lock,
  X,
} from 'lucide-react';
import { SubPageHeader } from './SubPageHeader';
import { EBook } from './EBookLibraryView';
import {
  getBookmarkedBooks,
  removeBookmark,
  onBookmarksChange,
  SavedPdf,
  getSavedPdfs,
  removeSavedPdf,
  onSavedPdfsChange,
} from '../utils/bookmarkStorage';

/* ------------------------------------------------------------------ */
/*  Types & mock data                                                  */
/* ------------------------------------------------------------------ */

export interface HistoryVideo {
  id: string;
  badge: string;
  badgeColor: string;
  title: string;
  duration: string;
}

const HISTORY_VIDEOS: HistoryVideo[] = [
  {
    id: 'h1',
    badge: 'Physics • 12th',
    badgeColor: 'bg-amber-100 text-amber-800',
    title: "Electrostatics – Gauss's Law Applications",
    duration: '45:10',
  },
  {
    id: 'h2',
    badge: 'Biology • 11th',
    badgeColor: 'bg-amber-100 text-amber-800',
    title: 'Human Physiology: Chemical Coordination',
    duration: '32:00',
  },
  {
    id: 'h3',
    badge: 'Dropper Special',
    badgeColor: 'bg-orange-100 text-orange-800',
    title: 'Thermodynamics & Heat Transfer PYQs',
    duration: '58:15',
  },
];

interface BookmarksViewProps {
  onBack: () => void;
  onGoLibrary?: () => void;
  searchQuery?: string;
  onClearHistory?: () => void;
  onWatchVideo?: (video: HistoryVideo) => void;
  onOpenPdfViewer?: () => void;
  onOpenSavedPdfsPage?: () => void;
  onOpenWatchLater?: () => void;
  onAddDocument?: () => void;
  onOpenEbook?: (book: EBook) => void;
  onBrowseEbooks?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Main view                                                           */
/* ------------------------------------------------------------------ */

export function BookmarksView({
  onBack,
  onGoLibrary,
  searchQuery = '',
  onClearHistory,
  onWatchVideo,
  onOpenPdfViewer,
  onOpenSavedPdfsPage,
  onOpenWatchLater,
  onAddDocument,
  onOpenEbook,
  onBrowseEbooks,
}: BookmarksViewProps) {
  const [bookmarkedBooks, setBookmarkedBooks] = useState<EBook[]>([]);
  const [savedPdfs, setSavedPdfs] = useState<SavedPdf[]>([]);
  const [isSavedPdfsOpen, setIsSavedPdfsOpen] = useState(false);
  const [activeViewerPdf, setActiveViewerPdf] = useState<SavedPdf | null>(null);
  const [activeReadingBook, setActiveReadingBook] = useState<EBook | null>(null);

  useEffect(() => {
    setBookmarkedBooks(getBookmarkedBooks());
    const unsubscribe = onBookmarksChange(() => {
      setBookmarkedBooks(getBookmarkedBooks());
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    setSavedPdfs(getSavedPdfs());
    const unsubPdfs = onSavedPdfsChange(() => {
      setSavedPdfs(getSavedPdfs());
    });
    return unsubPdfs;
  }, []);

  const q = searchQuery.trim().toLowerCase();

  const filteredVideos = HISTORY_VIDEOS.filter(
    (v) => !q || v.title.toLowerCase().includes(q) || v.badge.toLowerCase().includes(q)
  );

  const filteredBooks = bookmarkedBooks.filter(
    (b) =>
      !q ||
      b.title.toLowerCase().includes(q) ||
      b.subject.toLowerCase().includes(q)
  );

  const filteredSavedPdfs = savedPdfs.filter(
    (p) =>
      !q ||
      p.title.toLowerCase().includes(q) ||
      (p.courseTitle && p.courseTitle.toLowerCase().includes(q)) ||
      (p.subject && p.subject.toLowerCase().includes(q))
  );

  return (
    <div className="bg-[#DCEAE3] rounded-[28px] p-4 sm:p-6 lg:p-8 pb-10 relative space-y-6">
      {/* 1. Standardized Back Button + Breadcrumb */}
      <SubPageHeader
        onBack={onBack}
        crumbs={[
          { label: 'Home', onClick: onBack },
          { label: 'Library', onClick: onGoLibrary || onBack },
          { label: 'Bookmark' },
        ]}
      />

      {/* Page title card */}
      <div className="bg-white/80 backdrop-blur-md border border-white/80 rounded-2xl p-5 sm:p-6 shadow-[0_6px_24px_rgb(0,0,0,0.05)] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#0F3B42] text-white flex items-center justify-center shadow-md shrink-0">
            <Bookmark className="w-5 h-5 fill-white/20" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0B1C30]">Bookmark</h1>
            <p className="text-xs text-[#2A707C] mt-0.5">
              Your saved revision videos, bookmarked e-books, and study material
            </p>
          </div>
        </div>
      </div>

      {/* 3. Bookmarked E-Books Section (Linked to Heart Selection) */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-[#175A67]" />
            <h2 className="text-base sm:text-lg font-bold text-[#0B1C30]">Saved E-Books</h2>
            <span className="text-xs font-bold bg-[#175A67]/10 text-[#175A67] px-2.5 py-0.5 rounded-full">
              {bookmarkedBooks.length}
            </span>
          </div>
          {onBrowseEbooks && (
            <button
              onClick={onBrowseEbooks}
              className="text-xs sm:text-sm font-semibold text-[#175A67] hover:underline flex items-center gap-1"
            >
              Browse Library
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {filteredBooks.length === 0 ? (
          <div className="bg-white/70 backdrop-blur-md border border-white/80 rounded-2xl p-6 sm:p-8 text-center shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-[#175A67]/10 text-[#175A67] flex items-center justify-center mx-auto mb-3">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-sm sm:text-base text-[#0B1C30]">
              {q ? 'No saved e-books match your search' : 'No saved e-books yet'}
            </h3>
            <p className="text-xs text-[#2A707C] mt-1 max-w-md mx-auto">
              {q
                ? 'Try a different search term in the top header search bar.'
                : 'Click the heart icon on any e-book in the E-Book Library to pin it here for quick access!'}
            </p>
            {onBrowseEbooks && !q && (
              <button
                onClick={onBrowseEbooks}
                className="mt-4 px-4 py-2 rounded-xl bg-[#0F3B42] hover:bg-[#0b2c31] text-white text-xs font-bold transition-all shadow-sm active:scale-95 inline-flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Explore E-Books
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredBooks.map((book) => {
              const pct = book.totalPages > 0 ? Math.round((book.pagesRead / book.totalPages) * 100) : 0;
              return (
                <div
                  key={book.id}
                  className="bg-white rounded-2xl border border-white/80 p-5 shadow-[0_6px_24px_rgb(0,0,0,0.05)] hover:shadow-[0_10px_30px_rgb(0,0,0,0.08)] transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-[#175A67]/10 text-[#175A67] px-2.5 py-1 rounded-md">
                        {book.subject}
                      </span>
                      <button
                        onClick={() => removeBookmark(book.id)}
                        title="Remove from bookmarks"
                        className="p-1 rounded-full hover:bg-red-50 text-red-500 transition-colors"
                      >
                        <Heart className="w-4 h-4 fill-red-500" />
                      </button>
                    </div>

                    <h3 className="font-bold text-[#0B1C30] text-sm sm:text-base leading-snug line-clamp-2 min-h-[2.6rem]">
                      {book.title}
                    </h3>

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-[#2A707C] mb-1">
                        <span>{pct}% Read</span>
                        <span>
                          {book.pagesRead} / {book.totalPages} pgs
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (book.pdfUrl) {
                        setActiveReadingBook(book);
                      } else if (onOpenEbook) {
                        onOpenEbook(book);
                      }
                    }}
                    className="mt-4 w-full flex items-center justify-center gap-1.5 bg-[#0F3B42] hover:bg-[#0b2c31] text-white font-bold text-xs py-2.5 rounded-xl transition-all active:scale-95 shadow-sm"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Read Now
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. History (Videos) */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-4.5 h-4.5 text-[#175A67]" />
            <h2 className="text-base sm:text-lg font-bold text-[#0B1C30]">History</h2>
          </div>
          <button
            onClick={onClearHistory}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#175A67] hover:underline"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Clear All
          </button>
        </div>

        {filteredVideos.length === 0 ? (
          <div className="bg-white/70 rounded-2xl p-6 text-center text-xs text-[#2A707C]">
            No video history matching your search.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredVideos.map((video) => (
              <div key={video.id} className="bg-white rounded-2xl overflow-hidden shadow-[0_6px_24px_rgb(0,0,0,0.05)] border border-white/80">
                <button
                  onClick={() => onWatchVideo?.(video)}
                  className="relative w-full aspect-video bg-gradient-to-br from-[#0f2e2c] to-[#03110d] flex items-center justify-center group"
                >
                  <span className={`absolute top-3 left-3 text-[10px] font-bold px-2.5 py-1 rounded-full ${video.badgeColor}`}>
                    {video.badge}
                  </span>
                  <span className="w-11 h-11 rounded-full bg-white/90 group-hover:bg-white flex items-center justify-center transition-all group-hover:scale-105 shadow-md">
                    <Play className="w-4.5 h-4.5 text-[#0F3B42] fill-[#0F3B42] ml-0.5" />
                  </span>
                  <span className="absolute bottom-3 right-3 flex items-center gap-1 text-[10px] font-semibold text-white bg-black/40 px-2 py-1 rounded-md">
                    <Clock3 className="w-3 h-3" />
                    {video.duration}
                  </span>
                </button>

                <div className="p-4">
                  <h3 className="text-sm font-bold text-[#0B1C30] leading-snug min-h-[2.5rem]">{video.title}</h3>
                  <button
                    onClick={() => onWatchVideo?.(video)}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 bg-[#0F3B42] hover:bg-[#0b2c31] text-white font-bold text-xs py-2.5 rounded-xl transition-all active:scale-95"
                  >
                    Watch Now
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. Wishlist */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4.5 h-4.5 text-[#175A67]" />
            <h2 className="text-base sm:text-lg font-bold text-[#0B1C30]">Wishlist</h2>
          </div>
          <button
            onClick={onAddDocument}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#175A67] hover:underline"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            Add Document
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Your Saved PDF */}
          <div className="bg-white rounded-2xl p-5 shadow-[0_6px_24px_rgb(0,0,0,0.05)] border border-white/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-[#EAF3F1] text-[#175A67] flex items-center justify-center shrink-0">
                    <Files className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-[#0B1C30]">Your Saved PDF</h3>
                    <p className="text-[11px] text-[#2A707C]">
                      Saved notes &amp; formula sheets ({savedPdfs.length} saved)
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold bg-[#175A67]/10 text-[#175A67] px-2.5 py-0.5 rounded-full">
                  {savedPdfs.length}
                </span>
              </div>
              <div className="text-[11px] text-[#175A67] bg-[#EAF3F1]/80 border border-[#175A67]/15 rounded-xl p-2.5 mb-4 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>Protected notes • Device downloads disabled. Study inside the portal.</span>
              </div>
            </div>
            <button
              onClick={() => {
                if (onOpenSavedPdfsPage) {
                  onOpenSavedPdfsPage();
                } else {
                  setIsSavedPdfsOpen(true);
                  onOpenPdfViewer?.();
                }
              }}
              className="w-full flex items-center justify-center gap-1.5 bg-[#0F3B42] hover:bg-[#0b2c31] text-white font-bold text-xs py-2.5 rounded-xl transition-all active:scale-95 shadow-sm cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Saved PDFs Page ({savedPdfs.length})
            </button>
          </div>

          {/* Watch Later */}
          <div className="bg-white rounded-2xl p-5 shadow-[0_6px_24px_rgb(0,0,0,0.05)] border border-white/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#EAF3F1] text-[#175A67] flex items-center justify-center shrink-0">
                  <Play className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#0B1C30]">Watch Later</h3>
                  <p className="text-xs text-[#2A707C]">Lectures queued for weekend revision</p>
                </div>
              </div>
            </div>
            <button
              onClick={onOpenWatchLater}
              className="w-full flex items-center justify-center gap-1.5 bg-[#0F3B42] hover:bg-[#0b2c31] text-white font-bold text-xs py-2.5 rounded-xl transition-all active:scale-95"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View Queue
            </button>
          </div>
        </div>
      </section>

      {/* 6. Saved PDFs Collection Modal (Rendered via Portal to document.body) */}
      {isSavedPdfsOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[90] m-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
            <div className="bg-[#EAE3DE] border border-[#175A67]/20 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-white/80 border-b border-[#175A67]/15">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#175A67] text-white flex items-center justify-center shadow-sm">
                    <Files className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg text-[#0B1C30]">Your Saved PDFs</h3>
                      <span className="text-xs font-bold bg-[#175A67]/10 text-[#175A67] px-2 py-0.5 rounded-full">
                        {savedPdfs.length}
                      </span>
                    </div>
                    <p className="text-xs text-[#2A707C]">In-app study collection • Device download is disabled</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {onOpenSavedPdfsPage && (
                    <button
                      onClick={() => {
                        setIsSavedPdfsOpen(false);
                        onOpenSavedPdfsPage();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#0F3B42] hover:bg-[#0b2c31] text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
                      title="Open as full dedicated page"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Full Page</span>
                    </button>
                  )}
                  <button
                    onClick={() => setIsSavedPdfsOpen(false)}
                    className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-black/5 transition-colors"
                    title="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content List */}
              <div className="p-6 overflow-y-auto flex-1 space-y-3">
                {filteredSavedPdfs.length === 0 ? (
                  <div className="bg-white/80 rounded-2xl p-8 text-center border border-white/80 shadow-sm">
                    <div className="w-12 h-12 rounded-2xl bg-[#175A67]/10 text-[#175A67] flex items-center justify-center mx-auto mb-3">
                      <FileText className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-base text-[#0B1C30]">
                      {q ? 'No saved PDFs match your search' : 'No saved PDFs yet'}
                    </h4>
                    <p className="text-xs text-[#2A707C] mt-1.5 max-w-md mx-auto leading-relaxed">
                      {q
                        ? 'Try searching with a different term.'
                        : 'Students cannot download PDFs to their devices. Instead, open "Your Class Material" or "Your E-Book" and click the bookmark icon on any PDF notes to save it here for in-app reading.'}
                    </p>
                    {onGoLibrary && !q && (
                      <button
                        onClick={() => {
                          setIsSavedPdfsOpen(false);
                          onGoLibrary();
                        }}
                        className="mt-4 px-4 py-2 rounded-xl bg-[#0F3B42] hover:bg-[#0b2c31] text-white text-xs font-bold transition-all shadow-sm active:scale-95 inline-flex items-center gap-1.5"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        Browse Class Material
                      </button>
                    )}
                  </div>
                ) : (
                  filteredSavedPdfs.map((pdf) => (
                    <div
                      key={pdf.id}
                      className="bg-white rounded-2xl p-4 border border-white/80 shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-[#0B1C30] truncate" title={pdf.title}>
                            {pdf.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#2A707C]">
                            {pdf.subject && (
                              <span className="font-semibold bg-[#175A67]/10 text-[#175A67] px-2 py-0.5 rounded-md">
                                {pdf.subject}
                              </span>
                            )}
                            {pdf.courseTitle && (
                              <span className="truncate max-w-[150px]">{pdf.courseTitle}</span>
                            )}
                            {pdf.fileSize && <span>• {pdf.fileSize}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setActiveViewerPdf(pdf)}
                          className="px-3.5 py-2 rounded-xl bg-[#0F3B42] hover:bg-[#0b2c31] text-white text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Study</span>
                        </button>
                        <button
                          onClick={() => removeSavedPdf(pdf.id)}
                          className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Remove from saved PDFs"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 bg-white/60 border-t border-[#175A67]/10 text-[11px] text-[#2A707C] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#175A67]" />
                  Device downloads disabled • In-app study only
                </span>
                <span>EduRain Revision Hub</span>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 7. Protected In-App PDF Reader Modal (Rendered via Portal to document.body) */}
      {activeViewerPdf &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[110] m-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
            <div className="bg-[#0B1C30] rounded-3xl overflow-hidden max-w-5xl w-full h-[92vh] flex flex-col shadow-2xl border border-white/10">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 py-3.5 bg-[#0F3B42] text-white border-b border-white/10">
                <div className="flex items-center gap-2.5 min-w-0 pr-4">
                  <FileText className="w-5 h-5 text-teal-300 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm sm:text-base truncate">{activeViewerPdf.title}</h3>
                    <p className="text-[11px] text-teal-200/80 flex items-center gap-1.5">
                      <Lock className="w-3 h-3" />
                      <span>Protected Study Material</span>
                      <span>•</span>
                      <span>Device download disabled</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      removeSavedPdf(activeViewerPdf.id);
                      setActiveViewerPdf(null);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                    title="Remove from saved PDFs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Remove</span>
                  </button>

                  <button
                    onClick={() => setActiveViewerPdf(null)}
                    className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                    title="Close viewer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* PDF Viewer Frame */}
              <div className="flex-1 bg-slate-900 relative">
                <iframe
                  src={`${activeViewerPdf.mediaUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                  className="w-full h-full border-0 select-none"
                  title={activeViewerPdf.title}
                  onContextMenu={(e) => e.preventDefault()}
                />
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 8. Protected In-App E-Book Reader Modal (Rendered via Portal to document.body) */}
      {activeReadingBook &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[110] m-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
            <div className="bg-[#0B1C30] rounded-3xl overflow-hidden max-w-5xl w-full h-[92vh] flex flex-col shadow-2xl border border-white/10">
              <div className="flex items-center justify-between px-5 py-3.5 bg-[#0F3B42] text-white border-b border-white/10">
                <div className="flex items-center gap-2.5 min-w-0 pr-4">
                  <BookOpen className="w-5 h-5 text-teal-300 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm sm:text-base truncate">{activeReadingBook.title}</h3>
                    <p className="text-[11px] text-teal-200/80 flex items-center gap-1.5">
                      <Lock className="w-3 h-3" />
                      <span>Protected Study E-Book</span>
                      <span>•</span>
                      <span>Device download disabled</span>
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveReadingBook(null)}
                  className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                  title="Close reader"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 bg-slate-900 relative">
                <iframe
                  src={`${activeReadingBook.pdfUrl || ''}#toolbar=0&navpanes=0&scrollbar=1`}
                  className="w-full h-full border-0 select-none"
                  title={activeReadingBook.title}
                  onContextMenu={(e) => e.preventDefault()}
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export default BookmarksView;
