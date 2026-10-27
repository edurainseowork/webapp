import React, { useEffect, useState, useMemo } from 'react';
import {
  Files,
  FileText,
  Eye,
  Trash2,
  Lock,
  Search,
  X,
  Layers,
  FolderOpen,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  PlusCircle,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
import { SubPageHeader } from './SubPageHeader';
import {
  SavedPdf,
  getSavedPdfs,
  removeSavedPdf,
  toggleSavePdf,
  onSavedPdfsChange,
  INITIAL_SAMPLE_PDFS,
} from '../utils/bookmarkStorage';

interface SavedPdfsViewProps {
  onBack: () => void;
  onGoBookmarks?: () => void;
  onGoLibrary?: () => void;
  onBrowseCourses?: () => void;
  initialSearchQuery?: string;
}

export function SavedPdfsView({
  onBack,
  onGoBookmarks,
  onGoLibrary,
  onBrowseCourses,
  initialSearchQuery = '',
}: SavedPdfsViewProps) {
  const [savedPdfs, setSavedPdfs] = useState<SavedPdf[]>([]);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [activeViewerPdf, setActiveViewerPdf] = useState<SavedPdf | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setSavedPdfs(getSavedPdfs());
    const unsub = onSavedPdfsChange(() => {
      setSavedPdfs(getSavedPdfs());
    });
    return unsub;
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 2800);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setSavedPdfs(getSavedPdfs());
    setTimeout(() => {
      setIsRefreshing(false);
      showToast('Saved PDFs synchronized with Revision Hub');
    }, 450);
  };

  const handleRemove = (pdf: SavedPdf) => {
    removeSavedPdf(pdf.id);
    showToast(`Removed "${pdf.title}" from saved PDFs`);
  };

  const handleRestoreSample = () => {
    INITIAL_SAMPLE_PDFS.forEach((p) => toggleSavePdf(p));
    setSavedPdfs(getSavedPdfs());
    showToast('Restored sample study materials');
  };

  // Derive unique subjects from saved PDFs
  const subjectList = useMemo(() => {
    const set = new Set<string>();
    savedPdfs.forEach((p) => {
      if (p.subject) set.add(p.subject.trim());
    });
    return Array.from(set);
  }, [savedPdfs]);

  // Filter logic
  const filteredPdfs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return savedPdfs.filter((p) => {
      const matchesSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        (p.subject && p.subject.toLowerCase().includes(q)) ||
        (p.courseTitle && p.courseTitle.toLowerCase().includes(q));

      const matchesSubject =
        selectedSubject === 'all' ||
        (p.subject && p.subject.toLowerCase() === selectedSubject.toLowerCase());

      return matchesSearch && matchesSubject;
    });
  }, [savedPdfs, searchQuery, selectedSubject]);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. Header Navigation & Breadcrumbs (Like Picture 2) */}
      <SubPageHeader
        onBack={onBack}
        crumbs={[
          { label: 'Home', onClick: onBack },
          { label: 'Bookmark', onClick: onGoBookmarks || onBack },
          { label: 'Saved PDFs' },
        ]}
        rightElement={
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-xl bg-white/80 hover:bg-white border border-white/80 text-[#175A67] shadow-sm flex items-center justify-center transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              title="Refresh saved materials"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            {onBrowseCourses && (
              <button
                onClick={onBrowseCourses}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/80 hover:bg-white border border-white/80 text-xs font-bold text-[#175A67] shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Explore Courses</span>
              </button>
            )}
          </div>
        }
      />

      {/* 2. Hero Page Title Card (EXACT replica of Picture 2's Bookmark card) */}
      <div className="bg-white/80 backdrop-blur-md border border-white/80 rounded-2xl p-5 sm:p-6 shadow-[0_6px_24px_rgb(0,0,0,0.05)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-[#0F3B42] text-white flex items-center justify-center shadow-md shrink-0">
            <Files className="w-5 h-5 fill-white/20" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-[#0B1C30]">Saved PDFs</h1>
              <span className="text-xs font-bold bg-[#175A67]/10 text-[#175A67] px-2.5 py-0.5 rounded-full">
                {savedPdfs.length}
              </span>
            </div>
            <p className="text-xs text-[#2A707C] mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>Your saved revision PDFs, study notes, and protected course documents</span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 text-[#175A67] font-semibold">
                <Lock className="w-3 h-3" /> Device download is disabled
              </span>
            </p>
          </div>
        </div>

        {/* Search input in header card */}
        <div className="relative w-full md:w-72 shrink-0">
          <Search className="w-4 h-4 text-[#2A707C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in Saved PDFs..."
            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-white/90 hover:bg-white focus:bg-white border border-[#175A67]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#175A67]/30 text-[#0B1C30] placeholder-[#2A707C]/60 transition-all shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded-md"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Filter Chips & Count (if items exist) */}
      {savedPdfs.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs text-[#2A707C] font-semibold">
            <Layers className="w-3.5 h-3.5" />
            <span>{filteredPdfs.length} Documents in Collection</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setSelectedSubject('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                selectedSubject === 'all'
                  ? 'bg-[#0F3B42] text-white shadow-sm'
                  : 'bg-white/70 hover:bg-white text-[#175A67] border border-white/80'
              }`}
            >
              All ({savedPdfs.length})
            </button>
            {subjectList.map((subj) => {
              const count = savedPdfs.filter(
                (p) => p.subject && p.subject.toLowerCase() === subj.toLowerCase()
              ).length;
              const isActive = selectedSubject.toLowerCase() === subj.toLowerCase();
              return (
                <button
                  key={subj}
                  onClick={() => setSelectedSubject(isActive ? 'all' : subj)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-[#0F3B42] text-white shadow-sm'
                      : 'bg-white/70 hover:bg-white text-[#175A67] border border-white/80'
                  }`}
                >
                  {subj} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Main Stacked Container Card (EXACT layout and card stacking from Picture 3) */}
      <div className="rounded-2xl bg-white/70 backdrop-blur-md border border-white/80 p-5 sm:p-6 shadow-[0_6px_24px_rgb(0,0,0,0.04)]">
        {/* Header inside container card (matching "Batch Leaderboard" in Picture 3) */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#175A67]" />
            <h3 className="font-bold text-[#175A67] text-base">Your Saved PDFs</h3>
            <span className="text-xs font-bold bg-[#175A67]/10 text-[#175A67] px-2 py-0.5 rounded-full">
              {filteredPdfs.length}
            </span>
          </div>

          <span className="text-xs text-[#2A707C] font-semibold bg-[#EAF3F1] px-2.5 py-1 rounded-full border border-[#175A67]/15 inline-flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-[#175A67]" />
            <span>In-App Study Only</span>
          </span>
        </div>

        {/* Stacked PDF List (Stacked like rows in Picture 3) */}
        {filteredPdfs.length === 0 ? (
          /* Empty State (Styled like Picture 2 empty state) */
          <div className="py-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#175A67]/10 text-[#175A67] flex items-center justify-center mx-auto mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-sm sm:text-base text-[#0B1C30]">
              {searchQuery || selectedSubject !== 'all'
                ? 'No saved PDFs match your filter'
                : 'No saved PDFs yet'}
            </h3>
            <p className="text-xs text-[#2A707C] max-w-md mx-auto leading-relaxed">
              {searchQuery || selectedSubject !== 'all'
                ? 'Try clearing the search query or selecting a different subject filter tab.'
                : 'Bookmark PDFs from your class material or course lectures to stack them here for protected revision.'}
            </p>
            <div className="pt-3 flex items-center justify-center gap-3 flex-wrap">
              {onBrowseCourses && (
                <button
                  onClick={onBrowseCourses}
                  className="px-4 py-2.5 rounded-xl bg-[#0F3B42] hover:bg-[#0b2c31] text-white text-xs font-bold transition-all shadow-sm active:scale-95 inline-flex items-center gap-2 cursor-pointer"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>Explore Courses</span>
                </button>
              )}
              <button
                onClick={handleRestoreSample}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-[#175A67]/25 text-[#175A67] text-xs font-bold transition-all shadow-xs active:scale-95 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Restore Sample Study Material</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredPdfs.map((pdf, index) => {
              // Rank badge styling matching Picture 3 ranks (#1 gold, #2 silver, #3 bronze, #4+ teal)
              const rank = index + 1;
              const rankBadgeClass =
                rank === 1
                  ? 'bg-amber-400 text-slate-900 shadow-sm'
                  : rank === 2
                  ? 'bg-slate-300 text-slate-800'
                  : rank === 3
                  ? 'bg-amber-700 text-white'
                  : 'bg-[#175A67] text-white';

              return (
                <div
                  key={pdf.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 rounded-xl border border-slate-200/60 bg-white/80 hover:bg-white hover:border-[#175A67]/35 hover:shadow-sm transition-all backdrop-blur-sm gap-3 group"
                >
                  {/* Left Side: Index Badge (#1, #2...) + Red Document Icon + Title + Meta */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Rank Badge from Picture 3 */}
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${rankBadgeClass}`}
                      title={`Item #${rank}`}
                    >
                      #{rank}
                    </div>

                    {/* Pink/Red Document Icon from Picture 1 */}
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-50 border border-rose-100/80 text-rose-500 flex items-center justify-center shrink-0 shadow-xs">
                      <FileText className="w-5 h-5" />
                    </div>

                    {/* Title & Metadata */}
                    <div className="min-w-0">
                      <h4
                        onClick={() => setActiveViewerPdf(pdf)}
                        className="text-xs sm:text-sm font-bold text-[#0B1C30] group-hover:text-[#175A67] cursor-pointer truncate transition-colors leading-snug"
                        title={pdf.title}
                      >
                        {pdf.title}
                      </h4>

                      <div className="flex items-center gap-2 mt-1 text-[11px] text-[#2A707C] flex-wrap">
                        {pdf.subject && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#EAF3F1] text-[#175A67] border border-[#175A67]/15">
                            {pdf.subject}
                          </span>
                        )}
                        <span className="font-medium text-[#2A707C]">
                          {pdf.courseTitle || 'Class 11th Mathematics'}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="font-medium text-[#2A707C]">
                          {pdf.fileSize || '1.2 MB'}
                        </span>
                        <span className="px-1.5 py-0.2 bg-[#10B981] text-white text-[9px] font-bold rounded shrink-0">
                          PROTECTED
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Side: "Study" Button + Trash Icon from Picture 1 */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0 pl-2">
                    <button
                      onClick={() => setActiveViewerPdf(pdf)}
                      className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-full bg-[#0F3B42] hover:bg-[#0b2c31] text-white text-xs font-bold transition-all shadow-sm active:scale-95 inline-flex items-center gap-1.5 cursor-pointer hover:shadow-md"
                      title="Read PDF in protected in-app viewer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Study</span>
                    </button>

                    <button
                      onClick={() => handleRemove(pdf)}
                      className="p-2 sm:p-2.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Remove from saved PDFs"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Footer Notice Card (Matching Picture 1 Modal Footer) */}
      <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-white/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#2A707C] font-semibold">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-[#175A67] shrink-0" />
          <span>Device downloads disabled • In-app study only</span>
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>EduRain Revision Hub</span>
        </div>
      </div>

      {/* 6. Protected In-App PDF Reader Modal */}
      {activeViewerPdf && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
          <div className="bg-[#0B1C30] rounded-3xl overflow-hidden max-w-5xl w-full h-[92vh] flex flex-col shadow-2xl border border-white/10">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#0F3B42] text-white border-b border-white/10">
              <div className="flex items-center gap-2.5 min-w-0 pr-4">
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-300 flex items-center justify-center shrink-0">
                  <FileText className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm sm:text-base truncate">{activeViewerPdf.title}</h3>
                  <p className="text-[11px] text-teal-200/80 flex items-center gap-1.5 truncate">
                    <Lock className="w-3 h-3 text-teal-300" />
                    <span>Protected Study Material</span>
                    <span>•</span>
                    <span>{activeViewerPdf.courseTitle || 'EduRain Revision Hub'}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    handleRemove(activeViewerPdf);
                    setActiveViewerPdf(null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Remove from saved PDFs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Remove</span>
                </button>

                <button
                  onClick={() => setActiveViewerPdf(null)}
                  className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
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
        </div>
      )}

      {/* 7. Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] bg-[#0F3B42] text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 animate-fadeIn border border-white/20">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}

export default SavedPdfsView;
