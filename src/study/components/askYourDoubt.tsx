import React, { useState } from 'react';
import {
  UploadCloud,
  Paperclip,
  CheckCircle2,
  Ticket,
  Clock,
  MessageSquare,
  AlertCircle,
  X,
  FileText,
  Send,
  Sparkles,
} from 'lucide-react';
import { SubPageHeader } from './SubPageHeader';

interface BookDoubtSessionViewProps {
  onBack: () => void;
  onConfirmBooking?: (summary: any) => void;
  onOpenMySessions?: () => void;
}

interface UserTicket {
  id: string;
  topic: string;
  subject: string;
  status: 'Open' | 'In Review' | 'Resolved';
  createdAt: string;
  assignedMentor: string;
}

const INITIAL_TICKETS: UserTicket[] = [
  {
    id: 'TKT-1082',
    topic: 'Next.js 14 Server Component hydration mismatch',
    subject: 'Computer Science',
    status: 'In Review',
    createdAt: 'Today, 10:15 AM',
    assignedMentor: 'Er. Kabir Rana',
  },
  {
    id: 'TKT-0941',
    topic: 'Electromagnetic induction flux rate problem in JEE Adv 2024',
    subject: 'Physics',
    status: 'Resolved',
    createdAt: '16 Oct 2026',
    assignedMentor: 'Prof. Alok Gupta',
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

export function BookDoubtSessionView({ onBack, onOpenMySessions }: BookDoubtSessionViewProps) {
  const [subject, setSubject] = useState('Mathematics');
  const [doubtTitle, setDoubtTitle] = useState('');
  const [doubtDescription, setDoubtDescription] = useState('');
  const [attachedFile, setAttachedFile] = useState<string | null>(null);
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [notifyOnWhatsapp, setNotifyOnWhatsapp] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [submittedTicket, setSubmittedTicket] = useState<UserTicket | null>(null);
  const [showTicketsModal, setShowTicketsModal] = useState(false);
  const [ticketsList, setTicketsList] = useState<UserTicket[]>(INITIAL_TICKETS);

  const flashToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleRaiseTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!doubtTitle.trim()) {
      flashToast('Please enter a doubt topic or concept title.');
      return;
    }
    if (!doubtDescription.trim()) {
      flashToast('Please describe what you have tried and where you are stuck.');
      return;
    }

    const newTicketId = `TKT-${Math.floor(1000 + Math.random() * 9000)}`;
    const newTicket: UserTicket = {
      id: newTicketId,
      topic: doubtTitle.trim(),
      subject,
      status: 'Open',
      createdAt: 'Just now',
      assignedMentor: 'EduRain Senior Faculty',
    };

    setTicketsList([newTicket, ...ticketsList]);
    setSubmittedTicket(newTicket);
  };

  const handleResetForm = () => {
    setDoubtTitle('');
    setDoubtDescription('');
    setAttachedFile(null);
    setSubmittedTicket(null);
  };

  return (
    <div className="relative w-full rounded-[24px] overflow-hidden flex flex-col bg-[#DCEAE3] font-sans min-h-[calc(100vh-6rem)] shadow-sm">
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 pb-20">
        {/* 1. Header with Breadcrumb & 'My Tickets' */}
        <SubPageHeader
          onBack={onBack}
          crumbs={[
            { label: 'Home', onClick: onBack },
            { label: 'Features', onClick: onBack },
            { label: 'Raise a Ticket' },
          ]}
          rightElement={
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  if (onOpenMySessions) {
                    onOpenMySessions();
                  } else {
                    setShowTicketsModal(true);
                  }
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

        <div className="max-w-4xl mx-auto mt-2">
          {/* Page Heading */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-black text-[#0B1C30]">Raise a Ticket</h1>
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
                Ticket #{submittedTicket.id} Created
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-[#0B1C30]">Your Doubt Ticket Has Been Raised!</h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto mt-2 leading-relaxed">
                We have assigned your doubt to <strong className="text-[#0B1C30]">{submittedTicket.assignedMentor}</strong>. You will receive an instant notification as soon as the detailed solution is ready.
              </p>

              <div className="bg-[#F8FAFC] border border-[#175A67]/15 rounded-2xl p-4 sm:p-5 max-w-md mx-auto mt-6 text-left space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Topic:</span>
                  <span className="font-bold text-[#0B1C30] truncate max-w-[240px]">{submittedTicket.topic}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Subject:</span>
                  <span className="font-semibold text-[#175A67] bg-[#EAF3F1] px-2 py-0.5 rounded">{submittedTicket.subject}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Status:</span>
                  <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    {submittedTicket.status}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
                <button
                  onClick={handleResetForm}
                  className="px-5 py-2.5 rounded-xl border border-[#175A67]/20 text-[#175A67] hover:bg-[#EAF3F1] font-bold text-xs transition-all active:scale-95"
                >
                  Raise Another Doubt
                </button>
                <button
                  onClick={() => setShowTicketsModal(true)}
                  className="flex items-center gap-2 bg-[#0F3B42] hover:bg-[#0b2c31] text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md transition-all active:scale-95"
                >
                  <Ticket className="w-4 h-4" />
                  View All Tickets ({ticketsList.length})
                </button>
              </div>
            </div>
          ) : (
            /* Main Form — Brought to top and expanded */
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

              {/* Attachments Dropzone */}
              <div>
                <label className="block text-xs font-bold text-[#0B1C30] mb-1.5">
                  Attachments (Screenshots, PDFs, Logs or Code Snippets)
                </label>
                <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[#175A67]/20 rounded-2xl px-4 py-6 cursor-pointer hover:border-[#175A67]/40 hover:bg-[#F8FAFC] transition-all text-center">
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setAttachedFile(`${f.name} (${(f.size / 1024).toFixed(1)} KB)`);
                    }}
                  />
                  <div className="w-10 h-10 rounded-xl bg-[#EAF3F1] text-[#175A67] flex items-center justify-center">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <p className="text-xs text-[#0B1C30] font-medium">
                    Drop PDF, PNG, JPG or code files up to 10MB or <span className="text-[#175A67] font-bold underline">browse files</span>
                  </p>
                  {attachedFile ? (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg mt-1">
                      <Paperclip className="w-3.5 h-3.5" />
                      Attached: {attachedFile}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setAttachedFile(null);
                        }}
                        className="ml-2 text-slate-400 hover:text-red-500"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-400">Supported formats: .pdf, .png, .jpg, .log, .txt</span>
                  )}
                </label>
              </div>

              {/* Urgency & Notifications */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#175A67]/10">
                <div>
                  <label className="block text-xs font-bold text-[#0B1C30] mb-2">Ticket Priority</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPriority('normal')}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        priority === 'normal'
                          ? 'bg-[#0F3B42] text-white border-[#0F3B42]'
                          : 'bg-[#F8FAFC] text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Normal (Within 24h)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriority('urgent')}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        priority === 'urgent'
                          ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                          : 'bg-[#F8FAFC] text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Urgent (Priority)
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-[#F8FAFC] border border-[#175A67]/15">
                  <span className="text-xs font-semibold text-[#0B1C30] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Instant SMS / WhatsApp Alert
                  </span>
                  <button
                    type="button"
                    onClick={() => setNotifyOnWhatsapp((v) => !v)}
                    className={`relative w-[38px] h-[22px] rounded-full transition-colors shrink-0 ${
                      notifyOnWhatsapp ? 'bg-[#0F3B42]' : 'bg-[#D8E2E0]'
                    }`}
                  >
                    <span
                      className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                        notifyOnWhatsapp ? 'translate-x-[19px]' : 'translate-x-[3px]'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Submit Button ("Raise a Ticket") */}
              <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  Your doubt will be resolved by verified faculty with detailed explanation.
                </p>

                <button
                  type="submit"
                  className="flex items-center justify-center gap-2 bg-[#0F3B42] hover:bg-[#0b2c31] text-white font-bold text-sm px-8 py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.98] shrink-0"
                >
                  <Send className="w-4 h-4" />
                  Raise a Ticket
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Tickets List Modal */}
      {showTicketsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-scaleIn max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-[#175A67]" />
                <h3 className="font-bold text-base text-[#0B1C30]">My Doubt Tickets</h3>
              </div>
              <button
                onClick={() => setShowTicketsModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {ticketsList.map((t) => (
                <div
                  key={t.id}
                  className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200/80 hover:border-[#175A67]/30 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-mono font-bold text-[#175A67] bg-[#EAF3F1] px-2 py-0.5 rounded">
                      #{t.id}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        t.status === 'Resolved'
                          ? 'bg-emerald-100 text-emerald-700'
                          : t.status === 'In Review'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-[#0B1C30] mt-2 line-clamp-2">{t.topic}</h4>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2.5 pt-2 border-t border-slate-200/60">
                    <span>{t.subject} &bull; {t.assignedMentor}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {t.createdAt}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowTicketsModal(false)}
                className="w-full py-2.5 rounded-xl bg-[#0F3B42] hover:bg-[#0b2c31] text-white text-xs font-bold transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[70] bg-[#175A67] text-white text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-full shadow-2xl animate-fadeIn">
          {toast}
        </div>
      )}
    </div>
  );
}

export default BookDoubtSessionView;
