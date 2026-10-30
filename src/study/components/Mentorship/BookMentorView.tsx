import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowRight,
  Clock3,
  Target,
  Languages,
  Globe,
  CheckCircle2,
  BadgeCheck,
  CalendarCheck2,
  Video,
  MessageSquareText,
  Loader2,
  GraduationCap,
  AlertTriangle,
  RefreshCw,
  CalendarX2,
} from 'lucide-react';
import { SubPageHeader } from '../SubPageHeader';
import {
  bookSlot,
  errorText,
  fetchMentor,
  formatBookingDate,
  formatSlotTime,
  groupSlotsByDay,
  holdSlot,
  initialsOf,
  releaseSlot,
  type Mentor,
  type MentorBooking,
  type MentorSlot,
} from './mentorData';

const TOPIC_MAX = 100;
/** Re-read the slots this often, so times other students pick or book disappear */
const SLOT_REFRESH_MS = 15_000;

const countdown = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

interface BookMentorViewProps {
  mentorId: string;
  /** Card data from the list, shown while the full profile loads */
  initial?: Mentor;
  studentEmail: string;
  onBack: () => void;
  onExit: () => void;
  onBooked: (booking: MentorBooking) => void;
}

function StepTitle({ step, title, right }: { step: number; title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h3 className="flex items-center gap-2.5 text-base sm:text-lg font-semibold text-[#0B1C30]">
        <span className="w-6 h-6 rounded-full bg-[#0F3B42] text-white text-[11px] font-bold flex items-center justify-center shrink-0">{step}</span>
        {title}
      </h3>
      {right}
    </div>
  );
}

function MentorPhoto({ mentor }: { mentor: Mentor }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#EFE8E2] p-1.5 shadow-sm">
      {mentor.photo && !broken ? (
        <img src={mentor.photo} alt="" onError={() => setBroken(true)} className="w-full h-full rounded-full object-cover" />
      ) : (
        <div className="w-full h-full rounded-full bg-gradient-to-br from-[#CDEBE6] to-[#9FD6CC] text-[#0F3B42] text-xl sm:text-2xl font-bold flex items-center justify-center">
          {initialsOf(mentor.name)}
        </div>
      )}
    </div>
  );
}

