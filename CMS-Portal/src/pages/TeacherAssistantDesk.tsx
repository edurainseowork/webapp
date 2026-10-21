import edurainLogo from '../assets/logo.webp'
import { useState, useEffect, useRef, useMemo, type ChangeEvent, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import {
  getStoredTickets,
  saveStoredTickets,
  getStoredProfile,
  saveStoredProfile,
  type DoubtTicket,
  type TAProfile,
  type ChatMessage,
} from './teacherAssistantData';
import './TeacherAssistantDesk.css';

interface TeacherAssistantDeskProps {
  user?: User | null;
  onExit?: () => void;
}

export function TeacherAssistantDesk({ user, onExit }: TeacherAssistantDeskProps) {
  // Profile State
  const [profile, setProfile] = useState<TAProfile>(() => {
    const stored = getStoredProfile();
    if (user?.displayName && stored.name === 'Dr. Arjun Mehta') {
      return { ...stored, name: user.displayName, email: user.email || stored.email };
    }
    return stored;
  });

  // Tickets State
  const [tickets, setTickets] = useState<DoubtTicket[]>(getStoredTickets);
  
  // Navigation State
  const [activeNav, setActiveNav] = useState<'queue' | 'urgent' | 'resolved'>('queue');
  
  // Selected ticket for Split View (null = full-width queue)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Tabs inside the Detail Panel
  const [activeDetailTab, setActiveDetailTab] = useState<'question' | 'studentInfo' | 'previousChats'>('question');

  // Search & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest' | 'urgent'>('latest');

  // Chat message input
  const [chatInput, setChatInput] = useState('');

  // Modals & Popovers
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Profile Edit temporary state
  const [editName, setEditName] = useState(profile.name);
  const [editAvatar, setEditAvatar] = useState(profile.avatarUrl);
  const [editStatus, setEditStatus] = useState(profile.status);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  // Sync tickets with localStorage
  useEffect(() => {
    saveStoredTickets(tickets);
  }, [tickets]);

  // Sync profile with localStorage
  useEffect(() => {
    saveStoredProfile(profile);
  }, [profile]);

  // Selected Ticket object
  const activeTicket = useMemo(() => {
    if (!selectedTicketId) return null;
    return tickets.find((t) => t.id === selectedTicketId) || null;
  }, [tickets, selectedTicketId]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (activeTicket && activeDetailTab === 'question') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTicket?.messages.length, activeDetailTab]);

  // Counts
  const queueCount = useMemo(() => tickets.filter((t) => t.status === 'queue').length, [tickets]);
  const urgentCount = useMemo(() => tickets.filter((t) => t.status === 'queue' && t.urgency === 'Urgent').length, [tickets]);
  const resolvedCount = useMemo(() => tickets.filter((t) => t.status === 'resolved').length, [tickets]);

  // Filtered & Sorted Tickets
  const displayedTickets = useMemo(() => {
    let list = tickets.filter((t) => {
      if (activeNav === 'queue') return t.status === 'queue';
      if (activeNav === 'urgent') return t.status === 'queue' && t.urgency === 'Urgent';
      if (activeNav === 'resolved') return t.status === 'resolved';
      return true;
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((t) =>
        t.ticketNumber.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.studentName.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.examTag.toLowerCase().includes(q)
      );
    }

    if (sortOrder === 'urgent') {
      list = [...list].sort((a, _b) => (a.urgency === 'Urgent' ? -1 : 1));
    } else if (sortOrder === 'oldest') {
      list = [...list].reverse();
    }

    return list;
  }, [tickets, activeNav, searchQuery, sortOrder]);

  // Handlers
  const handleSelectTicket = (id: string) => {
    setSelectedTicketId(id);
    setActiveDetailTab('question');
  };

  const handleCloseSplit = () => {
    setSelectedTicketId(null);
  };

  const handleSendMessage = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || !activeTicket) return;

    const newMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'ta',
      senderName: profile.name,
      text: chatInput.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      avatar: profile.avatarUrl,
    };

    setTickets((prev) =>
      prev.map((t) => (t.id === activeTicket.id ? { ...t, messages: [...t.messages, newMsg] } : t))
    );
    setChatInput('');
  };

  const handleResolveDoubt = () => {
    if (!activeTicket) return;
    setTickets((prev) =>
      prev.map((t) => (t.id === activeTicket.id ? { ...t, status: 'resolved' as const } : t))
    );
    showToast(`${activeTicket.ticketNumber} marked as Resolved!`);
    // Move to resolved or keep open with resolved state
  };

  // Profile modal photo upload
  const handlePhotoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setEditAvatar(base64);
        showToast('Photo uploaded preview ready!');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = () => {
    const updated: TAProfile = {
      ...profile,
      name: editName.trim() || profile.name,
      avatarUrl: editAvatar || profile.avatarUrl,
      status: editStatus,
    };
    setProfile(updated);
    setIsProfileModalOpen(false);
    showToast('Profile updated successfully!');
  };

  return (
    <div className="ta-shell">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="ta-toast">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {toastMessage}
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {/* 1. Left Sidebar                                              */}
      {/* ------------------------------------------------------------ */}
      <aside className="ta-sidebar">
        {/* Brand */}
        <div className="ta-brand">
          <div className="ta-brand-logo">
            <img src={edurainLogo} alt="EduRain Logo" style={{ width: '26px', height: '26px', objectFit: 'contain' }} />
          </div>
          <div className="ta-brand-text">
            <span className="ta-brand-name">EDURAIN</span>
            <span className="ta-brand-desk">TeacherAssistant</span>
          </div>
        </div>

        {/* User Card */}
        <div className="ta-user-card">
          <div
            className="ta-avatar-wrapper"
            onClick={() => {
              setEditName(profile.name);
              setEditAvatar(profile.avatarUrl);
              setEditStatus(profile.status);
              setIsProfileModalOpen(true);
            }}
            title="Click to edit profile"
          >
            <img src={profile.avatarUrl} alt={profile.name} className="ta-avatar-img" />
            <span className="ta-online-badge" />
          </div>
          <div className="ta-user-name">{profile.name}</div>
          <div className="ta-user-role">{profile.role}</div>
          <div className="ta-status-pill">
            <span className="ta-status-dot" />
            {profile.status}
          </div>
        </div>

        {/* Nav Items */}
        <nav className="ta-nav-list">
          <div
            className={`ta-nav-item ${activeNav === 'queue' ? 'active' : ''}`}
            onClick={() => {
              setActiveNav('queue');
              setSelectedTicketId(null);
            }}
          >
            <div className="ta-nav-left">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
              </svg>
              <span>Doubt Queue</span>
            </div>
            <span className="ta-nav-badge">({queueCount})</span>
          </div>

          <div
            className={`ta-nav-item ${activeNav === 'urgent' ? 'active' : ''}`}
            onClick={() => {
              setActiveNav('urgent');
              setSelectedTicketId(null);
            }}
          >
            <div className="ta-nav-left">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <span>Urgent Tickets</span>
            </div>
            <span className="ta-nav-badge">({urgentCount})</span>
          </div>

          <div
            className={`ta-nav-item ${activeNav === 'resolved' ? 'active' : ''}`}
            onClick={() => {
              setActiveNav('resolved');
              setSelectedTicketId(null);
            }}
          >
            <div className="ta-nav-left">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>Resolved</span>
            </div>
            <span className="ta-nav-badge">({resolvedCount})</span>
          </div>
        </nav>
      </aside>

      {/* ------------------------------------------------------------ */}
      {/* 2. Main Shell & Top Bar                                      */}
      {/* ------------------------------------------------------------ */}
      <main className="ta-main-shell">
        <header className="ta-topbar">
          {/* Back to CMS Button */}
          <button
            onClick={() => {
              if (onExit) onExit();
              else window.location.href = '/';
            }}
            className="ta-back-btn"
            title="Return to CMS Portal"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back to CMS
          </button>

          {/* Search Bar */}
          <div className="ta-search-bar">
            <svg className="ta-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search tickets, students, subjects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ta-search-input"
            />
          </div>

          {/* Right Section */}
          <div className="ta-topbar-right">
            <span className="ta-quote">Make a difference, one doubt at a time.</span>

            {/* Notification Bell */}
            <div style={{ position: 'relative' }}>
              <button
                className="ta-icon-btn"
                onClick={() => setIsNotificationsOpen((prev) => !prev)}
                title="Notifications"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {urgentCount > 0 && <span className="ta-badge-dot" />}
              </button>

              {isNotificationsOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '46px',
                    right: 0,
                    width: '320px',
                    backgroundColor: '#111723',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '12px',
                    padding: '16px',
                    boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
                    zIndex: 1000,
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px', color: '#ffffff' }}>
                    Recent Activity
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#cbd5e1', padding: '6px 8px', background: 'rgba(239,68,68,0.1)', borderRadius: '6px' }}>
                      🔥 <strong>#TK-1024</strong> from Aarav Sharma requires urgent attention.
                    </div>
                    <div style={{ fontSize: '12px', color: '#cbd5e1', padding: '6px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px' }}>
                      📝 <strong>#TK-1025</strong> from Riya Malhotra was added to queue.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Avatar Button */}
            <button
              className="ta-top-avatar-btn"
              onClick={() => {
                setEditName(profile.name);
                setEditAvatar(profile.avatarUrl);
                setEditStatus(profile.status);
                setIsProfileModalOpen(true);
              }}
              title="Click to edit name and upload photo"
            >
              <img src={profile.avatarUrl} alt={profile.name} className="ta-top-avatar-img" />
            </button>
          </div>
        </header>

        {/* ------------------------------------------------------------ */}
        {/* 3. Content Body (Full-Width OR Split View)                   */}
        {/* ------------------------------------------------------------ */}
        <div className="ta-content-body">
          {/* Left Column: Tickets Queue List */}
          <div className={`ta-queue-column ${selectedTicketId ? 'split-view' : 'full-width'}`}>
            <div className="ta-queue-header">
              <div className="ta-queue-title-wrap">
                <div className="ta-queue-heading">
                  {activeNav === 'queue' && 'Doubt Queue'}
                  {activeNav === 'urgent' && 'Urgent Tickets'}
                  {activeNav === 'resolved' && 'Resolved Doubts'}
                  <span>({displayedTickets.length})</span>
                </div>
                <span className="ta-queue-sub">
                  {activeNav === 'queue' && 'Incoming doubts from students'}
                  {activeNav === 'urgent' && 'High priority doubts requiring immediate help'}
                  {activeNav === 'resolved' && 'Previously resolved questions and solutions'}
                </span>
              </div>

              {/* Sort Selector */}
              <select
                className="ta-sort-select"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
              >
                <option value="latest">Latest First</option>
                <option value="oldest">Oldest First</option>
                <option value="urgent">Urgent First</option>
              </select>
            </div>

            {/* Tickets Scroll List */}
            <div className="ta-tickets-scroll">
              {displayedTickets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ta-text-muted)' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 12px auto' }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <p style={{ fontSize: '15px', color: '#ffffff' }}>No tickets found</p>
                  <p style={{ fontSize: '13px' }}>Try switching filters or clearing your search query.</p>
                </div>
              ) : (
                displayedTickets.map((ticket) => {
                  const isSelected = selectedTicketId === ticket.id;
                  return (
                    <div
                      key={ticket.id}
                      className={`ta-ticket-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectTicket(ticket.id)}
                    >
                      {/* Diagram / Problem Thumbnail */}
                      <div className="ta-card-thumb-wrap">
                        {ticket.diagramUrl ? (
                          <img src={ticket.diagramUrl} alt="Problem diagram" className="ta-card-thumb-img" />
                        ) : (
                          <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#64748b' }}>
                            {ticket.subject[0]}
                          </span>
                        )}
                      </div>

                      {/* Main Card Content */}
                      <div className="ta-card-main">
                        <div className="ta-card-meta-row">
                          <span className="ta-ticket-id">{ticket.ticketNumber}</span>
                          {ticket.urgency === 'Urgent' ? (
                            <span className="ta-badge-urgent">Urgent</span>
                          ) : (
                            <span className="ta-badge-normal">Normal</span>
                          )}
                          <span className={`ta-badge-subject ${ticket.subject.toLowerCase()}`}>
                            {ticket.subject}
                          </span>
                          <span className="ta-badge-exam">{ticket.examTag}</span>
                        </div>

                        <h3 className="ta-card-title">{ticket.title}</h3>

                        <div className="ta-card-student-line">
                          <span>👤 {ticket.studentName}</span>
                          <span>•</span>
                          <span>{ticket.studentClass}</span>
                        </div>

                        {/* Extra description when in full-width mode */}
                        {!selectedTicketId && (
                          <div className="ta-full-card-extra">
                            {ticket.questionSnippet}
                          </div>
                        )}

                        <div className="ta-card-time">{ticket.submittedAt}</div>
                      </div>

                      {/* Button in full-width view */}
                      {!selectedTicketId && (
                        <button className="ta-open-ticket-btn">
                          Open Ticket →
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Ticket Detail & Chat View (Split View) */}
          {activeTicket && (
            <div className="ta-detail-panel">
              {/* Header */}
              <div className="ta-detail-header">
                <div className="ta-detail-top-row">
                  <div className="ta-detail-id-wrap">
                    <span className="ta-detail-id">{activeTicket.ticketNumber}</span>
                    {activeTicket.urgency === 'Urgent' ? (
                      <span className="ta-badge-urgent">Urgent</span>
                    ) : (
                      <span className="ta-badge-normal">Normal</span>
                    )}
                    <span className={`ta-badge-subject ${activeTicket.subject.toLowerCase()}`}>
                      {activeTicket.subject}
                    </span>
                    <span className="ta-badge-exam">{activeTicket.examTag}</span>
                  </div>

                  <div className="ta-detail-time-wrap">
                    <span className="ta-detail-submitted">Submitted on {activeTicket.submittedAt}</span>
                    {/* Close split button to return to full-width queue */}
                    <button
                      className="ta-close-detail-btn"
                      onClick={handleCloseSplit}
                      title="Close panel and return to full-width queue"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <h2 className="ta-detail-title">{activeTicket.title}</h2>

                <div className="ta-detail-student-row">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span>{activeTicket.studentName}</span>
                  <span>•</span>
                  <span>{activeTicket.studentClass}</span>
                </div>

                {/* Navigation Tabs */}
                <div className="ta-tabs-bar">
                  <button
                    className={`ta-tab-btn ${activeDetailTab === 'question' ? 'active' : ''}`}
                    onClick={() => setActiveDetailTab('question')}
                  >
                    Question
                  </button>
                  <button
                    className={`ta-tab-btn ${activeDetailTab === 'studentInfo' ? 'active' : ''}`}
                    onClick={() => setActiveDetailTab('studentInfo')}
                  >
                    Student Info
                  </button>
                  <button
                    className={`ta-tab-btn ${activeDetailTab === 'previousChats' ? 'active' : ''}`}
                    onClick={() => setActiveDetailTab('previousChats')}
                  >
                    Previous Chats ({activeTicket.previousChats.length})
                  </button>
                </div>
              </div>

              {/* Scrollable Body */}
              <div className="ta-detail-body">
                {activeDetailTab === 'question' && (
                  <>
                    {/* Question text */}
                    <div className="ta-question-text">
                      {activeTicket.questionFull}
                    </div>

                    {/* Attached Diagram Card */}
                    {activeTicket.diagramUrl && (
                      <div className="ta-diagram-card">
                        <img src={activeTicket.diagramUrl} alt="Diagram" className="ta-diagram-img" />
                        <button
                          className="ta-zoom-btn"
                          onClick={() => setIsLightboxOpen(true)}
                          title="Expand image fullscreen"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 3 21 3 21 9" />
                            <polyline points="9 21 3 21 3 15" />
                            <line x1="21" y1="3" x2="14" y2="10" />
                            <line x1="3" y1="21" x2="10" y2="14" />
                          </svg>
                        </button>
                      </div>
                    )}

                    {/* Chat Messages Thread */}
                    <div className="ta-chat-thread">
                      {activeTicket.messages.map((msg) => (
                        <div key={msg.id} className={`ta-msg-row ${msg.sender}`}>
                          {msg.sender === 'student' ? (
                            <div className="ta-msg-avatar">{activeTicket.studentAvatar}</div>
                          ) : (
                            <img src={msg.avatar || profile.avatarUrl} alt={msg.senderName} className="ta-msg-avatar" />
                          )}

                          <div className="ta-msg-content">
                            <div className="ta-msg-header">
                              <span>{msg.senderName}</span>
                              <span>{msg.time}</span>
                            </div>
                            <div className="ta-msg-bubble">{msg.text}</div>
                          </div>
                        </div>
                      ))}
                      <div ref={chatBottomRef} />
                    </div>
                  </>
                )}

                {/* Tab 2: Student Info */}
                {activeDetailTab === 'studentInfo' && (
                  <div className="ta-student-grid">
                    <div className="ta-info-card">
                      <span className="ta-info-label">Full Name</span>
                      <span className="ta-info-val">{activeTicket.studentName}</span>
                    </div>
                    <div className="ta-info-card">
                      <span className="ta-info-label">Class / Batch</span>
                      <span className="ta-info-val">{activeTicket.studentClass}</span>
                    </div>
                    <div className="ta-info-card">
                      <span className="ta-info-label">Email Address</span>
                      <span className="ta-info-val">{activeTicket.studentInfo.email}</span>
                    </div>
                    <div className="ta-info-card">
                      <span className="ta-info-label">Phone</span>
                      <span className="ta-info-val">{activeTicket.studentInfo.phone}</span>
                    </div>
                    <div className="ta-info-card">
                      <span className="ta-info-label">Target Exam</span>
                      <span className="ta-info-val">{activeTicket.studentInfo.targetExam}</span>
                    </div>
                    <div className="ta-info-card">
                      <span className="ta-info-label">Total Doubts Solved</span>
                      <span className="ta-info-val">{activeTicket.studentInfo.doubtsSolved}</span>
                    </div>
                    <div className="ta-info-card">
                      <span className="ta-info-label">Live Attendance</span>
                      <span className="ta-info-val" style={{ color: '#22c55e' }}>{activeTicket.studentInfo.attendance}</span>
                    </div>
                    <div className="ta-info-card">
                      <span className="ta-info-label">Recent Test Score</span>
                      <span className="ta-info-val" style={{ color: '#60a5fa' }}>{activeTicket.studentInfo.recentTestScore}</span>
                    </div>
                  </div>
                )}

                {/* Tab 3: Previous Chats */}
                {activeDetailTab === 'previousChats' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {activeTicket.previousChats.length === 0 ? (
                      <p style={{ color: 'var(--ta-text-muted)', fontSize: '14px', textAlign: 'center', padding: '20px' }}>
                        No previous chats recorded for this student yet.
                      </p>
                    ) : (
                      activeTicket.previousChats.map((pc) => (
                        <div key={pc.id} className="ta-info-card" style={{ padding: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>{pc.title}</span>
                            <span style={{ fontSize: '12px', color: '#eab308' }}>{'★'.repeat(pc.rating)}</span>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--ta-text-muted)', marginTop: '4px' }}>
                            Resolved by {pc.resolvedBy} on {pc.date} ({pc.subject})
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Chat Bar */}
              <div className="ta-chat-bottom-bar">
                {/* File Attachment */}
                <label className="ta-attach-btn" title="Attach image or formula sheet">
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        showToast(`Attached "${e.target.files[0].name}" to chat`);
                      }
                    }}
                  />
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                </label>

                {/* Chat Input form */}
                <form onSubmit={handleSendMessage} className="ta-chat-input-wrap">
                  <input
                    type="text"
                    placeholder="Type your message here..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="ta-chat-input"
                  />
                  <button type="submit" className="ta-send-btn" title="Send message">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </form>

                {/* Resolve Doubt Button */}
                {activeTicket.status === 'resolved' ? (
                  <button className="ta-resolve-btn resolved-badge">
                    ✓ Resolved
                  </button>
                ) : (
                  <button onClick={handleResolveDoubt} className="ta-resolve-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Resolve Doubt
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ------------------------------------------------------------ */}
      {/* 4. Profile Edit Modal                                        */}
      {/* ------------------------------------------------------------ */}
      {isProfileModalOpen && (
        <div className="ta-modal-backdrop" onClick={() => setIsProfileModalOpen(false)}>
          <div className="ta-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="ta-modal-header">
              <h3 className="ta-modal-title">Teacher Assistant Profile</h3>
              <button className="ta-modal-close" onClick={() => setIsProfileModalOpen(false)}>
                ✕
              </button>
            </div>

            {/* Avatar Edit */}
            <div className="ta-profile-avatar-edit">
              <img src={editAvatar} alt={editName} className="ta-profile-avatar-large" />
              <label className="ta-upload-label">
                📷 Upload New Photo
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handlePhotoUpload}
                />
              </label>
            </div>

            {/* Name Input */}
            <div className="ta-field-group">
              <label className="ta-field-label">Display Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="ta-input"
                placeholder="Enter your name"
              />
            </div>

            {/* Role & Email display */}
            <div className="ta-field-group">
              <label className="ta-field-label">Assigned Role</label>
              <input
                type="text"
                value={profile.role}
                disabled
                className="ta-input"
                style={{ opacity: 0.7, cursor: 'not-allowed' }}
              />
            </div>

            {/* Status Select */}
            <div className="ta-field-group">
              <label className="ta-field-label">Availability Status</label>
              <select
                className="ta-input"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as any)}
              >
                <option value="Online">🟢 Online (Accepting doubts)</option>
                <option value="Away">🟡 Away</option>
                <option value="Busy">🔴 Busy</option>
              </select>
            </div>

            {/* Save Button */}
            <button className="ta-save-btn" onClick={handleSaveProfile}>
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {/* 5. Image Lightbox Modal                                      */}
      {/* ------------------------------------------------------------ */}
      {isLightboxOpen && activeTicket?.diagramUrl && (
        <div className="ta-modal-backdrop" onClick={() => setIsLightboxOpen(false)}>
          <div className="ta-lightbox-card" onClick={(e) => e.stopPropagation()}>
            <img src={activeTicket.diagramUrl} alt="Problem diagram zoomed" className="ta-lightbox-img" />
            <button
              onClick={() => setIsLightboxOpen(false)}
              style={{
                marginTop: '16px',
                background: '#ef4444',
                color: '#ffffff',
                border: 'none',
                padding: '8px 20px',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Close Fullscreen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeacherAssistantDesk;
