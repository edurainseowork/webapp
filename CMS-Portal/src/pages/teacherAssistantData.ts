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

export interface DoubtTicket {
  id: string;
  ticketNumber: string;
  title: string;
  subject: 'Physics' | 'Mathematics' | 'Chemistry' | string;
  examTag: string;
  studentName: string;
  studentClass: string;
  studentAvatar: string;
  submittedAt: string;
  submittedAtRelative?: string;
  status: 'queue' | 'in_progress' | 'resolution_requested' | 'resolved';
  assignedTo?: { id: string; name: string; email: string } | null;
  resolutionRequestedAt?: string | null;
  resolutionRequestedBy?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  questionSnippet: string;
  questionFull: string;
  diagramUrl?: string;
  diagramUrls?: string[];
  attachmentUrls?: string[];
  messages: ChatMessage[];
  studentInfo: StudentInfo;
  previousChats: PreviousChat[];
}

export interface TAProfile {
  name: string;
  email: string;
  role: string;
  avatarUrl: string;
  status: 'Active' | 'Away' | 'In Doubts';
  doubtsResolvedToday: number;
  avgResponseTime: string;
  rating: number;
}

export const DEFAULT_PROFILE: TAProfile = {
  name: 'Dr. Arjun Mehta',
  email: 'arjun.mehta@edurain.in',
  role: 'Senior Teacher Assistant',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
  status: 'Active',
  doubtsResolvedToday: 18,
  avgResponseTime: '2.4 mins',
  rating: 4.9,
};

const makeStudent = (name: string, exam = 'JEE Advanced 2026', doubts = 42, att = '94%', acc = '87%', score = '198 / 300 (Rank 48)'): StudentInfo => ({
  email: `${name.toLowerCase().replace(/\s+/g, '.')}@edurain.student`,
  phone: '+91 98765 43210',
  targetExam: exam,
  doubtsSolved: doubts,
  attendance: att,
  accuracy: acc,
  recentTestScore: score,
});

const defaultChats = (subj: string): PreviousChat[] => [
  { id: 'pc-1', date: '19 Oct 2026', subject: subj, title: `Advanced numerical problem in ${subj}`, resolvedBy: 'Dr. Arjun Mehta', rating: 5 },
  { id: 'pc-2', date: '15 Oct 2026', subject: subj, title: 'Concept clarity doubt session', resolvedBy: 'Priya Sharma', rating: 4 },
];

export const INITIAL_TICKETS: DoubtTicket[] = [
  {
    id: 't-101',
    ticketNumber: 'TKT-1082',
    title: 'Rotational Dynamics: Parallel Axis Theorem on Inclined Plane',
    subject: 'Physics',
    examTag: 'JEE Advanced',
    studentName: 'Aarav Sharma',
    studentClass: 'Class 12th',
    studentAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=128&q=80',
    submittedAt: '10 mins ago',
    status: 'queue',
    assignedTo: null,
    questionSnippet: 'Unable to understand how to apply parallel axis theorem in this inclined plane situation.',
    questionFull: 'In the diagram attached, a uniform circular cylinder of mass M and radius R rolls without slipping down an inclined plane with angle theta. Please explain the torque balance about the contact axis vs the center of mass.',
    diagramUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1200&q=80',
    messages: [
      { id: 'm-1', sender: 'student', senderName: 'Aarav Sharma', text: 'Hi sir, I tried finding torque about contact point P, but why does friction torque vanish?', time: '10:14 AM' },
      { id: 'm-2', sender: 'ta', senderName: 'Dr. Arjun Mehta', text: 'Because line of friction passes directly through point P, its lever arm is zero.', time: '10:17 AM' },
    ],
    studentInfo: makeStudent('Aarav Sharma', 'JEE Advanced 2026', 48, '96%', '89%', '214 / 300'),
    previousChats: defaultChats('Physics'),
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
    submittedAt: '25 mins ago',
    status: 'queue',
    assignedTo: null,
    questionSnippet: 'Evaluating integral from 0 to 2pi of x*sin(x)/(1+cos^2(x)) dx using substitution.',
    questionFull: 'Evaluating integral from 0 to 2pi of x*sin(x)/(1+cos^2(x)) dx using substitution. Should I split at pi or directly apply f(a+b-x)?',
    messages: [
      { id: 'm-201', sender: 'student', senderName: 'Diya Patel', text: 'Does King rule cancel out the numerator x when applying f(2pi - x)?', time: '09:55 AM' },
    ],
    studentInfo: makeStudent('Diya Patel', 'JEE Mains 2026', 31, '91%', '82%', '176 / 300'),
    previousChats: defaultChats('Mathematics'),
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
    submittedAt: '40 mins ago',
    status: 'queue',
    assignedTo: null,
    questionSnippet: 'Calculating CFSE in octahedral d4 high spin complex with weak field ligand.',
    questionFull: 'In [Cr(H2O)6]2+ complex, Cr is +2 with 3d4 configuration. Weak ligand means high spin (t2g3 eg1). How do we calculate total CFSE in terms of delta_o?',
    diagramUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=80',
    messages: [
      { id: 'm-301', sender: 'student', senderName: 'Rohan Verma', text: 'Is CFSE = (-0.4 * 3 + 0.6 * 1) * delta_o = -0.6 delta_o?', time: '09:35 AM' },
    ],
    studentInfo: makeStudent('Rohan Verma', 'NEET 2026', 56, '98%', '91%', '645 / 720'),
    previousChats: defaultChats('Chemistry'),
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
    submittedAt: '1 hour ago',
    status: 'resolved',
    assignedTo: { id: 'ta-1', name: 'Dr. Arjun Mehta', email: 'arjun.mehta@edurain.in' },
    resolvedBy: 'Dr. Arjun Mehta',
    resolvedAt: '1 hour ago',
    questionSnippet: 'Why is delta S universe > 0 when q = 0 in free expansion of ideal gas?',
    questionFull: 'Why is delta S universe > 0 when q = 0 in free expansion of ideal gas? Since q_rev is used to define entropy, how do we construct the reversible path?',
    messages: [
      { id: 'm-401', sender: 'student', senderName: 'Ananya Deshmukh', text: 'Understood sir! Reversible isothermal expansion path gives nR*ln(V2/V1). Thanks!', time: '08:45 AM' },
    ],
    studentInfo: makeStudent('Ananya Deshmukh', 'JEE Advanced 2026', 64, '95%', '93%', '232 / 300'),
    previousChats: defaultChats('Physics'),
  },
];

const STORAGE_KEY_TICKETS = 'edurain_ta_tickets_v1';
const STORAGE_KEY_PROFILE = 'edurain_ta_profile_v1';

export function getStoredTickets(): DoubtTicket[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TICKETS);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse stored tickets', err);
  }
  return INITIAL_TICKETS;
}

export function saveStoredTickets(tickets: DoubtTicket[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_TICKETS, JSON.stringify(tickets));
  } catch (err) {
    console.error('Failed to save tickets', err);
  }
}

export function getStoredProfile(): TAProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROFILE);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse stored profile', err);
  }
  return DEFAULT_PROFILE;
}

export function saveStoredProfile(profile: TAProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
  } catch (err) {
    console.error('Failed to save profile', err);
  }
}
