import { Router, type Request, type Response } from "express";
import { pool } from "../db/index.js";
import { logger } from "../lib/logger.js";
import { getIO } from "../socket.js";

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

export interface StudentInfo {
  email: string;
  phone: string;
  targetExam: string;
  doubtsSolved: number;
  attendance: string;
  accuracy: string;
  recentTestScore: string;
}

export interface PreviousChat {
  id: string;
  date: string;
  subject: string;
  title: string;
  resolvedBy: string;
  rating: number;
}

export interface AssignedTA {
  id: string;
  name: string;
  email: string;
}

export interface DoubtTicket {
  id: string;
  ticketNumber: string;
  title: string;
  subject: string;
  examTag: string;
  studentName: string;
  studentClass: string;
  studentAvatar: string;
  submittedAt: string;
  submittedAtRelative?: string;
  status: 'queue' | 'in_progress' | 'resolution_requested' | 'resolved';
  assignedTo?: AssignedTA | null;
  resolutionRequestedAt?: string;
  resolutionRequestedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  questionSnippet: string;
  questionFull: string;
  diagramUrl?: string;
  diagramUrls?: string[];
  messages: ChatMessage[];
  studentInfo: StudentInfo;
  previousChats: PreviousChat[];
}

export function getRelativeTime(isoDate: string): string {
  try {
    const diff = Date.now() - new Date(isoDate).getTime();
    if (isNaN(diff) || diff < 0) return 'Just now';
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  } catch {
    return 'Recently';
  }
}

