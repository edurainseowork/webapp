import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch, uploadFile, type AdminCourse } from '../api';
import { uploadMediaToS3 } from '../services/uploadService';
import CustomSelect from '../components/CustomSelect';

export interface EBookItem {
  id: string;
  title: string;
  subject: string;
  courseId?: number | null;
  courseTitle?: string | null;
  totalPages: number;
  pagesRead?: number;
  rating?: number;
  isCourseBook: boolean;
  pdfUrl: string;
  fileSize?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface EBookUploadManagerProps {
  courses?: AdminCourse[];
  selectedCourseId?: string | number;
  showToast?: (message: string, type?: 'success' | 'error') => void;
  isModalOpen?: boolean;
  onCloseModal?: () => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function EBookUploadManager({
  courses = [],
  selectedCourseId,
  showToast: externalToast,
  isModalOpen: externalModalOpen,
  onCloseModal,
}: EBookUploadManagerProps) {
  const [ebooks, setEbooks] = useState<EBookItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form states (rendered inline at bottom + auto-scrolled via useRef)
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Physics');
  const [customSubject, setCustomSubject] = useState('');
  const [courseId, setCourseId] = useState<string>(selectedCourseId ? String(selectedCourseId) : '');
  const [totalPages, setTotalPages] = useState('120');
  const [isCourseBook, setIsCourseBook] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveCountdown, setSaveCountdown] = useState<number>(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formHighlighted, setFormHighlighted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const toast = useCallback(
    (msg: string, type: 'success' | 'error' = 'success') => {
      if (externalToast) {
        externalToast(msg, type);
      } else {
        alert(`${type.toUpperCase()}: ${msg}`);
      }
    },
    [externalToast]
  );

  // Smoothly scroll down to the bottom upload form using useRef + scrollIntoView
  const scrollToUploadForm = useCallback(() => {
    uploadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFormHighlighted(true);
    setTimeout(() => {
      titleInputRef.current?.focus();
    }, 350);
    setTimeout(() => {
      setFormHighlighted(false);
    }, 1800);
  }, []);

  // When parent triggers `isModalOpen`, auto-scroll to the inline upload form
  useEffect(() => {
    if (externalModalOpen) {
      scrollToUploadForm();
      if (onCloseModal) onCloseModal();
    }
  }, [externalModalOpen, scrollToUploadForm, onCloseModal]);

  // Countdown timer while saving / uploading
  useEffect(() => {
    if (!isSaving) {
      setSaveCountdown(0);
      return;
    }
    setSaveCountdown(8);
    const interval = setInterval(() => {
      setSaveCountdown((prev) => (prev > 1 ? prev - 1 : 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isSaving]);

  // Sync initial course
  useEffect(() => {
    if (selectedCourseId) {
      setCourseId(String(selectedCourseId));
    }
  }, [selectedCourseId]);

  // Fetch all uploaded ebooks
  const fetchEBooks = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch<{ success: boolean; ebooks: EBookItem[] }>('/ebooks');
      if (res && Array.isArray(res.ebooks)) {
        setEbooks(res.ebooks);
      }
    } catch (err: any) {
      console.warn('[EBookUploadManager] Failed to load ebooks:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEBooks();
  }, [fetchEBooks]);

  const handleFileSelect = (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast('Please upload a valid PDF document (.pdf)', 'error');
      return;
    }
    setSelectedFile(file);
    if (!title.trim()) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setTitle(cleanName);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const resetUploadForm = () => {
    setTitle('');
    setSelectedFile(null);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast('Please enter a book title', 'error');
      return;
    }
    if (!selectedFile) {
      toast('Please select a PDF file to upload', 'error');
      return;
    }

    setIsSaving(true);
    setUploadProgress(10);

    try {
      // Step 1: Upload PDF directly to the existing AWS S3 bucket under `ebooks/` prefix
      let uploadedUrl: string;
      try {
        const s3Target = courseId ? `ebooks/${courseId}` : 'ebooks';
        const s3Result = await uploadMediaToS3(selectedFile, s3Target, (pct) => {
          setUploadProgress(Math.max(10, Math.min(90, pct)));
        });
        uploadedUrl = s3Result.fileUrl;
      } catch (presignErr) {
        console.warn('[EBookUploadManager] Presigned S3 upload failed, falling back to backend S3 upload:', presignErr);
        setUploadProgress(45);
        uploadedUrl = await uploadFile(selectedFile);
      }
      setUploadProgress(92);

      // Match course title if selected
      const matchedCourse = courses.find((c) => String(c.id) === String(courseId));
      const finalSubject = subject === 'Other' ? (customSubject.trim() || 'General') : subject;

      // Step 2: Register E-Book in database with real S3 PDF URL
      const payload = {
        title: title.trim(),
        subject: finalSubject,
        courseId: courseId ? Number(courseId) : null,
        courseTitle: matchedCourse ? matchedCourse.title : (courseId ? `Course #${courseId}` : null),
        totalPages: Number(totalPages) > 0 ? Number(totalPages) : 100,
        pagesRead: 0,
        rating: 4.95,
        isCourseBook: Boolean(isCourseBook),
        pdfUrl: uploadedUrl,
        fileSize: formatBytes(selectedFile.size),
      };

      const res = await apiFetch<{ success: boolean; ebook: EBookItem }>('/ebooks', {
        method: 'POST',
        body: payload,
      });

      if (res.success) {
        setUploadProgress(100);
        toast(`E-Book "${title.trim()}" saved & published successfully!`, 'success');
        resetUploadForm();
        fetchEBooks();
      }
    } catch (err: any) {
      console.error('[EBookUploadManager] Upload error:', err);
      toast(`Error occurred: ${err.message || 'Failed to upload e-book'}`, 'error');
    } finally {
      setIsSaving(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteEBook = async (id: string, bookTitle: string) => {
    if (!window.confirm(`Are you sure you want to delete "${bookTitle}"? Students will no longer be able to access it.`)) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await apiFetch<{ success: boolean }>(`/ebooks/${id}`, {
        method: 'DELETE',
      });
      if (res.success) {
        toast(`Deleted "${bookTitle}" successfully`, 'success');
        setEbooks((prev) => prev.filter((b) => b.id !== id));
      }
    } catch (err: any) {
      toast(`Failed to delete e-book: ${err.message}`, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="glass-card" style={styles.cardContainer}>
      {/* 1. Header Banner with Auto-Scroll Trigger Button */}
      <div style={styles.headerRow}>
        <div>
          <div style={styles.badgeRow}>
            <span style={styles.kicker}>DIGITAL LIBRARY MANAGEMENT</span>
            <span style={styles.liveBadge}>● Synced to AWS S3 &amp; Web Portal</span>
          </div>
          <h2 style={styles.title}>UPLOAD E-BOOKS</h2>
          <p style={styles.subtitle}>
            Upload PDF textbooks, reference modules, and formula handbooks directly to AWS S3 so students can read them inside the web portal.
          </p>
        </div>

        <button
          type="button"
          onClick={scrollToUploadForm}
          className="btn"
          style={styles.uploadBtn}
        >
          <span style={{ fontSize: '1.15rem' }}>📖</span> Upload E-Book ↓
        </button>
      </div>

      {/* 2. Stats Bar */}
      <div style={styles.statsBar}>
        <div style={styles.statItem}>
          <span style={styles.statLabel}>Total Uploaded E-Books</span>
          <span style={styles.statValue}>{ebooks.length}</span>
        </div>
        <div style={styles.statItem}>
          <span style={styles.statLabel}>Course-Specific Books</span>
          <span style={styles.statValue}>{ebooks.filter((b) => b.courseId).length}</span>
        </div>
        <div style={styles.statItem}>
          <span style={styles.statLabel}>General Library Books</span>
          <span style={styles.statValue}>{ebooks.filter((b) => !b.courseId).length}</span>
        </div>
      </div>

      {/* 3. Uploaded Books Listing */}
      {isLoading ? (
        <div style={styles.emptyState}>
          <div style={styles.spinner} />
          <p style={{ color: 'var(--text-secondary)', marginTop: '1rem', fontSize: '0.9rem' }}>
            Loading uploaded e-books…
          </p>
        </div>
      ) : ebooks.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📚</div>
          <h4 style={{ color: '#ffffff', marginBottom: '6px', fontSize: '1.05rem' }}>No E-Books Available Yet</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', maxWidth: '420px', margin: '0 auto 1rem auto' }}>
            Use the upload form below to publish your first PDF e-book to the student library.
          </p>
          <button type="button" onClick={scrollToUploadForm} className="btn" style={styles.uploadBtnSmall}>
            ↓ Scroll to Upload Form
          </button>
        </div>
      ) : (
        <div style={styles.booksGrid}>
          {ebooks.map((book) => (
            <div key={book.id} style={styles.bookCard}>
              <div style={styles.bookCardTop}>
                <div style={styles.bookIconBox}>
                  <span style={{ fontSize: '1.4rem' }}>📖</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.tagRow}>
                    <span style={styles.subjectTag}>{book.subject}</span>
                    {book.courseTitle && (
                      <span style={styles.courseTag} title={book.courseTitle}>
                        {book.courseTitle}
                      </span>
                    )}
                  </div>
                  <h4 style={styles.bookTitle} title={book.title}>
                    {book.title}
                  </h4>
                </div>
              </div>

              <div style={styles.bookMeta}>
                <span>📄 {book.totalPages} Pages</span>
                {book.fileSize && <span>💾 {book.fileSize}</span>}
                {book.isCourseBook && <span style={{ color: '#10b981' }}>✓ Course Book</span>}
              </div>

              <div style={styles.bookCardActions}>
                <a
                  href={book.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.viewPdfBtn}
                >
                  View / Open PDF ↗
                </a>
                <button
                  type="button"
                  onClick={() => handleDeleteEBook(book.id, book.title)}
                  disabled={deletingId === book.id}
                  style={styles.deleteBtn}
                  title="Delete E-Book"
                >
                  {deletingId === book.id ? '…' : '🗑 Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. Bottom Inline Upload E-Book Form Section (Target of useRef scrollIntoView) */}
      <div
        ref={uploadRef}
        className={formHighlighted ? 'ebook-scroll-highlight' : ''}
        style={{
          ...styles.inlineFormCard,
          borderColor: formHighlighted ? '#8b5cf6' : 'rgba(255, 255, 255, 0.14)',
        }}
      >
        <div style={styles.modalHeader}>
          <div>
            <span style={styles.modalKicker}>AWS S3 E-BOOK UPLOAD FORM</span>
            <h3 style={styles.modalTitle}>Add &amp; Publish New E-Book</h3>
          </div>
          {isSaving && saveCountdown > 0 && (
            <span style={styles.timerBadge}>
              ⏱ Uploading… {saveCountdown}s
            </span>
          )}
        </div>

        <form onSubmit={handleUploadSubmit} style={{ marginTop: '1.1rem' }}>
          {/* PDF File Drag and Drop */}
          <div
            style={{
              ...styles.dropZone,
              borderColor: isDragOver ? '#8b5cf6' : 'rgba(255, 255, 255, 0.2)',
              backgroundColor: isDragOver ? 'rgba(139, 92, 246, 0.12)' : 'rgba(0, 0, 0, 0.22)',
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragOver(false);
            }}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
            />

            <div style={{ fontSize: '2.2rem', marginBottom: '6px' }}>📄</div>
            {selectedFile ? (
              <div>
                <p style={{ color: '#ffffff', fontWeight: 600, fontSize: '0.95rem' }}>
                  {selectedFile.name}
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '2px' }}>
                  {formatBytes(selectedFile.size)} • Click to change PDF file
                </p>
              </div>
            ) : (
              <div>
                <p style={{ color: '#ffffff', fontWeight: 600, fontSize: '0.95rem' }}>
                  Click to choose E-Book PDF or drag &amp; drop here
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '4px' }}>
                  Direct AWS S3 upload • PDF files up to 100MB supported
                </p>
              </div>
            )}
          </div>

          {/* Book Title */}
          <div style={styles.fieldGroup}>
            <label style={styles.inputLabel}>Book Title *</label>
            <input
              ref={titleInputRef}
              type="text"
              placeholder="e.g. Modern Physics for JEE Advanced"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={styles.modalInput}
              required
            />
          </div>

          {/* Subject & Course Selection */}
          <div style={styles.rowFields}>
            <div style={{ flex: 1 }}>
              <label style={styles.inputLabel}>Subject / Domain</label>
              <CustomSelect
                options={[
                  { value: 'Physics', label: 'Physics' },
                  { value: 'Chemistry', label: 'Chemistry' },
                  { value: 'Mathematics', label: 'Mathematics' },
                  { value: 'Biology', label: 'Biology' },
                  { value: 'General', label: 'General Science' },
                  { value: 'Other', label: 'Other / Custom' },
                ]}
                value={subject}
                onChange={(val) => setSubject(String(val || 'Physics'))}
                searchable={false}
              />
            </div>

            <div style={{ flex: 1.2 }}>
              <label style={styles.inputLabel}>Target Course (Optional)</label>
              <CustomSelect
                options={[
                  { value: '', label: '-- All Courses / General --' },
                  ...courses.map((c) => ({
                    value: String(c.id),
                    label: c.title,
                    category: c.category,
                    badge: c.isPublished ? 'Published' : 'Draft',
                  })),
                ]}
                value={courseId}
                onChange={(val) => setCourseId(String(val ?? ''))}
                placeholder="-- All Courses / General --"
                searchPlaceholder="Search course or category..."
                clearable
              />
            </div>
          </div>

          {subject === 'Other' && (
            <div style={styles.fieldGroup}>
              <label style={styles.inputLabel}>Specify Custom Subject</label>
              <input
                type="text"
                placeholder="e.g. Robotics, Astronomy"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                style={styles.modalInput}
              />
            </div>
          )}

          {/* Total Pages & Course Book Checkbox */}
          <div style={styles.rowFields}>
            <div style={{ flex: 1 }}>
              <label style={styles.inputLabel}>Estimated Total Pages</label>
              <input
                type="number"
                min="1"
                max="5000"
                value={totalPages}
                onChange={(e) => setTotalPages(e.target.value)}
                style={styles.modalInput}
              />
            </div>

            <div style={{ flex: 1.2, display: 'flex', alignItems: 'center', marginTop: '1.4rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#ffffff', fontSize: '0.88rem' }}>
                <input
                  type="checkbox"
                  checked={isCourseBook}
                  onChange={(e) => setIsCourseBook(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#8b5cf6', cursor: 'pointer' }}
                />
                Mark as Course Recommended Book
              </label>
            </div>
          </div>

          {/* Progress Bar */}
          {isSaving && (
            <div style={styles.progressBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.8rem', color: '#ffffff' }}>
                <span>Uploading E-Book PDF to AWS S3…</span>
                <span>{uploadProgress}%</span>
              </div>
              <div style={styles.progressBarTrack}>
                <div style={{ ...styles.progressBarFill, width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}

          {/* Action Buttons with Inline Loading Spinner */}
          <div style={styles.modalActions}>
            {(selectedFile || title) && !isSaving && (
              <button
                type="button"
                onClick={resetUploadForm}
                style={styles.cancelBtn}
              >
                Reset
              </button>
            )}
            <button
              type="submit"
              disabled={isSaving || !selectedFile || !title.trim()}
              className="btn"
              style={{
                ...styles.submitBtn,
                opacity: isSaving || !selectedFile || !title.trim() ? 0.65 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              {isSaving ? (
                <>
                  <svg className="cms-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                  <span>Saving &amp; Uploading… ({uploadProgress}%)</span>
                </>
              ) : (
                <span>Save &amp; Publish E-Book →</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  cardContainer: {
    padding: '1.75rem',
    borderRadius: '16px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1.5rem',
    flexWrap: 'wrap',
    marginBottom: '1.5rem',
  },
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '6px',
  },
  kicker: {
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: '#a78bfa',
    textTransform: 'uppercase',
  },
  liveBadge: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    padding: '2px 8px',
    borderRadius: '6px',
    border: '1px solid rgba(16, 185, 129, 0.3)',
  },
  title: {
    fontSize: '1.4rem',
    fontWeight: 800,
    color: '#ffffff',
    letterSpacing: '-0.3px',
    marginBottom: '6px',
  },
  subtitle: {
    fontSize: '0.88rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    maxWidth: '680px',
  },
  uploadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    fontSize: '0.92rem',
    fontWeight: 700,
    backgroundColor: '#8b5cf6',
    border: 'none',
    borderRadius: '999px',
    boxShadow: '0 4px 14px rgba(139, 92, 246, 0.35)',
    cursor: 'pointer',
  },
  uploadBtnSmall: {
    padding: '8px 18px',
    fontSize: '0.85rem',
    fontWeight: 600,
    backgroundColor: '#8b5cf6',
    borderRadius: '999px',
  },
  statsBar: {
    display: 'flex',
    gap: '1.5rem',
    padding: '12px 18px',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statLabel: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
  statValue: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#ffffff',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: '2px 8px',
    borderRadius: '6px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '2.2rem 1.5rem',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: '12px',
    border: '1px dashed rgba(255, 255, 255, 0.1)',
    marginBottom: '1.5rem',
  },
  emptyIcon: {
    fontSize: '2.5rem',
    marginBottom: '0.5rem',
  },
  spinner: {
    width: '36px',
    height: '36px',
    margin: '0 auto',
    border: '3px solid rgba(255, 255, 255, 0.1)',
    borderTopColor: 'var(--accent-primary)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  booksGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
    gap: '1rem',
    marginBottom: '1.75rem',
  },
  bookCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    padding: '1.2rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '1rem',
    transition: 'all 0.2s ease',
  },
  bookCardTop: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
  },
  bookIconBox: {
    width: '42px',
    height: '42px',
    borderRadius: '10px',
    backgroundColor: 'rgba(139, 92, 246, 0.18)',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tagRow: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: '4px',
  },
  subjectTag: {
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: '#c4b5fd',
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  courseTag: {
    fontSize: '0.7rem',
    color: 'var(--text-secondary)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    padding: '2px 6px',
    borderRadius: '4px',
    maxWidth: '130px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  bookTitle: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#ffffff',
    lineHeight: 1.35,
    marginTop: '2px',
  },
  bookMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '0.78rem',
    color: 'var(--text-secondary)',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    paddingTop: '8px',
  },
  bookCardActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  viewPdfBtn: {
    flex: 1,
    padding: '7px 12px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    color: '#ffffff',
    borderRadius: '8px',
    fontSize: '0.8rem',
    fontWeight: 600,
    textDecoration: 'none',
    textAlign: 'center',
    transition: 'background-color 0.15s ease',
  },
  deleteBtn: {
    padding: '7px 12px',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#f87171',
    borderRadius: '8px',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  inlineFormCard: {
    width: '100%',
    padding: '1.6rem',
    backgroundColor: 'rgba(13, 21, 32, 0.85)',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    borderRadius: '16px',
    scrollMarginTop: '24px',
    transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '10px',
  },
  modalKicker: {
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: '#a78bfa',
    textTransform: 'uppercase',
  },
  modalTitle: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: '#ffffff',
    marginTop: '2px',
  },
  timerBadge: {
    fontSize: '0.78rem',
    fontWeight: 700,
    color: '#c4b5fd',
    backgroundColor: 'rgba(139, 92, 246, 0.18)',
    border: '1px solid rgba(139, 92, 246, 0.35)',
    padding: '4px 12px',
    borderRadius: '999px',
  },
  dropZone: {
    border: '2px dashed rgba(255, 255, 255, 0.2)',
    borderRadius: '12px',
    padding: '1.5rem 1.2rem',
    textAlign: 'center',
    cursor: 'pointer',
    marginBottom: '1.1rem',
    transition: 'all 0.2s ease',
  },
  fieldGroup: {
    marginBottom: '1rem',
  },
  rowFields: {
    display: 'flex',
    gap: '12px',
    marginBottom: '1rem',
    flexWrap: 'wrap',
  },
  inputLabel: {
    display: 'block',
    marginBottom: '6px',
    fontSize: '0.82rem',
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
  modalInput: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    color: '#ffffff',
    fontSize: '0.9rem',
    outline: 'none',
  },
  modalSelect: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    backgroundColor: '#121b27',
    color: '#ffffff',
    fontSize: '0.9rem',
    outline: 'none',
    cursor: 'pointer',
  },
  progressBox: {
    marginTop: '1rem',
    marginBottom: '1rem',
    padding: '10px',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '8px',
  },
  progressBarTrack: {
    width: '100%',
    height: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#8b5cf6',
    borderRadius: '3px',
    transition: 'width 0.2s ease',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '1.25rem',
  },
  cancelBtn: {
    padding: '10px 18px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    color: '#ffffff',
    borderRadius: '999px',
    fontSize: '0.88rem',
    fontWeight: 500,
    cursor: 'pointer',
  },
  submitBtn: {
    padding: '10px 24px',
    backgroundColor: '#0ea5e9',
    border: 'none',
    color: '#ffffff',
    borderRadius: '999px',
    fontSize: '0.88rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
