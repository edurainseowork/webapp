import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BookOpen,
  Folder,
  FolderOpen,
  CheckCircle2,
  FileText,
  Video,
  Play,
  ExternalLink,
  Download,
  Bookmark,
  RefreshCw,
  X,
  Layers,
  ChevronRight,
  ArrowLeft,
  AlertCircle,
  Eye,
  Swords,
} from 'lucide-react';
import { SubPageHeader, type BreadcrumbCrumb } from './SubPageHeader';
import { apiFetch, ApiError } from '../lib/api';
import { toggleSavePdf, getSavedPdfs, onSavedPdfsChange } from '../utils/bookmarkStorage';

export type ContentType = 'folder' | 'video' | 'pdf' | 'note' | 'quiz';

export interface ContentItem {
  id: string;
  courseId: number | string;
  parentId: string | null;
  title: string;
  type: ContentType;
  mediaUrl: string | null;
  fileSize?: string | null;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CourseSummary {
  id: number;
  title: string;
  category?: string;
  categorySlug?: string;
  thumbnail?: string;
}

interface LibraryViewProps {
  onOpenUpgrade?: () => void;
  onBack?: () => void;
  searchQuery?: string;
  onOpenEbooks?: () => void;
}

function isVimeoUrl(url: string): boolean {
  return /player\.vimeo\.com|vimeo\.com/i.test(url);
}

function getVimeoEmbedUrl(url: string): string {
  if (url.includes('player.vimeo.com/video/')) return url;
  const match = url.match(/vimeo\.com\/(\d+)/);
  if (match) return `https://player.vimeo.com/video/${match[1]}?autoplay=1`;
  return url;
}

export function LibraryView({ onBack, searchQuery: globalSearchQuery = '', onOpenEbooks }: LibraryViewProps) {
  // Course State
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [loadingCourses, setLoadingCourses] = useState(true);

  // Content State
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  // Navigation & Filtering inside Course Material
  const [currentFolder, setCurrentFolder] = useState<ContentItem | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'folder' | 'pdf' | 'video'>('all');

  // Modals & Feedback
  const [activeVideo, setActiveVideo] = useState<ContentItem | null>(null);
  const [activeNote, setActiveNote] = useState<ContentItem | null>(null);
  const [activePdf, setActivePdf] = useState<ContentItem | null>(null);
  const [savedPdfIds, setSavedPdfIds] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setSavedPdfIds(getSavedPdfs().map((p) => p.id));
    sync();
    return onSavedPdfsChange(sync);
  }, []);

  const handleToggleSavePdf = (item: ContentItem) => {
    const isSaved = toggleSavePdf({
      id: String(item.id),
      title: item.title,
      mediaUrl: item.mediaUrl || '',
      courseTitle: selectedCourse?.title,
      courseId: item.courseId,
      fileSize: item.fileSize,
      savedAt: new Date().toISOString(),
    });
    showToast(isSaved ? `Saved "${item.title}" to Your Saved PDF in Bookmarks` : `Removed "${item.title}" from Saved PDFs`);
  };

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // 1. Fetch available courses on mount
  const fetchCourses = useCallback(async () => {
    setLoadingCourses(true);
    try {
      const data = await apiFetch<CourseSummary[]>('/courses');
      if (Array.isArray(data)) {
        setCourses(data);
        if (data.length > 0 && selectedCourseId === null) {
          // Default to first course or course 10/17 if available
          const preferred = data.find((c) => c.id === 10 || c.id === 17) || data[0];
          setSelectedCourseId(preferred.id);
        }
      }
    } catch (err: any) {
      console.error('[LibraryView] Failed to load courses:', err);
    } finally {
      setLoadingCourses(false);
    }
  }, [selectedCourseId]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // 2. Fetch content for the selected course
  const fetchContent = useCallback(async (courseId: number) => {
    setLoadingContent(true);
    setContentError(null);
    try {
      const res = await apiFetch<{ success?: boolean; data?: ContentItem[]; content?: ContentItem[] }>(
        `/courses/${courseId}/content?parentId=all`
      );
      const raw = res.data ?? res.content ?? [];
      setItems(Array.isArray(raw) ? raw : []);
    } catch (err: any) {
      console.error(`[LibraryView] Failed to fetch content for course ${courseId}:`, err);
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setContentError('Course content is locked or requires enrolment.');
      } else {
        setContentError(err?.message || 'Could not load class materials.');
      }
      setItems([]);
    } finally {
      setLoadingContent(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCourseId !== null) {
      setCurrentFolder(null);
      fetchContent(selectedCourseId);
    }
  }, [selectedCourseId, fetchContent]);

  // Active selected course info
  const selectedCourse = useMemo(() => {
    return courses.find((c) => c.id === selectedCourseId) || null;
  }, [courses, selectedCourseId]);

  // Compute item counts inside each folder
  const folderItemCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      if (item.parentId) {
        counts[item.parentId] = (counts[item.parentId] || 0) + 1;
      }
    }
    return counts;
  }, [items]);

  // Filter items by search, current folder level, and type
  const effectiveSearch = globalSearchQuery.trim().toLowerCase();

  const displayedItems = useMemo(() => {
    // If user is searching, search across the entire course hierarchy
    if (effectiveSearch) {
      return items.filter((item) => {
        const matchesQuery = item.title.toLowerCase().includes(effectiveSearch);
        const matchesType = typeFilter === 'all' || item.type === typeFilter;
        return matchesQuery && matchesType;
      });
    }

    // Normal folder view: show items directly at current folder level
    return items.filter((item) => {
      const matchesLevel = currentFolder ? item.parentId === currentFolder.id : !item.parentId;
      const matchesType = typeFilter === 'all' || item.type === typeFilter;
      return matchesLevel && matchesType;
    });
  }, [items, currentFolder, typeFilter, effectiveSearch]);

  // Counts summary for filter tabs
  const summaryCounts = useMemo(() => {
    const levelItems = currentFolder ? items.filter((i) => i.parentId === currentFolder.id) : items.filter((i) => !i.parentId);
    return {
      all: levelItems.length,
      folder: levelItems.filter((i) => i.type === 'folder').length,
      pdf: levelItems.filter((i) => i.type === 'pdf').length,
      video: levelItems.filter((i) => i.type === 'video').length,
    };
  }, [items, currentFolder]);

  // Handle clicking an item
  const handleItemClick = (item: ContentItem) => {
    if (item.type === 'folder') {
      setCurrentFolder(item);
      return;
    }

    if (item.type === 'pdf') {
      if (!item.mediaUrl) {
        showToast('PDF file URL is not available yet.');
        return;
      }
      setActivePdf(item);
      return;
    }

    if (item.type === 'video') {
      if (!item.mediaUrl) {
        showToast('Lecture video stream is not available yet.');
        return;
      }
      setActiveVideo(item);
      return;
    }

    if (item.type === 'note') {
      setActiveNote(item);
    }
  };

  // Build breadcrumbs for header
  const crumbs = useMemo(() => {
    const list: BreadcrumbCrumb[] = [
      { label: 'Home', onClick: onBack },
      { label: 'Library', onClick: onBack },
      {
        label: selectedCourse ? selectedCourse.title : 'Class Material',
        onClick: currentFolder ? () => setCurrentFolder(null) : undefined,
      },
    ];

    if (currentFolder) {
      list.push({ label: currentFolder.title });
    }

    return list;
  }, [onBack, selectedCourse, currentFolder]);

  return (
    <div className="bg-[#DCEAE3] rounded-[28px] p-4 sm:p-6 lg:p-8 relative space-y-6 min-h-[calc(100vh-6rem)]">
      {/* 1. Header with Breadcrumbs & Course Selector */}
      <SubPageHeader
        onBack={onBack}
        crumbs={crumbs}
        rightElement={
          <div className="flex items-center gap-2 flex-wrap">
            {courses.length > 1 && (
              <select
                aria-label="Select course"
                value={selectedCourseId ?? ''}
                onChange={(e) => setSelectedCourseId(Number(e.target.value))}
                className="bg-white/90 border border-white/80 rounded-xl px-3 py-1.5 text-xs font-semibold text-[#175A67] shadow-sm hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#175A67]/30 transition-all cursor-pointer"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => {
                if (selectedCourseId !== null) {
                  fetchContent(selectedCourseId);
                  showToast('Checking for newly uploaded materials…');
                }
              }}
              disabled={loadingContent}
              className="p-2 rounded-xl bg-white/80 hover:bg-white border border-white/80 text-[#175A67] shadow-sm flex items-center justify-center transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              title="Refresh materials"
            >
              <RefreshCw className={`w-4 h-4 ${loadingContent ? 'animate-spin' : ''}`} />
            </button>
          </div>
        }
      />

      {/* 2. Main Title Banner */}
      <div className="bg-white/80 backdrop-blur-md border border-white/80 rounded-2xl p-5 sm:p-6 shadow-[0_6px_24px_rgb(0,0,0,0.05)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#0F3B42] text-white flex items-center justify-center shadow-md shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0B1C30]">Your Class Material</h1>
            <p className="text-xs sm:text-sm text-[#2A707C] mt-0.5 font-medium">
              {selectedCourse ? selectedCourse.title : 'Your Daily Class Notes and Recorded Lectures'}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Folder Navigation Header & Filter Chips */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Back from Subfolder */}
        <div className="flex items-center gap-2">
          {currentFolder ? (
            <button
              onClick={() => setCurrentFolder(null)}
              className="flex items-center gap-1.5 bg-white/90 hover:bg-white text-[#175A67] text-xs font-bold px-3 py-1.5 rounded-xl border border-white/80 shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to {selectedCourse?.title || 'Root'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-[#2A707C] font-semibold">
              <Layers className="w-3.5 h-3.5" />
              <span>{summaryCounts.all} Items Available</span>
            </div>
          )}
        </div>

        {/* Type Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              typeFilter === 'all'
                ? 'bg-[#0F3B42] text-white shadow-sm'
                : 'bg-white/70 hover:bg-white text-[#175A67] border border-white/80'
            }`}
          >
            All ({summaryCounts.all})
          </button>
          {summaryCounts.folder > 0 && (
            <button
              onClick={() => setTypeFilter('folder')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                typeFilter === 'folder'
                  ? 'bg-[#0F3B42] text-white shadow-sm'
                  : 'bg-white/70 hover:bg-white text-[#175A67] border border-white/80'
              }`}
            >
              <Folder className="w-3 h-3" />
              Folders ({summaryCounts.folder})
            </button>
          )}
          <button
            onClick={() => setTypeFilter('pdf')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              typeFilter === 'pdf'
                ? 'bg-[#0F3B42] text-white shadow-sm'
                : 'bg-white/70 hover:bg-white text-[#175A67] border border-white/80'
            }`}
          >
            <FileText className="w-3 h-3" />
            PDFs ({summaryCounts.pdf})
          </button>
          <button
            onClick={() => setTypeFilter('video')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              typeFilter === 'video'
                ? 'bg-[#0F3B42] text-white shadow-sm'
                : 'bg-white/70 hover:bg-white text-[#175A67] border border-white/80'
            }`}
          >
            <Video className="w-3 h-3" />
            Lectures ({summaryCounts.video})
          </button>
        </div>
      </div>

      {/* 4. Content Items Grid */}
      <section className="bg-white/60 backdrop-blur-md border border-white/80 p-5 sm:p-6 lg:p-8 rounded-[24px] shadow-[0_6px_24px_rgb(0,0,0,0.04)] min-h-[380px]">
        {loadingContent ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="bg-white/80 rounded-2xl p-4 border border-slate-100 animate-pulse space-y-3">
                <div className="w-10 h-10 rounded-xl bg-slate-200" />
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : contentError ? (
          <div className="flex flex-col items-center justify-center text-center py-16 px-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-[#0B1C30]">{contentError}</h3>
            <p className="text-xs text-[#2A707C] mt-1 max-w-sm">
              Please check your enrolment status or choose another course from the top dropdown.
            </p>
            {selectedCourseId !== null && (
              <button
                onClick={() => fetchContent(selectedCourseId)}
                className="mt-4 px-4 py-2 rounded-xl bg-[#0F3B42] text-white text-xs font-bold hover:bg-[#0b2c31] transition-all cursor-pointer"
              >
                Retry
              </button>
            )}
          </div>
        ) : displayedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 px-4">
            <div className="w-16 h-16 rounded-2xl bg-[#EAF3F1] text-[#175A67] flex items-center justify-center mb-4 shadow-sm">
              <FolderOpen className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-[#0B1C30]">
              {effectiveSearch
                ? `No materials found matching "${effectiveSearch}"`
                : 'No Class Material Published Yet'}
            </h3>
            <p className="text-xs sm:text-sm text-[#2A707C] max-w-md mt-1.5 leading-relaxed font-medium">
              {effectiveSearch
                ? 'Try a different search query or clear the filter.'
                : 'When teachers upload PDF notes or recorded lecture videos for this course in the CMS portal, they will automatically appear here.'}
            </p>

            <div className="flex items-center gap-4 mt-6 text-xs text-slate-500 bg-white/80 border border-slate-200/60 rounded-xl px-4 py-2.5">
              <span className="flex items-center gap-1.5 font-medium">
                <FileText className="w-4 h-4 text-[#175A67]" />
                PDF Notes
              </span>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span className="flex items-center gap-1.5 font-medium">
                <Video className="w-4 h-4 text-[#175A67]" />
                Recorded Lectures
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedItems.map((item) => {
              if (item.type === 'folder') {
                const childCount = folderItemCounts[item.id] || 0;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className="bg-white/80 hover:bg-white border border-white/80 rounded-2xl p-4 sm:p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between min-h-[140px] group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-[#EAF3F1] group-hover:bg-[#175A67] text-[#175A67] group-hover:text-white flex items-center justify-center transition-colors shrink-0 shadow-sm">
                        <Folder className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {childCount} {childCount === 1 ? 'file' : 'files'}
                      </span>
                    </div>

                    <div className="mt-3">
                      <h3 className="font-bold text-[#0B1C30] text-sm group-hover:text-[#175A67] transition-colors line-clamp-2">
                        {item.title}
                      </h3>
                      <p className="text-[11px] text-[#2A707C] mt-1 font-medium flex items-center gap-1">
                        <span>Open folder</span>
                        <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                      </p>
                    </div>
                  </div>
                );
              }

              if (item.type === 'video') {
                return (
                  <div
                    key={item.id}
                    className="bg-white/80 hover:bg-white border border-white/80 rounded-2xl p-4 sm:p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-0.5 flex flex-col justify-between min-h-[150px] group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="w-10 h-10 rounded-2xl bg-teal-50 text-[#175A67] flex items-center justify-center shrink-0">
                          <Video className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Play className="w-2.5 h-2.5 fill-current" />
                          Lecture
                        </span>
                      </div>

                      <h3 className="font-bold text-[#0B1C30] text-sm line-clamp-2" title={item.title}>
                        {item.title}
                      </h3>
                      {item.fileSize && (
                        <p className="text-[11px] text-slate-400 mt-1">{item.fileSize}</p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleItemClick(item)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-[#0F3B42] hover:bg-[#0b2c31] text-white text-xs font-bold py-2 px-3 rounded-xl transition-all active:scale-95 cursor-pointer shadow-sm"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Watch Lecture</span>
                      </button>

                      {item.mediaUrl && (
                        <a
                          href={item.mediaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-xl text-[#175A67] hover:bg-slate-100 transition-colors"
                          title="Open link in new tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              }

              if (item.type === 'pdf') {
                return (
                  <div
                    key={item.id}
                    className="bg-white/80 hover:bg-white border border-white/80 rounded-2xl p-4 sm:p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-0.5 flex flex-col justify-between min-h-[150px] group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/50 px-2 py-0.5 rounded-full">
                          PDF Notes
                        </span>
                      </div>

                      <h3 className="font-bold text-[#0B1C30] text-sm line-clamp-2" title={item.title}>
                        {item.title}
                      </h3>
                      {item.fileSize && (
                        <p className="text-[11px] text-slate-400 mt-1">{item.fileSize}</p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleItemClick(item)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-[#175A67] hover:bg-[#124853] text-white text-xs font-bold py-2 px-3 rounded-xl transition-all active:scale-95 cursor-pointer shadow-sm"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Notes</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSavePdf(item);
                        }}
                        className={`p-2 rounded-xl transition-all cursor-pointer ${
                          savedPdfIds.includes(String(item.id))
                            ? 'text-amber-500 bg-amber-50 hover:bg-amber-100'
                            : 'text-[#175A67] hover:bg-slate-100'
                        }`}
                        title={
                          savedPdfIds.includes(String(item.id))
                            ? 'Saved in Bookmarks (Click to remove)'
                            : 'Save to Your Saved PDF in Bookmarks'
                        }
                      >
                        <Bookmark
                          className={`w-4 h-4 ${
                            savedPdfIds.includes(String(item.id)) ? 'fill-current' : ''
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              }

              // Note item fallback
              return (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className="bg-white/80 hover:bg-white border border-white/80 rounded-2xl p-4 sm:p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                      Note
                    </span>
                  </div>
                  <h3 className="font-bold text-[#0B1C30] text-sm">{item.title}</h3>
                  <span className="text-xs text-[#175A67] font-semibold mt-3 hover:underline">Read Note →</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 4b. YOUR E BOOK Tab (Moved into Class Material after content) */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#175A67]" />
          <h2 className="text-base sm:text-lg font-bold text-[#0B1C30]">Your E-Book</h2>
        </div>
        <div
          onClick={onOpenEbooks}
          className="bg-white/60 hover:bg-white/85 backdrop-blur-md border border-white/80 rounded-2xl p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.05)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.09)] transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col items-center justify-between min-h-[190px] sm:min-h-[220px] w-full sm:w-[260px] active:scale-[0.98]"
        >
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#175A67] text-white rounded-2xl flex items-center justify-center shadow-md mb-2 sm:mb-3">
            <Swords className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
          </div>
          <div className="text-center">
            <h3 className="font-bold text-[#175A67] text-center text-base sm:text-lg">Your Ebook</h3>
            <p className="text-xs text-center mt-1 text-[#10B981] font-bold">
              LIVE NOW
            </p>
          </div>
          <span className="text-[#175A67] text-xs text-center block mt-2 sm:mt-3 font-semibold hover:underline">
            Enter Library &gt;
          </span>
        </div>
      </section>

      {/* 5. Embedded Video Player Modal */}
      {activeVideo && (
        <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div className="bg-slate-900 border border-white/10 rounded-3xl overflow-hidden w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-slate-900/90">
              <div className="flex items-center gap-2.5 min-w-0 pr-4">
                <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
                  <Play className="w-4 h-4 fill-current" />
                </div>
                <h3 className="text-white text-sm sm:text-base font-bold truncate">
                  {activeVideo.title}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {activeVideo.mediaUrl && (
                  <a
                    href={activeVideo.mediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                    title="Open in new window"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={() => setActiveVideo(null)}
                  className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  title="Close player"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Video Surface */}
            <div className="relative w-full aspect-video bg-black flex items-center justify-center">
              {activeVideo.mediaUrl ? (
                isVimeoUrl(activeVideo.mediaUrl) ? (
                  <iframe
                    src={getVimeoEmbedUrl(activeVideo.mediaUrl)}
                    className="w-full h-full border-0"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    title={activeVideo.title}
                  />
                ) : (
                  <video
                    src={activeVideo.mediaUrl}
                    controls
                    autoPlay
                    className="w-full h-full object-contain"
                  >
                    Your browser does not support HTML5 video.
                  </video>
                )
              ) : (
                <p className="text-slate-400 text-sm">Video stream not available</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. Note Viewer Modal */}
      {activeNote && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <h3 className="font-bold text-[#0B1C30] text-base">{activeNote.title}</h3>
              <button
                onClick={() => setActiveNote(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xs text-slate-600 max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {activeNote.mediaUrl?.startsWith('data:text/plain')
                ? decodeURIComponent(activeNote.mediaUrl.split(',')[1] || '')
                : 'Note content'}
            </div>
            <button
              onClick={() => setActiveNote(null)}
              className="w-full py-2.5 bg-[#0F3B42] text-white text-xs font-bold rounded-xl"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* 6b. Protected In-App PDF Reader Modal (Device Download Disabled) */}
      {activePdf && (
        <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
          <div className="bg-[#0B1C30] rounded-3xl overflow-hidden max-w-4xl w-full h-[90vh] flex flex-col shadow-2xl border border-white/10">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#0F3B42] text-white border-b border-white/10">
              <div className="flex items-center gap-2.5 min-w-0 pr-4">
                <FileText className="w-5 h-5 text-teal-300 shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-bold text-sm sm:text-base truncate">{activePdf.title}</h3>
                  <p className="text-[11px] text-teal-200/80 flex items-center gap-1.5">
                    <span>🔒 Protected Study Material</span>
                    <span>•</span>
                    <span>Device download disabled</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleToggleSavePdf(activePdf)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    savedPdfIds.includes(String(activePdf.id))
                      ? 'bg-amber-400 text-slate-900 font-bold'
                      : 'bg-white/15 hover:bg-white/25 text-white'
                  }`}
                  title="Save to your Bookmarks"
                >
                  <Bookmark
                    className={`w-3.5 h-3.5 ${
                      savedPdfIds.includes(String(activePdf.id)) ? 'fill-current' : ''
                    }`}
                  />
                  <span className="hidden sm:inline">
                    {savedPdfIds.includes(String(activePdf.id)) ? 'Saved in Bookmarks' : 'Save to Bookmarks'}
                  </span>
                </button>

                <button
                  onClick={() => setActivePdf(null)}
                  className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Close viewer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Embedded PDF iframe with toolbar disabled */}
            <div className="flex-1 bg-slate-900 relative">
              <iframe
                src={`${activePdf.mediaUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                className="w-full h-full border-0"
                title={activePdf.title}
              />
            </div>
          </div>
        </div>
      )}

      {/* 7. Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-[#175A67] text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2 animate-fadeIn max-w-[90vw]">
          <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
          <span className="truncate">{toast}</span>
        </div>
      )}
    </div>
  );
}

export default LibraryView;