// Initial sample tickets matching the screenshots for immediate, rich preview
const INITIAL_TICKETS: DoubtTicket[] = [
  {
    id: 't-101',
    ticketNumber: 'TKT-1082',
    title: 'Rotational Dynamics: Parallel Axis Theorem on Inclined Plane',
    subject: 'Physics',
    examTag: 'JEE Advanced',
    studentName: 'Aarav Sharma',
    studentClass: 'Class 12th',
    studentAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=128&q=80',
    submittedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    status: 'in_progress',
    assignedTo: { id: 'ta-1', name: 'Dr. Arjun Mehta', email: 'arjun.mehta@edurain.in' },
    questionSnippet: 'Unable to understand how to apply parallel axis theorem in this inclined plane situation.',
    questionFull: 'In the diagram attached, a uniform circular cylinder of mass M and radius R rolls without slipping down an inclined plane with angle theta. Please explain the torque balance about the contact axis vs the center of mass.',
    diagramUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1200&q=80',
    diagramUrls: ['https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1200&q=80'],
    messages: [
      { id: 'm-1', sender: 'student', senderName: 'Aarav Sharma', text: 'Hi sir, I tried finding torque about contact point P, but why does friction torque vanish?', time: '10:14 AM' },
      { id: 'm-2', sender: 'ta', senderName: 'Dr. Arjun Mehta', text: 'Because line of friction passes directly through point P, its lever arm is zero.', time: '10:17 AM' },
    ],
    studentInfo: {
      email: 'aarav.sharma@edurain.student',
      phone: '+91 98765 43210',
      targetExam: 'JEE Advanced 2026',
      doubtsSolved: 48,
      attendance: '96%',
      accuracy: '89%',
      recentTestScore: '214 / 300 (Rank 24)',
    },
    previousChats: [
      { id: 'pc-1', date: '19 Oct 2026', subject: 'Physics', title: 'Advanced numerical problem in Kinematics', resolvedBy: 'Dr. Arjun Mehta', rating: 5 },
    ],
  },
  {
    id: 't-102',
    ticketNumber: 'TKT-1085',
    title: 'Definite Integration with Periodic Functions & King Rule',
    subject: 'Mathematics',
    examTag: 'JEE Mains',
    studentName: 'Diya Patel',
    studentClass: 'Class 12th',
    studentAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=128&q=80',
    submittedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    status: 'queue',
    assignedTo: null, // Unassigned in Central Pool
    questionSnippet: 'Evaluating integral from 0 to 2pi of x*sin(x)/(1+cos^2(x)) dx using substitution.',
    questionFull: 'Evaluating integral from 0 to 2pi of x*sin(x)/(1+cos^2(x)) dx using substitution. Should I split at pi or directly apply f(a+b-x)?',
    diagramUrl: '',
    diagramUrls: [],
    messages: [
      { id: 'm-201', sender: 'student', senderName: 'Diya Patel', text: 'Does King rule cancel out the numerator x when applying f(2pi - x)?', time: '09:55 AM' },
    ],
    studentInfo: {
      email: 'diya.patel@edurain.student',
      phone: '+91 98765 12345',
      targetExam: 'JEE Mains 2026',
      doubtsSolved: 31,
      attendance: '91%',
      accuracy: '82%',
      recentTestScore: '176 / 300 (Rank 64)',
    },
    previousChats: [
      { id: 'pc-2', date: '15 Oct 2026', subject: 'Mathematics', title: 'Concept clarity doubt on Integration', resolvedBy: 'Priya Sharma', rating: 4 },
    ],
  },
  {
    id: 't-103',
    ticketNumber: 'TKT-1088',
    title: 'Coordination Chemistry: Crystal Field Splitting in d4 High Spin',
    subject: 'Chemistry',
    examTag: 'NEET 2026',
    studentName: 'Rohan Verma',
    studentClass: 'Class 11th',
    studentAvatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=128&q=80',
    submittedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    status: 'queue',
    assignedTo: null, // Unassigned in Central Pool
    questionSnippet: 'Calculating CFSE in octahedral d4 high spin complex with weak field ligand.',
    questionFull: 'In [Cr(H2O)6]2+ complex, Cr is +2 with 3d4 configuration. Weak ligand means high spin (t2g3 eg1). How do we calculate total CFSE in terms of delta_o?',
    diagramUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=80',
    diagramUrls: ['https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=80'],
    messages: [
      { id: 'm-301', sender: 'student', senderName: 'Rohan Verma', text: 'Is CFSE = (-0.4 * 3 + 0.6 * 1) * delta_o = -0.6 delta_o?', time: '09:35 AM' },
    ],
    studentInfo: {
      email: 'rohan.verma@edurain.student',
      phone: '+91 98112 33445',
      targetExam: 'NEET 2026',
      doubtsSolved: 56,
      attendance: '98%',
      accuracy: '91%',
      recentTestScore: '645 / 720 (Rank 12)',
    },
    previousChats: [
      { id: 'pc-3', date: '18 Oct 2026', subject: 'Chemistry', title: 'Periodic trends in Lanthanide contraction', resolvedBy: 'Dr. Arjun Mehta', rating: 5 },
    ],
  },
  {
    id: 't-104',
    ticketNumber: 'TKT-1070',
    title: 'Thermodynamics: Entropy change in adiabatic free expansion',
    subject: 'Physics',
    examTag: 'JEE Advanced',
    studentName: 'Ananya Deshmukh',
    studentClass: 'Class 12th',
    studentAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=128&q=80',
    submittedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    status: 'resolved',
    assignedTo: { id: 'ta-2', name: 'Prof. Alok Gupta', email: 'alok.gupta@edurain.in' },
    resolvedBy: 'Prof. Alok Gupta',
    resolvedAt: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
    questionSnippet: 'Why is entropy change non-zero for adiabatic free expansion if q = 0?',
    questionFull: 'In adiabatic free expansion, q = 0 and w = 0, so delta U = 0 and delta T = 0 for ideal gas. Then why delta S = nR ln(V2/V1) > 0?',
    diagramUrl: '',
    diagramUrls: [],
    messages: [
      { id: 'm-401', sender: 'student', senderName: 'Ananya Deshmukh', text: 'Why is entropy change non-zero for adiabatic free expansion if q = 0?', time: '04:12 PM' },
      { id: 'm-402', sender: 'ta', senderName: 'Prof. Alok Gupta', text: 'Because free expansion is strictly irreversible. Delta S is defined via reversible path: delta S = integral(dq_rev / T). For isothermal expansion between same states, delta S = nR ln(V2/V1).', time: '04:25 PM' },
      { id: 'm-403', sender: 'student', senderName: 'Ananya Deshmukh', text: 'Understood sir, thank you!', time: '04:30 PM' },
    ],
    studentInfo: {
      email: 'ananya.deshmukh@edurain.student',
      phone: '+91 98220 55667',
      targetExam: 'JEE Advanced 2026',
      doubtsSolved: 74,
      attendance: '99%',
      accuracy: '94%',
      recentTestScore: '248 / 300 (Rank 6)',
    },
    previousChats: [
      { id: 'pc-4', date: '21 Oct 2026', subject: 'Physics', title: 'Carnot cycle efficiency questions', resolvedBy: 'Prof. Alok Gupta', rating: 5 },
    ],
  },
];

