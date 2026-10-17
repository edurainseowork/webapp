import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Users,
  Star,
  Video,
  Headphones,
  Clock3,
  ShieldCheck,
  UploadCloud,
  Paperclip,
  ArrowRight,
  Calendar,
  User,
} from 'lucide-react';
import { SubPageHeader } from './SubPageHeader';

/* ------------------------------------------------------------------ */
/*  Types & mock data                                                  */
/* ------------------------------------------------------------------ */

type SessionFormat = 'video' | 'audio';
type Duration = 15 | 30 | 45;
type SlotFilter = 'all' | 'morning' | 'afternoon' | 'evening';

interface DayOption {
  day: string;
  date: number;
  slots: number | null;
  disabled?: boolean;
}

interface TimeSlot {
  time: string;
  period: 'morning' | 'afternoon' | 'evening';
  full?: boolean;
}

const DAYS: DayOption[] = [
  { day: 'MON', date: 26, slots: 6 },
  { day: 'TUE', date: 27, slots: 8 },
  { day: 'WED', date: 28, slots: 4 },
  { day: 'THU', date: 29, slots: 5 },
  { day: 'FRI', date: 30, slots: 3 },
  { day: 'SAT', date: 31, slots: null, disabled: true },
];

const TIME_SLOTS: TimeSlot[] = [
  { time: '09:30 AM', period: 'morning' },
  { time: '11:00 AM', period: 'morning' },
  { time: '01:30 PM', period: 'afternoon' },
  { time: '03:30 PM', period: 'afternoon' },
  { time: '05:00 PM', period: 'afternoon' },
  { time: '06:30 PM', period: 'evening' },
  { time: '08:00 PM', period: 'evening', full: true },
  { time: '09:00 PM', period: 'evening', full: true },
];

const DURATION_OPTIONS: { value: Duration; label: string; sub: string; pts: number }[] = [
  { value: 15, label: '15 Mins', sub: 'Quick Doubt', pts: 40 },
  { value: 30, label: '30 Mins', sub: 'Standard Doubt', pts: 75 },
  { value: 45, label: '45 Mins', sub: 'Deep Dive', pts: 110 },
];

const SLOT_FILTERS: { id: SlotFilter; label: string }[] = [
  { id: 'all', label: 'All Slots' },
  { id: 'morning', label: 'Morning (9am - 12pm)' },
  { id: 'afternoon', label: 'Afternoon (12pm - 4pm)' },
  { id: 'evening', label: 'Evening (4pm - 9pm)' },
];

