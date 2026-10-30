import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  Ticket,
  Clock,
  X,
  Send,
  Sparkles,
  ImageIcon,
  Loader2,
  MessageSquare,
  ArrowLeft,
  Paperclip,
  Maximize2,
} from 'lucide-react';
import { SubPageHeader } from './SubPageHeader';
import { apiFetch, API_BASE_URL } from '../lib/api';
import { io, Socket } from 'socket.io-client';
import {
  compressImage,
  compressImageToTarget,
  validateImageFiles,
  STUDENT_CREATION_MAX_IMAGES,
  STUDENT_CHAT_MAX_IMAGES,
  STUDENT_TICKET_TOTAL_MAX_IMAGES,
  STUDENT_TICKET_MAX_COMBINED_BYTES,
  TARGET_CREATION_BYTES,
  formatBytes,
  type CompressedImageResult,
} from '../lib/compression';

interface BookDoubtSessionViewProps {
  onBack: () => void;
  onConfirmBooking?: (summary: any) => void;
  onOpenMySessions?: () => void;
  selectedBatch?: string;
  goalName?: string;
  studentName?: string;
  studentEmail?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'student' | 'ta';
  senderName: string;
  text: string;
  time: string;
  avatar?: string;
  attachmentUrl?: string;
  attachmentUrls?: string[];
}

export interface UserTicket {
  id: string;
  ticketNumber?: string;
  topic?: string;
  title?: string;
  subject: string;
  examTag?: string;
  status: string;
  createdAt?: string;
  submittedAtRelative?: string;
  assignedMentor?: string;
  attachmentUrls?: string[];
  diagramUrls?: string[];
  diagramUrl?: string;
  questionFull?: string;
  messages?: ChatMessage[];
}

const INITIAL_TICKETS: UserTicket[] = [
  {
    id: 't-101',
    ticketNumber: 'TKT-1082',
    topic: 'Rotational Dynamics: Parallel Axis Theorem on Inclined Plane',
    title: 'Rotational Dynamics: Parallel Axis Theorem on Inclined Plane',
    subject: 'Physics',
    examTag: 'JEE Advanced',
    status: 'In Review',
    createdAt: 'Today, 10:14 AM',
    submittedAtRelative: '10 mins ago',
    assignedMentor: 'Dr. Arjun Mehta',
    questionFull: 'In the diagram attached, a uniform circular cylinder of mass M and radius R rolls without slipping down an inclined plane with angle theta. Please explain the torque balance about the contact axis vs the center of mass.',
    diagramUrls: ['https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1200&q=80'],
    messages: [
      { id: 'm-1', sender: 'student', senderName: 'Aarav Sharma', text: 'Hi sir, I tried finding torque about contact point P, but why does friction torque vanish?', time: '10:14 AM' },
      { id: 'm-2', sender: 'ta', senderName: 'Dr. Arjun Mehta', text: 'Because line of friction passes directly through point P, its lever arm is zero.', time: '10:17 AM' },
    ],
  },
  {
    id: 't-102',
    ticketNumber: 'TKT-1085',
    topic: 'Definite Integration with Periodic Functions & King Rule',
    title: 'Definite Integration with Periodic Functions & King Rule',
    subject: 'Mathematics',
    examTag: 'JEE Mains',
    status: 'In Review',
    createdAt: 'Today, 09:55 AM',
    submittedAtRelative: '25 mins ago',
    assignedMentor: 'EduRain Senior Faculty',
    questionFull: 'Evaluating integral from 0 to 2pi of x*sin(x)/(1+cos^2(x)) dx using substitution. Should I split at pi or directly apply f(a+b-x)?',
    messages: [
      { id: 'm-201', sender: 'student', senderName: 'Diya Patel', text: 'Does King rule cancel out the numerator x when applying f(2pi - x)?', time: '09:55 AM' },
      { id: 'm-202', sender: 'ta', senderName: 'EduRain Senior Faculty', text: 'Yes, because integral I = integral from 0 to 2pi of (2pi - x)*sin(2pi-x)/(1+cos^2(2pi-x)). Adding the two integrals gives 2I = 2pi * integral(sin(x)/(1+cos^2(x))).', time: '10:02 AM' },
    ],
  },
  {
    id: 't-103',
    ticketNumber: 'TKT-1088',
    topic: 'Coordination Chemistry: Crystal Field Splitting in d4 High Spin',
    title: 'Coordination Chemistry: Crystal Field Splitting in d4 High Spin',
    subject: 'Chemistry',
    examTag: 'NEET 2026',
    status: 'In Review',
    createdAt: 'Today, 09:30 AM',
    submittedAtRelative: '40 mins ago',
    assignedMentor: 'Dr. Ramesh Raman',
    questionFull: 'In [Cr(H2O)6]2+ complex, Cr is +2 with 3d4 configuration. Weak ligand means high spin (t2g3 eg1). How do we calculate total CFSE in terms of delta_o?',
    diagramUrls: ['https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=80'],
    messages: [
      { id: 'm-301', sender: 'student', senderName: 'Rohan Verma', text: 'Is CFSE = (-0.4 * 3 + 0.6 * 1) * delta_o = -0.6 delta_o?', time: '09:35 AM' },
      { id: 'm-302', sender: 'ta', senderName: 'Dr. Ramesh Raman', text: 'Correct! The 3 electrons in t2g contribute -0.4 each (-1.2) and 1 in eg contributes +0.6, giving exactly -0.6 delta_o.', time: '09:42 AM' },
    ],
  },
  {
    id: 't-104',
    ticketNumber: 'TKT-1070',
    topic: 'Rotational Dynamics of Pure Rolling on an Inclined Plane',
    title: 'Rotational Dynamics of Pure Rolling on an Inclined Plane',
    subject: 'Physics',
    examTag: 'JEE Advanced',
    status: 'Resolved',
    createdAt: 'Yesterday, 04:12 PM',
    submittedAtRelative: '1 day ago',
    assignedMentor: 'Prof. Alok Gupta',
    questionFull: 'Condition for pure rolling on rough incline of friction coefficient mu.',
    messages: [
      { id: 'm-401', sender: 'student', senderName: 'Ananya Deshmukh', text: 'What is the minimum friction coefficient required for pure rolling of a solid sphere?', time: '04:12 PM' },
      { id: 'm-402', sender: 'ta', senderName: 'Prof. Alok Gupta', text: 'For a solid sphere, mu_min = (2/7) * tan(theta).', time: '04:20 PM' },
    ],
  },
];

