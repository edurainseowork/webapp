export interface ChatMessage {
  id: string;
  sender: 'student' | 'ta';
  senderName: string;
  text: string;
  time: string;
  avatar?: string;
  attachmentUrl?: string;
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
  subject: 'Physics' | 'Mathematics' | 'Chemistry';
  examTag: string;
  studentName: string;
  studentClass: string;
  studentAvatar: string;
  submittedAt: string;
  urgency: 'Urgent' | 'Normal';
  status: 'queue' | 'in_progress' | 'resolved';
  questionSnippet: string;
  questionFull: string;
  diagramUrl?: string;
  messages: ChatMessage[];
  studentInfo: StudentInfo;
  previousChats: PreviousChat[];
}

export interface TAProfile {
  name: string;
  role: string;
  email: string;
  avatarUrl: string;
  status: 'Online' | 'Away' | 'Busy';
  department: string;
}

const STORAGE_PROFILE_KEY = 'edurain_ta_profile_v1';
const STORAGE_TICKETS_KEY = 'edurain_ta_tickets_v1';

export const DEFAULT_PROFILE: TAProfile = {
  name: 'Dr. Arjun Mehta',
  role: 'Teacher Assistant',
  email: 'arjun.mehta@edurain.in',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
  status: 'Online',
  department: 'Physics & STEM Faculty',
};

// SVG Diagram for TK-1024 (Rotational Motion on Incline)
export const DIAGRAM_ROTATIONAL_INCLINE = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 360" width="100%" height="100%">
  <rect width="100%" height="100%" fill="%23f5ede0" rx="12" />
  <rect x="6" y="6" width="688" height="348" fill="none" stroke="%23dfd4c4" stroke-width="2" rx="8" />
  
  <text x="30" y="42" font-family="'Courier New', monospace, serif" font-size="19" font-weight="600" fill="%231e293b">
    A solid cylinder of mass M and radius R rolls without slipping
  </text>
  <text x="30" y="68" font-family="'Courier New', monospace, serif" font-size="19" font-weight="600" fill="%231e293b">
    on an inclined plane of angle θ. Find its acceleration.
  </text>
  
  <polygon points="60,280 440,280 440,140" fill="%23e2d8c9" stroke="%231e293b" stroke-width="3" stroke-linejoin="round" />
  
  <path d="M 120,280 A 60,60 0 0,0 114,258" fill="none" stroke="%231e293b" stroke-width="2" />
  <text x="135" y="272" font-family="serif" font-size="22" font-style="italic" fill="%231e293b">θ</text>
  
  <circle cx="280" cy="155" r="44" fill="%23faf8f5" stroke="%231e293b" stroke-width="3" />
  <circle cx="280" cy="155" r="4" fill="%231e293b" />
  
  <line x1="280" y1="155" x2="318" y2="175" stroke="%231e293b" stroke-width="2" stroke-dasharray="3,3" />
  <text x="290" y="145" font-family="serif" font-size="18" font-weight="bold" fill="%231e293b">M, R</text>
  
  <rect x="490" y="150" width="180" height="110" rx="6" fill="%23ece3d4" stroke="%2394a3b8" stroke-dasharray="4,4" />
  <text x="505" y="180" font-family="sans-serif" font-size="16" font-weight="bold" fill="%23334155">Given:</text>
  <text x="505" y="210" font-family="serif" font-size="18" font-style="italic" fill="%230f172a">I<tspan font-size="12">cm</tspan> = ½ MR²</text>
  <text x="505" y="240" font-family="sans-serif" font-size="13" fill="%23475569">(rolling without slipping)</text>
</svg>`;

export const DIAGRAM_PARTIAL_FRACTIONS = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 320" width="100%" height="100%">
  <rect width="100%" height="100%" fill="%23f5ede0" rx="12" />
  <rect x="6" y="6" width="688" height="308" fill="none" stroke="%23dfd4c4" stroke-width="2" rx="8" />
  <text x="30" y="45" font-family="'Courier New', monospace" font-size="19" font-weight="bold" fill="%231e293b">
    Evaluate the indefinite integral:
  </text>
  <text x="60" y="130" font-family="serif" font-size="34" font-style="italic" fill="%230f172a">
    ∫ <tspan font-size="28" font-family="sans-serif">[ (5x - 6) / ( (x - 1)² (x + 2) ) ] dx</tspan>
  </text>
  <text x="60" y="190" font-family="sans-serif" font-size="16" fill="%23475569">
    Decomposition: A/(x-1) + B/(x-1)² + C/(x+2)
  </text>
</svg>`;

