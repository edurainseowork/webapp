/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type MentorSubject = 'Physics' | 'Chemistry' | 'Mathematics';
export type Availability = 'today' | 'weekend' | 'next-week';

export interface Mentor {
  id: string;
  name: string;
  /** Short line under the name on the mentors list */
  credential: string;
  /** Longer line on the booking page */
  headline: string;
  subjects: MentorSubject[];
  /** Matched by the search box, e.g. "Moment of Inertia" */
  topics: string[];
  availability: Availability;
  online: boolean;
  sessionMinutes: number;
  focus: string;
  languages: string;
  /** Daily slot times, "hh:mm AM/PM" */
  times: string[];
  avatarTone: string;
}

export interface BookingDay {
  key: string;
  date: Date;
  weekday: string;
  dayOfMonth: string;
  month: string;
  isToday: boolean;
}

export interface BookingSlot {
  time: string;
  available: boolean;
}

/* ------------------------------------------------------------------ */
/*  Mentors                                                             */
/* ------------------------------------------------------------------ */

// TODO: replace with mentors from your backend
export const MENTORS: Mentor[] = [
  {
    id: 'shivankar-tiwari',
    name: 'Dr. Shivankar Tiwari',
    credential: 'IIT Bombay AIR 42',
    headline: 'AIR 42 IIT-JEE (Adv) • Physics Mentor @ IIT Bombay',
    subjects: ['Physics'],
    topics: ['Moment of Inertia', 'Rotational Dynamics', 'Electrostatics', 'Mechanics'],
    availability: 'today',
    online: true,
    sessionMinutes: 15,
    focus: 'Mechanics & Rotational Dynamics, Problem-Solving Speed, Mock Test Analysis',
    languages: 'Hinglish / English',
    times: ['05:30 PM', '06:30 PM', '08:00 PM', '09:00 PM'],
    avatarTone: 'from-[#0F3B42] to-[#0A262C]',
  },
  {
    id: 'ananya-roy',
    name: 'Dr. Ananya Roy',
    credential: 'IIT Kharagpur • Chemistry',
    headline: 'Chemistry Mentor • PhD, IIT Kharagpur',
    subjects: ['Chemistry'],
    topics: ['Organic Mechanisms', 'Chemical Bonding', 'Thermodynamics', 'Named Reactions'],
    availability: 'today',
    online: true,
    sessionMinutes: 15,
    focus: 'Organic Reaction Mechanisms, NCERT Inorganic Revision, Physical Chem Numericals',
    languages: 'English / Hindi',
    times: ['04:00 PM', '06:00 PM', '07:30 PM', '09:00 PM'],
    avatarTone: 'from-[#1F5F6E] to-[#164954]',
  },
  {
    id: 'gauransh',
    name: 'Dr Gauransh',
    credential: 'IIT Delhi AIR 156',
    headline: 'AIR 156 IIT-JEE (Adv) • Mathematics Mentor @ IIT Delhi',
    subjects: ['Mathematics'],
    topics: ['Calculus', 'Coordinate Geometry', 'Probability', 'Definite Integration'],
    availability: 'weekend',
    online: true,
    sessionMinutes: 30,
    focus: 'Calculus & Coordinate Geometry, Shortcut Techniques, Accuracy Under Time Pressure',
    languages: 'Hinglish / English',
    times: ['10:00 AM', '11:30 AM', '04:00 PM', '06:00 PM'],
    avatarTone: 'from-[#123D46] to-[#0C2B31]',
  },
  {
    id: 'priyanka',
    name: 'Priyanka',
    credential: 'AIIMS Delhi • NEET AIR 89',
    headline: 'NEET AIR 89 • Physics & Chemistry Mentor @ AIIMS Delhi',
    subjects: ['Physics', 'Chemistry'],
    topics: ['NEET Physics', 'Physical Chemistry', 'Revision Planning', 'Mock Test Strategy'],
    availability: 'today',
    online: true,
    sessionMinutes: 15,
    focus: 'NEET Pacing, Physics Numericals for Medical Aspirants, Revision Planning',
    languages: 'Hindi / English',
    times: ['05:00 PM', '06:30 PM', '08:00 PM', '09:30 PM'],
    avatarTone: 'from-[#1C4B52] to-[#123A40]',
  },
  {
    id: 'abhinav',
    name: 'Abhinav',
    credential: 'IIT Madras • JEE AIR 310',
    headline: 'AIR 310 IIT-JEE (Adv) • Mentor @ IIT Madras (CSE)',
    subjects: ['Mathematics', 'Physics'],
    topics: ['Vectors & 3D', 'Integration', 'Backlog Planning', 'Exam Temperament'],
    availability: 'next-week',
    online: true,
    sessionMinutes: 15,
    focus: 'Backlog Clearing Plans, Vectors & 3D, Exam-Day Temperament',
    languages: 'Hinglish / English',
    times: ['07:00 PM', '08:00 PM', '09:00 PM', '10:00 PM'],
    avatarTone: 'from-[#0B1F24] to-[#071417]',
  },
  {
    id: 'kabir-rana',
    name: 'Er. Kabir Rana',
    credential: 'IIT Bombay AIR 48',
    headline: 'AIR 48 IIT-JEE (Adv) • Senior Mentor @ IIT Bombay (EE)',
    subjects: ['Physics', 'Mathematics'],
    topics: ['JEE Pacing', 'Backlog Clearing', 'Mock Test Analysis', 'Electrodynamics'],
    availability: 'today',
    online: true,
    sessionMinutes: 15,
    focus: 'IIT-JEE / NEET Pacing, Backlog Clearing, Mock Test Analysis',
    languages: 'Hinglish / English / Hindi',
    times: ['06:00 PM', '07:00 PM', '08:30 PM', '09:15 PM'],
    avatarTone: 'from-[#174A56] to-[#0F3B42]',
  },
];