const SUBJECTS = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'IIT-JEE Advanced',
  'NEET-UG',
  'General Doubt',
];

export const isResolutionPending = (status?: string | null): boolean => {
  if (!status) return false;
  const s = status.toLowerCase().trim();
  return s === 'resolution_requested' || s === 'resolution requested' || s.includes('resolution');
};

export const normalizeTicketStatus = (status?: string | null): 'Resolved' | 'resolution_requested' | 'In Review' => {
  if (!status) return 'In Review';
  const s = status.toLowerCase().trim();
  if (s === 'resolved') return 'Resolved';
  if (s === 'resolution_requested' || s === 'resolution requested' || s.includes('resolution')) {
    return 'resolution_requested';
  }
  return 'In Review';
};

export function BookDoubtSessionView({
  onBack,
  onOpenMySessions,
  selectedBatch,
  goalName,
  studentName,
  studentEmail,
}: BookDoubtSessionViewProps) {
  const [subject, setSubject] = useState('Mathematics');
  const [doubtTitle, setDoubtTitle] = useState('');
  const [doubtDescription, setDoubtDescription] = useState('');
  const [attachments, setAttachments] = useState<CompressedImageResult[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [submittedTicket, setSubmittedTicket] = useState<UserTicket | null>(null);

  // Tickets List & Chat Modal state
  const [showTicketsModal, setShowTicketsModal] = useState(false);
  const [ticketsList, setTicketsList] = useState<UserTicket[]>(() => {
    try {
      const stored = localStorage.getItem('edurain_student_tickets_cache');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_TICKETS;
  });
  const [isFetchingTickets, setIsFetchingTickets] = useState(false);
  const [selectedTicketForChat, setSelectedTicketForChat] = useState<UserTicket | null>(null);

  // Sync ticketsList with localStorage for instant zero-lag display, excluding base64 data URLs
  useEffect(() => {
    if (ticketsList && ticketsList.length > 0) {
      try {
        const sanitized = ticketsList.map((t) => ({
          ...t,
          attachmentUrls: t.attachmentUrls?.filter((u) => !u.startsWith('data:')),
          diagramUrls: t.diagramUrls?.filter((u) => !u.startsWith('data:')),
          messages: t.messages?.map((m) => ({
            ...m,
            attachmentUrl: m.attachmentUrl?.startsWith('data:') ? undefined : m.attachmentUrl,
            attachmentUrls: m.attachmentUrls?.filter((u) => !u.startsWith('data:')),
          })),
        }));
        localStorage.setItem('edurain_student_tickets_cache', JSON.stringify(sanitized));
      } catch {}
    }
  }, [ticketsList]);

  // Student follow-up reply in chat
  const [studentChatInput, setStudentChatInput] = useState('');
  const [studentReplyAttachments, setStudentReplyAttachments] = useState<CompressedImageResult[]>([]);
  const [isStudentCompressing, setIsStudentCompressing] = useState(false);
  const [isStudentSending, setIsStudentSending] = useState(false);

  // Zoom / Lightbox
  const [activeZoomImage, setActiveZoomImage] = useState<string | null>(null);

  const studentChatEndRef = useRef<HTMLDivElement>(null);
  const studentFileInputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // Dynamic Exam / Cohort tag derived from home page cohort and goal
  const derivedExamTag = goalName || selectedBatch || 'JEE Advanced';

  const flashToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  // Fetch live tickets for the authenticated student from Backend
  const fetchAllTickets = async () => {
    setIsFetchingTickets(true);
    try {
      const query = studentEmail ? `?email=${encodeURIComponent(studentEmail.trim())}` : '';
      const res = await apiFetch<{ success: boolean; data: any[] }>(`/tickets/my${query}`);
      if (res && res.data && Array.isArray(res.data)) {
        const mapped: UserTicket[] = res.data.map((t) => ({
          id: t.id,
          ticketNumber: t.ticketNumber || t.id,
          topic: t.title,
          title: t.title,
          subject: t.subject,
          examTag: t.examTag,
          status: normalizeTicketStatus(t.status),
          createdAt: t.submittedAtRelative || 'Recently',
          submittedAtRelative: t.submittedAtRelative,
          assignedMentor: t.assignedTo?.name || 'EduRain Senior Faculty',
          attachmentUrls: t.diagramUrls || t.attachmentUrls || (t.diagramUrl ? [t.diagramUrl] : []),
          diagramUrls: t.diagramUrls || (t.diagramUrl ? [t.diagramUrl] : []),
          questionFull: t.questionFull,
          messages: t.messages || [],
        }));
        setTicketsList(mapped);

        // If chat modal is currently open on a ticket, update it too
        setSelectedTicketForChat((curr) => {
          if (!curr) return null;
          const updated = mapped.find(
            (t) => t.id === curr.id || t.ticketNumber === curr.ticketNumber
          );
          return updated || curr;
        });
      }
    } catch {
      // Keep using current state
    } finally {
      setIsFetchingTickets(false);
    }
  };

  // Re-fetch on window focus to catch any status updates from Teacher Assistant
  useEffect(() => {
    const onFocus = () => fetchAllTickets();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // Polling fallback when tickets modal is open and socket is disconnected
  useEffect(() => {
    if (!showTicketsModal) return;
    fetchAllTickets();
    const interval = setInterval(() => {
      if (!socketRef.current?.connected) {
        fetchAllTickets();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [showTicketsModal]);

  useEffect(() => {
    fetchAllTickets();

    // Socket.io connection for real-time synchronization
    const socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      // If a chat is already open, rejoin its room
      if (selectedTicketForChat) {
        socket.emit('join_ticket', {
          ticketId: selectedTicketForChat.id,
          userId: studentEmail || 'student@edurain.in',
          role: 'student',
        });
      }
    });

    socket.on('ticket_created', (payload: { ticket: any }) => {
      if (!payload?.ticket) return;
      const t = payload.ticket;
      if (studentEmail && t.studentInfo?.email && t.studentInfo.email.toLowerCase() !== studentEmail.toLowerCase()) {
        return;
      }
      const mappedTicket: UserTicket = {
        id: t.id,
        ticketNumber: t.ticketNumber || t.id,
        topic: t.title,
        title: t.title,
        subject: t.subject,
        examTag: t.examTag,
        status: normalizeTicketStatus(t.status),
        createdAt: t.submittedAtRelative || 'Just now',
        submittedAtRelative: t.submittedAtRelative || 'Just now',
        assignedMentor: t.assignedTo?.name || 'EduRain Senior Faculty',
        attachmentUrls: t.diagramUrls || t.attachmentUrls || (t.diagramUrl ? [t.diagramUrl] : []),
        diagramUrls: t.diagramUrls || (t.diagramUrl ? [t.diagramUrl] : []),
        questionFull: t.questionFull,
        messages: t.messages || [],
      };
      setTicketsList((prev) => {
        if (prev.some((x) => x.id === mappedTicket.id || x.ticketNumber === mappedTicket.ticketNumber)) return prev;
        return [mappedTicket, ...prev];
      });
    });

    socket.on('ticket_updated', (payload: { ticket: any }) => {
      if (!payload?.ticket) return;
      const t = payload.ticket;
      if (studentEmail && t.studentInfo?.email && t.studentInfo.email.toLowerCase() !== studentEmail.toLowerCase()) {
        return;
      }
      const displayStatus = normalizeTicketStatus(t.status);
      setTicketsList((prev) =>
        prev.map((item) => {
          if (item.id === t.id || item.ticketNumber === t.ticketNumber) {
            return {
              ...item,
              topic: t.title || item.topic,
              title: t.title || item.title,
              subject: t.subject || item.subject,
              status: displayStatus,
              assignedMentor: t.assignedTo?.name || item.assignedMentor,
              messages: t.messages || item.messages,
              submittedAtRelative: t.submittedAtRelative || item.submittedAtRelative,
            };
          }
          return item;
        })
      );
      setSelectedTicketForChat((curr) => {
        if (!curr || (curr.id !== t.id && curr.ticketNumber !== t.ticketNumber)) return curr;
        return {
          ...curr,
          topic: t.title || curr.topic,
          title: t.title || curr.title,
          subject: t.subject || curr.subject,
          status: displayStatus,
          assignedMentor: t.assignedTo?.name || curr.assignedMentor,
          messages: t.messages || curr.messages,
          submittedAtRelative: t.submittedAtRelative || curr.submittedAtRelative,
        };
      });
    });

    socket.on('new_message', (payload: { ticketId: string; ticketNumber?: string; message: ChatMessage; ticket?: any }) => {
      setTicketsList((prev) =>
        prev.map((t) => {
          if (
            t.id === payload.ticketId ||
            t.ticketNumber === payload.ticketId ||
            (payload.ticketNumber && t.ticketNumber === payload.ticketNumber)
          ) {
            const msgs = t.messages || [];
            const nextStatus = payload.ticket?.status ? normalizeTicketStatus(payload.ticket.status) : t.status;
            if (msgs.some((m) => m.id === payload.message.id)) {
              return { ...t, status: nextStatus };
            }
            return {
              ...t,
              messages: [...msgs, payload.message],
              status: nextStatus,
            };
          }
          return t;
        })
      );
      setSelectedTicketForChat((curr) => {
        if (
          !curr ||
          (curr.id !== payload.ticketId &&
            curr.ticketNumber !== payload.ticketId &&
            (!payload.ticketNumber || curr.ticketNumber !== payload.ticketNumber))
        ) {
          return curr;
        }
        const msgs = curr.messages || [];
        const nextStatus = payload.ticket?.status ? normalizeTicketStatus(payload.ticket.status) : curr.status;
        if (msgs.some((m) => m.id === payload.message.id)) {
          return { ...curr, status: nextStatus };
        }
        return {
          ...curr,
          messages: [...msgs, payload.message],
          status: nextStatus,
        };
      });
      if (payload.message.sender === 'ta') {
        flashToast(`Reply received from ${payload.message.senderName || 'Teacher Assistant'}!`);
      }
    });

    socket.on('resolution_requested', (payload: { ticketId: string; ticketNumber?: string; ticket?: any }) => {
      setTicketsList((prev) =>
        prev.map((t) =>
          t.id === payload.ticketId || t.ticketNumber === payload.ticketId || (payload.ticketNumber && t.ticketNumber === payload.ticketNumber)
            ? { ...t, status: 'resolution_requested', messages: payload.ticket?.messages || t.messages }
            : t
        )
      );
      setSelectedTicketForChat((curr) =>
        curr &&
        (curr.id === payload.ticketId ||
          curr.ticketNumber === payload.ticketId ||
          (payload.ticketNumber && curr.ticketNumber === payload.ticketNumber))
          ? { ...curr, status: 'resolution_requested', messages: payload.ticket?.messages || curr.messages }
          : curr
      );
      flashToast('Teacher Assistant requested doubt resolution. Please confirm or reply.');
    });

    socket.on('ticket_status_updated', (payload: { ticketId: string; ticketNumber?: string; status: string; assignedTo?: any }) => {
      const displayStatus = normalizeTicketStatus(payload.status);
      setTicketsList((prev) =>
        prev.map((t) => {
          if (
            t.id === payload.ticketId ||
            t.ticketNumber === payload.ticketId ||
            (payload.ticketNumber && t.ticketNumber === payload.ticketNumber)
          ) {
            return {
              ...t,
              status: displayStatus,
              ...(payload.assignedTo?.name ? { assignedMentor: payload.assignedTo.name } : {}),
            };
          }
          return t;
        })
      );
      setSelectedTicketForChat((curr) => {
        if (
          !curr ||
          (curr.id !== payload.ticketId &&
            curr.ticketNumber !== payload.ticketId &&
            (!payload.ticketNumber || curr.ticketNumber !== payload.ticketNumber))
        ) {
          return curr;
        }
        return {
          ...curr,
          status: displayStatus,
          ...(payload.assignedTo?.name ? { assignedMentor: payload.assignedTo.name } : {}),
        };
      });
    });

    socket.on('ticket_closed', (payload: { ticketId: string; ticketNumber?: string }) => {
      setTicketsList((prev) =>
        prev.map((t) =>
          t.id === payload.ticketId || t.ticketNumber === payload.ticketId || (payload.ticketNumber && t.ticketNumber === payload.ticketNumber)
            ? { ...t, status: 'Resolved' }
            : t
        )
      );
      setSelectedTicketForChat((curr) =>
        curr &&
        (curr.id === payload.ticketId ||
          curr.ticketNumber === payload.ticketId ||
          (payload.ticketNumber && curr.ticketNumber === payload.ticketNumber))
          ? { ...curr, status: 'Resolved' }
          : curr
      );
      flashToast('This doubt ticket has been marked Solved!');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // When selectedTicketForChat changes, join the socket room
  useEffect(() => {
    if (selectedTicketForChat && socketRef.current) {
      socketRef.current.emit('join_ticket', {
        ticketId: selectedTicketForChat.id,
        userId: studentEmail || 'student@edurain.in',
        role: 'student',
      });
    }
  }, [selectedTicketForChat?.id]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (selectedTicketForChat) {
      studentChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedTicketForChat?.messages?.length]);

  // Handle new doubt image attachments selection & compression (Limit: Exactly 1 photo, ~1MB target)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (attachments.length >= STUDENT_CREATION_MAX_IMAGES) {
      flashToast(`Ticket creation allows maximum ${STUDENT_CREATION_MAX_IMAGES} photo. Please remove it first.`);
      return;
    }

    const { valid, error } = validateImageFiles(files);
    if (error) {
      flashToast(error);
      if (valid.length === 0) return;
    }

    const toProcess = valid.slice(0, STUDENT_CREATION_MAX_IMAGES - attachments.length);
    setIsCompressing(true);

    try {
      const compressedList = await Promise.all(
        toProcess.map((f) => compressImageToTarget(f, TARGET_CREATION_BYTES))
      );
      setAttachments((prev) => [...prev, ...compressedList]);
      flashToast(`Photo compressed (~1MB target) & attached!`);
    } catch {
      flashToast('Failed to compress image. Please try again.');
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  // Handle student chat reply image attachments (Max 2 in chat, total <= 3 per ticket, combined < 2MB)
  const handleStudentReplyFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Count student photos already on this ticket: retain initialPhotos and exclude first message from message-photo count
    const initialPhotos = selectedTicketForChat?.attachmentUrls?.length || 0;
    const chatStudentPhotos = (selectedTicketForChat?.messages?.slice(1) || [])
      .filter((m) => m.sender === 'student')
      .reduce((sum, m) => sum + (m.attachmentUrls?.length || (m.attachmentUrl ? 1 : 0)), 0);
    const existingTotal = initialPhotos + chatStudentPhotos;

    const remainingForTicket = Math.max(0, STUDENT_TICKET_TOTAL_MAX_IMAGES - existingTotal);
    const availableSlots = Math.min(
      STUDENT_CHAT_MAX_IMAGES - studentReplyAttachments.length,
      remainingForTicket
    );

    if (availableSlots <= 0) {
      flashToast(`Upload limit reached: max 2 photos in chat and 3 total per ticket.`);
      return;
    }

    const { valid, error } = validateImageFiles(files);
    if (error) {
      flashToast(error);
      if (valid.length === 0) return;
    }

    const toProcess = valid.slice(0, availableSlots);
    setIsStudentCompressing(true);

    try {
      const compressedList = await Promise.all(
        toProcess.map((f) => compressImageToTarget(f, 600 * 1024))
      );
      setStudentReplyAttachments((prev) => [...prev, ...compressedList]);
      flashToast(`Attached ${compressedList.length} compressed photo(s)!`);
    } catch {
      flashToast('Failed to compress image.');
    } finally {
      setIsStudentCompressing(false);
      e.target.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit main doubt ticket (Priority completely removed)
  const handleRaiseTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doubtTitle.trim()) {
      flashToast('Please enter a doubt topic or concept title.');
      return;
    }
    if (!doubtDescription.trim()) {
      flashToast('Please describe what you have tried and where you are stuck.');
      return;
    }

    setIsSubmitting(true);
    const attachmentUrls = attachments.slice(0, STUDENT_CREATION_MAX_IMAGES).map((a) => a.dataUrl);

    try {
      const res = await apiFetch<{ success: boolean; data: any }>('/tickets', {
        method: 'POST',
        body: {
          title: doubtTitle.trim(),
          subject,
          description: doubtDescription.trim(),
          studentName: studentName || 'Student',
          studentClass: selectedBatch || 'Class 12th',
          studentEmail: studentEmail || 'student@edurain.in',
          examTag: derivedExamTag,
          attachments: attachmentUrls,
        },
      });

      if (res && res.data) {
        const newTicket: UserTicket = {
          id: res.data.id,
          ticketNumber: res.data.ticketNumber,
          topic: res.data.title,
          title: res.data.title,
          subject: res.data.subject,
          examTag: res.data.examTag,
          status: 'In Review',
          createdAt: 'Just now',
          submittedAtRelative: 'Just now',
          assignedMentor: 'EduRain Senior Faculty',
          attachmentUrls,
          diagramUrls: attachmentUrls,
          questionFull: doubtDescription.trim(),
          messages: res.data.messages || [
            {
              id: `m-${Date.now()}`,
              sender: 'student',
              senderName: studentName || 'Student',
              text: doubtDescription.trim(),
              time: 'Just now',
              attachmentUrls,
            },
          ],
        };
        setSubmittedTicket(newTicket);
        setTicketsList((prev) => [newTicket, ...prev.filter((x) => x.id !== newTicket.id)]);
        flashToast(`Ticket ${newTicket.ticketNumber} created successfully!`);
      }
    } catch (err) {
      flashToast(err instanceof Error ? err.message : 'Failed to submit doubt ticket. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Student sends reply in the chat thread (Strict Turn-Based, bypassed during resolution request)
  const handleStudentSendReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedTicketForChat) return;
    if (!studentChatInput.trim() && studentReplyAttachments.length === 0) return;

    const isPendingRes = isResolutionPending(selectedTicketForChat.status);
    const msgs = selectedTicketForChat.messages || [];
    const lastMsg = msgs[msgs.length - 1];

    // Strict Turn-Based Rule: Student cannot send if last message was from student UNLESS TA requested resolution
    if (lastMsg && lastMsg.sender === 'student' && !isPendingRes) {
      flashToast('Please wait for the Teacher Assistant to reply before sending another message.');
      return;
    }

    const messageText = studentChatInput.trim();
    const attachmentsToSend = studentReplyAttachments.map((a) => a.dataUrl);

    const newMsg: ChatMessage = {
      id: `m-st-${Date.now()}`,
      sender: 'student',
      senderName: studentName || 'Student',
      text: messageText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachmentUrl: attachmentsToSend[0],
      attachmentUrls: attachmentsToSend,
    };

    const nextStatus = isPendingRes ? 'In Review' : selectedTicketForChat.status;

    // Optimistically update
    setSelectedTicketForChat((prev) =>
      prev ? { ...prev, status: nextStatus, messages: [...(prev.messages || []), newMsg] } : null
    );
    setTicketsList((prev) =>
      prev.map((t) =>
        t.id === selectedTicketForChat.id
          ? { ...t, status: nextStatus, messages: [...(t.messages || []), newMsg] }
          : t
      )
    );

    setStudentChatInput('');
    setStudentReplyAttachments([]);
    setIsStudentSending(true);

    // If resolution was pending, student reply automatically triggers followup mode
    if (isPendingRes) {
      try {
        await apiFetch(`/tickets/${selectedTicketForChat.id}/action`, {
          method: 'POST',
          body: {
            action: 'followup',
            message: messageText,
            messageId: newMsg.id,
            attachments: attachmentsToSend,
          },
        });
        flashToast('Reply sent!');
      } catch {
        flashToast('Failed to send follow-up reply. Please try again.');
      } finally {
        setIsStudentSending(false);
      }
      return;
    }

    // Emit via Socket.io
    if (socketRef.current) {
      socketRef.current.emit('send_message', {
        ticketId: selectedTicketForChat.id,
        messageId: newMsg.id,
        senderId: studentEmail || 'student',
        senderName: studentName || 'Student',
        role: 'student',
        message: messageText,
        attachments: attachmentsToSend,
      });
    }

    try {
      await apiFetch(`/tickets/${selectedTicketForChat.id}/reply`, {
        method: 'POST',
        body: {
          id: newMsg.id,
          text: messageText,
          sender: 'student',
          senderName: studentName || 'Student',
          attachments: attachmentsToSend,
        },
      });
      flashToast('Reply sent!');
    } catch {
      // Delivered via socket
    } finally {
      setIsStudentSending(false);
    }
  };

  // Student Action for Dual-Action Resolution ('solved' | 'followup')
  const handleResolutionAction = async (action: 'solved' | 'followup') => {
    if (!selectedTicketForChat) return;

    // Emit socket event
    if (socketRef.current) {
      socketRef.current.emit('ticket_action', {
        ticketId: selectedTicketForChat.id,
        action,
      });
    }

    const updatedStatus = action === 'solved' ? 'Resolved' : 'In Review';
    setSelectedTicketForChat((prev) => (prev ? { ...prev, status: updatedStatus } : null));
    setTicketsList((prev) =>
      prev.map((t) => (t.id === selectedTicketForChat.id ? { ...t, status: updatedStatus } : t))
    );

    try {
      await apiFetch(`/tickets/${selectedTicketForChat.id}/action`, {
        method: 'POST',
        body: { action },
      });
      if (action === 'solved') {
        flashToast('Doubt marked as Solved! Ticket closed.');
      } else {
        flashToast('Follow-up mode active. You can now reply.');
      }
    } catch {
      flashToast(action === 'solved' ? 'Ticket marked as solved.' : 'Follow-up mode active.');
    }
  };

  const handleResetForm = () => {
    setDoubtTitle('');
    setDoubtDescription('');
    setAttachments([]);
    setSubmittedTicket(null);
  };

  return (
    <div className="relative w-full rounded-[24px] overflow-hidden flex flex-col bg-[#DCEAE3] font-sans min-h-[calc(100vh-6rem)] shadow-sm">
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 pb-20">
        {/* 1. Header with Breadcrumb ('Ask a Doubt') & 'My Tickets' */}
        <SubPageHeader
          onBack={onBack}
          crumbs={[
            { label: 'Home', onClick: onBack },
            { label: 'Features', onClick: onBack },
            { label: 'Ask a Doubt' },
          ]}
          rightElement={
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  setSelectedTicketForChat(null);
                  setShowTicketsModal(true);
                }}
                className="flex items-center gap-2 bg-white hover:bg-[#EAF3F1] text-[#175A67] border border-[#175A67]/20 font-bold text-xs px-4 py-2 rounded-xl transition-all active:scale-95 shadow-sm"
              >
                <Ticket className="w-3.5 h-3.5 text-[#175A67]" />
                My Tickets
                <span className="w-4 h-4 rounded-full bg-[#0F3B42] text-white text-[10px] font-bold flex items-center justify-center">
                  {ticketsList.length}
                </span>
              </button>
            </div>
          }
        />

        <div className="max-w-4xl mx-auto mt-3">
          {/* Ask a Doubt Section Badge + Shifted Down Heading */}
          <div className="mb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#175A67]/15 text-[#0F3B42] border border-[#175A67]/25 text-[11px] font-bold tracking-wide uppercase mb-2">
              <Sparkles className="w-3.5 h-3.5 text-[#175A67]" />
              Ask a Doubt Section
            </div>

            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-[#0B1C30]">Raise a Ticket</h1>
              <div className="flex items-center gap-2 text-xs text-[#175A67] font-semibold">
                <span className="text-slate-500">Student Cohort:</span>
                <span className="bg-white/80 border border-[#175A67]/20 px-2.5 py-0.5 rounded-full font-bold text-[#0F3B42]">
                  {derivedExamTag}
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[#175A67] mt-1 font-medium">
              Have a doubt or question? Submit your query with code, diagrams or screenshots and our subject experts will resolve it.
            </p>
          </div>

          {/* Success Screen if Ticket Submitted */}
          {submittedTicket ? (
            <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-[0_10px_35px_rgb(0,0,0,0.06)] border border-[#175A67]/10 text-center animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 mb-3">
                Ticket #{submittedTicket.ticketNumber || submittedTicket.id} Created
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-[#0B1C30]">Your Doubt Ticket Has Been Raised!</h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto mt-2 leading-relaxed">
                We have assigned your doubt to <strong className="text-[#0B1C30]">{submittedTicket.assignedMentor || 'EduRain Senior Faculty'}</strong>. You can chat directly with faculty and view replies under My Tickets.
              </p>

              <div className="bg-[#F8FAFC] border border-[#175A67]/15 rounded-2xl p-4 sm:p-5 max-w-md mx-auto mt-6 text-left space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Topic:</span>
                  <span className="font-bold text-[#0B1C30] truncate max-w-[240px]">{submittedTicket.topic || submittedTicket.title}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Subject:</span>
                  <span className="font-semibold text-[#175A67] bg-[#EAF3F1] px-2 py-0.5 rounded">{submittedTicket.subject}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Cohort / Target:</span>
                  <span className="font-semibold text-[#0F3B42] bg-slate-100 px-2 py-0.5 rounded">{submittedTicket.examTag || derivedExamTag}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Status:</span>
                  <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    {submittedTicket.status}
                  </span>
                </div>
                {submittedTicket.attachmentUrls && submittedTicket.attachmentUrls.length > 0 && (
                  <div className="pt-2 border-t border-slate-200/80 flex items-center gap-2">
                    <span className="text-slate-500 text-xs">Attached Images:</span>
                    <span className="text-xs font-bold text-[#175A67]">
                      {submittedTicket.attachmentUrls.length} compressed image(s)
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
                <button
                  onClick={handleResetForm}
                  className="px-5 py-2.5 rounded-xl border border-[#175A67]/20 text-[#175A67] hover:bg-[#EAF3F1] font-bold text-xs transition-all active:scale-95"
                >
                  Raise Another Doubt
                </button>
                <button
                  onClick={() => {
                    setSelectedTicketForChat(submittedTicket);
                    setShowTicketsModal(true);
                  }}
                  className="flex items-center gap-2 bg-[#0F3B42] hover:bg-[#0b2c31] text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md transition-all active:scale-95"
                >
                  <MessageSquare className="w-4 h-4" />
                  Open Doubt Chat &amp; Replies
                </button>
                <button
                  onClick={() => {
                    setSelectedTicketForChat(null);
                    setShowTicketsModal(true);
                  }}
                  className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-[#0B1C30] font-bold text-xs px-5 py-2.5 rounded-xl transition-all active:scale-95"
                >
                  <Ticket className="w-4 h-4" />
                  All Tickets ({ticketsList.length})
                </button>
              </div>
            </div>
          ) : (
            /* Main Form */
            <form onSubmit={handleRaiseTicket} className="bg-white rounded-3xl p-5 sm:p-8 shadow-[0_10px_35px_rgb(0,0,0,0.06)] border border-[#175A67]/10 space-y-6">
              {/* Subject Tags */}
              <div>
                <label className="block text-xs font-bold text-[#0B1C30] mb-2">
                  Select Subject / Topic Category <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {SUBJECTS.map((sub) => {
                    const active = subject === sub;
                    return (
                      <button
                        type="button"
                        key={sub}
                        onClick={() => setSubject(sub)}
                        className={`text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all ${
                          active
                            ? 'bg-[#0F3B42] text-white shadow-sm'
                            : 'bg-[#F8F1EC] text-[#0B1C30] hover:bg-[#F1E6DD] border border-transparent'
                        }`}
                      >
                        {sub}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title Input */}
              <div>
                <label className="block text-xs font-bold text-[#0B1C30] mb-1.5">
                  Doubt Topic / Concept Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Next.js hydration error or Newton's Laws friction problem..."
                  value={doubtTitle}
                  onChange={(e) => setDoubtTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#F8FAFC] border border-[#175A67]/15 text-xs sm:text-sm text-[#0B1C30] placeholder:text-slate-400 focus:outline-none focus:border-[#175A67]/40 focus:ring-2 focus:ring-[#175A67]/10 transition-all"
                />
              </div>

              {/* Detailed Description */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-[#0B1C30]">
                    Describe What You've Tried &amp; Where You're Stuck <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400 font-semibold">{doubtDescription.length} / 1000 chars</span>
                </div>
                <textarea
                  required
                  placeholder="Write clear steps, problem question, equation, or describe the unexpected behavior..."
                  value={doubtDescription}
                  onChange={(e) => setDoubtDescription(e.target.value.slice(0, 1000))}
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl bg-[#F8FAFC] border border-[#175A67]/15 text-xs sm:text-sm text-[#0B1C30] placeholder:text-slate-400 leading-relaxed resize-none focus:outline-none focus:border-[#175A67]/40 focus:ring-2 focus:ring-[#175A67]/10 transition-all"
                />
              </div>

              {/* Attachments (Initial upload: exactly 1 photo, ~1MB target) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-[#0B1C30]">
                    Doubt Diagram / Problem Screenshot (1 Photo Max)
                  </label>
                  <span className="text-[11px] text-slate-400 font-semibold">
                    {attachments.length} / {STUDENT_CREATION_MAX_IMAGES} image (target ~1MB)
                  </span>
                </div>

                {/* Dropzone */}
                {attachments.length < STUDENT_CREATION_MAX_IMAGES ? (
                  <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[#175A67]/20 rounded-2xl px-4 py-6 cursor-pointer hover:border-[#175A67]/40 hover:bg-[#F8FAFC] transition-all text-center">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isCompressing || attachments.length >= STUDENT_CREATION_MAX_IMAGES}
                      onChange={handleFileChange}
                    />
                    <div className="w-10 h-10 rounded-xl bg-[#EAF3F1] text-[#175A67] flex items-center justify-center">
                      {isCompressing ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
                    </div>
                    <p className="text-xs text-[#0B1C30] font-medium">
                      {isCompressing ? (
                        <span className="text-[#175A67] font-bold">Compressing photo to ~1MB target...</span>
                      ) : (
                        <>
                          Drop 1 image file (PNG, JPG, WebP) or{' '}
                          <span className="text-[#175A67] font-bold underline">browse files</span>
                        </>
                      )}
                    </p>
                    <span className="text-[10px] text-slate-400">
                      Auto-compressed to ~1MB with high visual clarity for TA review
                    </span>
                  </label>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500 font-medium">
                    1 image attached. Remove it below if you wish to attach a different screenshot.
                  </div>
                )}

                {/* Compressed Attachment Preview */}
                {attachments.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    {attachments.map((att, idx) => (
                      <div
                        key={idx}
                        className="relative flex items-center gap-3 p-2.5 rounded-xl bg-[#F8FAFC] border border-[#175A67]/20 shadow-sm"
                      >
                        <img
                          src={att.dataUrl}
                          alt={`Attachment ${idx + 1}`}
                          onClick={() => setActiveZoomImage(att.dataUrl)}
                          className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0 bg-white cursor-pointer"
                        />
                        <div className="flex-1 min-w-0 pr-6">
                          <p className="text-xs font-bold text-[#0B1C30] truncate">{att.file.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] font-semibold text-slate-500">
                              {(att.compressedSize / 1024).toFixed(0)} KB
                            </span>
                            {att.savingsPercent > 0 && (
                              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded">
                                -{att.savingsPercent}%
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] text-[#175A67] font-medium block uppercase tracking-tight">
                            High Clarity • {att.format}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttachment(idx)}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-slate-200/80 hover:bg-red-100 hover:text-red-600 text-slate-500 flex items-center justify-center transition-colors"
                          title="Remove image"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  Your query will appear immediately in the Teacher Assistant Desk queue.
                </p>

                <button
                  type="submit"
                  disabled={isSubmitting || isCompressing}
                  className="flex items-center justify-center gap-2 bg-[#0F3B42] hover:bg-[#0b2c31] disabled:opacity-50 text-white font-bold text-sm px-8 py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.98] shrink-0"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Raise a Ticket
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* 2. My Tickets & Interactive Chat Thread Modal                */}
      {/* ------------------------------------------------------------ */}
      {showTicketsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-100 animate-scaleIn max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
              {selectedTicketForChat ? (
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setSelectedTicketForChat(null)}
                    className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
                    title="Back to all tickets"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#175A67] bg-[#EAF3F1] px-2 py-0.5 rounded">
                        {selectedTicketForChat.ticketNumber || `#${selectedTicketForChat.id}`}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          selectedTicketForChat.status === 'Resolved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : isResolutionPending(selectedTicketForChat.status)
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {selectedTicketForChat.status === 'Resolved'
                          ? 'Resolved'
                          : isResolutionPending(selectedTicketForChat.status)
                          ? '⏳ Resolution Requested'
                          : 'In Review'}
                      </span>
                    </div>
                    <h3 className="font-bold text-sm text-[#0B1C30] mt-0.5 truncate max-w-[320px] sm:max-w-md">
                      {selectedTicketForChat.topic || selectedTicketForChat.title}
                    </h3>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#EAF3F1] text-[#175A67] flex items-center justify-center">
                    <Ticket className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-[#0B1C30]">My Doubt Tickets &amp; Chats</h3>
                    <p className="text-[11px] text-slate-500">Click any ticket to view faculty responses and chat</p>
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  setShowTicketsModal(false);
                  setSelectedTicketForChat(null);
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Ticket List OR Live Chat Thread */}
            {selectedTicketForChat ? (
              /* VIEW 2: Chat Thread for Selected Ticket */
              <div className="flex-1 overflow-hidden flex flex-col pt-3 min-h-0">
                
                {/* Scrollable messages container */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-3 text-xs">
                  
                  {/* Problem Question Card */}
                  <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#175A67]/20">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                      <span className="font-semibold text-[#175A67]">Original Doubt Description</span>
                      <span>{selectedTicketForChat.subject} • {selectedTicketForChat.examTag || derivedExamTag}</span>
                    </div>
                    <p className="text-slate-700 leading-relaxed font-normal">
                      {selectedTicketForChat.questionFull || selectedTicketForChat.topic}
                    </p>

                    {/* Attached diagrams / screenshots */}
                    {selectedTicketForChat.attachmentUrls && selectedTicketForChat.attachmentUrls.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-200 flex flex-wrap gap-2">
                        {selectedTicketForChat.attachmentUrls.map((url, i) => (
                          <div
                            key={i}
                            onClick={() => setActiveZoomImage(url)}
                            className="relative group cursor-pointer rounded-lg overflow-hidden border border-slate-200 hover:border-[#175A67]"
                          >
                            <img src={url} alt="Attachment" className="w-16 h-16 object-cover" />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                              <Maximize2 className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Messages Stream */}
                  {selectedTicketForChat.messages && selectedTicketForChat.messages.length > 0 ? (
                    selectedTicketForChat.messages.map((msg) => {
                      const isStudent = msg.sender === 'student';
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isStudent ? 'items-end' : 'items-start'}`}
                        >
                          <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-slate-400 font-semibold">
                            <span>{msg.senderName}</span>
                            <span>•</span>
                            <span>{msg.time}</span>
                            {!isStudent && (
                              <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.2 rounded font-bold">
                                Verified Faculty
                              </span>
                            )}
                          </div>

                          <div
                            className={`max-w-[85%] sm:max-w-[78%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-sm ${
                              isStudent
                                ? 'bg-[#0F3B42] text-white rounded-tr-none'
                                : 'bg-white border border-[#175A67]/20 text-[#0B1C30] rounded-tl-none shadow-sm'
                            }`}
                          >
                            {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}

                            {/* Message Image Attachments */}
                            {msg.attachmentUrls && msg.attachmentUrls.length > 0 ? (
                              <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-white/20">
                                {msg.attachmentUrls.map((url, idx) => (
                                  <img
                                    key={idx}
                                    src={url}
                                    alt="attachment"
                                    onClick={() => setActiveZoomImage(url)}
                                    className="max-w-[150px] max-h-[120px] rounded-lg object-cover cursor-pointer hover:opacity-90 border border-white/30"
                                  />
                                ))}
                              </div>
                            ) : msg.attachmentUrl ? (
                              <img
                                src={msg.attachmentUrl}
                                alt="attachment"
                                onClick={() => setActiveZoomImage(msg.attachmentUrl!)}
                                className="max-w-[150px] max-h-[120px] rounded-lg object-cover cursor-pointer hover:opacity-90 mt-2 border border-white/30"
                              />
                            ) : null}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-6 text-slate-400 text-xs">
                      No response yet. A teacher assistant is reviewing your query.
                    </div>
                  )}

                  <div ref={studentChatEndRef} />
                </div>

                {/* Dual-Action Resolution Request Banner */}
                {isResolutionPending(selectedTicketForChat.status) && (
                  <div className="p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-300 text-[#0B1C30] shadow-sm mb-2 animate-fadeIn">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <span className="font-bold text-xs text-amber-900">
                        Teacher Assistant requested doubt resolution
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed mb-3">
                      Has your doubt been completely cleared? Select an option below to proceed.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleResolutionAction('solved')}
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
                      >
                        ✓ Mark as Doubt Solved
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResolutionAction('followup')}
                        className="flex-1 py-2 px-3 rounded-xl bg-[#0F3B42] hover:bg-[#0b2c31] text-white font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
                      >
                        Ask for Reply / Follow-up
                      </button>
                    </div>
                  </div>
                )}

                {/* Resolved Status Notice */}
                {selectedTicketForChat.status === 'Resolved' && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center text-xs text-emerald-800 font-semibold mb-2">
                    ✓ This doubt has been marked as Solved and permanently closed.
                  </div>
                )}

                {/* Turn-Based Waiting Mode OR Active Chat Input Bar */}
                {selectedTicketForChat.status === 'Resolved' ? (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-400 font-medium">
                    This ticket is closed. No further replies can be posted.
                  </div>
                ) : (() => {
                  const msgs = selectedTicketForChat.messages || [];
                  const lastMsg = msgs[msgs.length - 1];
                  const isWaitingForTA = lastMsg ? lastMsg.sender === 'student' : false;

                  if (isWaitingForTA && !isResolutionPending(selectedTicketForChat.status)) {
                    return (
                      <div className="p-3.5 rounded-xl bg-slate-100/90 border border-slate-200 text-center text-xs text-slate-700 font-semibold flex items-center justify-center gap-2 animate-fadeIn">
                        <Clock className="w-4 h-4 text-[#175A67] animate-pulse" />
                        <span>Wait for reply from Teacher Assistant...</span>
                      </div>
                    );
                  }

                  return (
                    <>
                      {/* Pending Reply Attachments Strip */}
                      {studentReplyAttachments.length > 0 && (
                        <div className="flex gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl mb-2 flex-wrap items-center">
                          <span className="text-[10px] text-slate-500 font-bold">Attached:</span>
                          {studentReplyAttachments.map((att, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-200 text-[11px]"
                            >
                              <img src={att.dataUrl} alt="" className="w-5 h-5 rounded object-cover" />
                              <span className="text-slate-600 font-semibold">{(att.compressedSize / 1024).toFixed(0)} KB</span>
                              <button
                                type="button"
                                onClick={() => setStudentReplyAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                                className="text-red-500 hover:text-red-700 font-bold ml-1 text-xs"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Student Reply Input Bar */}
                      <form
                        onSubmit={handleStudentSendReply}
                        className="flex items-center gap-2 pt-2 border-t border-slate-100 shrink-0"
                      >
                        <label
                          className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer transition-colors"
                          title="Attach up to 2 photos in chat (max 3 total per ticket, <2MB combined)"
                        >
                          <input
                            ref={studentFileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            disabled={isStudentCompressing}
                            className="hidden"
                            onChange={handleStudentReplyFileChange}
                          />
                          <Paperclip className="w-4 h-4" />
                        </label>

                        <input
                          type="text"
                          placeholder={isStudentCompressing ? "Compressing image..." : "Type your follow-up doubt or question..."}
                          value={studentChatInput}
                          onChange={(e) => setStudentChatInput(e.target.value)}
                          className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-[#0B1C30] placeholder:text-slate-400 focus:outline-none focus:border-[#175A67] transition-all"
                        />

                        <button
                          type="submit"
                          disabled={isStudentSending || (!studentChatInput.trim() && studentReplyAttachments.length === 0)}
                          className="p-2.5 rounded-xl bg-[#0F3B42] hover:bg-[#0b2c31] disabled:opacity-40 text-white transition-all shadow-sm"
                          title="Send reply"
                        >
                          {isStudentSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                      </form>
                    </>
                  );
                })()}
              </div>
            ) : (
              /* VIEW 1: All Tickets Cards List */
              <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
                {isFetchingTickets && ticketsList.length === 0 ? (
                  <div className="space-y-2.5" aria-busy="true" role="status">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="p-3.5 sm:p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200/80 space-y-3">
                        <div className="flex justify-between items-center">
                          <div className="h-4 w-20 rounded-md skeleton-shimmer" />
                          <div className="h-4 w-16 rounded-full skeleton-shimmer" />
                        </div>
                        <div className="h-5 w-3/4 rounded-md skeleton-shimmer" />
                        <div className="flex justify-between pt-2 border-t border-slate-200/60">
                          <div className="h-3 w-24 rounded skeleton-shimmer" />
                          <div className="h-3 w-16 rounded skeleton-shimmer" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : ticketsList.length === 0 ? (
                  <p className="text-center py-8 text-slate-400 text-xs font-medium">
                    No tickets found. Raise your first doubt above!
                  </p>
                ) : (
                  ticketsList.map((t) => {
                    const hasFacultyReply = t.messages?.some((m) => m.sender === 'ta');
                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTicketForChat(t)}
                        className="p-3.5 sm:p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200/80 hover:border-[#175A67]/40 hover:bg-white hover:shadow-md transition-all cursor-pointer group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-[#175A67] bg-[#EAF3F1] px-2 py-0.5 rounded">
                              {t.ticketNumber || `#${t.id}`}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-500">
                              {t.subject}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {hasFacultyReply && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Reply Received
                              </span>
                            )}
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                t.status === 'Resolved'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : isResolutionPending(t.status)
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {t.status === 'Resolved'
                                ? 'Resolved'
                                : isResolutionPending(t.status)
                                ? 'Action Needed'
                                : 'In Review'}
                            </span>
                          </div>
                        </div>

                        <h4 className="font-bold text-sm text-[#0B1C30] mt-2 group-hover:text-[#175A67] transition-colors line-clamp-2">
                          {t.topic || t.title}
                        </h4>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2.5 pt-2 border-t border-slate-200/60">
                          <span className="flex items-center gap-1.5 font-medium">
                            <MessageSquare className="w-3.5 h-3.5 text-[#175A67]" />
                            {t.messages?.length || 1} message(s)
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {t.submittedAtRelative || t.createdAt}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Modal Bottom Close */}
            {!selectedTicketForChat && (
              <div className="pt-3 border-t border-slate-100 shrink-0">
                <button
                  onClick={() => setShowTicketsModal(false)}
                  className="w-full py-2.5 rounded-xl bg-[#0F3B42] hover:bg-[#0b2c31] text-white text-xs font-bold transition-all"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {/* 3. Image Fullscreen Lightbox Modal                           */}
      {/* ------------------------------------------------------------ */}
      {activeZoomImage && (
        <div
          className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setActiveZoomImage(null)}
        >
          <div
            className="max-w-4xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={activeZoomImage}
              alt="Zoomed diagram"
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
            />
            <button
              onClick={() => setActiveZoomImage(null)}
              className="mt-4 px-6 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md transition-all"
            >
              Close Fullscreen
            </button>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[70] bg-[#175A67] text-white text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-full shadow-2xl animate-fadeIn">
          {toast}
        </div>
      )}
    </div>
  );
}

export default BookDoubtSessionView;