export const DIAGRAM_CHEMISTRY_SN = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 320" width="100%" height="100%">
  <rect width="100%" height="100%" fill="%23f5ede0" rx="12" />
  <rect x="6" y="6" width="688" height="308" fill="none" stroke="%23dfd4c4" stroke-width="2" rx="8" />
  <text x="30" y="45" font-family="'Courier New', monospace" font-size="19" font-weight="bold" fill="%231e293b">
    Substrate Reaction Kinetics & Stereochemistry:
  </text>
  <text x="50" y="120" font-family="sans-serif" font-size="20" font-weight="600" fill="%237c3aed">
    (CH₃)₃C—Br + OH⁻  (in 80% aqueous acetone) ➔ (CH₃)₃C—OH + Br⁻
  </text>
  <text x="50" y="175" font-family="sans-serif" font-size="15" fill="%23334155">
    • Bulky 3° alkyl halide inhibits SN2 backside attack.
  </text>
  <text x="50" y="210" font-family="sans-serif" font-size="15" fill="%23334155">
    • Ionizes first into stable planar carbocation intermediate (SN1 mechanism).
  </text>
</svg>`;

export const DIAGRAM_WAVE_INTERFERENCE = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 320" width="100%" height="100%">
  <rect width="100%" height="100%" fill="%23f5ede0" rx="12" />
  <rect x="6" y="6" width="688" height="308" fill="none" stroke="%23dfd4c4" stroke-width="2" rx="8" />
  <text x="30" y="45" font-family="'Courier New', monospace" font-size="19" font-weight="bold" fill="%231e293b">
    Wave Interference: Coherent Source Superposition
  </text>
  <path d="M 50,140 Q 110,60 170,140 T 290,140 T 410,140 T 530,140 T 650,140" fill="none" stroke="%232563eb" stroke-width="3" />
  <path d="M 50,140 Q 110,90 170,140 T 290,140 T 410,140 T 530,140 T 650,140" fill="none" stroke="%23dc2626" stroke-width="2.5" stroke-dasharray="4,4" />
  <text x="50" y="240" font-family="sans-serif" font-size="16" fill="%231e293b">
    Path Difference: Δx = d sin θ = nλ  (Constructive Interference)
  </text>
</svg>`;

