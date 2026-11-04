import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { pool } from "../db/index.js";
import { logger } from "../lib/logger.js";
import { getIO } from "../socket.js";
import { externalize, inflate, hasBlobs, stripBlobs, type BlobStore } from "../lib/ticketBlobs.js";
import { isDbUnavailable } from "../lib/dbErrors.js";
import { signalTicketChange } from "../lib/ticketSignals.js";
import { requireEnrolled } from "../lib/enrollment.js";

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
let lastDbSyncTime = 0;
const DB_SYNC_COOLDOWN_MS = 15000;

// Newest tickets kept in memory. An older ticket is read from the database, one row, when somebody opens it.
const TICKETS_MEMORY_LIMIT = Number(process.env.TICKETS_MEMORY_LIMIT) || 300;

// How a ticket's student is matched in SQL (the indexes in initDbTable use these exact expressions)
const EMAIL_SQL = `lower(data->'studentInfo'->>'email')`;
const PHONE10_SQL = `right(regexp_replace(coalesce(data->'studentInfo'->>'phone', ''), '[^0-9]', '', 'g'), 10)`;

// Big attachments live in ticket_blobs (lib/ticketBlobs.ts); the ticket JSON only keeps a short marker.
export const blobStore: BlobStore = {
  put: async (id, content) => {
    await pool.query('INSERT INTO ticket_blobs (id, content) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [id, content]);
  },
  get: async (ids) => {
    const { rows } = await pool.query('SELECT id, content FROM ticket_blobs WHERE id = ANY($1)', [ids]);
    return new Map<string, string>(rows.map((r): [string, string] => [r.id, r.content]));
  },
};

export async function syncTicketsFromDb(force: boolean = false): Promise<DoubtTicket[]> {
  const now = Date.now();
  if (!force && now - lastDbSyncTime < DB_SYNC_COOLDOWN_MS) {
    return ticketsStore;
  }
  lastDbSyncTime = now;
  try {
    const res = await pool.query('SELECT data FROM doubt_tickets ORDER BY submitted_at DESC LIMIT $1', [TICKETS_MEMORY_LIMIT]);
    if (res.rows.length > 0) {
      const seen = new Set<string>();
      const list: DoubtTicket[] = [];
      for (const r of res.rows) {
        const d = r.data as DoubtTicket;
        if (d && d.id && !seen.has(d.id)) {
          seen.add(d.id);
          list.push(d);
        }
      }
      ticketsStore = list;
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to sync tickets from DB');
  }
  return ticketsStore;
}

/** The ticket as saved (attachments are markers), read from the database row. */
export async function findTicketLight(idOrNumber: string): Promise<DoubtTicket | null> {
  if (!idOrNumber) return null;
  const clean = String(idOrNumber).trim();
  const lower = clean.toLowerCase();
  const stripped = lower.replace(/^#/, '').replace(/^tkt-?/i, '');

  // Always the row, never the memory copy: on Lambda every container has its own memory, so its copy can miss
  // messages another container saved (the app polled that copy and never saw the teacher's reply), and a reply
  // saved on top of it erased them. Both columns are indexed (primary key, unique), so this is one cheap lookup.
  try {
    const { rows } = await pool.query('SELECT data FROM doubt_tickets WHERE id = $1 OR ticket_number = $2 LIMIT 1', [
      clean,
      `TKT-${stripped.toUpperCase()}`,
    ]);
    if (rows[0]) return rows[0].data as DoubtTicket;
  } catch (err) {
    if (isDbUnavailable(err)) throw err; // answered as 503, not as "ticket not found"
    logger.warn({ err }, 'Ticket lookup failed');
  }
  // Demo tickets that only exist in memory (no database configured)
  return (
    ticketsStore.find(
      (t) => t.id === clean || t.id.toLowerCase() === lower || t.ticketNumber.toLowerCase().replace(/^tkt-?/i, '') === stripped,
    ) ?? null
  );
}

/** The ticket with its attachments back in place: what a reply, claim or detail view needs. */
export async function findTicket(idOrNumber: string): Promise<DoubtTicket | null> {
  const ticket = await findTicketLight(idOrNumber);
  return ticket && hasBlobs(ticket) ? inflate(ticket, blobStore) : ticket;
}

/** Saves a ticket (attachments go to ticket_blobs, memory keeps the light copy). Throws if the database write fails. */
export async function persistTicket(full: DoubtTicket) {
  const ticket = await externalize(full, blobStore);
  const idx = ticketsStore.findIndex((t) => t.id === ticket.id || t.ticketNumber === ticket.ticketNumber);
  if (idx !== -1) {
    ticketsStore[idx] = ticket;
  } else {
    ticketsStore.unshift(ticket);
  }
  const { rows } = await pool.query(
      `INSERT INTO doubt_tickets (id, ticket_number, status, data, submitted_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (id) DO UPDATE SET
         ticket_number = EXCLUDED.ticket_number,
         status = EXCLUDED.status,
         -- Messages are only ever added. Keep every message already saved (a student and a teacher replying at the
         -- same moment, on two servers, each saved a copy without the other's message) and add this copy's new
         -- ones after them, so both replies stay. The order of saved messages never changes.
         data = EXCLUDED.data || jsonb_build_object('messages',
           coalesce(doubt_tickets.data->'messages', '[]'::jsonb) || coalesce((
             SELECT jsonb_agg(m ORDER BY i)
               FROM jsonb_array_elements(coalesce(EXCLUDED.data->'messages', '[]'::jsonb)) WITH ORDINALITY AS n(m, i)
              WHERE m ? 'id'
                AND NOT coalesce(doubt_tickets.data->'messages', '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('id', m->'id'))
           ), '[]'::jsonb)),
         updated_at = now()
       RETURNING status, CASE WHEN jsonb_typeof(data->'messages') = 'array' THEN jsonb_array_length(data->'messages') ELSE 0 END AS n`,
      [ticket.id, ticket.ticketNumber, ticket.status, JSON.stringify(ticket), ticket.submittedAt || new Date().toISOString()]
    );
  // Every save goes through here (HTTP routes, socket handlers, auto-close), so one call keeps every chat live
  await signalTicketChange(ticket.id, Number(rows[0]?.n ?? 0), String(rows[0]?.status ?? ticket.status));
}

export async function saveTicketToDb(ticket: DoubtTicket) {
  try {
    await persistTicket(ticket);
  } catch (err) {
    logger.warn({ err, ticketId: ticket.id }, 'Failed to persist ticket to DB');
  }
}

// Auto-create database table if Postgres is connected
// Requests that arrive together on a fresh server share one setup run instead of each repeating it
let initInFlight: Promise<void> | null = null;
function initDbTable(): Promise<void> {
  if (isTableInitialized) return Promise.resolve();
  return (initInFlight ??= initDbTableOnce().finally(() => {
    initInFlight = null;
  }));
}

async function initDbTableOnce() {
  if (isTableInitialized) return;
  try {
    // Set up already (every start after the first): one catalog read instead of DDL on every cold start
    const {
      rows: [have],
    } = await pool.query(
      "SELECT to_regclass('doubt_tickets') IS NOT NULL AS t, to_regclass('ticket_blobs') IS NOT NULL AS b, to_regclass('doubt_tickets_phone_idx') IS NOT NULL AS i",
    );
    if (!(have.t && have.b && have.i)) {
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
    await pool.query(`CREATE TABLE IF NOT EXISTS ticket_blobs (id TEXT PRIMARY KEY, content TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await pool.query(`CREATE INDEX IF NOT EXISTS doubt_tickets_email_idx ON doubt_tickets ((${EMAIL_SQL}))`);
    await pool.query(`CREATE INDEX IF NOT EXISTS doubt_tickets_phone_idx ON doubt_tickets ((${PHONE10_SQL}))`);
    await pool.query(`CREATE INDEX IF NOT EXISTS doubt_tickets_submitted_idx ON doubt_tickets (submitted_at DESC)`);
    }

    const res = await pool.query('SELECT 1 FROM doubt_tickets LIMIT 1');
    if (res.rows.length > 0) {
      lastDbSyncTime = 0;
      await syncTicketsFromDb(true); // newest TICKETS_MEMORY_LIMIT only
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
    setTimeout(() => {
      if (!isTableInitialized) {
        initDbTable().catch(() => {});
      }
    }, 5000);
  }
}

// A long-lived server warms its list at start. A Lambda container must not: every cold start of every route would pay for it.
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) initDbTable().catch(() => {});

async function getNextTicketNumber(): Promise<string> {
  let maxNum = 1088;
  try {
    const res = await pool.query(
      "SELECT MAX(CAST(SUBSTRING(ticket_number FROM 5) AS INTEGER)) as max_num FROM doubt_tickets WHERE ticket_number ~ '^TKT-[0-9]+$'"
    );
    if (res.rows.length > 0 && res.rows[0].max_num) {
      maxNum = Math.max(maxNum, parseInt(res.rows[0].max_num, 10));
    }
  } catch {}
  for (const t of ticketsStore) {
    const match = t.ticketNumber.match(/TKT-(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return `TKT-${maxNum + 1}`;
}

function sanitizeTicketForList(t: DoubtTicket): any {
  t = stripBlobs(t);
  const small = (u?: string) => !!u && u !== '[attachment]' && u.length <= 50000;
  return {
    ...t,
    diagramUrl: small(t.diagramUrl) ? t.diagramUrl : undefined,
    diagramUrls: (t.diagramUrls || []).filter(small),
    submittedAtRelative: getRelativeTime(t.submittedAt),
    messages: (t.messages || []).map((m) => ({
      id: m.id,
      sender: m.sender,
      senderName: m.senderName,
      text: m.text,
      time: m.time,
      avatar: m.avatar,
      // Truncate heavy attachments only in list views to prevent 25MB response payloads
      attachmentUrl: m.attachmentUrl && m.attachmentUrl.length > 50000 ? '[attachment]' : m.attachmentUrl,
      attachmentUrls: (m.attachmentUrls || []).map((u) => (u && u.length > 50000 ? '[attachment]' : u)),
    })),
  };
}

/** Time shown next to a message. Lambda runs on UTC; students and teachers read Indian time. */
export const chatTime = () =>
  new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: process.env.APP_TIME_ZONE || 'Asia/Kolkata' });

// Student photos: 1 when raising a doubt, STUDENT_CHAT_PHOTOS more in the chat, each an image under 1 MB.
// The app and the website compress to fit and count before sending; this is the check no client can skip.
const STUDENT_CHAT_PHOTOS = 2;
const MAX_PHOTO_BYTES = 1024 * 1024;
const IMAGE_DATA_URL = /^data:image\/(jpeg|jpg|png|webp);base64,/i;

/** Photos the student has already sent in the chat (the first message is the doubt itself). */
export const chatPhotosLeft = (t: DoubtTicket) =>
  STUDENT_CHAT_PHOTOS -
  (t.messages || []).slice(1).filter((m) => m.sender === 'student').reduce((n, m) => n + (m.attachmentUrls?.length || (m.attachmentUrl ? 1 : 0)), 0);

/** Why these student photos can't be accepted, or null when they can. */
export function studentPhotoProblem(attachments: string[], allowed: number): string | null {
  if (attachments.length > Math.max(0, allowed)) {
    return `You can send up to ${STUDENT_CHAT_PHOTOS} photos in a doubt chat${allowed > 0 ? ` (${allowed} left)` : ''}.`;
  }
  for (const a of attachments) {
    if (!IMAGE_DATA_URL.test(a)) return 'Photos must be JPEG, PNG or WebP images.';
    const b64 = a.slice(a.indexOf(',') + 1);
    const bytes = Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
    if (bytes > MAX_PHOTO_BYTES) return 'Each photo must be under 1 MB.';
  }
  return null;
}

// Who is calling comes from the verified token and the user row only, never from anything in the request body.
const STAFF = new Set(['admin', 'faculty', 'teacher_assistant']);
const callerRole = (req: Request): string =>
  req.user?.role || (req.auth?.role as string) || (req.auth?.admin ? 'admin' : req.auth?.faculty ? 'faculty' : 'student');
const phone10 = (p: unknown) => String(p ?? '').replace(/\D/g, '').slice(-10);
const callerIdentity = (req: Request) => ({
  email: String(req.user?.email || req.auth?.email || '').toLowerCase().trim(),
  // Only the OTP-verified login number from the token (a profile phone could be typed in by anyone)
  phone: phone10((req.auth as any)?.phone_number),
});
function isOwner(req: Request, t: DoubtTicket): boolean {
  const me = callerIdentity(req);
  const email = t.studentInfo?.email?.toLowerCase().trim();
  return (!!me.email && email === me.email) || (me.phone.length === 10 && phone10(t.studentInfo?.phone) === me.phone);
}

const router = Router();

// Every route with :id: staff, or the student who raised that ticket. Anyone else gets 403.
router.param('id', async (req, res, next, id) => {
  try {
    if (STAFF.has(callerRole(req))) return next();
    const ticket = await findTicketLight(String(id));
    if (ticket && !isOwner(req, ticket)) {
      res.status(403).json({ error: 'This is not your ticket' });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
});

// 1. GET /api/tickets — fetch all tickets
router.get('/', async (req: Request, res: Response) => {
  // The whole desk list: staff only (students use /my)
  if (!STAFF.has(callerRole(req))) {
    res.status(403).json({ error: 'Only staff can list all tickets' });
    return;
  }
  await initDbTable().catch(() => {});
  await syncTicketsFromDb(false);
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;
  for (const t of ticketsStore) {
    if (t.status === 'resolution_requested' && t.resolutionRequestedAt) {
      const diff = now - new Date(t.resolutionRequestedAt).getTime();
      if (diff >= ONE_HOUR) {
        t.status = 'resolved';
        t.resolvedAt = new Date().toISOString();
        t.resolvedBy = t.resolutionRequestedBy || t.assignedTo?.name || 'Auto-Closed';
        await saveTicketToDb(t);
      }
    }
  }

  const data = ticketsStore.map(sanitizeTicketForList);
  res.json({ success: true, data });
});

// 2. GET /api/tickets/my — fetch student tickets
router.get('/my', async (req: Request, res: Response) => {
  await initDbTable().catch(() => {});
  // Only the caller's own tickets, matched on the verified account's email or mobile number (last 10 digits).
  // Nothing from the query string or a "no email, show everything" fallback: that leaked other students' tickets.
  const me = callerIdentity(req);
  const params: string[] = [];
  const where: string[] = [];
  if (me.email) {
    params.push(me.email);
    where.push(`${EMAIL_SQL} = $${params.length}`);
  }
  if (me.phone.length === 10) {
    params.push(me.phone);
    where.push(`${PHONE10_SQL} = $${params.length}`);
  }
  if (!where.length) {
    res.json({ success: true, data: [] });
    return;
  }
  const { rows } = await pool.query(`SELECT data FROM doubt_tickets WHERE ${where.join(' OR ')} ORDER BY submitted_at DESC LIMIT 200`, params);
  const tickets = rows.map((r) => r.data as DoubtTicket);
  const photos = await inflate(tickets.map((t) => ({ one: t.diagramUrl, many: t.diagramUrls })), blobStore);
  res.json({ success: true, data: tickets.map((t, i) => ({ ...sanitizeTicketForList(t), diagramUrl: photos[i].one, diagramUrls: photos[i].many })) });
});

// 3. GET /api/tickets/analytics — Super Admin Performance tracking
router.get('/analytics', async (req: Request, res: Response) => {
  await initDbTable().catch(() => {});
  await syncTicketsFromDb().catch(() => {});
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
  const id = String(req.params.id);

  // ?after=N — chat polling: the status and only the messages after the first N. Without it every poll
  // downloaded every photo in the chat again. Saved messages never move (see persistTicket), so N is stable.
  const after = Number(req.query.after);
  if (req.query.after !== undefined && Number.isInteger(after) && after >= 0) {
    const light = await findTicketLight(id);
    if (!light) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }
    const all = light.messages || [];
    const fresh = all.slice(after);
    res.json({
      success: true,
      data: {
        id: light.id,
        ticketNumber: light.ticketNumber,
        status: light.status,
        assignedTo: light.assignedTo,
        resolutionRequestedAt: light.resolutionRequestedAt,
        messageCount: all.length,
        messages: hasBlobs(fresh) ? await inflate(fresh, blobStore) : fresh,
      },
    });
    return;
  }

  const ticket = await findTicket(id);
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
router.post('/', requireEnrolled('Doubt solving'), async (req: Request, res: Response) => {
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

    const ticketNumber = await getNextTicketNumber();
    // Random part: two doubts raised in the same millisecond had the same id, and the second overwrote the first
    const id = `t-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const nowIso = new Date().toISOString();

    const allAttachments: string[] = Array.isArray(attachments)
      ? attachments.filter((u: any) => typeof u === 'string' && u.length > 0)
      : diagramUrl
      ? [diagramUrl]
      : [];

    // Strictly max 1 photo during initial ticket creation
    const initialAttachments = allAttachments.slice(0, 1);
    const photoProblem = STAFF.has(callerRole(req)) ? null : studentPhotoProblem(initialAttachments, 1);
    if (photoProblem) {
      res.status(400).json({ error: photoProblem });
      return;
    }

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
          time: chatTime(),
          attachmentUrl: initialAttachments[0] || undefined,
          attachmentUrls: initialAttachments,
        },
      ],
      studentInfo: {
        email: req.user?.email || studentEmail?.trim() || 'student@edurain.in',
        phone: req.user?.phone || studentPhone?.trim() || '+91 98765 00000',
        targetExam: examTag?.trim() || 'JEE Mains',
        doubtsSolved: 12,
        attendance: '95%',
        accuracy: '88%',
        recentTestScore: '185 / 300',
      },
      previousChats: [],
    };

    // awaited: nothing runs after the response on Lambda, and a lost ticket must be an error
    for (let attempt = 1; ; attempt++) {
      try {
        await persistTicket(newTicket);
        break;
      } catch (err: any) {
        // Two doubts raised at the same moment were given the same next number (unique): take the next free one
        if (err?.code !== '23505' || attempt >= 5) throw err;
        newTicket.ticketNumber = await getNextTicketNumber();
      }
    }
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
  const role = callerRole(req);
  if (role !== 'teacher_assistant' && role !== 'faculty' && role !== 'admin') {
    res.status(403).json({ error: 'Only teacher assistants, faculty, or admins can claim a ticket' });
    return;
  }
  await initDbTable().catch(() => {});
  const id = String(req.params.id);
  const { taId, taName, taEmail } = req.body;

  const ticket = await findTicket(id);
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

  await saveTicketToDb(ticket);

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
  const role = callerRole(req);
  if (role !== 'teacher_assistant' && role !== 'faculty' && role !== 'admin') {
    res.status(403).json({ error: 'Only teacher assistants, faculty, or admins can release a ticket' });
    return;
  }
  await initDbTable().catch(() => {});
  const id = String(req.params.id);

  const ticket = await findTicket(id);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  ticket.assignedTo = null;
  ticket.status = 'queue';

  await saveTicketToDb(ticket);

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
  const role = callerRole(req);
  if (role !== 'teacher_assistant' && role !== 'faculty' && role !== 'admin') {
    res.status(403).json({ error: 'Only teacher assistants, faculty, or admins can request resolution' });
    return;
  }
  await initDbTable().catch(() => {});
  const id = String(req.params.id);
  const { resolvedBy } = req.body;

  const ticket = await findTicket(id);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  ticket.status = 'resolution_requested';
  ticket.resolutionRequestedAt = new Date().toISOString();
  ticket.resolutionRequestedBy = req.user?.name || (req.auth?.name as string | undefined) || resolvedBy || ticket.assignedTo?.name || 'Teacher Assistant';

  await saveTicketToDb(ticket);

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

// 9. POST /api/tickets/:id/action & /api/tickets/:id/resolution-action — Student action: 'solved' or 'followup'
const handleTicketAction = async (req: Request, res: Response) => {
  await initDbTable().catch(() => {});
  const id = String(req.params.id);
  const { action, message, messageId, attachments } = req.body;

  const ticket = await findTicket(id);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  // A follow-up is the student's message: same photo limits as a reply (a repeat of a saved one is let through)
  const followupPhotos = Array.isArray(attachments) ? attachments.filter((u: unknown) => typeof u === 'string') : [];
  const followupProblem =
    action === 'followup' && !STAFF.has(callerRole(req)) && !(messageId && ticket.messages.some((m) => m.id === messageId))
      ? studentPhotoProblem(followupPhotos, chatPhotosLeft(ticket))
      : null;
  if (followupProblem) {
    res.status(400).json({ error: followupProblem });
    return;
  }

  const io = getIO();

  if (action === 'solved') {
    ticket.status = 'resolved';
    ticket.resolvedAt = new Date().toISOString();
    ticket.resolvedBy = ticket.resolutionRequestedBy || ticket.assignedTo?.name || 'Teacher Assistant';

    await saveTicketToDb(ticket);

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
      await saveTicketToDb(ticket);
      res.json({ success: true, data: ticket });
      return;
    }

    if (message || (attachments && attachments.length > 0)) {
      const followupMsg: ChatMessage = {
        id: messageId || `m-st-${Date.now()}`,
        sender: 'student',
        senderName: req.user?.name || (req.auth?.name as string | undefined) || ticket.studentName,
        text: message || '',
        time: chatTime(),
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

    await saveTicketToDb(ticket);

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
};

router.post('/:id/action', handleTicketAction);
router.post('/:id/resolution-action', handleTicketAction);

// 10. POST /api/tickets/:id/reply — Sends message in conversation thread
router.post('/:id/reply', async (req: Request, res: Response) => {
  await initDbTable().catch(() => {});
  const id = String(req.params.id);
  const { text, senderName, attachments, attachmentUrl, id: clientMsgId } = req.body;
  const sender = STAFF.has(callerRole(req)) ? 'ta' : 'student';

  if (!text && (!attachments || attachments.length === 0) && !attachmentUrl) {
    res.status(400).json({ error: 'Message text or attachment is required' });
    return;
  }

  const ticket = await findTicket(id);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  // Idempotency: if clientMsgId already saved by socket handler, return without error
  if (clientMsgId && ticket.messages.some((m) => m.id === clientMsgId)) {
    res.json({ success: true, data: ticket });
    return;
  }

  const allAttachments: string[] = Array.isArray(attachments)
    ? attachments.filter((u: any) => typeof u === 'string')
    : attachmentUrl
    ? [attachmentUrl]
    : [];

  // Students can follow up freely, but with at most 2 photos in the whole chat, each under 1 MB
  const photoProblem = sender === 'student' ? studentPhotoProblem(allAttachments, chatPhotosLeft(ticket)) : null;
  if (photoProblem) {
    res.status(400).json({ error: photoProblem });
    return;
  }

  const replyMsg: ChatMessage = {
    id: clientMsgId || `m-${sender}-${Date.now()}`,
    sender: sender === 'student' ? 'student' : 'ta',
    senderName: req.user?.name || senderName || (sender === 'student' ? ticket.studentName : 'Teacher Assistant'),
    text: text || '',
    time: chatTime(),
    attachmentUrl: allAttachments[0] || undefined,
    attachmentUrls: allAttachments,
  };

  ticket.messages.push(replyMsg);
  if (sender === 'ta' && ticket.status === 'queue') {
    ticket.status = 'in_progress';
  }

  await saveTicketToDb(ticket);

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
  const id = String(req.params.id);
  const { resolvedBy } = req.body || {};

  const ticket = await findTicket(id);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  ticket.status = 'resolved';
  ticket.resolvedAt = new Date().toISOString();
  ticket.resolvedBy = resolvedBy || ticket.assignedTo?.name || 'Teacher Assistant';

  await saveTicketToDb(ticket);

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