interface BookDoubtSessionViewProps {
  onBack: () => void;
  onConfirmBooking?: (summary: {
    mentor: string;
    date: string;
    time: string;
    duration: Duration;
    format: SessionFormat;
    topic: string;
  }) => void;
  onOpenMySessions?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Main view                                                           */
/* ------------------------------------------------------------------ */

export function BookDoubtSessionView({ onBack, onConfirmBooking, onOpenMySessions }: BookDoubtSessionViewProps) {
  const [sessionFormat, setSessionFormat] = useState<SessionFormat>('video');
  const [duration, setDuration] = useState<Duration>(30);
  const [selectedDate, setSelectedDate] = useState<number>(26);
  const [slotFilter, setSlotFilter] = useState<SlotFilter>('all');
  const [selectedTime, setSelectedTime] = useState<string>('03:30 PM');
  const [doubtTitle, setDoubtTitle] = useState('Next.js 14 App Router Server Component hydration error with localStorage');
  const [doubtDescription, setDoubtDescription] = useState(
    "Getting 'Text content did not match server-rendered HTML' specifically when rendering the client theme toggle wrapped in context. Checked useEffect guards, but re-render cascades continue."
  );
  const [attachedFile, setAttachedFile] = useState<string | null>('stack-trace.log (14.2 KB)');
  const [sendInvite, setSendInvite] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const selectedDay = DAYS.find((d) => d.date === selectedDate) ?? DAYS[0];

  const filteredSlots = useMemo(() => {
    if (slotFilter === 'all') return TIME_SLOTS;
    return TIME_SLOTS.filter((s) => s.period === slotFilter);
  }, [slotFilter]);

  const flashToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const handleConfirm = () => {
    const summary = {
      mentor: 'Er. Kabir Rana',
      date: `${selectedDay.day.charAt(0)}${selectedDay.day.slice(1).toLowerCase()}, ${selectedDate} Oct`,
      time: selectedTime,
      duration,
      format: sessionFormat,
      topic: doubtTitle,
    };
    onConfirmBooking?.(summary);
    flashToast('Slot confirmed! Calendar invite & meeting link on the way.');
  };

  const formattedDate = `${selectedDay.day.charAt(0)}${selectedDay.day.slice(1).toLowerCase()}, ${selectedDate} Oct`;

  return (
    <div className="relative w-full rounded-[24px] overflow-hidden flex flex-col bg-[#DCEAE3] font-sans min-h-[calc(100vh-6rem)] shadow-sm">
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 pb-28">
        {/* 1. Standardized Back Button + Breadcrumb */}
        <SubPageHeader
          onBack={onBack}
          crumbs={[
            { label: 'Home', onClick: onBack },
            { label: 'Features', onClick: onBack },
            { label: 'Ask Your Doubt' },
          ]}
          rightElement={
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => flashToast('Opening booking calendar…')}
                className="hidden sm:flex items-center bg-[#0F3B42] hover:bg-[#0b2c31] text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all active:scale-95 shadow-sm"
              >
                Book a Session
              </button>
              <button
                onClick={onOpenMySessions}
                className="flex items-center gap-1.5 bg-white hover:bg-[#EAF3F1] text-[#175A67] border border-[#175A67]/15 font-bold text-xs px-3.5 py-2 rounded-xl transition-all active:scale-95 shadow-sm"
              >
                My Sessions
                <span className="w-4 h-4 rounded-full bg-[#0F3B42] text-white text-[10px] font-bold flex items-center justify-center">2</span>
              </button>
            </div>
          }
        />

        <h1 className="text-2xl sm:text-3xl font-black text-[#0B1C30] mb-5">Schedule Your 1:1 Live Doubts Session</h1>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_1fr] gap-5 items-start">
          {/* ------------------------------------------------------ */}
          {/* Left column                                             */}
          {/* ------------------------------------------------------ */}
          <div className="space-y-5">
            {/* Mentor card */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-[0_6px_24px_rgb(0,0,0,0.05)]">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-[#0F3B42] text-white flex items-center justify-center font-black text-sm shrink-0">
                    KR
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-[#0B1C30] text-sm truncate">Er. Kabir Rana</p>
                    <p className="text-[11px] text-[#70787C] font-medium truncate">IIT Delhi Alumni &bull; AIR 48 Gate CSE</p>
                  </div>
                </div>
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full shrink-0 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Available for Instant Booking
                </span>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-[#175A67]/10">
                <span className="flex items-center gap-1 text-xs font-bold text-[#0B1C30]">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  4.9 <span className="text-[#70787C] font-medium">(184 reviews)</span>
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Top 1% Mentor</span>
              </div>
            </div>

            {/* Step 1: Session format */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-[0_6px_24px_rgb(0,0,0,0.05)]">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#0F3B42] text-white text-[10px] font-bold flex items-center justify-center">1</span>
                  <h3 className="text-sm font-bold text-[#0B1C30]">Choose Session Format</h3>
                </div>
                <span className="text-[10px] font-bold text-[#0F766E]">Live 1:1 Environment</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSessionFormat('video')}
                  className={`relative rounded-xl p-3.5 border-2 text-left transition-all ${
                    sessionFormat === 'video' ? 'border-[#0F3B42] bg-[#0F3B42]/5' : 'border-[#175A67]/10 hover:border-[#175A67]/25'
                  }`}
                >
                  {sessionFormat === 'video' && (
                    <span className="absolute top-2.5 right-2.5 text-[9px] font-bold bg-[#0F3B42] text-white px-1.5 py-0.5 rounded-full">
                      Selected &#10003;
                    </span>
                  )}
                  <div className="w-8 h-8 rounded-lg bg-[#0F3B42] text-white flex items-center justify-center mb-3">
                    <Video className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-bold text-[#0B1C30]">Video Call</p>
                  <span className="inline-block mt-1.5 text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                    MOST POPULAR
                  </span>
                </button>

                <button
                  onClick={() => setSessionFormat('audio')}
                  className={`rounded-xl p-3.5 border-2 text-left transition-all ${
                    sessionFormat === 'audio' ? 'border-[#0F3B42] bg-[#0F3B42]/5' : 'border-[#175A67]/10 hover:border-[#175A67]/25'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-[#EAF3F1] text-[#175A67] flex items-center justify-center mb-3">
                    <Headphones className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-bold text-[#0B1C30]">Audio Call</p>
                  <p className="mt-1.5 text-[10px] text-[#70787C] font-medium">Fast connection</p>
                </button>
              </div>
            </div>

            {/* Step 2: Duration */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-[0_6px_24px_rgb(0,0,0,0.05)]">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#0F3B42] text-white text-[10px] font-bold flex items-center justify-center">2</span>
                  <h3 className="text-sm font-bold text-[#0B1C30]">Select Duration</h3>
                </div>
                <span className="text-[10px] font-semibold text-[#70787C]">Extendable during call</span>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {DURATION_OPTIONS.map((opt) => {
                  const isSelected = duration === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setDuration(opt.value)}
                      className={`rounded-xl p-3 text-center border-2 transition-all ${
                        isSelected ? 'bg-[#0F3B42] border-[#0F3B42]' : 'bg-white border-[#175A67]/10 hover:border-[#175A67]/25'
                      }`}
                    >
                      <p className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-[#0B1C30]'}`}>{opt.label}</p>
                      <p className={`text-[10px] font-medium mt-0.5 ${isSelected ? 'text-white/70' : 'text-[#70787C]'}`}>{opt.sub}</p>
                      <span
                        className={`inline-block mt-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          isSelected ? 'bg-amber-400 text-slate-900' : 'bg-[#EAF3F1] text-[#175A67]'
                        }`}
                      >
                        {opt.pts} pts
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------ */}
          {/* Right column                                            */}
          {/* ------------------------------------------------------ */}
          <div className="space-y-5">
            {/* Step 3: Date & time */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-[0_6px_24px_rgb(0,0,0,0.05)]">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#0F3B42] text-white text-[10px] font-bold flex items-center justify-center">3</span>
                  <h3 className="text-sm font-bold text-[#0B1C30]">Pick Date &amp; Time Slot</h3>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-[#175A67]">
                  <button onClick={() => flashToast('Showing September 2026')} className="p-1 hover:bg-[#EAF3F1] rounded-md transition-colors">
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span>October 2026</span>
                  <button onClick={() => flashToast('Showing November 2026')} className="p-1 hover:bg-[#EAF3F1] rounded-md transition-colors">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Day strip */}
              <div className="grid grid-cols-6 gap-2 mb-4">
                {DAYS.map((d) => {
                  const isSelected = selectedDate === d.date;
                  return (
                    <button
                      key={d.date}
                      onClick={() => !d.disabled && setSelectedDate(d.date)}
                      disabled={d.disabled}
                      className={`rounded-xl py-2.5 text-center border transition-all ${
                        d.disabled
                          ? 'bg-[#F5F7F6] border-transparent text-[#B8C0BE] cursor-not-allowed'
                          : isSelected
                          ? 'bg-[#0F3B42] border-[#0F3B42] text-white'
                          : 'bg-white border-[#175A67]/10 text-[#0B1C30] hover:border-[#175A67]/25'
                      }`}
                    >
                      <p className="text-[9px] font-bold uppercase tracking-wide opacity-70">{d.day}</p>
                      <p className="text-sm font-black mt-0.5">{d.date}</p>
                      <p className={`text-[9px] font-semibold mt-0.5 ${isSelected ? 'text-emerald-300' : 'text-[#70787C]'}`}>
                        {d.disabled ? 'Leave' : `${d.slots} slots`}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Filter pills */}
              <div className="flex flex-wrap items-center gap-2 mb-3.5">
                {SLOT_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSlotFilter(f.id)}
                    className={`text-[11px] font-bold px-3 py-1.5 rounded-full transition-all ${
                      slotFilter === f.id ? 'bg-[#0F3B42] text-white' : 'bg-[#EAF3F1] text-[#175A67] hover:bg-[#dcece7]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Time slots */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {filteredSlots.map((slot) => {
                  const isSelected = selectedTime === slot.time;
                  return (
                    <button
                      key={slot.time}
                      onClick={() => !slot.full && setSelectedTime(slot.time)}
                      disabled={slot.full}
                      className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold border transition-all ${
                        slot.full
                          ? 'bg-[#F5F7F6] border-transparent text-[#B8C0BE] cursor-not-allowed'
                          : isSelected
                          ? 'bg-[#0F3B42] border-[#0F3B42] text-white'
                          : 'bg-white border-[#175A67]/10 text-[#0B1C30] hover:border-[#175A67]/25'
                      }`}
                    >
                      {isSelected && <span>&#10003;</span>}
                      {slot.full ? `${slot.time} (Full)` : slot.time}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2 mt-4 pt-3.5 border-t border-[#175A67]/10 text-[11px]">
                <span className="flex items-center gap-1.5 text-[#70787C] font-medium">
                  <Clock3 className="w-3.5 h-3.5" />
                  IST (UTC +5:30) &bull; Calculated automatically
                </span>
                <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  100% on-time guarantee
                </span>
              </div>
            </div>

            {/* Step 4: Doubt context */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-[0_6px_24px_rgb(0,0,0,0.05)]">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#0F3B42] text-white text-[10px] font-bold flex items-center justify-center">4</span>
                  <h3 className="text-sm font-bold text-[#0B1C30]">Doubt Context &amp; Details</h3>
                </div>
                <span className="text-[10px] font-bold text-[#0F766E]">Helps mentor prepare early</span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-[#40484B]">
                    Doubt Topic / Concept Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={doubtTitle}
                    onChange={(e) => setDoubtTitle(e.target.value)}
                    className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#175A67]/15 text-xs sm:text-sm text-[#0B1C30] focus:outline-none focus:border-[#175A67]/40 focus:ring-2 focus:ring-[#175A67]/10"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-[#40484B]">
                      Describe what you've tried &amp; where you're stuck <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[10px] text-[#70787C] font-semibold">{doubtDescription.length} / 500 chars</span>
                  </div>
                  <textarea
                    value={doubtDescription}
                    onChange={(e) => setDoubtDescription(e.target.value.slice(0, 500))}
                    rows={3}
                    className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#175A67]/15 text-xs sm:text-sm text-[#0B1C30] leading-relaxed resize-none focus:outline-none focus:border-[#175A67]/40 focus:ring-2 focus:ring-[#175A67]/10"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#40484B]">Attachments (Screenshots, Logs, or GitHub repo URL)</label>
                  <label className="mt-1.5 flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-[#175A67]/20 rounded-xl px-4 py-5 cursor-pointer hover:border-[#175A67]/40 hover:bg-[#F8FAFC] transition-all text-center">
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setAttachedFile(`${f.name} (${(f.size / 1024).toFixed(1)} KB)`);
                      }}
                    />
                    <UploadCloud className="w-5 h-5 text-[#175A67]" />
                    <p className="text-xs text-[#40484B] font-medium">
                      Drop PDF, PNG, code snippet up to 10MB or <span className="text-[#175A67] font-bold underline">browse files</span>
                    </p>
                    {attachedFile && (
                      <p className="flex items-center gap-1 text-[11px] text-[#0F766E] font-semibold mt-0.5">
                        <Paperclip className="w-3 h-3" />
                        Attached: {attachedFile}
                      </p>
                    )}
                  </label>
                </div>

                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-[#40484B]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    Send instant meeting link &amp; calendar invite to WhatsApp &amp; Email
                  </span>
                  <button
                    type="button"
                    onClick={() => setSendInvite((v) => !v)}
                    className={`relative w-[38px] h-[22px] rounded-full transition-colors shrink-0 ${
                      sendInvite ? 'bg-[#0F3B42]' : 'bg-[#D8E2E0]'
                    }`}
                  >
                    <span
                      className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                        sendInvite ? 'translate-x-[19px]' : 'translate-x-[3px]'
                      }`}
                    />
                  </button>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------- */}
      {/* Sticky booking summary bar                                  */}
      {/* ---------------------------------------------------------- */}
      <div className="shrink-0 px-4 sm:px-6 lg:px-8 pb-4 sm:pb-5">
        <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 text-xs font-bold text-[#0B1C30] shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Booking Summary:
              </span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-[#175A67] bg-[#EAF3F1] px-2.5 py-1 rounded-full">
                <User className="w-3 h-3" />
                Er. Kabir Rana
              </span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-[#175A67] bg-[#EAF3F1] px-2.5 py-1 rounded-full">
                <Calendar className="w-3 h-3" />
                {formattedDate} &bull; {selectedTime}
              </span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-[#175A67] bg-[#EAF3F1] px-2.5 py-1 rounded-full">
                <Video className="w-3 h-3" />
                {duration} Mins {sessionFormat === 'video' ? 'Video' : 'Audio'} Call
              </span>
            </div>
            <p className="text-[10px] font-bold text-amber-700 mt-1.5">EduRain PRO Pass: 0 pts deducted</p>
          </div>

          <div className="flex items-center gap-4 shrink-0 self-end sm:self-auto">
            <button onClick={onBack} className="text-xs font-bold text-[#2A707C] hover:text-[#175A67] transition-colors">
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex items-center gap-1.5 bg-[#0F3B42] hover:bg-[#0b2c31] text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm transition-all active:scale-95"
            >
              Confirm &amp; Book Slot
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-[#175A67] text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-xl animate-fadeIn">
          {toast}
        </div>
      )}
    </div>
  );
}

export default BookDoubtSessionView;