export const INITIAL_TICKETS: DoubtTicket[] = [
  {
    id: 'tk-1024',
    ticketNumber: '#TK-1024',
    title: 'Rotational Motion: Moment of Inertia on Incline',
    subject: 'Physics',
    examTag: 'IIT-JEE Advanced',
    studentName: 'Aarav Sharma',
    studentClass: 'Class 12 Lakshya JEE',
    studentAvatar: 'AS',
    submittedAt: 'Today, 10:24 AM',
    urgency: 'Urgent',
    status: 'queue',
    questionSnippet: 'Hi mentor, I am unable to understand how to apply the parallel axis theorem in this inclined plane situation. Could you please explain the approach?',
    questionFull: 'Hi mentor, I am unable to understand how to apply the parallel axis theorem in this inclined plane situation. Could you please explain the approach?',
    diagramUrl: DIAGRAM_ROTATIONAL_INCLINE,
    messages: [
      {
        id: 'm1',
        sender: 'student',
        senderName: 'Aarav Sharma',
        text: "I'm particularly confused about whether to take torque about COM or point of contact?",
        time: '10:24 AM',
        avatar: 'AS',
      },
      {
        id: 'm2',
        sender: 'ta',
        senderName: 'Dr. Arjun Mehta',
        text: "Good question! For rolling motion, it's usually simplest to take torque about the point of contact. Let me walk you through it: taking torque about the contact point eliminates the torque due to friction, which simplifies the equation of motion directly!",
        time: '10:26 AM',
        avatar: DEFAULT_PROFILE.avatarUrl,
      },
    ],
    studentInfo: {
      email: 'aarav.sharma@gmail.com',
      phone: '+91 98765 43210',
      targetExam: 'JEE Advanced 2026',
      doubtsSolved: 34,
      attendance: '96%',
      accuracy: '84%',
      recentTestScore: '242/300 (AIR 148)',
    },
    previousChats: [
      {
        id: 'pc1',
        date: '18 Oct 2026',
        subject: 'Physics',
        title: 'Rigid Body Dynamics: Pure Rolling on Frictionless Surface',
        resolvedBy: 'Dr. Arjun Mehta',
        rating: 5,
      },
      {
        id: 'pc2',
        date: '12 Oct 2026',
        subject: 'Physics',
        title: 'Collision of Rod with Point Mass',
        resolvedBy: 'Er. Priya Nair',
        rating: 5,
      },
    ],
  },
  {
    id: 'tk-1025',
    ticketNumber: '#TK-1025',
    title: 'Integration using Partial Fractions',
    subject: 'Mathematics',
    examTag: 'IIT-JEE Advanced',
    studentName: 'Riya Malhotra',
    studentClass: 'Class 12 Lakshya JEE',
    studentAvatar: 'RM',
    submittedAt: 'Today, 09:17 AM',
    urgency: 'Normal',
    status: 'queue',
    questionSnippet: 'Getting wrong answer when decomposing repeated quadratic factors in denominator.',
    questionFull: 'When I split the denominator with (x - 1)^2 (x + 2), my coefficient B is coming out negative whereas book shows positive. How do we set up the equation for repeated linear factor?',
    diagramUrl: DIAGRAM_PARTIAL_FRACTIONS,
    messages: [
      {
        id: 'm1',
        sender: 'student',
        senderName: 'Riya Malhotra',
        text: 'Sir, I equated coefficients of x^2 and x but I am still getting a mismatch for constant term.',
        time: '09:17 AM',
        avatar: 'RM',
      },
    ],
    studentInfo: {
      email: 'riya.malhotra@yahoo.com',
      phone: '+91 98112 34567',
      targetExam: 'JEE Advanced 2026',
      doubtsSolved: 28,
      attendance: '92%',
      accuracy: '79%',
      recentTestScore: '218/300 (AIR 412)',
    },
    previousChats: [
      {
        id: 'pc1',
        date: '16 Oct 2026',
        subject: 'Mathematics',
        title: 'Definite Integration King Property Application',
        resolvedBy: 'Dr. Arjun Mehta',
        rating: 5,
      },
    ],
  },
  {
    id: 'tk-1026',
    ticketNumber: '#TK-1026',
    title: 'Why is this reaction SN1 and not SN2?',
    subject: 'Chemistry',
    examTag: 'Class 12 Pratigya',
    studentName: 'Kunal Verma',
    studentClass: 'Class 12 Pratigya',
    studentAvatar: 'KV',
    submittedAt: 'Today, 08:46 AM',
    urgency: 'Normal',
    status: 'queue',
    questionSnippet: 'Why does polar protic solvent favor tertiary carbocation in nucleophilic substitution?',
    questionFull: 'Sir, both aqueous acetone and ethanolic KOH are mentioned in NCERT. Why does acetone with water promote carbocation ionization instead of direct displacement?',
    diagramUrl: DIAGRAM_CHEMISTRY_SN,
    messages: [
      {
        id: 'm1',
        sender: 'student',
        senderName: 'Kunal Verma',
        text: 'I always get confused between polar protic and polar aprotic solvents and how they solvate nucleophiles.',
        time: '08:46 AM',
        avatar: 'KV',
      },
    ],
    studentInfo: {
      email: 'kunal.verma@outlook.com',
      phone: '+91 97234 56789',
      targetExam: 'NEET / JEE 2026',
      doubtsSolved: 19,
      attendance: '88%',
      accuracy: '76%',
      recentTestScore: '185/300',
    },
    previousChats: [],
  },
  {
    id: 'tk-1027',
    ticketNumber: '#TK-1027',
    title: 'Wave Interference: Phase Difference',
    subject: 'Physics',
    examTag: 'Class 11 Udaan',
    studentName: 'Sneha Iyer',
    studentClass: 'Class 11 Udaan',
    studentAvatar: 'SI',
    submittedAt: 'Today, 08:12 AM',
    urgency: 'Normal',
    status: 'queue',
    questionSnippet: 'Formula for resultant intensity when initial phase difference is pi/3.',
    questionFull: 'Two waves with amplitudes A1 and A2 and phase difference delta phi meet at a point. If A1 = 2A2, what is the ratio of I_max to I_min?',
    diagramUrl: DIAGRAM_WAVE_INTERFERENCE,
    messages: [
      {
        id: 'm1',
        sender: 'student',
        senderName: 'Sneha Iyer',
        text: 'Hello sir, does intensity ratio depend on initial phase or only on amplitudes?',
        time: '08:12 AM',
        avatar: 'SI',
      },
    ],
    studentInfo: {
      email: 'sneha.iyer@gmail.com',
      phone: '+91 99887 66554',
      targetExam: 'JEE Main 2027',
      doubtsSolved: 42,
      attendance: '98%',
      accuracy: '91%',
      recentTestScore: '265/300 (AIR 82)',
    },
    previousChats: [
      {
        id: 'pc1',
        date: '15 Oct 2026',
        subject: 'Physics',
        title: 'Simple Harmonic Motion Phase Constants',
        resolvedBy: 'Dr. Arjun Mehta',
        rating: 5,
      },
    ],
  },
  {
    id: 'tk-1020',
    ticketNumber: '#TK-1020',
    title: 'Thermodynamics Carnot Engine Efficiency Limit',
    subject: 'Physics',
    examTag: 'IIT-JEE Advanced',
    studentName: 'Rohan Gupta',
    studentClass: 'Class 12 Lakshya JEE',
    studentAvatar: 'RG',
    submittedAt: 'Yesterday, 04:30 PM',
    urgency: 'Normal',
    status: 'resolved',
    questionSnippet: 'Second law of thermodynamics: why efficiency cannot reach 100% even with zero friction.',
    questionFull: 'Can we achieve 100% Carnot efficiency if sink is at 0 Kelvin or does third law forbid reaching absolute zero?',
    diagramUrl: DIAGRAM_ROTATIONAL_INCLINE,
    messages: [
      {
        id: 'm1',
        sender: 'student',
        senderName: 'Rohan Gupta',
        text: 'Sir, is reaching 0K impossible because of finite number of cycles?',
        time: '04:30 PM',
        avatar: 'RG',
      },
      {
        id: 'm2',
        sender: 'ta',
        senderName: 'Dr. Arjun Mehta',
        text: 'Exactly! By the Nernst Heat Theorem (Third Law), it requires infinite isothermal and adiabatic steps to reach absolute zero, so efficiency eta = 1 - T2/T1 is strictly less than 1 in practice.',
        time: '04:38 PM',
        avatar: DEFAULT_PROFILE.avatarUrl,
      },
    ],
    studentInfo: {
      email: 'rohan.gupta@gmail.com',
      phone: '+91 98450 12345',
      targetExam: 'JEE Advanced 2026',
      doubtsSolved: 50,
      attendance: '95%',
      accuracy: '88%',
      recentTestScore: '254/300',
    },
    previousChats: [],
  },
];

export function getStoredTickets(): DoubtTicket[] {
  try {
    const raw = localStorage.getItem(STORAGE_TICKETS_KEY);
    if (!raw) return INITIAL_TICKETS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_TICKETS;
  } catch {
    return INITIAL_TICKETS;
  }
}

export function saveStoredTickets(tickets: DoubtTicket[]): void {
  try {
    localStorage.setItem(STORAGE_TICKETS_KEY, JSON.stringify(tickets));
  } catch (e) {
    console.error('Failed to save tickets to localStorage', e);
  }
}

export function getStoredProfile(): TAProfile {
  try {
    const raw = localStorage.getItem(STORAGE_PROFILE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveStoredProfile(profile: TAProfile): void {
  try {
    localStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error('Failed to save profile to localStorage', e);
  }
}
