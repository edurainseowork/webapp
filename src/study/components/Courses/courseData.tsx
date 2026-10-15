import {
  Clock3,
  FileText,
  Layers,
  Brain,
  Zap,
  Users,
  Trophy,
  BookOpen,
  Video,
  Download,
  Target,
  Sigma,
  FlaskConical,
  Hexagon,
  Network,
  Megaphone,
  BarChart3,
  Gauge,
  Infinity as InfinityIcon,
  RefreshCw,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type BatchCategory = 'class11' | 'class12' | 'dropper' | 'class10' | 'crash';
export type PlanId = 'standard' | 'infinity' | 'pro';
export type HeaderTone = 'deep' | 'teal' | 'brown';
export type StatusTone = 'live' | 'new' | 'flash';

export interface Batch {
  id: string;
  /** Uppercase name used on catalogue cards */
  name: string;
  /** Ribbon on the card header, e.g. "FLAGSHIP 2-YEAR" */
  label: string;
  tone: HeaderTone;
  categories: BatchCategory[];
  chips: string[];
  status: { text: string; tone: StatusTone };
  features: { icon: LucideIcon; text: string }[];
  price: number;
  mrp: number;
  offerText: string;
  /** Hidden from the catalogue grid (shown in hero / best-fit slots instead) */
  featured?: boolean;

  // Detail page
  title: string;
  subtitle: string;
  cohortLabel: string;
  description: string;
  breadcrumb: string;
  startDate: string;
  schedule: string;
  validity: string;
  language: string;
  enrolled: string;
  audience: string;
  /** Explicit plan prices; otherwise derived from price / mrp */
  plans?: Record<PlanId, { price: number; mrp: number }>;
}

export interface EnrolledCourse {
  id: string;
  /** Batch the course belongs to — opens that batch's detail page */
  batchId: string;
  batchLabel: string;
  title: string;
  progress: number;
  completedLectures: number;
  totalLectures: number;
  currentTopic: string;
}

export interface DemoClass {
  id: string;
  title: string;
  meta: string;
  duration: string;
}

export interface Lecture {
  code: string;
  title: string;
  meta: string;
  kind: 'live' | 'recorded';
  extra?: string;
}

export interface Chapter {
  num: number;
  title: string;
  status: 'done' | 'live' | 'locked';
  summary?: string;
  lectures?: Lecture[];
}

export interface Subject {
  id: string;
  name: string;
  icon: LucideIcon;
  badge: string;
  stats: string;
  moduleTitle: string;
  chapters: Chapter[];
  isNotices?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Batches                                                            */
/* ------------------------------------------------------------------ */

export const BATCHES: Batch[] = [
  {
    id: 'arjuna-2027',
    name: 'ARJUNA JEE 2027 (CLASS 11 FLAGSHIP)',
    label: 'FLAGSHIP 2-YEAR',
    tone: 'deep',
    categories: ['class11'],
    chips: ['Class 11th', 'HINGLISH', 'IIT-JEE 2027'],
    status: { text: 'Admissions Open | Starts Monday, May 12', tone: 'new' },
    features: [
      { icon: Users, text: 'Kota Star Faculty (AIR 1-3 & 100 Percentile)' },
      { icon: FileText, text: 'Full test series + Kota Modules delivered home' },
    ],
    price: 3999,
    mrp: 7000,
    offerText: '43% OFF Early Bird',
    featured: true,
    title: 'Arjuna JEE 4.0 2027',
    subtitle: '(Class 11th + 12th + JEE Advanced)',
    cohortLabel: 'Flagship 2-Year Cohort • Target IIT Advanced 2027',
    description:
      "India's premier comprehensive classroom program engineered by Kota's top faculty rankers. Includes Complete Theory, Daily Problem Sheets (DPPs), Video Solutions, 24x7 Doubt Resolution & Real-time AI Analytics.",
    breadcrumb: '11th & 12th IIT-JEE',
    startDate: '11th June 2025',
    schedule: '6 Days a Week',
    validity: 'June 2027 (24M)',
    language: 'Hinglish',
    enrolled: '48.5k Aspirants',
    audience: 'For IIT-JEE 2027 Aspirants (Class 11 & 12)',
    plans: {
      standard: { price: 3999, mrp: 7000 },
      infinity: { price: 5000, mrp: 8800 },
      pro: { price: 7499, mrp: 12999 },
    },
  },
  {
    id: 'uday-2027',
    name: 'UDAY 2027 (CLASS 11th JEE)',
    label: 'FLAGSHIP 2-YEAR',
    tone: 'deep',
    categories: ['class11'],
    chips: ['Class 11th', 'HINGLISH', 'IIT-JEE 2027'],
    status: { text: 'Ongoing | Started on 15th May 2025', tone: 'live' },
    features: [
      { icon: Clock3, text: '24x7 Live Doubt Engine Support' },
      { icon: BookOpen, text: 'Includes 14 Printed Hardcopy Study Modules' },
    ],
    price: 3499,
    mrp: 6999,
    offerText: '50% OFF Limited Offer',
    title: 'Uday 2027',
    subtitle: '(Class 11th + JEE Main & Advanced)',
    cohortLabel: 'Flagship 2-Year Cohort • Target JEE 2027',
    description:
      'A two-year foundation-to-advanced track for Class 11 students. Complete theory, DPPs, printed modules and weekly ranker-style tests to build JEE problem-solving depth early.',
    breadcrumb: '11th IIT-JEE',
    startDate: '15th May 2025',
    schedule: '6 Days a Week',
    validity: 'May 2027 (24M)',
    language: 'Hinglish',
    enrolled: '31.2k Aspirants',
    audience: 'For IIT-JEE 2027 Aspirants (Class 11)',
  },
  {
    id: 'lakshya-2026',
    name: 'LAKSHYA JEE 2026 (CLASS 12th)',
    label: 'MOST POPULAR',
    tone: 'teal',
    categories: ['class12'],
    chips: ['Class 12th', 'HINGLISH', 'JEE Main & Adv'],
    status: { text: 'New Batch Starts June 1, 2025', tone: 'new' },
    features: [
      { icon: FileText, text: 'Full Test Series (24 Part + 16 Full Mock)' },
      { icon: Brain, text: 'AI-Assisted Weakness Diagnosis Reports' },
    ],
    price: 3899,
    mrp: 7499,
    offerText: '48% OFF Coupon Applied',
    title: 'Lakshya JEE 2026',
    subtitle: '(Class 12th + JEE Main & Advanced)',
    cohortLabel: '1-Year Intensive Cohort • Target JEE 2026',
    description:
      'A focused one-year program for Class 12 students covering the full JEE syllabus alongside boards, with 40 mock tests and AI weakness diagnosis after every test.',
    breadcrumb: '12th IIT-JEE',
    startDate: '1st June 2025',
    schedule: '6 Days a Week',
    validity: 'May 2026 (12M)',
    language: 'Hinglish',
    enrolled: '52.8k Aspirants',
    audience: 'For IIT-JEE 2026 Aspirants (Class 12)',
  },
  {
    id: 'prayas-2026',
    name: 'PRAYAS JEE 2026 (DROPPER TRACK)',
    label: 'INTENSIVE DROPPER',
    tone: 'brown',
    categories: ['dropper'],
    chips: ['Dropper / Repeater', 'HINGLISH', 'Intensive 300-Day'],
    status: { text: 'Ongoing | Batch 2 Admissions Open', tone: 'live' },
    features: [
      { icon: Zap, text: 'Daily 6-Hour High-Efficiency Core Lectures' },
      { icon: Users, text: 'Dedicated Micro-Batch Doubt Rooms' },
    ],
    price: 4200,
    mrp: 8500,
    offerText: '51% OFF Summer Pass',
    title: 'Prayas JEE 2026',
    subtitle: '(Dropper / Repeater Track)',
    cohortLabel: 'Intensive 300-Day Cohort • Target JEE 2026',
    description:
      'A 300-day rank-booster for droppers: daily six-hour core lectures, micro-batch doubt rooms and a full revision cycle before the exam season.',
    breadcrumb: 'Dropper IIT-JEE',
    startDate: '20th May 2025',
    schedule: '6 Days a Week',
    validity: 'May 2026 (12M)',
    language: 'Hinglish',
    enrolled: '22.4k Aspirants',
    audience: 'For IIT-JEE 2026 Droppers & Repeaters',
  },
  {
    id: 'udaan-2027',
    name: 'UDAAN 2027 (CLASS 10th CBSE + OLYMPIAD)',
    label: 'FOUNDATION',
    tone: 'deep',
    categories: ['class10'],
    chips: ['Class 10th', 'ENGLISH', 'CBSE + NTSE'],
    status: { text: 'Enrolling Now | Orientation June 10', tone: 'new' },
    features: [
      { icon: Trophy, text: 'Olympiad / PRMO Problem Solving Clinics' },
      { icon: BookOpen, text: 'Free NCERT Board Exemplar Handbooks' },
    ],
    price: 2499,
    mrp: 4999,
    offerText: '50% FLAT OFF',
    title: 'Udaan 2027',
    subtitle: '(Class 10th CBSE + Olympiad)',
    cohortLabel: 'Foundation Cohort • CBSE Boards + Olympiads',
    description:
      'Board-first foundation for Class 10 with olympiad and NTSE problem-solving clinics, so students start Class 11 already comfortable with competitive-exam thinking.',
    breadcrumb: 'Class 10 Foundation',
    startDate: '10th June 2025',
    schedule: '5 Days a Week',
    validity: 'March 2026 (10M)',
    language: 'English',
    enrolled: '18.9k Aspirants',
    audience: 'For Class 10 CBSE & Olympiad Aspirants',
  },
  {
    id: 'neet-drill-2026',
    name: 'NEET TOPPERS DRILL (CLASS 12th + DROPPER)',
    label: 'NEET SPECIAL',
    tone: 'teal',
    categories: ['class12', 'dropper'],
    chips: ['NEET 2026', 'HINGLISH', '70 Mock Tests'],
    status: { text: 'Starts June 5 | Early Access Active', tone: 'new' },
    features: [
      { icon: Layers, text: 'Bio-Diagrammatic Memory Flashcards Included' },
      { icon: Gauge, text: 'Speed Calculation Sprints (Physics Section)' },
    ],
    price: 3699,
    mrp: 6999,
    offerText: '47% OFF Discount',
    title: 'NEET Toppers Drill 2026',
    subtitle: '(Class 12th + Dropper)',
    cohortLabel: 'NEET Special Cohort • Target NEET-UG 2026',
    description:
      'A test-heavy NEET program with 70 full mocks, diagram-first biology flashcards and timed physics calculation sprints for Class 12 students and droppers.',
    breadcrumb: 'NEET-UG',
    startDate: '5th June 2025',
    schedule: '6 Days a Week',
    validity: 'May 2026 (12M)',
    language: 'Hinglish',
    enrolled: '27.6k Aspirants',
    audience: 'For NEET-UG 2026 Aspirants (Class 12 & Droppers)',
  },
  {
    id: 'formula-booster',
    name: 'FORMULA & DERIVATION BOOSTER CRASH',
    label: 'BOOSTER CAPSULE',
    tone: 'brown',
    categories: ['crash'],
    chips: ['Fastrack', 'ALL STREAMS', 'Formula Sheets'],
    status: { text: 'Live Now | Immediate Video Access', tone: 'flash' },
    features: [
      { icon: Download, text: 'Downloadable Color-Coded Mindmaps' },
      { icon: FileText, text: '10 Mock CBTs simulating NTA pattern' },
    ],
    price: 1299,
    mrp: 2699,
    offerText: '52% OFF Flash Deal',
    title: 'Formula & Derivation Booster',
    subtitle: '(Crash Course • All Streams)',
    cohortLabel: 'Booster Capsule • Instant Access',
    description:
      'A fast-track revision capsule with every key formula and derivation, colour-coded mindmaps and 10 NTA-pattern mock CBTs for the final weeks before the exam.',
    breadcrumb: 'Crash Courses',
    startDate: 'Available now',
    schedule: 'Self-paced',
    validity: '6 Months',
    language: 'Hinglish',
    enrolled: '64.1k Aspirants',
    audience: 'For JEE & NEET Aspirants (All Classes)',
  },
];

export const CATALOG_FILTERS: { id: 'all' | BatchCategory; label: string }[] = [
  { id: 'all', label: 'All Batches' },
  { id: 'class11', label: 'Class 11th JEE' },
  { id: 'class12', label: 'Class 12th JEE' },
  { id: 'dropper', label: 'Dropper / Repeater' },
  { id: 'class10', label: 'Class 10th Foundation' },
  { id: 'crash', label: 'Crash Courses' },
];

export const getBatch = (id: string) => BATCHES.find((b) => b.id === id) ?? BATCHES[0];

/* ------------------------------------------------------------------ */
/*  Plans                                                              */
/* ------------------------------------------------------------------ */

export const PLAN_META: Record<
  PlanId,
  {
    name: string;
    tag: string;
    tagClass: string;
    description: string;
    suffix: string;
    lead?: string;
    features: { icon: LucideIcon; text: string }[];
    footer: string;
    footerClass: string;
  }
> = {
  standard: {
    name: 'Batch Standard',
    tag: 'Essential Prep',
    tagClass: 'bg-[#EAF3F1] text-[#175A67]',
    description: 'Core classroom rigor for self-driven students.',
    suffix: 'Full Validity',
    features: [
      { icon: ShieldCheck, text: 'Live & Recorded Lectures' },
      { icon: ShieldCheck, text: 'Daily DPPs + Video Solutions' },
      { icon: ShieldCheck, text: 'Monthly Part-Syllabus Tests' },
    ],
    footer: 'Standard doubt engine',
    footerClass: 'text-slate-500 font-medium',
  },
  infinity: {
    name: 'Infinity',
    tag: 'Best Value for Rankers',
    tagClass: 'bg-sky-100 text-sky-700',
    description: "Full arsenal with previous years' archives & AI prep.",
    suffix: 'Recommended',
    lead: 'Everything in Batch Standard, plus:',
    features: [
      { icon: BookOpen, text: 'Khazana (Kota Top Faculty Archives)' },
      { icon: BarChart3, text: 'All India Test Pass + AIR Rank Predictor' },
      { icon: RefreshCw, text: 'Auto-access to 2026/27 Future Cohorts' },
    ],
    footer: 'Includes 6 Infinity Power Modules',
    footerClass: 'text-[#175A67] font-bold',
  },
  pro: {
    name: 'Infinity Pro',
    tag: '1-on-1 Mentorship',
    tagClass: 'bg-[#EAF3F1] text-[#175A67]',
    description: 'Elite preparation with dedicated IITian mentor & books.',
    suffix: 'Full Physical Kit',
    lead: 'Everything in Infinity, plus:',
    features: [
      { icon: Target, text: '1-on-1 Assigned IITian Senior Mentor' },
      { icon: BookOpen, text: '14 Hardcopy Theory Modules Home Delivered' },
      { icon: Video, text: 'Priority 24x7 1-on-1 Audio/Video Doubt Room' },
    ],
    footer: 'Free Doorstep Delivery of Books',
    footerClass: 'text-[#175A67] font-bold',
  },
};

export const PLAN_ORDER: PlanId[] = ['standard', 'infinity', 'pro'];

const roundPrice = (n: number) => Math.max(99, Math.round(n / 100) * 100 - 1);

export const getPlanPrices = (batch: Batch): Record<PlanId, { price: number; mrp: number }> =>
  batch.plans ?? {
    standard: { price: batch.price, mrp: batch.mrp },
    infinity: { price: roundPrice(batch.price * 1.3), mrp: roundPrice(batch.mrp * 1.25) },
    pro: { price: roundPrice(batch.price * 1.9), mrp: roundPrice(batch.mrp * 1.85) },
  };

export const COMPARE_ROWS: { label: string; plans: Record<PlanId, boolean | string> }[] = [
  { label: 'Live & recorded lectures', plans: { standard: true, infinity: true, pro: true } },
  { label: 'Daily DPPs + video solutions', plans: { standard: true, infinity: true, pro: true } },
  { label: 'Part-syllabus tests', plans: { standard: 'Monthly', infinity: 'Weekly', pro: 'Weekly' } },
  { label: 'Khazana faculty archives', plans: { standard: false, infinity: true, pro: true } },
  { label: 'All India Test Pass + AIR predictor', plans: { standard: false, infinity: true, pro: true } },
  { label: 'Future cohort auto-access', plans: { standard: false, infinity: true, pro: true } },
  { label: '1-on-1 IITian mentor', plans: { standard: false, infinity: false, pro: true } },
  { label: 'Hardcopy modules delivered', plans: { standard: false, infinity: false, pro: true } },
  { label: 'Doubt support', plans: { standard: 'Standard', infinity: 'Priority', pro: '1-on-1 room' } },
];

export const INFINITY_PERKS: { icon: LucideIcon; label: string }[] = [
  { icon: BarChart3, label: 'All India Test Pass' },
  { icon: ShieldCheck, label: 'Topper Mentorship' },
  { icon: Gauge, label: 'AI Prep Meter' },
  { icon: InfinityIcon, label: 'Infinite Practice Bank' },
  { icon: RefreshCw, label: 'Free Cohort Upgrades' },
];

/* ------------------------------------------------------------------ */
/*  Enrolled courses & demo classes                                    */
/* ------------------------------------------------------------------ */

// TODO: replace with the student's real enrolments from the backend
export const ENROLLED_COURSES: EnrolledCourse[] = [
  {
    id: 'c1',
    batchId: 'lakshya-2026',
    batchLabel: '12th - IIT JEE',
    title: 'JEE Advanced Physics Masterclass (Mechanics to Modern Physics)',
    progress: 68,
    completedLectures: 32,
    totalLectures: 48,
    currentTopic: 'Lecture 33: Coupled Oscillations & Resonance',
  },
  {
    id: 'c2',
    batchId: 'lakshya-2026',
    batchLabel: '12th - IIT JEE',
    title: 'Integral & Differential Calculus Rank Booster',
    progress: 82,
    completedLectures: 29,
    totalLectures: 36,
    currentTopic: 'Lecture 30: Area Under Curves (Advanced Traps)',
  },
  {
    id: 'c3',
    batchId: 'lakshya-2026',
    batchLabel: '12th - IIT JEE',
    title: 'Organic Chemistry Synthesis & Reaction Mechanisms',
    progress: 54,
    completedLectures: 22,
    totalLectures: 40,
    currentTopic: 'Lecture 23: Aldol & Cannizzaro Crossed Reactions',
  },
];

export const DEMO_CLASSES: DemoClass[] = [
  { id: 'd1', title: 'Kinematics 1D & Graph Traps', meta: 'Physics • Lecture 01', duration: '1h 20m' },
  { id: 'd2', title: 'Periodic Trends & Chemical Bonding', meta: 'Inorganic • Lecture 01', duration: '1h 15m' },
  { id: 'd3', title: 'Calculus Fundamentals & Limits Traps', meta: 'Maths • Lecture 01', duration: '1h 28m' },
];

/* ------------------------------------------------------------------ */
/*  Syllabus                                                           */
/* ------------------------------------------------------------------ */

export const SUBJECTS: Subject[] = [
  {
    id: 'physics',
    name: 'Physics',
    icon: Zap,
    badge: 'Class 11 & 12',
    stats: '25 Chapters • 142 Lectures',
    moduleTitle: 'Class 11 Foundation Modules',
    chapters: [
      {
        num: 1,
        title: 'Physical World, Units & Dimensions',
        status: 'done',
        lectures: [
          { code: 'L02', title: 'Dimensional Analysis & Error Propagation', meta: '1h 12m', kind: 'recorded', extra: 'DPP-01 Solution Live' },
          { code: 'L01', title: 'Physical Quantities & SI Units', meta: '58m', kind: 'recorded' },
        ],
      },
      {
        num: 2,
        title: 'Kinematics in 1D & 2D Projectile Motion',
        status: 'live',
        lectures: [
          { code: 'L04', title: 'Trajectory Equation & Inclined Plane Projectiles', meta: 'Starts 06:00 PM', kind: 'live' },
          { code: 'L03', title: 'Relative Motion & River-Boat Swimming Problems', meta: '1h 45m', kind: 'recorded', extra: 'DPP-03 Solution Live' },
        ],
      },
      {
        num: 3,
        title: "Newton's Laws of Motion & Friction Dynamics",
        status: 'locked',
        summary: '10 Lectures • 10 DPP Sheets • Advanced IIT-JEE Problem Drill • Unlocks Next Monday',
      },
    ],
  },
  {
    id: 'mathematics',
    name: 'Mathematics',
    icon: Sigma,
    badge: 'Class 11 & 12',
    stats: '27 Chapters • 156 Lectures',
    moduleTitle: 'Class 11 Algebra & Calculus Modules',
    chapters: [
      {
        num: 1,
        title: 'Sets, Relations & Functions',
        status: 'done',
        lectures: [{ code: 'L03', title: 'Domain, Range & Composite Functions', meta: '1h 25m', kind: 'recorded', extra: 'DPP-02 Solution Live' }],
      },
      {
        num: 2,
        title: 'Quadratic Equations & Inequalities',
        status: 'live',
        lectures: [
          { code: 'L05', title: 'Location of Roots & Graph Transformations', meta: 'Starts 07:30 PM', kind: 'live' },
          { code: 'L04', title: 'Sign Scheme & Wavy Curve Method', meta: '1h 30m', kind: 'recorded', extra: 'DPP-04 Solution Live' },
        ],
      },
      {
        num: 3,
        title: 'Sequences & Series',
        status: 'locked',
        summary: '9 Lectures • 8 DPP Sheets • AP-GP-HP Mixed Drill • Unlocks Next Monday',
      },
    ],
  },
  {
    id: 'physical-chem',
    name: 'Physical Chem',
    icon: FlaskConical,
    badge: 'Class 11 & 12',
    stats: '15 Chapters • 88 Lectures',
    moduleTitle: 'Class 11 Physical Chemistry Modules',
    chapters: [
      {
        num: 1,
        title: 'Mole Concept & Stoichiometry',
        status: 'done',
        lectures: [{ code: 'L03', title: 'Limiting Reagent & Percentage Yield', meta: '1h 05m', kind: 'recorded', extra: 'DPP-03 Solution Live' }],
      },
      {
        num: 2,
        title: 'Atomic Structure & Quantum Numbers',
        status: 'live',
        lectures: [
          { code: 'L03', title: 'Bohr Model & Hydrogen Spectral Series', meta: 'Starts 05:00 PM', kind: 'live' },
          { code: 'L02', title: 'de Broglie Wavelength & Uncertainty Principle', meta: '1h 20m', kind: 'recorded', extra: 'DPP-02 Solution Live' },
        ],
      },
      {
        num: 3,
        title: 'Chemical Equilibrium',
        status: 'locked',
        summary: '8 Lectures • 7 DPP Sheets • Kp-Kc Numerical Drill • Unlocks Next Monday',
      },
    ],
  },
  {
    id: 'organic-chem',
    name: 'Organic Chem',
    icon: Hexagon,
    badge: 'Class 11 & 12',
    stats: '12 Chapters • 76 Lectures',
    moduleTitle: 'Class 11 Organic Chemistry Modules',
    chapters: [
      {
        num: 1,
        title: 'IUPAC Nomenclature',
        status: 'done',
        lectures: [{ code: 'L02', title: 'Bicyclic & Spiro Compound Naming', meta: '55m', kind: 'recorded', extra: 'DPP-01 Solution Live' }],
      },
      {
        num: 2,
        title: 'General Organic Chemistry (GOC)',
        status: 'live',
        lectures: [
          { code: 'L06', title: 'Hyperconjugation & Resonance Stability', meta: 'Starts 08:00 PM', kind: 'live' },
          { code: 'L05', title: 'Inductive & Mesomeric Effects', meta: '1h 35m', kind: 'recorded', extra: 'DPP-05 Solution Live' },
        ],
      },
      {
        num: 3,
        title: 'Isomerism',
        status: 'locked',
        summary: '7 Lectures • 6 DPP Sheets • Stereo-Isomer Counting Drill • Unlocks Next Monday',
      },
    ],
  },
  {
    id: 'inorganic-chem',
    name: 'Inorganic Chem',
    icon: Network,
    badge: 'Class 11 & 12',
    stats: '11 Chapters • 64 Lectures',
    moduleTitle: 'Class 11 Inorganic Chemistry Modules',
    chapters: [
      {
        num: 1,
        title: 'Periodic Classification of Elements',
        status: 'done',
        lectures: [{ code: 'L02', title: 'Ionisation Enthalpy & Electron Affinity Trends', meta: '1h 02m', kind: 'recorded', extra: 'DPP-02 Solution Live' }],
      },
      {
        num: 2,
        title: 'Chemical Bonding & VSEPR',
        status: 'live',
        lectures: [
          { code: 'L04', title: 'Molecular Orbital Theory', meta: 'Starts 04:30 PM', kind: 'live' },
          { code: 'L03', title: 'Hybridisation & Molecular Shapes', meta: '1h 10m', kind: 'recorded', extra: 'DPP-03 Solution Live' },
        ],
      },
      {
        num: 3,
        title: 'Coordination Compounds',
        status: 'locked',
        summary: '6 Lectures • 5 DPP Sheets • Werner Theory & CFT Drill • Unlocks Next Monday',
      },
    ],
  },
  {
    id: 'notices',
    name: 'Batch Notices',
    icon: Megaphone,
    badge: 'Live Updates',
    stats: '7 Notice Modules • Weekly Routine',
    moduleTitle: 'Latest Batch Notices',
    chapters: [],
    isNotices: true,
  },
];

export const BATCH_NOTICES = [
  { id: 'bn1', title: 'Weekly routine updated: Physics L04 moved to 06:00 PM today', time: '2h ago', isNew: true },
  { id: 'bn2', title: 'Part Test 03 (Kinematics + Units) scheduled for Sunday, 10:00 AM', time: '1d ago', isNew: true },
  { id: 'bn3', title: 'Hardcopy Module 2 dispatched — track it from My Purchases', time: '2d ago', isNew: true },
  { id: 'bn4', title: 'Doubt room timings extended to 11:00 PM on weekdays', time: '5d ago', isNew: false },
];
