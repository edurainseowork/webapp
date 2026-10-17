import { useMemo, useState, type ReactNode } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
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
} from 'lucide-react';
import { SubPageHeader } from '../SubPageHeader';
import { Mentor, formatBookingDate, getBookingDays, getSlots, initialsOf } from './mentorData';

const TOPIC_MAX = 100;

export interface MentorBooking {
  mentorId: string;
  dateLabel: string;
  time: string;
  topic: string;
}

interface BookMentorViewProps {
  mentor: Mentor;
  studentEmail: string;
  onBack: () => void;
  onExit: () => void;
  onBooked: (booking: MentorBooking) => void;
}

function StepTitle({ step, title, right }: { step: number; title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h3 className="flex items-center gap-2.5 text-base sm:text-lg font-semibold text-[#0B1C30]">
        <span className="w-6 h-6 rounded-full bg-[#0F3B42] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
          {step}
        </span>
        {title}
      </h3>
      {right}
    </div>
  );
}

export function BookMentorView({ mentor, studentEmail, onBack, onExit, onBooked }: BookMentorViewProps) {
  const days = useMemo(() => getBookingDays(mentor), [mentor]);
  const [dayIndex, setDayIndex] = useState(0);
  const slots = useMemo(() => getSlots(mentor, days[dayIndex], dayIndex), [mentor, days, dayIndex]);
  const [time, setTime] = useState<string | null>(() => slots.find((s) => s.available)?.time ?? null);
  const [topic, setTopic] = useState('');
  const [topicError, setTopicError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<MentorBooking | null>(null);

  const availableCount = slots.filter((s) => s.available).length;
  const day = days[dayIndex];

  const selectDay = (index: number) => {
    setDayIndex(index);
    // Keep the chosen time if it is still free on the new day, otherwise pick the first free one
    const nextSlots = getSlots(mentor, days[index], index);
    setTime((current) =>
      nextSlots.some((s) => s.available && s.time === current) ? current : nextSlots.find((s) => s.available)?.time ?? null
    );
  };

  const handleSchedule = async () => {
    if (!time) return;
    if (topic.trim().length < 3) {
      setTopicError('Tell your mentor what you would like to discuss.');
      return;
    }
    setIsSubmitting(true);
    // TODO: send the booking to your backend here (mentorId, date, time, topic)
    await new Promise((resolve) => setTimeout(resolve, 900));
    const booking: MentorBooking = { mentorId: mentor.id, dateLabel: formatBookingDate(day), time, topic: topic.trim() };
    setIsSubmitting(false);
    setConfirmed(booking);
    onBooked(booking);
    confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, colors: ['#10B981', '#175A67', '#F59E0B'] });
  };

  return (
    <div className="relative w-full rounded-[24px] overflow-hidden flex flex-col bg-[#DCEAE3] font-sans text-[#0B1C30] min-h-[calc(100vh-6rem)] shadow-sm">
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 pb-20">
        <SubPageHeader
          onBack={onBack}
          crumbs={[
            { label: 'Home', onClick: onExit },
            { label: 'Features', onClick: onExit },
            { label: '1 to 1 Mentorship', onClick: onBack },
            { label: `Book ${mentor.name}` },
          ]}
        />

        <div className="max-w-[1160px] mx-auto">
          <div className="bg-white rounded-3xl overflow-hidden grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] shadow-[0_12px_40px_rgba(11,28,32,0.06)]">
            {/* ------------------------------------------------------ */}
            {/* Mentor panel                                            */}
            {/* ------------------------------------------------------ */}
            <aside className="bg-[#FAF5F1] p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#EFE8E2] p-1.5 shadow-sm">
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-[#CDEBE6] to-[#9FD6CC] text-[#0F3B42] text-xl sm:text-2xl font-bold flex items-center justify-center">
                      {initialsOf(mentor.name)}
                    </div>
                  </div>
                  <span className="absolute bottom-1 right-0 w-6 h-6 rounded-full bg-emerald-600 text-white ring-2 ring-white flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </span>
                </div>
                <div className="min-w-0 pt-1">
                  <h2 className="text-lg sm:text-xl font-semibold">{mentor.name}</h2>
                  <p className="text-sm text-[#175A67] mt-1 leading-snug">{mentor.headline}</p>
                  <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-semibold bg-[#DDEFEA] text-[#0F3B42] px-2.5 py-1 rounded-full">
                    <BadgeCheck className="w-3.5 h-3.5" />
                    Verified Ranker Mentor
                  </span>
                </div>
              </div>

              <ul className="mt-6 bg-white rounded-2xl p-4 space-y-3.5 shadow-[0_4px_16px_rgb(0,0,0,0.03)]">
                {[
                  { icon: Clock3, text: `${mentor.sessionMinutes} Minutes Video Call (Google Meet)` },
                  { icon: Target, text: `Focus: ${mentor.focus}` },
                  { icon: Languages, text: `Language: ${mentor.languages}` },
                ].map((item) => (
                  <li key={item.text} className="flex items-start gap-3 text-xs text-slate-600 leading-relaxed">
                    <span className="w-7 h-7 rounded-lg bg-[#F4EDE7] text-[#0F3B42] flex items-center justify-center shrink-0">
                      <item.icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="pt-1">{item.text}</span>
                  </li>
                ))}
              </ul>
            </aside>

            {/* ------------------------------------------------------ */}
            {/* Booking panel                                           */}
            {/* ------------------------------------------------------ */}
            <section className="p-6 sm:p-8">
              {confirmed ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-8 animate-fadeIn">
                  <span className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CalendarCheck2 className="w-8 h-8" />
                  </span>
                  <h3 className="text-xl font-semibold mt-4">Mentorship call scheduled!</h3>
                  <p className="text-sm text-slate-500 mt-1.5 max-w-sm">
                    You&apos;ll get the Google Meet link for your session with {mentor.name} on{' '}
                    <span className="font-semibold text-[#0B1C30]">{studentEmail || 'your registered email'}</span>.
                  </p>

                  <ul className="w-full max-w-sm mt-6 rounded-2xl bg-[#FAF5F1] p-4 space-y-3 text-left">
                    <li className="flex items-center gap-3 text-sm">
                      <CalendarCheck2 className="w-4 h-4 text-[#175A67] shrink-0" />
                      {confirmed.dateLabel} • {confirmed.time}
                    </li>
                    <li className="flex items-center gap-3 text-sm">
                      <Video className="w-4 h-4 text-[#175A67] shrink-0" />
                      {mentor.sessionMinutes} min Google Meet video call
                    </li>
                    <li className="flex items-start gap-3 text-sm">
                      <MessageSquareText className="w-4 h-4 text-[#175A67] shrink-0 mt-0.5" />
                      <span className="break-words min-w-0">{confirmed.topic}</span>
                    </li>
                  </ul>

                  <div className="w-full max-w-sm grid grid-cols-2 gap-3 mt-6">
                    <button
                      onClick={onExit}
                      className="py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm font-semibold transition-colors"
                    >
                      Go to Home
                    </button>
                    <button
                      onClick={onBack}
                      className="py-3 rounded-xl bg-[#0F3B42] hover:bg-[#0b2c31] text-white text-sm font-semibold transition-colors"
                    >
                      Back to Mentors
                    </button>
                  </div>
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
                    <div className="grid grid-cols-5 gap-2 sm:gap-2.5 pt-2">
                      {days.map((d, index) => {
                        const active = index === dayIndex;
                        return (
                          <button
                            key={d.key}
                            onClick={() => selectDay(index)}
                            className={`relative rounded-xl py-3 text-center transition-all ${
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
                      right={
                        <span className="text-[11px] text-slate-500 whitespace-nowrap">
                          {availableCount} slot{availableCount === 1 ? '' : 's'} available
                        </span>
                      }
                    />
                    {availableCount === 0 ? (
                      <p className="text-sm text-slate-500 bg-[#FAF5F1] rounded-xl px-4 py-3">
                        All slots are taken for this day. Please pick another date.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {slots.map((slot) => {
                          const active = slot.time === time;
                          return (
                            <button
                              key={slot.time}
                              onClick={() => slot.available && setTime(slot.time)}
                              disabled={!slot.available}
                              title={slot.available ? undefined : 'Not available'}
                              className={`flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-medium transition-all ${
                                !slot.available
                                  ? 'bg-slate-50 text-slate-300 line-through cursor-not-allowed'
                                  : active
                                  ? 'bg-[#DDEFEA] text-[#0B1C30] ring-1 ring-[#175A67]/30'
                                  : 'bg-[#F4EDE7] hover:bg-[#EDE3DA] text-[#0B1C30]'
                              }`}
                            >
                              {active ? (
                                <CheckCircle2 className="w-4 h-4 text-white fill-[#0F3B42]" />
                              ) : (
                                <Clock3 className="w-4 h-4" />
                              )}
                              {slot.time}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Step 3: topic */}
                  <div>
                    <StepTitle
                      step={3}
                      title="What topic would you like to discuss?"
                      right={
                        <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                          {topic.length} / {TOPIC_MAX} characters
                        </span>
                      }
                    />
                    <input
                      value={topic}
                      onChange={(e) => {
                        setTopic(e.target.value.slice(0, TOPIC_MAX));
                        if (topicError) setTopicError(null);
                      }}
                      placeholder="Currently in Class 12 preparing for JEE"
                      aria-invalid={!!topicError}
                      className={`w-full px-4 py-3 rounded-xl text-sm placeholder-slate-500 border focus:outline-none focus:bg-white focus:ring-4 transition-all ${
                        topicError
                          ? 'bg-red-50/50 border-red-300 focus:border-red-400 focus:ring-red-100'
                          : 'bg-[#F8F1EC] border-transparent focus:border-[#175A67] focus:ring-[#175A67]/10'
                      }`}
                    />
                    {topicError && <p className="text-[11px] font-medium text-red-500 mt-1.5">{topicError}</p>}
                  </div>

                  <button
                    onClick={handleSchedule}
                    disabled={!time || isSubmitting}
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
                  {time && (
                    <p className="text-center text-[11px] text-slate-500 -mt-4">
                      {formatBookingDate(day)} • {time} • {mentor.sessionMinutes} min with {mentor.name}
                    </p>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BookMentorView;