// In-memory store (source of truth & Redis-ready cache)
export let ticketsStore: DoubtTicket[] = [...INITIAL_TICKETS];
let isTableInitialized = false;

export async function saveTicketToDb(ticket: DoubtTicket) {
  try {
    await pool.query(
      `INSERT INTO doubt_tickets (id, ticket_number, status, data, submitted_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (id) DO UPDATE SET
         ticket_number = EXCLUDED.ticket_number,
         status = EXCLUDED.status,
         data = EXCLUDED.data,
         updated_at = now()`,
      [ticket.id, ticket.ticketNumber, ticket.status, JSON.stringify(ticket), ticket.submittedAt || new Date().toISOString()]
    );
  } catch (err) {
    logger.warn({ err, ticketId: ticket.id }, 'Failed to persist ticket to DB');
  }
}

// Auto-create database table if Postgres is connected
async function initDbTable() {
  if (isTableInitialized) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS doubt_tickets (
        id VARCHAR(64) PRIMARY KEY,
        ticket_number VARCHAR(32) NOT NULL UNIQUE,
        status VARCHAR(32) NOT NULL,
        data JSONB NOT NULL,
        submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const res = await pool.query('SELECT data FROM doubt_tickets ORDER BY submitted_at DESC');
    if (res.rows.length > 0) {
      ticketsStore = res.rows.map((r) => r.data as DoubtTicket);
    } else {
      for (const t of INITIAL_TICKETS) {
        await pool.query(
          'INSERT INTO doubt_tickets (id, ticket_number, status, data, submitted_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
          [t.id, t.ticketNumber, t.status, JSON.stringify(t), t.submittedAt]
        );
      }
    }
    isTableInitialized = true;
  } catch (err) {
    logger.warn({ err }, 'Failed to initialize doubt_tickets table in DB, operating in memory');
  }
}

initDbTable().catch(() => {});

