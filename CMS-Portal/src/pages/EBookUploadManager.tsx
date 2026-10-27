import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch, uploadFile, type AdminCourse } from '../api';

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
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Physics');
  const [customSubject, setCustomSubject] = useState('');
  const [courseId, setCourseId] = useState<string>(selectedCourseId ? String(selectedCourseId) : '');
  const [totalPages, setTotalPages] = useState('120');
  const [isCourseBook, setIsCourseBook] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Sync external modal state if controlled
  useEffect(() => {
    if (externalModalOpen !== undefined) {
      setIsModalOpen(externalModalOpen);
    }
  }, [externalModalOpen]);

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

  const handleOpenModal = () => {
    setTitle('');
    setSelectedFile(null);
    setUploadProgress(0);
    setIsUploading(false);
    if (selectedCourseId) {
      setCourseId(String(selectedCourseId));
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isUploading) return;
    setIsModalOpen(false);
    if (onCloseModal) onCloseModal();
  };

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

    setIsUploading(true);
    setUploadProgress(20);

    try {
      // Step 1: Upload PDF binary to server/S3
      setUploadProgress(45);
      const uploadedUrl = await uploadFile(selectedFile);
      setUploadProgress(80);

      // Match course title if selected
      const matchedCourse = courses.find((c) => String(c.id) === String(courseId));
      const finalSubject = subject === 'Other' ? (customSubject.trim() || 'General') : subject;

      // Step 2: Register E-Book in database
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
        toast(`E-Book "${title.trim()}" published to student portal!`, 'success');
        handleCloseModal();
        fetchEBooks();
      }
    } catch (err: any) {
      console.error('[EBookUploadManager] Upload error:', err);
      toast(`Failed to upload e-book: ${err.message || 'Server error'}`, 'error');
    } finally {
      setIsUploading(false);
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
      {/* 1. Header Banner */}
      <div style={styles.headerRow}>
        <div>
          <div style={styles.badgeRow}>
            <span style={styles.kicker}>DIGITAL LIBRARY MANAGEMENT</span>
            <span style={styles.liveBadge}>● Synced to Web Portal</span>
          </div>
          <h2 style={styles.title}>UPLOAD E-BOOKS</h2>
          <p style={styles.subtitle}>
            Upload PDF textbooks, reference modules, and formula handbooks so students can read and download them directly from the web portal.
          </p>
        </div>

        <button
          onClick={handleOpenModal}
          className="btn"
          style={styles.uploadBtn}
        >
          <span style={{ fontSize: '1.2rem' }}>📖</span> + Upload New E-Book
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
          <h4 style={{ color: '#ffffff', marginBottom: '6px', fontSize: '1.1rem' }}>No E-Books Uploaded Yet</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '420px', margin: '0 auto 1.2rem auto' }}>
            Click the button above to upload PDF textbooks and reference materials. They will immediately become available in the student's E-Book tab.
          </p>
          <button onClick={handleOpenModal} className="btn" style={styles.uploadBtnSmall}>
            + Upload First E-Book
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

      {/* 4. Upload E-Book Modal */}
      {isModalOpen && (
        <div style={styles.modalBackdrop} onClick={() => !isUploading && handleCloseModal()}>
          <div className="glass-card" style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <span style={styles.modalKicker}>PORTAL ASSET UPLOAD</span>
                <h3 style={styles.modalTitle}>Upload E-Book to Portal</h3>
              </div>
              <button onClick={handleCloseModal} disabled={isUploading} style={styles.closeBtn}>
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} style={{ marginTop: '1.2rem' }}>
              {/* PDF File Drag and Drop */}
              <div
                style={{
                  ...styles.dropZone,
                  borderColor: isDragOver ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.2)',
                  backgroundColor: isDragOver ? 'rgba(23, 90, 103, 0.2)' : 'rgba(0, 0, 0, 0.2)',
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

                <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📄</div>
                {selectedFile ? (
                  <div>
                    <p style={{ color: '#ffffff', fontWeight: 600, fontSize: '0.95rem' }}>
                      {selectedFile.name}
                    </p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '2px' }}>
                      {formatBytes(selectedFile.size)} • Click to change file
                    </p>
                  </div>
                ) : (
                  <div>
                    <p style={{ color: '#ffffff', fontWeight: 600, fontSize: '0.95rem' }}>
                      Click to choose PDF or drag &amp; drop here
                    </p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '4px' }}>
                      PDF files up to 100MB supported
                    </p>
                  </div>
                )}
              </div>

              {/* Book Title */}
              <div style={styles.fieldGroup}>
                <label style={styles.inputLabel}>Book Title *</label>
                <input
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
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    style={styles.modalSelect}
                  >
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Biology">Biology</option>
                    <option value="General">General Science</option>
                    <option value="Other">Other / Custom</option>
                  </select>
                </div>

                <div style={{ flex: 1.2 }}>
                  <label style={styles.inputLabel}>Target Course (Optional)</label>
                  <select
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    style={styles.modalSelect}
                  >
                    <option value="">-- All Courses / General --</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
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
                      style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                    />
                    Mark as Course Book
                  </label>
                </div>
              </div>

              {/* Progress Bar */}
              {isUploading && (
                <div style={styles.progressBox}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.8rem', color: '#ffffff' }}>
                    <span>Uploading E-Book binary…</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div style={styles.progressBarTrack}>
                    <div style={{ ...styles.progressBarFill, width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isUploading}
                  style={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !selectedFile || !title.trim()}
                  className="btn"
                  style={{
                    ...styles.submitBtn,
                    opacity: isUploading || !selectedFile || !title.trim() ? 0.6 : 1,
                  }}
                >
                  {isUploading ? 'Publishing E-Book…' : 'Publish to Student Portal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
    color: 'var(--accent-primary, #175a67)',
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
    boxShadow: '0 4px 14px rgba(139, 92, 246, 0.35)',
    cursor: 'pointer',
  },
  uploadBtnSmall: {
    padding: '8px 18px',
    fontSize: '0.85rem',
    fontWeight: 600,
    backgroundColor: '#8b5cf6',
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
    padding: '3rem 1.5rem',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: '12px',
    border: '1px dashed rgba(255, 255, 255, 0.1)',
  },
  emptyIcon: {
    fontSize: '3rem',
    marginBottom: '0.8rem',
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
  modalBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
    padding: '1.5rem',
  },
  modalBox: {
    width: '100%',
    maxWidth: '520px',
    padding: '2rem',
    backgroundColor: '#0d1520',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '16px',
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalKicker: {
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: '#a78bfa',
    textTransform: 'uppercase',
  },
  modalTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#ffffff',
    marginTop: '2px',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '1.3rem',
    cursor: 'pointer',
    padding: '4px',
  },
  dropZone: {
    border: '2px dashed rgba(255, 255, 255, 0.2)',
    borderRadius: '12px',
    padding: '1.8rem 1.2rem',
    textAlign: 'center',
    cursor: 'pointer',
    marginBottom: '1.2rem',
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
    marginTop: '1.5rem',
  },
  cancelBtn: {
    padding: '10px 18px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    color: '#ffffff',
    borderRadius: '8px',
    fontSize: '0.88rem',
    fontWeight: 500,
    cursor: 'pointer',
  },
  submitBtn: {
    padding: '10px 20px',
    backgroundColor: '#8b5cf6',
    border: 'none',
    color: '#ffffff',
    borderRadius: '8px',
    fontSize: '0.88rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