export const INITIAL_FAVORITES = ['abhinav'];

export const SUBJECT_FILTERS: ('All' | MentorSubject)[] = ['All', 'Physics', 'Chemistry', 'Mathematics'];

export const AVAILABILITY_LABELS: Record<Availability, { label: string; className: string; dot: string }> = {
  today: { label: 'Available Today', className: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  weekend: { label: 'Weekend Slots', className: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  'next-week': { label: 'Next Week', className: 'bg-red-50 text-red-600', dot: 'bg-red-500' },
};

export const getMentor = (id: string) => MENTORS.find((m) => m.id === id) ?? MENTORS[0];

export const initialsOf = (name: string) =>
  name
    .replace(/^(Dr|Er)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

/* ------------------------------------------------------------------ */
/*  Booking calendar                                                    */
/* ------------------------------------------------------------------ */

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** The next `count` days this mentor takes sessions on. */
export function getBookingDays(mentor: Mentor, count = 5, now = new Date()): BookingDay[] {
  const today = startOfDay(now);
  const days: BookingDay[] = [];
  for (let offset = 0; days.length < count && offset < 60; offset++) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    if (mentor.availability === 'weekend' && !isWeekend) continue;
    if (mentor.availability === 'next-week' && offset < 7) continue;
    days.push({
      key: `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
      date,
      weekday: date.toLocaleDateString('en-IN', { weekday: 'short' }),
      dayOfMonth: String(date.getDate()).padStart(2, '0'),
      month: date.toLocaleDateString('en-IN', { month: 'short' }),
      isToday: offset === 0,
    });
  }
  return days;
}

const slotDateTime = (day: Date, time: string) => {
  const [, hh, mm, meridiem] = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i) ?? [];
  let hours = Number(hh) % 12;
  if (meridiem?.toUpperCase() === 'PM') hours += 12;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, Number(mm));
};

/**
 * Slots for one day. Times already gone (or starting within 30 min) are unavailable.
 * TODO: replace the sample "already booked" pattern with real availability from your backend.
 */
export function getSlots(mentor: Mentor, day: BookingDay, dayIndex: number, now = new Date()): BookingSlot[] {
  const cutoff = now.getTime() + 30 * 60_000;
  return mentor.times.map((time, slotIndex) => {
    const alreadyBooked = (dayIndex * 7 + slotIndex * 3 + mentor.id.length + 3) % 5 === 0;
    const tooSoon = slotDateTime(day.date, time).getTime() < cutoff;
    return { time, available: !alreadyBooked && !tooSoon };
  });
}

export const formatBookingDate = (day: BookingDay) =>
  day.date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
