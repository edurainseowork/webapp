import edurainLogo from '../assets/logo.webp'
import { useState, useEffect, useRef, useMemo, type ChangeEvent, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { io, Socket } from 'socket.io-client';
import {
  getStoredTickets,
  saveStoredTickets,
  getStoredProfile,
  saveStoredProfile,
  type DoubtTicket,
  type TAProfile,
  type ChatMessage,
} from './teacherAssistantData';
import { apiFetch, API_BASE_URL } from '../api';
import { compressImage, validateImageFiles, type CompressedImageResult } from '../lib/compression';
import './TeacherAssistantDesk.css';

function formatSubmittedDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const datePart = d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const timePart = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return `${datePart} at ${timePart}`;
  } catch {
    return dateStr;
  }
}

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}

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

  const effectiveEmail = (user?.email || profile.email || '').trim().toLowerCase();
  const effectiveName = user?.displayName || profile.name;

  // Tickets State
  const [tickets, setTickets] = useState<DoubtTicket[]>(getStoredTickets);
  const [isFetchingTickets, setIsFetchingTickets] = useState(false);
  
  // Navigation State: Central Available Pool, My Claimed, and Solved
  const [activeNav, setActiveNav] = useState<'pool' | 'my_claimed' | 'resolved'>('pool');
  
  // Selected ticket for Split View (null = full-width queue)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Tabs inside the Detail Panel
  const [activeDetailTab, setActiveDetailTab] = useState<'question' | 'studentInfo' | 'previousChats'>('question');

  // Search & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest'>('latest');

  // Chat message input
  const [chatInput, setChatInput] = useState('');
  // TA Chat image attachments
  const [taAttachments, setTaAttachments] = useState<CompressedImageResult[]>([]);
  const [isTaCompressing, setIsTaCompressing] = useState(false);

  // Modals & Popovers
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Profile Edit temporary state
  const [editName, setEditName] = useState(profile.name);
  const [editAvatar, setEditAvatar] = useState(profile.avatarUrl);
  const [editStatus, setEditStatus] = useState(profile.status);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const taChatFileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  // Live fetch from Backend
  const fetchTickets = async () => {
    setIsFetchingTickets(true);
    try {
      const res = await apiFetch<{ success: boolean; data: DoubtTicket[] }>('/tickets');
      if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
        setTickets(res.data);
        saveStoredTickets(res.data);
      }
    } catch {
      // Keep using stored tickets if network fails
    } finally {
      setIsFetchingTickets(false);
    }
  };

  useEffect(() => {
    fetchTickets();

    // Socket.io connection for real-time synchronization
    const socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      if (selectedTicketId) {
        socket.emit('join_ticket', {
          ticketId: selectedTicketId,
          userId: profile.email,
          role: 'teacher',
        });
      }
    });

    socket.on('ticket_created', (data: any) => {
      const ticket: DoubtTicket = data?.ticket || data;
      if (!ticket || (!ticket.id && !ticket.ticketNumber)) return;
      setTickets((prev) => {
        if (prev.some((t) => t.id === ticket.id || t.ticketNumber === ticket.ticketNumber)) return prev;
        return [ticket, ...prev];
      });
      showToast(`New doubt added to pool: #${ticket.ticketNumber || ticket.id}`);
    });

    socket.on('ticket_updated', (data: any) => {
      const ticket: DoubtTicket = data?.ticket || data;
      if (!ticket || (!ticket.id && !ticket.ticketNumber)) return;
      setTickets((prev) => {
        const idx = prev.findIndex((t) => t.id === ticket.id || t.ticketNumber === ticket.ticketNumber);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], ...ticket };
          return updated;
        }
        return [ticket, ...prev];
      });
    });

    socket.on('new_message', (payload: { ticketId: string; ticketNumber?: string; message: ChatMessage; ticket?: DoubtTicket }) => {
      setTickets((prev) =>
        prev.map((t) => {
          if (
            t.id === payload.ticketId ||
            t.ticketNumber === payload.ticketId ||
            (payload.ticketNumber && t.ticketNumber === payload.ticketNumber)
          ) {
            const msgs = t.messages || [];
            if (msgs.some((m) => m.id === payload.message.id)) {
              return payload.ticket ? { ...t, ...payload.ticket, messages: msgs } : t;
            }
            return {
              ...t,
              ...(payload.ticket || {}),
              messages: [...msgs, payload.message],
            };
          }
          return t;
        })
      );
    });

    socket.on('ticket_status_updated', (payload: { ticketId: string; ticketNumber?: string; status: any; assignedTo?: any; ticket?: DoubtTicket }) => {
      setTickets((prev) =>
        prev.map((t) => {
          if (
            t.id === payload.ticketId ||
            t.ticketNumber === payload.ticketId ||
            (payload.ticketNumber && t.ticketNumber === payload.ticketNumber)
          ) {
            return {
              ...t,
              status: payload.status,
              ...(payload.assignedTo !== undefined ? { assignedTo: payload.assignedTo } : {}),
              ...(payload.ticket || {}),
            };
          }
          return t;
        })
      );
    });

    socket.on('resolution_requested', (payload: { ticketId: string; ticketNumber?: string; ticket?: DoubtTicket }) => {
      setTickets((prev) =>
        prev.map((t) =>
          t.id === payload.ticketId ||
          t.ticketNumber === payload.ticketId ||
          (payload.ticketNumber && t.ticketNumber === payload.ticketNumber)
            ? { ...t, status: 'resolution_requested', ...(payload.ticket || {}) }
            : t
        )
      );
    });

    socket.on('ticket_closed', (payload: { ticketId: string; ticketNumber?: string }) => {
      setTickets((prev) =>
        prev.map((t) =>
          t.id === payload.ticketId ||
          t.ticketNumber === payload.ticketId ||
          (payload.ticketNumber && t.ticketNumber === payload.ticketNumber)
            ? { ...t, status: 'resolved' }
            : t
        )
      );
      showToast(`Ticket #${payload.ticketNumber || payload.ticketId} marked as Doubt Solved by student.`);
    });

    const handleFocus = () => {
      fetchTickets();
    };
    window.addEventListener('focus', handleFocus);
    const interval = setInterval(fetchTickets, 12000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
      socket.disconnect();
    };
  }, []);

  // When selected ticket changes, join the room
  useEffect(() => {
    if (selectedTicketId && socketRef.current) {
      socketRef.current.emit('join_ticket', {
        ticketId: selectedTicketId,
        userId: profile.email,
        role: 'teacher',
      });
    }
  }, [selectedTicketId]);

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
    return tickets.find((t) => t.id === selectedTicketId || t.ticketNumber === selectedTicketId) || null;
  }, [tickets, selectedTicketId]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (activeTicket && activeDetailTab === 'question') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTicket?.messages.length, activeDetailTab]);

  // Counts based on Central Pool and Claims
  const poolCount = useMemo(
    () => tickets.filter((t) => (!t.assignedTo || !t.assignedTo.email) && t.status !== 'resolved').length,
    [tickets]
  );
  const myClaimedCount = useMemo(
    () =>
      tickets.filter(
        (t) => t.assignedTo && t.assignedTo.email?.toLowerCase() === effectiveEmail && t.status !== 'resolved'
      ).length,
    [tickets, effectiveEmail]
  );
  const resolvedCount = useMemo(() => tickets.filter((t) => t.status === 'resolved').length, [tickets]);

  // Filtered & Sorted Tickets
  const displayedTickets = useMemo(() => {
    let list = tickets.filter((t) => {
      if (activeNav === 'pool') return (!t.assignedTo || !t.assignedTo.email) && t.status !== 'resolved';
      if (activeNav === 'my_claimed') return t.assignedTo && t.assignedTo.email?.toLowerCase() === effectiveEmail && t.status !== 'resolved';
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

    if (sortOrder === 'oldest') {
      list = [...list].reverse();
    }

    return list;
  }, [tickets, activeNav, searchQuery, sortOrder, effectiveEmail]);

  // Handlers
  const handleSelectTicket = (id: string) => {
    setSelectedTicketId(id);
    setActiveDetailTab('question');
  };

  const handleCloseSplit = () => {
    setSelectedTicketId(null);
  };

  const handleClaimTicket = async (ticketId: string) => {
    const taData = { id: effectiveEmail, name: effectiveName, email: effectiveEmail };
    if (socketRef.current) {
      socketRef.current.emit('claim_ticket', {
        ticketId,
        taId: effectiveEmail,
        taName: effectiveName,
        taEmail: effectiveEmail,
        ta: taData,
      });
    }
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, assignedTo: taData, status: 'in_progress' } : t))
    );
    showToast('Ticket claimed! It is now locked to your workspace.');

    try {
      await apiFetch(`/tickets/${ticketId}/claim`, {
        method: 'POST',
        body: { taId: effectiveEmail, taName: effectiveName, taEmail: effectiveEmail },
      });
    } catch {
      // saved locally
    }
  };

  const handleReleaseTicket = async (ticketId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('release_ticket', { ticketId });
    }
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, assignedTo: null, status: 'queue' } : t))
    );
    showToast('Ticket released back to available pool.');

    try {
      await apiFetch(`/tickets/${ticketId}/release`, {
        method: 'POST',
      });
    } catch {
      // saved locally
    }
  };

  const handleTaFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingCapacity = Math.max(0, 3 - taAttachments.length);
    if (remainingCapacity <= 0) {
      showToast('Maximum 3 attachments allowed per message.');
      e.target.value = '';
      return;
    }

    const { valid, error } = validateImageFiles(files);
    if (error) {
      showToast(error);
      if (valid.length === 0) {
        e.target.value = '';
        return;
      }
    }

    const filesToCompress = valid.slice(0, remainingCapacity);
    setIsTaCompressing(true);
    try {
      const compressedList = await Promise.all(filesToCompress.map((f) => compressImage(f)));
      setTaAttachments((prev) => [...prev, ...compressedList]);
      showToast(`Attached & compressed ${compressedList.length} image(s)!`);
    } catch {
      showToast('Failed to process image');
    } finally {
      setIsTaCompressing(false);
      e.target.value = '';
    }
  };

  const handleSendMessage = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!activeTicket) return;

    if (activeTicket.status === 'resolved') {
      showToast('This ticket is marked as resolved and cannot receive new messages.');
      return;
    }

    if (!activeTicket.assignedTo) {
      showToast('Please pick this doubt first before sending a message!');
      return;
    }
    if (activeTicket.assignedTo.email?.toLowerCase() !== effectiveEmail) {
      showToast(`This doubt is assigned to ${activeTicket.assignedTo.name}. Only the assigned teacher can reply.`);
      return;
    }

    if (!chatInput.trim() && taAttachments.length === 0) return;

    const messageText = chatInput.trim();
    const attachmentsToSend = taAttachments.map((a) => a.dataUrl);

    const newMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'ta',
      senderName: effectiveName,
      text: messageText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      avatar: profile.avatarUrl,
      attachmentUrl: attachmentsToSend[0],
      attachmentUrls: attachmentsToSend,
    };

    setTickets((prev) =>
      prev.map((t) => (t.id === activeTicket.id ? { ...t, messages: [...t.messages, newMsg] } : t))
    );
    setChatInput('');
    setTaAttachments([]);

    // Real-time socket broadcast
    if (socketRef.current) {
      socketRef.current.emit('send_message', {
        ticketId: activeTicket.id,
        messageId: newMsg.id,
        senderId: effectiveEmail,
        senderName: effectiveName,
        role: 'ta',
        message: messageText,
        attachments: attachmentsToSend,
      });
    }

    try {
      await apiFetch(`/tickets/${activeTicket.id}/reply`, {
        method: 'POST',
        body: {
          id: newMsg.id,
          text: messageText,
          senderName: effectiveName,
          sender: 'ta',
          attachments: attachmentsToSend,
        },
      });
      showToast('Reply sent to student!');
    } catch {
      // Delivered via socket
    }
  };

  // Resolution Request Trigger (Dual-Action Flow)
  const handleRequestResolution = async () => {
    if (!activeTicket) return;

    if (!activeTicket.assignedTo) {
      showToast('Please pick this doubt first before requesting resolution!');
      return;
    }
    if (activeTicket.assignedTo.email?.toLowerCase() !== effectiveEmail) {
      showToast(`This doubt is assigned to ${activeTicket.assignedTo.name}. Only the assigned teacher can request resolution.`);
      return;
    }

    if (socketRef.current) {
      socketRef.current.emit('request_resolution', {
        ticketId: activeTicket.id,
        resolvedBy: effectiveName,
      });
    }

    setTickets((prev) =>
      prev.map((t) =>
        t.id === activeTicket.id
          ? { ...t, status: 'resolution_requested', resolutionRequestedAt: new Date().toISOString() }
          : t
      )
    );
    showToast('Resolution requested! Student prompted with Doubt Solved & Follow-up options.');

    try {
      await apiFetch(`/tickets/${activeTicket.id}/request-resolution`, {
        method: 'POST',
        body: { resolvedBy: effectiveName },
      });
    } catch {
      // Handled
    }
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
            className={`ta-nav-item ${activeNav === 'pool' ? 'active' : ''}`}
            onClick={() => {
              setActiveNav('pool');
              setSelectedTicketId(null);
            }}
          >
            <div className="ta-nav-left">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
              </svg>
              <span>Available Pool</span>
            </div>
            <span className="ta-nav-badge">({poolCount})</span>
          </div>

          <div
            className={`ta-nav-item ${activeNav === 'my_claimed' ? 'active' : ''}`}
            onClick={() => {
              setActiveNav('my_claimed');
              setSelectedTicketId(null);
            }}
          >
            <div className="ta-nav-left">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <polyline points="16 11 18 13 22 9" />
              </svg>
              <span>My Claimed</span>
            </div>
            <span className="ta-nav-badge">({myClaimedCount})</span>
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
                {poolCount > 0 && <span className="ta-badge-dot" />}
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
                    Central Doubt Pool Activity
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#cbd5e1', padding: '6px 8px', background: 'rgba(56,189,248,0.1)', borderRadius: '6px' }}>
                      🏊 <strong>{poolCount} doubts</strong> currently waiting in Central Pool.
                    </div>
                    <div style={{ fontSize: '12px', color: '#cbd5e1', padding: '6px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px' }}>
                      📝 Live synchronization enabled via Socket.io.
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
        {/* 3. Content Body (Queue & Split View Detail)                  */}
        {/* ------------------------------------------------------------ */}
        <div className="ta-content-body">
          {/* Left Column: Tickets Queue List */}
          <div className={`ta-queue-column ${selectedTicketId ? 'split-view' : 'full-width'}`}>
              <div className="ta-queue-header">
                <div className="ta-queue-title-wrap">
                  <div className="ta-queue-heading">
                    {activeNav === 'pool' && 'Available Doubts'}
                    {activeNav === 'my_claimed' && 'My Claimed Doubts'}
                    {activeNav === 'resolved' && 'Solved Doubts'}
                    <span>({displayedTickets.length})</span>
                  </div>
                  <span className="ta-queue-sub">
                    {activeNav === 'pool' && 'Doubts waiting to be picked by a teacher'}
                    {activeNav === 'my_claimed' && 'Doubts you are currently solving'}
                    {activeNav === 'resolved' && 'History of solved doubts'}
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
                </select>
              </div>

              {/* Tickets Scroll List */}
              <div className="ta-tickets-scroll animate-view" key={activeNav}>
                {isFetchingTickets && displayedTickets.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px' }} aria-busy="true" role="status">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="ta-ticket-card" style={{ opacity: 0.85, cursor: 'default' }}>
                        <div className="skeleton-box" style={{ width: '48px', height: '48px', borderRadius: '10px', flexShrink: 0 }} />
                        <div className="ta-card-main" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <div className="skeleton-box" style={{ width: '60px', height: '18px' }} />
                            <div className="skeleton-box" style={{ width: '80px', height: '18px' }} />
                            <div className="skeleton-box" style={{ width: '50px', height: '18px' }} />
                          </div>
                          <div className="skeleton-box" style={{ width: '75%', height: '16px' }} />
                          <div className="skeleton-box" style={{ width: '40%', height: '12px' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : displayedTickets.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ta-text-muted)' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 12px auto' }}>
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <p style={{ fontSize: '15px', color: '#ffffff' }}>No doubts found</p>
                    <p style={{ fontSize: '13px' }}>Try switching tabs or clearing your search query.</p>
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
                            {ticket.assignedTo ? (
                              <span style={{ fontSize: '11px', color: '#38bdf8', background: 'rgba(56,189,248,0.12)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                                👤 {ticket.assignedTo.name}
                              </span>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#34d399', background: 'rgba(52,211,153,0.12)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                                🟢 Open Pool
                              </span>
                            )}
                            {ticket.status === 'resolution_requested' && (
                              <span style={{ fontSize: '11px', color: '#fbbf24', background: 'rgba(251,191,36,0.12)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                                ⏳ Waiting for Student
                              </span>
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

                          <div className="ta-card-time">{formatRelativeTime(ticket.submittedAt)}</div>
                        </div>

                        {/* Action buttons on card */}
                        {!selectedTicketId && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end', justifyContent: 'center' }}>
                            {!ticket.assignedTo && ticket.status !== 'resolved' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleClaimTicket(ticket.id);
                                }}
                                style={{
                                  background: '#0284c7',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '6px 14px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                Pick Doubt
                              </button>
                            )}
                            <button className="ta-open-ticket-btn">
                              Open Chat →
                            </button>
                          </div>
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
                    {activeTicket.assignedTo ? (
                      <span style={{ fontSize: '11px', color: '#38bdf8', background: 'rgba(56,189,248,0.14)', padding: '3px 8px', borderRadius: '5px', fontWeight: 700 }}>
                        👤 {activeTicket.assignedTo.name}
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#34d399', background: 'rgba(52,211,153,0.14)', padding: '3px 8px', borderRadius: '5px', fontWeight: 700 }}>
                        🟢 Open Pool
                      </span>
                    )}
                    {activeTicket.status === 'resolution_requested' && (
                      <span style={{ fontSize: '11px', color: '#fbbf24', background: 'rgba(251,191,36,0.14)', padding: '3px 8px', borderRadius: '5px', fontWeight: 700 }}>
                        ⏳ Waiting for Student
                      </span>
                    )}
                    <span className={`ta-badge-subject ${activeTicket.subject.toLowerCase()}`}>
                      {activeTicket.subject}
                    </span>
                    <span className="ta-badge-exam">{activeTicket.examTag}</span>
                    {!activeTicket.assignedTo && activeTicket.status !== 'resolved' ? (
                      <button
                        onClick={() => handleClaimTicket(activeTicket.id)}
                        style={{ background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Pick Doubt
                      </button>
                    ) : activeTicket.assignedTo?.email === profile.email && activeTicket.status !== 'resolved' ? (
                      <button
                        onClick={() => handleReleaseTicket(activeTicket.id)}
                        style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Leave Doubt
                      </button>
                    ) : null}
                  </div>

                  <div className="ta-detail-time-wrap">
                    <span className="ta-detail-submitted">Submitted on {formatSubmittedDate(activeTicket.submittedAt)}</span>
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

                    {/* Attached Diagram / Screenshots */}
                    {(() => {
                      const urls = (activeTicket.attachmentUrls && activeTicket.attachmentUrls.length > 0)
                        ? activeTicket.attachmentUrls
                        : (activeTicket.diagramUrls && activeTicket.diagramUrls.length > 0)
                        ? activeTicket.diagramUrls
                        : activeTicket.diagramUrl
                        ? [activeTicket.diagramUrl]
                        : [];
                      if (urls.length === 0) return null;
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>
                            Attached Images ({urls.length}/3):
                          </span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                            {urls.map((url, idx) => (
                              <div key={idx} className="ta-diagram-card" style={{ maxWidth: '240px', position: 'relative' }}>
                                <img src={url} alt={`Doubt Attachment ${idx + 1}`} className="ta-diagram-img" style={{ maxHeight: '160px', objectFit: 'contain' }} />
                                <button
                                  className="ta-zoom-btn"
                                  onClick={() => setLightboxUrl(url)}
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
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Chat Messages Thread */}
                    <div className="ta-chat-thread">
                      {activeTicket.messages.map((msg) => {
                        const isStudent = msg.sender === 'student';
                        const rawAvatar = isStudent
                          ? (msg.avatar || activeTicket.studentAvatar)
                          : (msg.avatar || profile.avatarUrl);
                        const isUrl =
                          rawAvatar &&
                          typeof rawAvatar === 'string' &&
                          (rawAvatar.startsWith('http://') ||
                            rawAvatar.startsWith('https://') ||
                            rawAvatar.startsWith('data:') ||
                            rawAvatar.startsWith('/'));
                        const initial = (
                          (isStudent
                            ? msg.senderName || activeTicket.studentName
                            : msg.senderName || profile.name) ||
                          (isStudent ? 'S' : 'T')
                        )
                          .trim()
                          .charAt(0)
                          .toUpperCase() || (isStudent ? 'S' : 'T');

                        return (
                          <div key={msg.id} className={`ta-msg-row ${msg.sender}`}>
                            {isUrl ? (
                              <img
                                src={rawAvatar}
                                alt={msg.senderName}
                                className="ta-msg-avatar"
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="ta-msg-avatar">{initial}</div>
                            )}

                          <div className="ta-msg-content">
                            <div className="ta-msg-header">
                              <span>{msg.senderName}</span>
                              <span>{msg.time}</span>
                            </div>
                            {msg.text && <div className="ta-msg-bubble">{msg.text}</div>}
                            {/* Message Attachments */}
                            {msg.attachmentUrls && msg.attachmentUrls.length > 0 ? (
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                                {msg.attachmentUrls.map((url, idx) => (
                                  <img
                                    key={idx}
                                    src={url}
                                    alt="reply attachment"
                                    onClick={() => setLightboxUrl(url)}
                                    style={{ maxWidth: '180px', maxHeight: '130px', borderRadius: '8px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)' }}
                                  />
                                ))}
                              </div>
                            ) : msg.attachmentUrl ? (
                              <img
                                src={msg.attachmentUrl}
                                alt="reply attachment"
                                onClick={() => setLightboxUrl(msg.attachmentUrl!)}
                                style={{ maxWidth: '180px', maxHeight: '130px', borderRadius: '8px', cursor: 'pointer', marginTop: '6px', border: '1px solid rgba(255,255,255,0.15)' }}
                              />
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                      <div ref={chatBottomRef} />
                    </div>
                  </>
                )}

                {/* Tab 2: Student Info */}
                {activeDetailTab === 'studentInfo' && (
                  <div className="ta-student-grid">
                    {[
                      ['Full Name', activeTicket.studentName],
                      ['Class / Batch', activeTicket.studentClass],
                      ['Email Address', activeTicket.studentInfo.email],
                      ['Phone', activeTicket.studentInfo.phone],
                      ['Target Exam', activeTicket.studentInfo.targetExam],
                      ['Total Doubts Solved', activeTicket.studentInfo.doubtsSolved],
                      ['Live Attendance', activeTicket.studentInfo.attendance, '#22c55e'],
                      ['Recent Test Score', activeTicket.studentInfo.recentTestScore, '#60a5fa'],
                    ].map(([label, val, color]) => (
                      <div key={label} className="ta-info-card">
                        <span className="ta-info-label">{label}</span>
                        <span className="ta-info-val" style={color ? { color: color as string } : undefined}>{val}</span>
                      </div>
                    ))}
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

              {/* Pending Attachments Strip */}
              {taAttachments.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', padding: '8px 16px', background: 'rgba(15,23,42,0.85)', borderTop: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Attachments ({taAttachments.length}/3):</span>
                  {taAttachments.map((att, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1e293b', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <img src={att.dataUrl} alt="" style={{ width: '24px', height: '24px', objectFit: 'cover', borderRadius: '4px' }} />
                      <span style={{ fontSize: '11px', color: '#38bdf8' }}>{(att.compressedSize / 1024).toFixed(0)} KB</span>
                      <span style={{ fontSize: '10px', color: '#22c55e' }}>(-{att.savingsPercent}%)</span>
                      <button
                        type="button"
                        onClick={() => setTaAttachments((prev) => prev.filter((_, i) => i !== idx))}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px', padding: '0 2px' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Bottom Chat Bar - Locked unless picked by this TA, or Read-Only if resolved */}
              {activeTicket.status === 'resolved' ? (
                <div className="ta-chat-bottom-bar ta-claimed-other-bar">
                  <div className="ta-lock-info">
                    <span className="ta-lock-icon">✅</span>
                    <div>
                      <div className="ta-lock-title">Ticket Resolved</div>
                      <div className="ta-lock-sub">This doubt has been marked as resolved and discussion is closed.</div>
                    </div>
                  </div>
                  <span className="ta-badge-readonly">Resolved</span>
                </div>
              ) : !activeTicket.assignedTo ? (
                <div className="ta-chat-bottom-bar ta-unclaimed-lock-bar">
                  <div className="ta-lock-info">
                    <span className="ta-lock-icon">🔒</span>
                    <div>
                      <div className="ta-lock-title">Doubt is Available in Open Pool</div>
                      <div className="ta-lock-sub">You must pick this doubt to assign it to yourself before you can chat or reply.</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleClaimTicket(activeTicket.id)}
                    className="ta-claim-primary-btn"
                  >
                    👉 Pick Doubt to Start Solving
                  </button>
                </div>
              ) : activeTicket.assignedTo?.email?.toLowerCase() !== effectiveEmail ? (
                <div className="ta-chat-bottom-bar ta-claimed-other-bar">
                  <div className="ta-lock-info">
                    <span className="ta-lock-icon">👤</span>
                    <div>
                      <div className="ta-lock-title">Claimed by {activeTicket.assignedTo?.name}</div>
                      <div className="ta-lock-sub">This doubt is being handled by another teacher assistant.</div>
                    </div>
                  </div>
                  <span className="ta-badge-readonly">Read-Only</span>
                </div>
              ) : (
                <div className="ta-chat-bottom-bar">
                  {/* File Attachment */}
                  <label className="ta-attach-btn" title="Attach up to 3 compressed images (max 10MB each)">
                    <input
                      ref={taChatFileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={isTaCompressing || taAttachments.length >= 3}
                      style={{ display: 'none' }}
                      onChange={handleTaFileSelect}
                    />
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  </label>

                  {/* Chat Input form */}
                  <form onSubmit={handleSendMessage} className="ta-chat-input-wrap">
                    <input
                      type="text"
                      placeholder={isTaCompressing ? "Compressing image..." : "Type your message here..."}
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

                  {/* Resolve Doubt / Request Resolution Button */}
                  {activeTicket.status === 'resolution_requested' ? (
                    <button className="ta-resolve-btn" disabled style={{ background: '#d97706', opacity: 0.95, cursor: 'wait' }}>
                      ⏳ Waiting for Student
                    </button>
                  ) : (
                    <button onClick={handleRequestResolution} className="ta-resolve-btn">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Close Doubt Request
                    </button>
                  )}
                </div>
              )}
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
      {(lightboxUrl || (isLightboxOpen && activeTicket?.diagramUrl)) && (
        <div
          className="ta-modal-backdrop"
          onClick={() => {
            setLightboxUrl(null);
            setIsLightboxOpen(false);
          }}
        >
          <div className="ta-lightbox-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <img
              src={lightboxUrl || activeTicket?.diagramUrl || ''}
              alt="Zoomed attachment"
              className="ta-lightbox-img"
              style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: '8px' }}
            />
            <button
              onClick={() => {
                setLightboxUrl(null);
                setIsLightboxOpen(false);
              }}
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
