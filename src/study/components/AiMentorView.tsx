import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import {
  HelpCircle,
  Search,
  Sparkles,
  ArrowUp,
  Bot,
  User,
  Copy,
  Check,
  MessageSquare,
  Clock,
  AlertCircle,
  AlertTriangle,
  Lock,
  X,
  GraduationCap,
} from 'lucide-react';
import { SubPageHeader } from './SubPageHeader';
import { FormattedAiMessage } from './FormattedAiMessage';
import { inspectStudentMessage } from '../utils/abuseGuardEngine';
import { API_BASE_URL } from '../lib/api';
import { auth } from '../lib/firebase';

/* ------------------------------------------------------------------ */
/*  Types & Interfaces                                                 */
/* ------------------------------------------------------------------ */

export type AcademicCohort = 'FOUNDATION_6_8' | 'BOARDS_9_10' | 'JEE_MAIN_ADV' | 'NEET_UG';

export interface AiChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AiChatSession {
  id: string;
  title: string;
  timestamp: string;
  messages: AiChatMessage[];
}

export interface QuotaStatus {
  isAllowed: boolean;
  reason: string | null;
  questionsUsed: number;
  questionsLimit: number;
  questionsLeft: number;
  minutesUsed: number;
  minutesLimit: number;
  minutesLeft: number;
}

export interface LockoutInfo {
  isLocked: boolean;
  lockoutUntil: number | null;
  message: string;
}

interface AiMentorViewProps {
  userName: string;
  onBack: () => void;
}

const DEFAULT_QUOTA: QuotaStatus = {
  isAllowed: true,
  reason: null,
  questionsUsed: 0,
  questionsLimit: 30,
  questionsLeft: 30,
  minutesUsed: 0,
  minutesLimit: 60,
  minutesLeft: 60,
};

const SUGGESTED_PROMPTS = [
  "Explain magnetic flux and Faraday's laws of induction",
  "Derive the work-energy theorem for variable force",
  "Difference between SN1 and SN2 reaction mechanisms",
  "Calculate root mean square speed (Vrms) of gas molecules",
];