function getNextTicketNumber(): string {
  let maxNum = 1088;
  for (const t of ticketsStore) {
    const match = t.ticketNumber.match(/TKT-(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return `TKT-${maxNum + 1}`;
}

const router = Router();

// 1. GET /api/tickets — fetch all tickets
router.get('/', async (_req: Request, res: Response) => {
  await initDbTable().catch(() => {});
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;
  for (const t of ticketsStore) {
    if (t.status === 'resolution_requested' && t.resolutionRequestedAt) {
      const diff = now - new Date(t.resolutionRequestedAt).getTime();
      if (diff >= ONE_HOUR) {
        t.status = 'resolved';
        t.resolvedAt = new Date().toISOString();
        t.resolvedBy = t.resolutionRequestedBy || t.assignedTo?.name || 'Auto-Closed';
        saveTicketToDb(t);
      }
    }
  }

  const data = ticketsStore.map((t) => ({
    ...t,
    submittedAtRelative: getRelativeTime(t.submittedAt),
  }));
  res.json({ success: true, data });
});

// 2. GET /api/tickets/my — fetch student tickets
router.get('/my', async (req: Request, res: Response) => {
  await initDbTable().catch(() => {});
  const email = (
    req.user?.email ||
    (req.auth?.email as string | undefined) ||
    (req.query.email as string | undefined)
  )?.toLowerCase()?.trim();

  if (!email) {
    res.json({ success: true, data: [] });
    return;
  }

  const userTickets = ticketsStore
    .filter((t) => t.studentInfo?.email?.toLowerCase() === email)
    .map((t) => ({
      ...t,
      submittedAtRelative: getRelativeTime(t.submittedAt),
    }));

  res.json({ success: true, data: userTickets });
});

// 3. GET /api/tickets/analytics — Super Admin Performance tracking
router.get('/analytics', async (req: Request, res: Response) => {
  const role = req.user?.role || (req.auth?.role as string) || (req.auth?.admin ? 'admin' : 'student');
  if (role !== 'admin' && !req.auth?.admin) {
    res.status(403).json({ error: 'Only Super Admin can access analytics' });
    return;
  }
  await initDbTable().catch(() => {});

  const totalTickets = ticketsStore.length;
  const unassignedPoolCount = ticketsStore.filter((t) => !t.assignedTo && t.status !== 'resolved').length;
  const inProgressCount = ticketsStore.filter((t) => t.status === 'in_progress' || t.status === 'resolution_requested').length;
  const resolvedCount = ticketsStore.filter((t) => t.status === 'resolved').length;

  // Aggregate by TA
  const taMap = new Map<string, { name: string; email: string; claimedCount: number; resolvedCount: number }>();

  for (const t of ticketsStore) {
    if (t.assignedTo) {
      const key = t.assignedTo.email || t.assignedTo.name;
      if (!taMap.has(key)) {
        taMap.set(key, { name: t.assignedTo.name, email: t.assignedTo.email, claimedCount: 0, resolvedCount: 0 });
      }
      taMap.get(key)!.claimedCount += 1;
    }
    if (t.status === 'resolved' && (t.resolvedBy || t.assignedTo)) {
      const key = t.assignedTo?.email || t.resolvedBy || 'faculty';
      const name = t.assignedTo?.name || t.resolvedBy || 'Faculty';
      if (!taMap.has(key)) {
        taMap.set(key, { name, email: t.assignedTo?.email || key, claimedCount: 0, resolvedCount: 0 });
      }
      taMap.get(key)!.resolvedCount += 1;
    }
  }

  res.json({
    success: true,
    data: {
      totalTickets,
      unassignedPoolCount,
      inProgressCount,
      resolvedCount,
      taPerformance: Array.from(taMap.values()),
    },
  });
});

// 4. GET /api/tickets/:id — fetch single ticket
router.get('/:id', async (req: Request, res: Response) => {
  await initDbTable().catch(() => {});
  const { id } = req.params;
  const ticket = ticketsStore.find((t) => t.id === id || t.ticketNumber === id);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }
  res.json({
    success: true,
    data: {
      ...ticket,
      submittedAtRelative: getRelativeTime(ticket.submittedAt),
    },
  });
});

// 5. POST /api/tickets — Student raises a new doubt ticket into Central Pool
router.post('/', async (req: Request, res: Response) => {
  await initDbTable().catch(() => {});
  try {
    const {
      title,
      subject,
      description,
      question,
      examTag,
      studentClass,
      studentName,
      studentEmail,
      studentPhone,
      studentAvatar,
      attachments,
      diagramUrl,
    } = req.body;

    const content = (description || question || '').trim();

    if (!title || !subject || !content) {
      res.status(400).json({ error: 'Title, subject and description/question are required' });
      return;
    }

    const ticketNumber = getNextTicketNumber();
    const id = `t-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const allAttachments: string[] = Array.isArray(attachments)
      ? attachments.filter((u: any) => typeof u === 'string' && u.length > 0)
      : diagramUrl
      ? [diagramUrl]
      : [];

    // Strictly max 1 photo during initial ticket creation
    const initialAttachments = allAttachments.slice(0, 1);

    const newTicket: DoubtTicket = {
      id,
      ticketNumber,
      title: title.trim(),
      subject: subject.trim(),
      examTag: examTag?.trim() || 'JEE Mains',
      studentName: studentName?.trim() || 'Student',
      studentClass: studentClass?.trim() || 'Class 12th',
      studentAvatar:
        studentAvatar?.trim() ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=128&q=80',
      submittedAt: nowIso,
      submittedAtRelative: 'Just now',
      status: 'queue',
      assignedTo: null, // Initial doubt enters unassigned central pool
      questionSnippet: content.length > 120 ? content.slice(0, 117) + '...' : content,
      questionFull: content,
      diagramUrl: initialAttachments[0] || undefined,
      diagramUrls: initialAttachments,
      messages: [
        {
          id: `m-${Date.now()}-1`,
          sender: 'student',
          senderName: studentName?.trim() || 'Student',
          text: content,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          attachmentUrl: initialAttachments[0] || undefined,
          attachmentUrls: initialAttachments,
        },
      ],
      studentInfo: {
        email: studentEmail?.trim() || 'student@edurain.in',
        phone: studentPhone?.trim() || '+91 98765 00000',
        targetExam: examTag?.trim() || 'JEE Mains',
        doubtsSolved: 12,
        attendance: '95%',
        accuracy: '88%',
        recentTestScore: '185 / 300',
      },
      previousChats: [],
    };

    ticketsStore.unshift(newTicket);

    pool.query(
      'INSERT INTO doubt_tickets (id, ticket_number, status, data, submitted_at) VALUES ($1, $2, $3, $4, $5)',
      [newTicket.id, newTicket.ticketNumber, newTicket.status, JSON.stringify(newTicket), newTicket.submittedAt]
    ).catch((err) => logger.warn({ err }, 'Failed to persist ticket to Postgres'));

    // Emit live to CMS TA Pool and all connected clients
    const io = getIO();
    io?.emit('ticket_created', {
      ticket: { ...newTicket, submittedAtRelative: 'Just now' },
    });
    io?.emit('ticket_updated', {
      ticket: { ...newTicket, submittedAtRelative: 'Just now' },
    });

    res.status(201).json({ success: true, data: newTicket });
  } catch (err: any) {
    logger.error({ err }, 'Error raising doubt ticket');
    res.status(500).json({ error: err?.message || 'Failed to raise doubt ticket' });
  }
});

// 6. POST /api/tickets/:id/claim — TA claims/picks a ticket from Central Pool
router.post('/:id/claim', async (req: Request, res: Response) => {
  const role = req.user?.role || (req.auth?.role as string) || (req.auth?.admin ? 'admin' : (req.auth?.faculty ? 'faculty' : 'student'));
  if (role !== 'teacher_assistant' && role !== 'faculty' && role !== 'admin') {
    res.status(403).json({ error: 'Only teacher assistants, faculty, or admins can claim a ticket' });
    return;
  }
  await initDbTable().catch(() => {});
  const { id } = req.params;
  const { taId, taName, taEmail } = req.body;

  const ticket = ticketsStore.find((t) => t.id === id || t.ticketNumber === id);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  const effectiveEmail = (
    req.user?.email ||
    (req.auth?.email as string | undefined) ||
    taEmail ||
    ''
  ).trim().toLowerCase();
  const effectiveName = req.user?.name || (req.auth?.name as string | undefined) || taName || 'Teacher Assistant';
  const effectiveId = req.user?.id ? String(req.user.id) : (taId || effectiveEmail || 'ta-curr');

  if (ticket.status === 'resolved') {
    res.status(409).json({ error: 'Ticket is already resolved and cannot be claimed.' });
    return;
  }
  if (ticket.assignedTo && ticket.assignedTo.email && ticket.assignedTo.email.toLowerCase() !== effectiveEmail) {
    res.status(409).json({ error: `Ticket is already claimed by ${ticket.assignedTo.name || ticket.assignedTo.email}` });
    return;
  }

  ticket.assignedTo = {
    id: effectiveId,
    name: effectiveName,
    email: effectiveEmail || 'ta@edurain.in',
  };
  if (ticket.status === 'queue') {
    ticket.status = 'in_progress';
  }

  saveTicketToDb(ticket);

  const io = getIO();
  const statusPayload = {
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    status: ticket.status,
    assignedTo: ticket.assignedTo,
    ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
  };
  io?.emit('ticket_status_updated', statusPayload);
  io?.emit('ticket_updated', {
    ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
  });

  res.json({ success: true, data: ticket });
});

// 7. POST /api/tickets/:id/release — TA releases ticket back to Central Pool
router.post('/:id/release', async (req: Request, res: Response) => {
  const role = req.user?.role || (req.auth?.role as string) || (req.auth?.admin ? 'admin' : (req.auth?.faculty ? 'faculty' : 'student'));
  if (role !== 'teacher_assistant' && role !== 'faculty' && role !== 'admin') {
    res.status(403).json({ error: 'Only teacher assistants, faculty, or admins can release a ticket' });
    return;
  }
  await initDbTable().catch(() => {});
  const { id } = req.params;

  const ticket = ticketsStore.find((t) => t.id === id || t.ticketNumber === id);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  ticket.assignedTo = null;
  ticket.status = 'queue';

  saveTicketToDb(ticket);

  const io = getIO();
  const statusPayload = {
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    status: 'queue',
    assignedTo: null,
    ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
  };
  io?.emit('ticket_status_updated', statusPayload);
  io?.emit('ticket_updated', {
    ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
  });

  res.json({ success: true, data: ticket });
});

// 8. POST /api/tickets/:id/request-resolution — Teacher requests resolution
router.post('/:id/request-resolution', async (req: Request, res: Response) => {
  const role = req.user?.role || (req.auth?.role as string) || (req.auth?.admin ? 'admin' : (req.auth?.faculty ? 'faculty' : 'student'));
  if (role !== 'teacher_assistant' && role !== 'faculty' && role !== 'admin') {
    res.status(403).json({ error: 'Only teacher assistants, faculty, or admins can request resolution' });
    return;
  }
  await initDbTable().catch(() => {});
  const { id } = req.params;
  const { resolvedBy } = req.body;

  const ticket = ticketsStore.find((t) => t.id === id || t.ticketNumber === id);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  ticket.status = 'resolution_requested';
  ticket.resolutionRequestedAt = new Date().toISOString();
  ticket.resolutionRequestedBy = req.user?.name || (req.auth?.name as string | undefined) || resolvedBy || ticket.assignedTo?.name || 'Teacher Assistant';

  saveTicketToDb(ticket);

  const io = getIO();
  const resPayload = {
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    resolutionRequestedAt: ticket.resolutionRequestedAt,
    resolvedBy: ticket.resolutionRequestedBy,
    ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
  };

  io?.to(`ticket_${ticket.id}`).to(`ticket_${ticket.ticketNumber}`).emit('resolution_requested', resPayload);
  io?.emit('resolution_requested', resPayload);
  io?.emit('ticket_updated', {
    ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
  });

  res.json({ success: true, data: ticket });
});

// 9. POST /api/tickets/:id/action — Student action: 'solved' or 'followup'
router.post('/:id/action', async (req: Request, res: Response) => {
  await initDbTable().catch(() => {});
  const { id } = req.params;
  const { action, message, messageId, attachments } = req.body;

  const ticket = ticketsStore.find((t) => t.id === id || t.ticketNumber === id);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  const io = getIO();

  if (action === 'solved') {
    ticket.status = 'resolved';
    ticket.resolvedAt = new Date().toISOString();
    ticket.resolvedBy = ticket.resolutionRequestedBy || ticket.assignedTo?.name || 'Teacher Assistant';

    saveTicketToDb(ticket);

    const statusPayload = {
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      status: 'resolved',
      ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
    };
    io?.to(`ticket_${ticket.id}`).to(`ticket_${ticket.ticketNumber}`).emit('ticket_status_updated', statusPayload);
    io?.emit('ticket_status_updated', statusPayload);

    io?.to(`ticket_${ticket.id}`).to(`ticket_${ticket.ticketNumber}`).emit('ticket_closed', {
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
    });
    io?.emit('ticket_closed', {
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
    });
  } else if (action === 'followup') {
    ticket.status = 'in_progress';
    ticket.resolutionRequestedAt = undefined;

    // Idempotency: skip adding if messageId already exists
    if (messageId && ticket.messages.some((m) => m.id === messageId)) {
      saveTicketToDb(ticket);
      res.json({ success: true, data: ticket });
      return;
    }

    if (message || (attachments && attachments.length > 0)) {
      const followupMsg: ChatMessage = {
        id: messageId || `m-st-${Date.now()}`,
        sender: 'student',
        senderName: req.user?.name || (req.auth?.name as string | undefined) || ticket.studentName,
        text: message || '',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        attachmentUrls: Array.isArray(attachments) ? attachments : [],
        attachmentUrl: Array.isArray(attachments) && attachments.length > 0 ? attachments[0] : undefined,
      };
      ticket.messages.push(followupMsg);

      const msgPayload = {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        message: followupMsg,
        ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
      };
      io?.to(`ticket_${ticket.id}`).to(`ticket_${ticket.ticketNumber}`).emit('new_message', msgPayload);
      io?.emit('new_message', msgPayload);
    }

    saveTicketToDb(ticket);

    const statusPayload = {
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      status: 'in_progress',
      ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
    };
    io?.to(`ticket_${ticket.id}`).to(`ticket_${ticket.ticketNumber}`).emit('ticket_status_updated', statusPayload);
    io?.emit('ticket_status_updated', statusPayload);
  }

  io?.emit('ticket_updated', {
    ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
  });

  res.json({ success: true, data: ticket });
});

// 10. POST /api/tickets/:id/reply — Sends message in conversation thread
router.post('/:id/reply', async (req: Request, res: Response) => {
  await initDbTable().catch(() => {});
  const { id } = req.params;
  const { text, senderName, sender = 'ta', attachments, attachmentUrl, id: clientMsgId } = req.body;

  if (!text && (!attachments || attachments.length === 0) && !attachmentUrl) {
    res.status(400).json({ error: 'Message text or attachment is required' });
    return;
  }

  const ticket = ticketsStore.find((t) => t.id === id || t.ticketNumber === id);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  // Idempotency: if clientMsgId already saved by socket handler, return without error
  if (clientMsgId && ticket.messages.some((m) => m.id === clientMsgId)) {
    res.json({ success: true, data: ticket });
    return;
  }

  // Turn-based messaging validation: student cannot send twice consecutively
  if (sender === 'student') {
    const lastMsg = ticket.messages[ticket.messages.length - 1];
    if (lastMsg && lastMsg.sender === 'student') {
      res.status(400).json({ error: 'Wait for reply from Teacher Assistant before sending another message.' });
      return;
    }
  }

  const allAttachments: string[] = Array.isArray(attachments)
    ? attachments.filter((u: any) => typeof u === 'string')
    : attachmentUrl
    ? [attachmentUrl]
    : [];

  const replyMsg: ChatMessage = {
    id: clientMsgId || `m-${sender}-${Date.now()}`,
    sender: sender === 'student' ? 'student' : 'ta',
    senderName: senderName || (sender === 'student' ? ticket.studentName : 'Teacher Assistant'),
    text: text || '',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    attachmentUrl: allAttachments[0] || undefined,
    attachmentUrls: allAttachments,
  };

  ticket.messages.push(replyMsg);
  if (sender === 'ta' && ticket.status === 'queue') {
    ticket.status = 'in_progress';
  }

  saveTicketToDb(ticket);

  const io = getIO();
  const msgPayload = {
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    message: replyMsg,
    ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
  };

  io?.to(`ticket_${ticket.id}`).to(`ticket_${ticket.ticketNumber}`).emit('new_message', msgPayload);
  io?.emit('new_message', msgPayload);
  io?.emit('ticket_updated', {
    ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
  });

  res.json({ success: true, data: ticket });
});

// 11. POST /api/tickets/:id/resolve — fallback direct resolve
router.post('/:id/resolve', async (req: Request, res: Response) => {
  await initDbTable().catch(() => {});
  const { id } = req.params;
  const { resolvedBy } = req.body || {};

  const ticket = ticketsStore.find((t) => t.id === id || t.ticketNumber === id);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  ticket.status = 'resolved';
  ticket.resolvedAt = new Date().toISOString();
  ticket.resolvedBy = resolvedBy || ticket.assignedTo?.name || 'Teacher Assistant';

  saveTicketToDb(ticket);

  const io = getIO();
  const statusPayload = {
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    status: 'resolved',
    ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
  };
  io?.to(`ticket_${ticket.id}`).to(`ticket_${ticket.ticketNumber}`).emit('ticket_status_updated', statusPayload);
  io?.emit('ticket_status_updated', statusPayload);

  io?.to(`ticket_${ticket.id}`).to(`ticket_${ticket.ticketNumber}`).emit('ticket_closed', {
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
  });
  io?.emit('ticket_closed', {
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
  });

  io?.emit('ticket_updated', {
    ticket: { ...ticket, submittedAtRelative: getRelativeTime(ticket.submittedAt) },
  });

  res.json({ success: true, data: ticket });
});

export default router;