export function BookMentorView({ mentorId, initial, studentEmail, onBack, onExit, onBooked }: BookMentorViewProps) {
  const [mentor, setMentor] = useState<Mentor | null>(initial ?? null);
  const [slots, setSlots] = useState<MentorSlot[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<number | null>(null);
  const [courseId, setCourseId] = useState<number | null>(initial?.courses[0]?.id ?? null);
  const [topic, setTopic] = useState('');
  const [topicError, setTopicError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<MentorBooking | null>(null);
  // 2-minute hold on the picked time, so another student can't book it meanwhile
  const [heldUntil, setHeldUntil] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);
  const [holdNote, setHoldNote] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const heldRef = useRef<number | null>(null); // slot this student holds, released on leaving

  const load = async () => {
    setLoadError(null);
    setSlots(null);
    try {
      const res = await fetchMentor(mentorId);
      setMentor(res.mentor);
      setSlots(res.slots);
      setCourseId((c) => (c && res.mentor.courses.some((x) => x.id === c) ? c : res.mentor.courses[0]?.id ?? null));
    } catch (err) {
      setLoadError(errorText(err, 'Could not load this mentor.'));
    }
  };

  useEffect(() => {
    void load();
  }, [mentorId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the slots current while choosing (others may pick or book a time)
  useEffect(() => {
    if (confirmed) return;
    const timer = window.setInterval(() => {
      fetchMentor(mentorId)
        .then((res) => setSlots(res.slots))
        .catch(() => undefined);
    }, SLOT_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [mentorId, confirmed]);

  // Leaving the page gives the held time back
  useEffect(
    () => () => {
      if (heldRef.current) releaseSlot(heldRef.current);
    },
    [],
  );

  // Countdown for the hold
  useEffect(() => {
    if (!heldUntil) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [heldUntil]);
  const holdLeft = heldUntil ? new Date(heldUntil).getTime() - now : 0;
  useEffect(() => {
    if (heldUntil && holdLeft <= 0) {
      setHeldUntil(null);
      heldRef.current = null;
      setHoldNote({ tone: 'info', text: 'Your 2-minute hold ended. Tap the time again to hold it, or book now if it is still free.' });
    }
  }, [heldUntil, holdLeft]);

  const days = useMemo(() => groupSlotsByDay(slots ?? []), [slots]);
  const day = days.find((d) => d.key === dayKey) ?? days.find((d) => d.slots.some((s) => s.available)) ?? days[0];
  const daySlots = day?.slots ?? [];
  const availableCount = daySlots.filter((s) => s.available).length;
  const selected = daySlots.find((s) => s.id === slotId && s.available) ?? null;

  // The picked time was booked or taken by someone else meanwhile
  useEffect(() => {
    if (slotId && slots && !slots.some((s) => s.id === slotId && s.available)) {
      setSlotId(null);
      setHeldUntil(null);
      heldRef.current = null;
      setHoldNote({ tone: 'error', text: 'That time was just taken by another student. Please pick another one.' });
    }
  }, [slots]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickSlot = async (slot: MentorSlot) => {
    if (!slot.available || holding) return;
    if (slot.id === slotId && heldUntil) return; // already held
    const previous = heldRef.current;
    setSlotId(slot.id);
    setHoldNote(null);
    setSubmitError(null);
    setHolding(true);
    try {
      const until = await holdSlot(slot.id); // the server also releases the previous hold
      heldRef.current = slot.id;
      setHeldUntil(until);
      setNow(Date.now());
    } catch (err) {
      if (previous && previous !== slot.id) heldRef.current = null;
      setSlotId(null);
      setHeldUntil(null);
      setHoldNote({ tone: 'error', text: errorText(err, 'Could not hold this time. Please pick another one.') });
      void fetchMentor(mentorId).then((res) => setSlots(res.slots)).catch(() => undefined);
    } finally {
      setHolding(false);
    }
  };

  const changeDay = (key: string) => {
    if (heldRef.current) releaseSlot(heldRef.current);
    heldRef.current = null;
    setHeldUntil(null);
    setHoldNote(null);
    setDayKey(key);
    setSlotId(null);
  };

  const handleSchedule = async () => {
    if (!selected || !mentor || isSubmitting) return;
    if (topic.trim().length < 3) {
      setTopicError('Tell your mentor what you would like to discuss.');
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const booking = await bookSlot({ slotId: selected.id, topic: topic.trim(), courseId });
      heldRef.current = null; // booked: nothing to give back
      setHeldUntil(null);
      setConfirmed(booking);
      onBooked(booking);
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, colors: ['#10B981', '#175A67', '#F59E0B'] });
    } catch (err) {
      setSubmitError(errorText(err, 'Could not book this slot. Please try again.'));
      void fetchMentor(mentorId).then((res) => setSlots(res.slots)).catch(() => undefined); // the slot may have just been taken
    } finally {
      setIsSubmitting(false);
    }
  };

  const name = mentor?.name ?? 'Mentor';
  const minutes = selected?.durationMinutes ?? mentor?.sessionMinutes ?? 30;
  const details = mentor
    ? [
        { icon: Clock3, text: `${mentor.sessionMinutes} Minutes Video Call (Google Meet)` },
        mentor.institute || mentor.achievement ? { icon: GraduationCap, text: [mentor.institute, mentor.achievement].filter(Boolean).join(' • ') } : null,
        mentor.about ? { icon: Target, text: mentor.about } : null,
        mentor.languages ? { icon: Languages, text: `Language: ${mentor.languages}` } : null,
        mentor.courses.length ? { icon: CalendarCheck2, text: `Mentor for: ${mentor.courses.map((c) => c.title).join(', ')}` } : null,
      ].filter((x): x is { icon: typeof Clock3; text: string } => !!x)
    : [];

  return (
    <div className="relative w-full rounded-[24px] overflow-hidden flex flex-col bg-[#DCEAE3] font-sans text-[#0B1C30] min-h-[calc(100vh-6rem)] shadow-sm">
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 pb-20">
        <SubPageHeader
          onBack={onBack}
          crumbs={[
            { label: 'Home', onClick: onExit },
            { label: 'Features', onClick: onExit },
            { label: '1 to 1 Mentorship', onClick: onBack },
            { label: `Book ${name}` },
          ]}
        />

        <div className="max-w-[1160px] mx-auto">
          {loadError && !mentor ? (
            <div className="bg-white rounded-3xl py-14 px-6 flex flex-col items-center text-center">
              <AlertTriangle className="w-6 h-6 text-amber-500 mb-2" />
              <p className="font-semibold">Couldn&apos;t load this mentor</p>
              <p className="text-xs text-slate-500 mt-1">{loadError}</p>
              <button onClick={() => void load()} className="mt-4 flex items-center gap-1.5 bg-[#0F3B42] text-white text-xs font-semibold px-4 py-2 rounded-lg">
                <RefreshCw className="w-3.5 h-3.5" /> Try again
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-3xl overflow-hidden grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] shadow-[0_12px_40px_rgba(11,28,32,0.06)]">
              {/* Mentor panel */}
              <aside className="bg-[#FAF5F1] p-6 sm:p-8">
                {mentor ? (
                  <>
                    <div className="flex items-start gap-4">
                      <div className="relative shrink-0">
                        <MentorPhoto mentor={mentor} />
                        {mentor.verified && (
                          <span className="absolute bottom-1 right-0 w-6 h-6 rounded-full bg-emerald-600 text-white ring-2 ring-white flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 pt-1">
                        <h2 className="text-lg sm:text-xl font-semibold">{mentor.name}</h2>
                        {mentor.headline && <p className="text-sm text-[#175A67] mt-1 leading-snug">{mentor.headline}</p>}
                        {mentor.verified && (
                          <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-semibold bg-[#DDEFEA] text-[#0F3B42] px-2.5 py-1 rounded-full">
                            <BadgeCheck className="w-3.5 h-3.5" />
                            Verified Mentor
                          </span>
                        )}
                      </div>
                    </div>

                    <ul className="mt-6 bg-white rounded-2xl p-4 space-y-3.5 shadow-[0_4px_16px_rgb(0,0,0,0.03)]">
                      {details.map((item) => (
                        <li key={item.text} className="flex items-start gap-3 text-xs text-slate-600 leading-relaxed">
                          <span className="w-7 h-7 rounded-lg bg-[#F4EDE7] text-[#0F3B42] flex items-center justify-center shrink-0">
                            <item.icon className="w-3.5 h-3.5" />
                          </span>
                          <span className="pt-1 whitespace-pre-line break-words min-w-0">{item.text}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <div className="animate-pulse flex items-start gap-4">
                    <div className="w-20 h-20 rounded-full bg-[#EFE8E2]" />
                    <div className="flex-1 space-y-2 pt-2">
                      <div className="h-4 w-1/2 rounded bg-slate-200" />
                      <div className="h-3 w-2/3 rounded bg-slate-100" />
                    </div>
                  </div>
                )}
              </aside>

              {/* Booking panel */}
              <section className="p-6 sm:p-8">
                {confirmed ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-8 animate-fadeIn">
                    <span className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <CalendarCheck2 className="w-8 h-8" />
                    </span>
                    <h3 className="text-xl font-semibold mt-4">Mentorship call scheduled!</h3>
                    <p className="text-sm text-slate-500 mt-1.5 max-w-sm">
                      You&apos;ll get the Google Meet link for your session with {name} on{' '}
                      <span className="font-semibold text-[#0B1C30]">{studentEmail || 'your registered email'}</span>.
                    </p>
                    <ul className="w-full max-w-sm mt-6 rounded-2xl bg-[#FAF5F1] p-4 space-y-3 text-left">
                      <li className="flex items-center gap-3 text-sm">
                        <CalendarCheck2 className="w-4 h-4 text-[#175A67] shrink-0" />
                        {formatBookingDate(confirmed.startsAt)} • {formatSlotTime(confirmed.startsAt)}
                      </li>
                      <li className="flex items-center gap-3 text-sm">
                        <Video className="w-4 h-4 text-[#175A67] shrink-0" />
                        {confirmed.durationMinutes} min Google Meet video call
                      </li>
                      <li className="flex items-start gap-3 text-sm">
                        <MessageSquareText className="w-4 h-4 text-[#175A67] shrink-0 mt-0.5" />
                        <span className="break-words min-w-0">{confirmed.topic}</span>
                      </li>
                    </ul>
                    <div className="w-full max-w-sm grid grid-cols-2 gap-3 mt-6">
                      <button onClick={onExit} className="py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm font-semibold transition-colors">
                        Go to Home
                      </button>
                      <button onClick={onBack} className="py-3 rounded-xl bg-[#0F3B42] hover:bg-[#0b2c31] text-white text-sm font-semibold transition-colors">
                        Back to Mentors
                      </button>
                    </div>
                  </div>
                ) : slots === null ? (
                  <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading available slots">
                    <div className="h-5 w-40 rounded bg-slate-200" />
                    <div className="grid grid-cols-5 gap-2">
                      {Array.from({ length: 5 }, (_, i) => <div key={i} className="h-16 rounded-xl bg-[#F4EDE7]" />)}
                    </div>
                    <div className="h-5 w-48 rounded bg-slate-200" />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-11 rounded-xl bg-[#F4EDE7]" />)}
                    </div>
                  </div>
                ) : days.length === 0 || !days.some((d) => d.slots.some((s) => s.available)) ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-10">
                    <CalendarX2 className="w-8 h-8 text-slate-400" />
                    <h3 className="text-lg font-semibold mt-3">No open slots right now</h3>
                    <p className="text-sm text-slate-500 mt-1 max-w-sm">
                      {name} hasn&apos;t opened any session times for the next 30 days. Please check back soon or choose another mentor.
                    </p>
                    <button onClick={onBack} className="mt-5 py-2.5 px-5 rounded-xl bg-[#0F3B42] hover:bg-[#0b2c31] text-white text-sm font-semibold">
                      Back to Mentors
                    </button>
                  </div>
                ) : (
                  <div className="space-y-7">
                    {/* Step 1: date */}
                    <div>
                      <StepTitle
                        step={1}
                        title="Select a Date"
                        right={
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-[#175A67] whitespace-nowrap">
                            <Globe className="w-3.5 h-3.5" />
                            IST (GMT+5:30)
                          </span>
                        }
                      />
                      <div className="flex gap-2 sm:gap-2.5 pt-2 overflow-x-auto no-scrollbar">
                        {days.map((d) => {
                          const active = d.key === day?.key;
                          const free = d.slots.some((s) => s.available);
                          return (
                            <button
                              key={d.key}
                              onClick={() => changeDay(d.key)}
                              disabled={!free}
                              className={`relative shrink-0 w-[calc(20%-0.4rem)] min-w-[64px] rounded-xl py-3 text-center transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                active ? 'bg-[#0F3B42] text-white shadow-md' : 'bg-[#F4EDE7] hover:bg-[#EDE3DA] text-[#0B1C30]'
                              }`}
                            >
                              {d.isToday && (
                                <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] font-bold uppercase tracking-wider bg-amber-400 text-[#0B1C30] px-1.5 py-0.5 rounded-full">
                                  Today
                                </span>
                              )}
                              <span className={`block text-[11px] font-medium ${active ? 'text-white/70' : 'text-slate-600'}`}>{d.weekday}</span>
                              <span className="block text-lg sm:text-xl font-semibold leading-tight">{d.dayOfMonth}</span>
                              <span className={`block text-[10px] ${active ? 'text-white/60' : 'text-slate-500'}`}>{d.month}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Step 2: time */}
                    <div>
                      <StepTitle
                        step={2}
                        title="Select a Time Slot"
                        right={<span className="text-[11px] text-slate-500 whitespace-nowrap">{availableCount} slot{availableCount === 1 ? '' : 's'} available</span>}
                      />
                      {availableCount === 0 ? (
                        <p className="text-sm text-slate-500 bg-[#FAF5F1] rounded-xl px-4 py-3">All slots are taken for this day. Please pick another date.</p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {daySlots.map((slot) => {
                            const active = slot.id === selected?.id;
                            return (
                              <button
                                key={slot.id}
                                onClick={() => void pickSlot(slot)}
                                disabled={!slot.available || holding}
                                aria-pressed={active}
                                title={slot.available ? `${slot.durationMinutes} min — tap to hold it for 2 minutes` : slot.held ? 'Another student is booking this time' : 'Already booked'}
                                className={`flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-medium transition-all ${
                                  slot.held
                                    ? 'bg-amber-50 text-amber-400 cursor-not-allowed'
                                    : !slot.available
                                    ? 'bg-slate-50 text-slate-300 line-through cursor-not-allowed'
                                    : active
                                    ? 'bg-[#DDEFEA] text-[#0B1C30] ring-1 ring-[#175A67]/30'
                                    : 'bg-[#F4EDE7] hover:bg-[#EDE3DA] text-[#0B1C30]'
                                }`}
                              >
                                {active && holding ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : active ? (
                                  <CheckCircle2 className="w-4 h-4 text-white fill-[#0F3B42]" />
                                ) : (
                                  <Clock3 className="w-4 h-4" />
                                )}
                                {formatSlotTime(slot.startsAt)}
                                {slot.held && <span className="text-[10px] font-semibold">· held</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {heldUntil && holdLeft > 0 ? (
                        <p className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-700" role="status">
                          <Clock3 className="w-3.5 h-3.5" />
                          This time is held for you for {countdown(holdLeft)} — finish booking before it ends.
                        </p>
                      ) : holdNote ? (
                        <p className={`mt-2.5 flex items-center gap-1.5 text-xs font-semibold ${holdNote.tone === 'error' ? 'text-red-600' : 'text-[#175A67]'}`} role={holdNote.tone === 'error' ? 'alert' : 'status'}>
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          {holdNote.text}
                        </p>
                      ) : availableCount > 0 && !selected ? (
                        <p className="mt-2.5 text-[11px] text-slate-500">Tap a time to hold it for 2 minutes while you book.</p>
                      ) : null}
                    </div>

                    {/* Step 3: topic */}
                    <div>
                      <StepTitle
                        step={3}
                        title="What topic would you like to discuss?"
                        right={<span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">{topic.length} / {TOPIC_MAX} characters</span>}
                      />
                      {mentor && mentor.courses.length > 1 && (
                        <select
                          value={courseId ?? ''}
                          onChange={(e) => setCourseId(Number(e.target.value) || null)}
                          aria-label="Course"
                          className="w-full mb-2.5 px-4 py-3 rounded-xl text-sm bg-[#F8F1EC] border border-transparent focus:outline-none focus:border-[#175A67] focus:ring-4 focus:ring-[#175A67]/10"
                        >
                          {mentor.courses.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.title}
                            </option>
                          ))}
                        </select>
                      )}
                      <input
                        value={topic}
                        onChange={(e) => {
                          setTopic(e.target.value.slice(0, TOPIC_MAX));
                          if (topicError) setTopicError(null);
                        }}
                        placeholder="Currently in Class 12 preparing for JEE"
                        aria-invalid={!!topicError}
                        className={`w-full px-4 py-3 rounded-xl text-sm placeholder-slate-500 border focus:outline-none focus:bg-white focus:ring-4 transition-all ${
                          topicError ? 'bg-red-50/50 border-red-300 focus:border-red-400 focus:ring-red-100' : 'bg-[#F8F1EC] border-transparent focus:border-[#175A67] focus:ring-[#175A67]/10'
                        }`}
                      />
                      {topicError && <p className="text-[11px] font-medium text-red-500 mt-1.5">{topicError}</p>}
                    </div>

                    {submitError && (
                      <p role="alert" className="flex items-center gap-1.5 text-xs font-semibold text-red-600 -mb-3">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        {submitError}
                      </p>
                    )}
                    <button
                      onClick={handleSchedule}
                      disabled={!selected || isSubmitting}
                      className="w-full flex items-center justify-center gap-2 bg-[#0F3B42] hover:bg-[#0b2c31] text-white text-sm font-semibold py-4 rounded-xl shadow-md transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Scheduling…
                        </>
                      ) : (
                        <>
                          Schedule Mentorship Call
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                    {selected && day && (
                      <p className="text-center text-[11px] text-slate-500 -mt-4">
                        {formatBookingDate(day.date)} • {formatSlotTime(selected.startsAt)} • {minutes} min with {name}
                      </p>
                    )}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BookMentorView;