const COHORT_LABELS: Record<AcademicCohort, string> = {
  JEE_MAIN_ADV: 'IIT-JEE (Main + Adv)',
  NEET_UG: 'NEET-UG (Medical)',
  BOARDS_9_10: 'Class 9–10 Boards',
  FOUNDATION_6_8: 'Class 6–8 Foundation',
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function AiMentorView({ userName, onBack }: AiMentorViewProps) {
  const [sessions, setSessions] = useState<AiChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [quota, setQuota] = useState<QuotaStatus>(DEFAULT_QUOTA);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cohort, setCohort] = useState<AcademicCohort>('JEE_MAIN_ADV');

  // Moderation & 24h Lockout State
  const [lockoutStatus, setLockoutStatus] = useState<LockoutInfo | null>(null);
  const [warningNotice, setWarningNotice] = useState<{
    title: string;
    message: string;
    strike: number;
  } | null>(null);
  const [inputShake, setInputShake] = useState(false);
  const [nowTimestamp, setNowTimestamp] = useState(Date.now());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Active session object
  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === activeSessionId) || null;
  }, [sessions, activeSessionId]);

  // Strictly enforce the last 2 chats in sidebar
  const lastTwoSessions = useMemo(() => {
    const list = sessions.slice(0, 2);
    if (!sidebarSearch.trim()) return list;
    const q = sidebarSearch.toLowerCase();
    return list.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, sidebarSearch]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, isGenerating]);

  // Ticker for live 24-hour countdown
  useEffect(() => {
    const interval = setInterval(() => setNowTimestamp(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Compute countdown string for 24h lockout
  const lockoutCountdownText = useMemo(() => {
    if (!lockoutStatus?.isLocked || !lockoutStatus.lockoutUntil) return null;
    const remainingMs = Math.max(0, lockoutStatus.lockoutUntil - nowTimestamp);
    if (remainingMs <= 0) return 'Unlocking now... Please refresh.';

    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((remainingMs % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
  }, [lockoutStatus, nowTimestamp]);

  // Auth header helper
  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    try {
      const token = await auth.currentUser?.getIdToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch {
      // Guest or local fallback
    }
    return headers;
  }, []);

  // Fetch initial history & quota from backend
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const headers = await getAuthHeaders();

        // 1. Fetch quota and lockout status
        const quotaRes = await fetch(`${API_BASE_URL}/api/ai/doubt/quota`, { headers });
        if (quotaRes.ok) {
          const quotaJson = await quotaRes.json();
          if (isMounted && quotaJson?.data) {
            setQuota(quotaJson.data);
            if (quotaJson.data.lockStatus?.isLocked) {
              setLockoutStatus({
                isLocked: true,
                lockoutUntil: quotaJson.data.lockStatus.lockoutUntil,
                message: quotaJson.data.lockStatus.message,
              });
            }
          }
        }

        // 2. Fetch last 2 sessions history
        const historyRes = await fetch(`${API_BASE_URL}/api/ai/doubt/history`, { headers });
        if (historyRes.ok) {
          const historyJson = await historyRes.json();
          if (isMounted && Array.isArray(historyJson?.data) && historyJson.data.length > 0) {
            setSessions(historyJson.data.slice(0, 2));
            setActiveSessionId(historyJson.data[0].id);
          }
        }
      } catch {
        // Fallback default state
      }
    }

    loadData();

    // Track active user interactions on this screen
    let lastUserActivity = Date.now();
    const markActive = () => {
      lastUserActivity = Date.now();
    };

    window.addEventListener('mousemove', markActive, { passive: true });
    window.addEventListener('keydown', markActive, { passive: true });
    window.addEventListener('touchstart', markActive, { passive: true });
    window.addEventListener('scroll', markActive, { passive: true });

    // Heartbeat timer: ping every 30s ONLY if student is actively using this screen
    const heartbeatInterval = setInterval(async () => {
      if (document.hidden) return;
      if (Date.now() - lastUserActivity > 180000) return;

      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE_URL}/api/ai/doubt/heartbeat`, {
          method: 'POST',
          headers,
        });
        if (res.ok) {
          const json = await res.json();
          if (isMounted && json?.data) setQuota(json.data);
        }
      } catch {
        // Silent catch
      }
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(heartbeatInterval);
      window.removeEventListener('mousemove', markActive);
      window.removeEventListener('keydown', markActive);
      window.removeEventListener('touchstart', markActive);
      window.removeEventListener('scroll', markActive);
    };
  }, [getAuthHeaders]);

  // Handle "Ask New Doubt"
  const handleAskNewDoubt = () => {
    setActiveSessionId(null);
    setDraft('');
    setErrorMessage(null);
    setWarningNotice(null);
    inputRef.current?.focus();
  };

  // Copy response
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  // Send question with pre-send abuse filter & real-time SSE Streaming
  const handleSendPrompt = async (textToSend?: string) => {
    const query = (textToSend ?? draft).trim();
    if (!query || isGenerating) return;

    // Check if account is locked under 24-hour restriction
    if (lockoutStatus?.isLocked) {
      setErrorMessage(lockoutStatus.message);
      return;
    }

    /* ------------------------------------------------------------------ */
    /*  CLIENT-SIDE PRE-SEND ABUSE BLOCKER (<2ms execution)               */
    /* ------------------------------------------------------------------ */
    const scan = inspectStudentMessage(query);
    if (scan.isAbusive) {
      // 1. Instantly abort: DO NOT append to chat history
      setDraft('');
      setInputShake(true);
      setTimeout(() => setInputShake(false), 600);

      // 2. Call backend moderation strike synchronization endpoint
      try {
        const headers = await getAuthHeaders();
        const strikeRes = await fetch(`${API_BASE_URL}/api/ai/moderation/strike`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            prompt: query,
            matchedToken: scan.matchedToken,
            studentName: userName,
          }),
        });

        const strikeJson = await strikeRes.json();
        const decision = strikeJson?.data;

        if (decision?.isLocked) {
          setLockoutStatus({
            isLocked: true,
            lockoutUntil: decision.lockoutUntil,
            message: decision.message,
          });
          setWarningNotice(null);
        } else if (decision?.message) {
          setWarningNotice({
            strike: decision.strikeCount,
            title: decision.strikeCount === 1 ? 'Warning 1/2' : 'Final Warning 2/2',
            message: decision.message,
          });
        }
      } catch {
        setWarningNotice({
          strike: 1,
          title: 'Warning 1/2',
          message: '⚠️ Warning 1/2: Abusive or inappropriate language is strictly prohibited. Please maintain academic discipline.',
        });
      }
      return;
    }

    if (!quota.isAllowed) {
      setErrorMessage(quota.reason || 'Daily quota limit reached.');
      return;
    }

    setDraft('');
    setErrorMessage(null);
    setWarningNotice(null);

    const userMsgId = 'u-' + Date.now();
    const userMsg: AiChatMessage = {
      id: userMsgId,
      sender: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    let targetSessionId = activeSessionId;

    if (!targetSessionId) {
      targetSessionId = 'chat-' + Date.now();
      const newSession: AiChatSession = {
        id: targetSessionId,
        title: query.length > 38 ? query.slice(0, 35) + '...' : query,
        timestamp: 'Just now',
        messages: [userMsg],
      };
      setSessions((prev) => [newSession, ...prev.slice(0, 1)]);
      setActiveSessionId(targetSessionId);
    } else {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetSessionId
            ? { ...s, messages: [...s.messages, userMsg], timestamp: 'Just now' }
            : s
        )
      );
    }

    setIsGenerating(true);

    // Placeholder assistant message for streaming tokens
    const assistantMsgId = 'a-' + Date.now();
    const placeholderAssistantMsg: AiChatMessage = {
      id: assistantMsgId,
      sender: 'assistant',
      content: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setSessions((prev) =>
      prev.map((s) =>
        s.id === targetSessionId
          ? { ...s, messages: [...s.messages, placeholderAssistantMsg] }
          : s
      )
    );

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/ai/doubt/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: query,
          sessionId: targetSessionId,
          cohort,
        }),
      });

      // 403 Forbidden: Account is locked out
      if (response.status === 403) {
        const errorJson = await response.json();
        setLockoutStatus({
          isLocked: true,
          lockoutUntil: errorJson?.lockStatus?.lockoutUntil || Date.now() + 24 * 3600 * 1000,
          message: errorJson?.message || 'Access suspended for 24 hours.',
        });
        setSessions((prev) =>
          prev.map((s) =>
            s.id === targetSessionId
              ? { ...s, messages: s.messages.filter((m) => m.id !== assistantMsgId) }
              : s
          )
        );
        setIsGenerating(false);
        return;
      }

      // 400 Bad Request: Moderation Strike triggered at server fallback
      if (response.status === 400) {
        const errorJson = await response.json();
        const mod = errorJson?.moderation;
        setWarningNotice({
          strike: mod?.strikeCount || 1,
          title: mod?.strikeCount === 1 ? 'Warning 1/2' : 'Final Warning 2/2',
          message: errorJson?.message || 'Inappropriate language detected.',
        });
        setSessions((prev) =>
          prev.map((s) =>
            s.id === targetSessionId
              ? { ...s, messages: s.messages.filter((m) => m.id !== assistantMsgId) }
              : s
          )
        );
        setIsGenerating(false);
        return;
      }

      if (response.status === 429) {
        const errorJson = await response.json();
        const reason = errorJson?.message || 'Daily limit reached.';
        setQuota((q) => ({ ...q, isAllowed: false, reason, questionsLeft: 0 }));
        setErrorMessage(reason);
        setSessions((prev) =>
          prev.map((s) =>
            s.id === targetSessionId
              ? { ...s, messages: s.messages.filter((m) => m.id !== assistantMsgId) }
              : s
          )
        );
        setIsGenerating(false);
        return;
      }

      if (!response.ok || !response.body) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              if (data.text) {
                accumulatedText += data.text;
                setSessions((prev) =>
                  prev.map((s) =>
                    s.id === targetSessionId
                      ? {
                          ...s,
                          messages: s.messages.map((m) =>
                            m.id === assistantMsgId
                              ? { ...m, content: accumulatedText }
                              : m
                          ),
                        }
                      : s
                  )
                );
              }
              if (data.quota) {
                setQuota(data.quota);
              }
            } catch {
              // safe
            }
          }
        }
      }

      setIsGenerating(false);
    } catch {
      // Local fallback simulation if server is unreachable
      setTimeout(() => {
        const fallbackText =
          `### 1. Quick Concept Overview\nAnalysis for "${query}" focuses on core fundamental principles.\n\n### 2. Governing Formula & Units\n$$\\Phi_B = \\vec{B} \\cdot \\vec{A} = B A \\cos\\theta$$\n\n### 3. Step-by-Step Derivation / Numerical Solution\n1. Define initial parameters and sign convention.\n2. Apply governing conservation theorem and substitute values.\n\n### 4. Exam Pro-Tip\nAlways verify dimensional homogeneity $[M^a L^b T^c]$ before proceeding with numerical calculations.`;

        setSessions((prev) =>
          prev.map((s) =>
            s.id === targetSessionId
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === assistantMsgId ? { ...m, content: fallbackText } : m
                  ),
                }
              : s
          )
        );
        setIsGenerating(false);
      }, 700);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendPrompt();
    }
  };

  return (
    <div className="space-y-4 pb-6 animate-fadeIn">
      {/* 1. Subpage Header */}
      <SubPageHeader
        onBack={onBack}
        crumbs={[
          { label: 'Home', onClick: onBack },
          { label: 'Features', onClick: onBack },
          { label: 'EduAI' },
        ]}
      />

      {/* Main Container */}
      <div className="relative w-full rounded-[24px] overflow-hidden flex bg-[#DCEAE3] font-sans h-[calc(100vh-11rem)] min-h-[580px] shadow-sm border border-emerald-900/10">
        {/* ---------------------------------------------------------- */}
        {/* Left Sidebar: Displays strictly the LAST 2 CHATS HISTORY    */}
        {/* ---------------------------------------------------------- */}
        <aside className="w-[260px] shrink-0 bg-[#06120e] text-slate-200 flex flex-col p-3.5 gap-4 overflow-y-auto no-scrollbar border-r border-emerald-950">
          {/* Ask New Doubt Button */}
          <button
            onClick={handleAskNewDoubt}
            className="w-full flex items-center justify-between gap-2 bg-[#101f19] hover:bg-[#152a22] border border-emerald-500/25 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white transition-all active:scale-95 shadow-sm"
          >
            <span className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-emerald-400" />
              <span>Ask New Doubt</span>
            </span>
          </button>

          {/* Academic Cohort Selector Pill */}
          <div className="bg-black/30 p-2.5 rounded-xl border border-emerald-500/10 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Target Cohort</span>
            </div>
            <select
              value={cohort}
              onChange={(e) => setCohort(e.target.value as AcademicCohort)}
              className="w-full bg-[#101f19] text-slate-200 border border-emerald-500/25 rounded-lg px-2 py-1.5 text-xs font-medium focus:outline-none focus:border-emerald-400"
            >
              {(Object.keys(COHORT_LABELS) as AcademicCohort[]).map((cKey) => (
                <option key={cKey} value={cKey} className="bg-[#0b1a14] text-white">
                  {COHORT_LABELS[cKey]}
                </option>
              ))}
            </select>
          </div>

          {/* Search Bar for Previous Chats */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              placeholder="Search past doubts..."
              className="w-full pl-8 pr-3 py-1.5 bg-[#101f19] rounded-lg text-xs text-slate-200 placeholder-slate-500 border border-emerald-500/15 focus:outline-none focus:border-emerald-400/50"
            />
          </div>

          {/* Last 2 Chats Section */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 px-1">
              <span>Recent Doubts</span>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
                Last 2
              </span>
            </div>

            <div className="space-y-1.5">
              {lastTwoSessions.map((session) => {
                const isActive = session.id === activeSessionId;
                return (
                  <button
                    key={session.id}
                    onClick={() => setActiveSessionId(session.id)}
                    className={`w-full text-left p-2.5 rounded-xl transition-all flex flex-col gap-1 ${
                      isActive
                        ? 'bg-emerald-500/15 border border-emerald-500/35 text-white font-medium shadow-sm'
                        : 'text-slate-300 hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <MessageSquare
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isActive ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      />
                      <span className="text-xs truncate font-medium flex-1">
                        {session.title}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 pl-5">
                      {session.timestamp}
                    </span>
                  </button>
                );
              })}

              {lastTwoSessions.length === 0 && (
                <p className="text-[11px] text-slate-500 px-2 py-3 text-center">
                  No previous doubts yet.
                </p>
              )}
            </div>
          </div>

          {/* Hybrid Quota Status Widget (30 Questions / 1 Hour Limit) */}
          <div className="pt-3 border-t border-emerald-950/70 space-y-2 text-[11px] text-slate-300 bg-black/25 -mx-1 p-2.5 rounded-xl border border-emerald-500/10">
            <div className="flex items-center justify-between font-semibold">
              <span className="text-slate-400">Daily Doubts</span>
              <span className="text-emerald-400 font-mono font-bold">
                {quota.questionsLeft} / {quota.questionsLimit} left
              </span>
            </div>
            <div className="flex items-center justify-between font-semibold">
              <span className="flex items-center gap-1 text-slate-400">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>Daily Time</span>
              </span>
              <span className="text-amber-300 font-mono font-bold">
                {quota.minutesLeft}m / {quota.minutesLimit}m
              </span>
            </div>
            {!quota.isAllowed && (
              <p className="text-[10px] text-rose-300 font-medium leading-tight pt-1">
                Limit reached for today.
              </p>
            )}
          </div>
        </aside>

        {/* ---------------------------------------------------------- */}
        {/* Main Conversation Area                                      */}
        {/* ---------------------------------------------------------- */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#E8F1EC]">
          {/* Warning Notice Banner (Strike 1 or Final Warning 2) */}
          {warningNotice && (
            <div className="mx-4 sm:mx-8 mt-3 p-3.5 bg-amber-500/15 border border-amber-500/40 rounded-2xl flex items-start justify-between gap-3 text-amber-900 text-xs shadow-sm backdrop-blur-md animate-fadeIn">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-950 uppercase tracking-wide">
                    {warningNotice.title}
                  </p>
                  <p className="text-[11px] text-amber-900 mt-0.5">
                    {warningNotice.message}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setWarningNotice(null)}
                className="text-amber-800 hover:text-amber-950 p-1 rounded-md"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Scrollable Conversation View */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6">
            {!activeSession || activeSession.messages.length === 0 ? (
              /* Welcome Screen for Fresh Doubt */
              <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto space-y-5 animate-fadeIn">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B1C30] tracking-tight">
                    Welcome to EduRain AI Mentor
                  </h1>
                  <p className="text-xs sm:text-sm font-semibold text-[#175A67] mt-1.5">
                    Trained for {COHORT_LABELS[cohort]} • Step-by-Step Derivations &amp; NCERT Fidelity
                  </p>
                </div>

                {/* Quick Suggestion Pills */}
                <div className="w-full pt-2">
                  <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-2">
                    Try asking about
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                    {SUGGESTED_PROMPTS.map((prompt, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendPrompt(prompt)}
                        className="p-3 rounded-xl bg-white/80 hover:bg-white text-xs font-medium text-slate-800 border border-emerald-900/10 hover:border-emerald-500/40 transition-all text-left shadow-xs hover:shadow-sm"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Conversation Messages Thread */
              <div className="space-y-5 max-w-3xl mx-auto">
                {activeSession.messages.map((message, idx) => {
                  const isUser = message.sender === 'user';
                  return (
                    <article
                      key={message.id}
                      className={`flex gap-3 sm:gap-4 ${
                        isUser ? 'justify-end' : 'justify-start'
                      } animate-fadeIn`}
                    >
                      {!isUser && (
                        <div className="w-8 h-8 rounded-full bg-[#0B1C30] text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                          <Bot className="w-4 h-4" />
                        </div>
                      )}

                      <div
                        className={`relative rounded-2xl px-4 py-3 max-w-[88%] sm:max-w-[82%] text-xs sm:text-sm leading-relaxed shadow-sm ${
                          isUser
                            ? 'bg-[#175A67] text-white rounded-tr-none'
                            : 'bg-white text-slate-800 border border-emerald-950/10 rounded-tl-none'
                        }`}
                      >
                        {/* Header for AI response */}
                        {!isUser && (
                          <div className="flex items-center justify-between gap-3 pb-1.5 mb-2 border-b border-slate-100 text-[10px] text-slate-500 font-semibold">
                            <span className="text-[#175A67] font-bold">
                              EduRain Academic Solution
                            </span>
                            <button
                              onClick={() => handleCopy(message.id, message.content)}
                              className="inline-flex items-center gap-1 hover:text-slate-800 transition-colors"
                              title="Copy response"
                            >
                              {copiedMessageId === message.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span className="text-emerald-600">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}

                        {/* Content: Formatted with KaTeX & Clean Typography */}
                        {isUser ? (
                          <div className="whitespace-pre-wrap font-sans text-white">
                            {message.content}
                          </div>
                        ) : message.content ? (
                          <FormattedAiMessage
                            content={message.content}
                            isStreaming={isGenerating && idx === activeSession.messages.length - 1}
                          />
                        ) : (
                          <span className="inline-flex items-center gap-2 text-slate-400">
                            <Sparkles className="w-3.5 h-3.5 animate-spin" />
                            <span>Formulating verified solution...</span>
                          </span>
                        )}

                        {/* Timestamp */}
                        <div
                          className={`text-[10px] mt-2 text-right ${
                            isUser ? 'text-emerald-100/70' : 'text-slate-400'
                          }`}
                        >
                          {message.timestamp}
                        </div>
                      </div>

                      {isUser && (
                        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                          <User className="w-4 h-4" />
                        </div>
                      )}
                    </article>
                  );
                })}

                {/* AI Formulating Indicator */}
                {isGenerating && activeSession.messages[activeSession.messages.length - 1]?.content === '' && (
                  <div className="flex gap-3 sm:gap-4 justify-start animate-fadeIn">
                    <div className="w-8 h-8 rounded-full bg-[#0B1C30] text-emerald-400 flex items-center justify-center shrink-0 shadow-sm">
                      <Sparkles className="w-4 h-4 animate-spin text-amber-300" />
                    </div>
                    <div className="bg-white/95 rounded-2xl rounded-tl-none px-4 py-3 border border-emerald-900/10 shadow-sm space-y-2 w-64">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#175A67]">
                        <span>EduRain is formulating solution...</span>
                      </div>
                      <div className="h-2 w-full bg-slate-200 rounded animate-pulse" />
                      <div className="h-2 w-3/4 bg-slate-200 rounded animate-pulse" />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Quota Exhausted Warning Alert */}
          {errorMessage && (
            <div className="mx-4 sm:mx-8 mb-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ---------------------------------------------------------- */}
          {/* Bottom Area: 24h Lock Banner OR Interactive Input Bar       */}
          {/* ---------------------------------------------------------- */}
          <div className="shrink-0 px-4 sm:px-8 pb-4 sm:pb-5 pt-2">
            {lockoutStatus?.isLocked ? (
              /* Dedicated 24-Hour Account Lockout Banner */
              <div className="max-w-3xl mx-auto flex items-center gap-3.5 bg-rose-950/90 border border-rose-500/40 rounded-2xl p-4 text-rose-100 shadow-xl backdrop-blur-md animate-fadeIn">
                <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
                  <Lock className="w-5 h-5 text-rose-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-sm text-white flex items-center gap-2">
                    <span>🔒 AI Mentor Access Restricted for 24 Hours</span>
                  </p>
                  <p className="text-xs text-rose-200/90 mt-0.5">
                    Account suspended due to repetitive community guideline violations.
                  </p>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] font-mono text-amber-300">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Time Remaining: {lockoutCountdownText || '24 hours'}</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Standard Chat Input Bar with Pre-Send Guard & Shake Effect */
              <div
                className={`max-w-3xl mx-auto flex items-center gap-2.5 bg-[#0b1a14] rounded-full pl-4 pr-2 py-2 shadow-xl border transition-all ${
                  inputShake ? 'animate-bounce border-rose-500 ring-2 ring-rose-500/30' : ''
                } ${
                  quota.isAllowed
                    ? 'border-emerald-500/20'
                    : 'border-amber-500/40 opacity-75'
                }`}
              >
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isGenerating || !quota.isAllowed}
                  placeholder={
                    quota.isAllowed
                      ? `Ask EduRain any academic doubt (${COHORT_LABELS[cohort]})...`
                      : 'Daily limit reached (30 questions / 1 hr). Resets tomorrow.'
                  }
                  className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => handleSendPrompt()}
                  disabled={!draft.trim() || isGenerating || !quota.isAllowed}
                  className="w-8 h-8 rounded-full bg-white text-[#0b1a14] flex items-center justify-center shrink-0 disabled:opacity-30 hover:bg-slate-100 transition-all active:scale-95 shadow-md"
                  title="Send"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>
            )}
            <p className="text-[10px] text-center text-slate-500 mt-2 font-medium">
              Daily quota: 30 doubts &amp; 1 hour active time • Zero-quota for greetings • Strict academic focus
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AiMentorView;
