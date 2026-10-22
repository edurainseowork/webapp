import edurainLogo from '../assets/logo.webp'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { signOut, type User } from 'firebase/auth'
import { auth } from '../firebase'
import { apiFetch } from '../api'
import {
  formatSessionTime,
  formatStartClock,
  getSessionStatus,
  initialsOf,
  isLaterDate,
  isToday,
  loadMentorSessions,
  matchesFilter,
  nameFromEmail,
  type MentorSession,
  type SessionFilter,
  type SessionStatus,
} from './mentorDeskData'
import MentorAvailability from './MentorAvailability'
import './MentorDesk.css'

/* ------------------------------------------------------------------ */
/*  Icons (lucide outlines, inlined – the CMS has no icon library)     */
/* ------------------------------------------------------------------ */

function Icon({ children, size = 16 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

const VideoIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
    <rect x="2" y="6" width="14" height="12" rx="2" />
  </Icon>
)
const CalendarIcon = () => (
  <Icon>
    <path d="M8 2v4" />
    <path d="M16 2v4" />
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M3 10h18" />
  </Icon>
)
const CalendarCheckIcon = () => (
  <Icon size={13}>
    <path d="M8 2v4" />
    <path d="M16 2v4" />
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M3 10h18" />
    <path d="m9 16 2 2 4-4" />
  </Icon>
)
const CalendarClockIcon = () => (
  <Icon size={13}>
    <path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" />
    <path d="M16 2v4" />
    <path d="M8 2v4" />
    <path d="M3 10h5" />
    <path d="M17.5 17.5 16 16.3V14" />
    <circle cx="16" cy="16" r="6" />
  </Icon>
)
const ClockIcon = () => (
  <Icon size={14}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </Icon>
)
const CapIcon = () => (
  <Icon size={14}>
    <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
    <path d="M22 10v6" />
    <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
  </Icon>
)
const CopyIcon = () => (
  <Icon size={14}>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </Icon>
)
const CheckIcon = () => (
  <Icon size={14}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
)
const ArrowUpRightIcon = () => (
  <Icon size={14}>
    <path d="M7 7h10v10" />
    <path d="M7 17 17 7" />
  </Icon>
)
const SearchIcon = () => (
  <Icon>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </Icon>
)
const BellIcon = () => (
  <Icon>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </Icon>
)
const UserIcon = () => (
  <Icon size={15}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </Icon>
)
const ShieldCheckIcon = () => (
  <Icon size={15}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
)
const RefreshIcon = () => (
  <Icon size={14}>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </Icon>
)
const LogOutIcon = () => (
  <Icon>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" x2="9" y1="12" y2="12" />
  </Icon>
)
const ArrowLeftIcon = () => (
  <Icon size={14}>
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </Icon>
)
const XIcon = () => (
  <Icon size={14}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Icon>
)

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const STATUS_META: Record<SessionStatus, { label: string; icon: ReactNode }> = {
  live: { label: 'Live Now', icon: <span className="md-dot md-dot-pulse" /> },
  today: { label: 'Scheduled Today', icon: <><span className="md-dot" /><CalendarCheckIcon /></> },
  upcoming: { label: 'Upcoming Session', icon: <CalendarClockIcon /> },
  ended: { label: 'Completed', icon: <CheckIcon /> },
}

const FILTERS: { id: SessionFilter; label: string }[] = [
  { id: 'all', label: 'All Sessions' },
  { id: 'today', label: 'Today Only' },
  { id: 'upcoming', label: 'Upcoming Dates' },
]

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Clipboard API is blocked on plain http (non-localhost) pages
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}

/* ------------------------------------------------------------------ */
/*  Session card                                                       */
/* ------------------------------------------------------------------ */

function SessionCard({
  session,
  slot,
  status,
  copied,
  onCopy,
}: {
  session: MentorSession
  slot: number
  status: SessionStatus
  copied: boolean
  onCopy: () => void
}) {
  const meta = STATUS_META[status]
  const canJoin = !!session.meetLink && status !== 'ended'

  return (
    <article className={`md-card ${status === 'ended' ? 'is-ended' : ''}`}>
      <div className="md-card-top">
        <span className={`md-status md-status-${status}`}>
          {meta.icon}
          {meta.label}
        </span>
        <span className="md-slot">Slot {slot}</span>
      </div>

      <p className="md-meta" title={`${session.className} • ${session.batchName}`}>
        {session.className} • {session.batchName}
      </p>
      <h3 className="md-topic">{session.topic}</h3>

      <div className="md-details">
        <div className="md-row">
          <span className="md-row-label">
            <CapIcon />
            Student
          </span>
          <span className="md-student">
            <span className="md-avatar-sm">{initialsOf(session.studentName)}</span>
            {session.studentName}
          </span>
        </div>
        <div className="md-row">
          <span className="md-row-label">
            <ClockIcon />
            Date &amp; Time
          </span>
          <span className="md-time">{formatSessionTime(session)}</span>
        </div>
      </div>

      <div className="md-card-actions">
        <button
          type="button"
          className={`md-btn-ghost ${copied ? 'is-copied' : ''}`}
          onClick={onCopy}
          disabled={!session.meetLink}
          title={session.meetLink ?? 'Meet link not added yet'}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
        <button
          type="button"
          className="md-btn-primary"
          disabled={!canJoin}
          onClick={() => session.meetLink && window.open(session.meetLink, '_blank', 'noopener,noreferrer')}
        >
          <VideoIcon size={15} />
          {status === 'ended' ? 'Session Ended' : session.meetLink ? 'Connect on Google Meet' : 'Meet Link Pending'}
          {canJoin && <ArrowUpRightIcon />}
        </button>
      </div>
    </article>
  )
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

interface MentorDeskProps {
  user: User | null
  /**
   * Leave Mentor Desk and go back to the CMS. Only given to admins/faculty previewing the desk;
   * Mentor accounts get no CMS access, so they see no "Back to CMS" anywhere.
   */
  onExit?: () => void
}

type Menu = 'notifications' | 'profile' | null

export default function MentorDesk({ user, onExit }: MentorDeskProps) {
  const [sessions, setSessions] = useState<MentorSession[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(true)
  const [lastSynced, setLastSynced] = useState<Date | null>(null)
  const [filter, setFilter] = useState<SessionFilter>('all')
  const [query, setQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [menu, setMenu] = useState<Menu>(null)
    // Sessions students booked, or the times this mentor opens for booking
    const [view, setView] = useState<'sessions' | 'availability'>('sessions')
    const [openSlots, setOpenSlots] = useState<number | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())
  const menuRef = useRef<HTMLDivElement>(null)

  const email = user?.email ?? ''
  const mentorName = user?.displayName || (email ? nameFromEmail(email) : 'Mentor')

  // "About Mentor", written by the Super Admin when inviting this mentor (GET /api/mentor-desk/me).
  // Admins previewing the desk (onExit) are not mentors, so there is nothing to load for them.
  const [about, setAbout] = useState<string | null>(null)
  useEffect(() => {
    if (onExit || !user) return
    let active = true
    apiFetch<{ data?: { about?: string | null } }>('/mentor-desk/me')
      .then((res) => active && setAbout(res?.data?.about?.trim() || null))
      .catch(() => active && setAbout(null))
    return () => {
      active = false
    }
  }, [user?.uid, onExit])
  const fetchSessions = useCallback(
    () =>
      loadMentorSessions()
        .then((list) => {
          setSessions(list)
          setLastSynced(new Date())
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load your sessions'))
        .finally(() => setIsSyncing(false)),
    [],
  )

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const sync = () => {
    setIsSyncing(true)
    setError(null)
    fetchSessions()
  }

  // Keep "Live Now" / "Completed" badges current
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const previous = document.title
    document.title = 'Mentor Desk · Edurain CMS'
    return () => {
      document.title = previous
    }
  }, [])

  // Close the bell / profile menus on outside click or Escape
  useEffect(() => {
    if (!menu) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(null)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menu])

  const all = sessions ?? []
  const todaySessions = all.filter((s) => isToday(s, now))
  const counts: Record<SessionFilter, number> = {
    all: all.length,
    today: todaySessions.length,
    upcoming: all.filter((s) => isLaterDate(s, now)).length,
  }

  const q = query.trim().toLowerCase()
  // Slot numbers follow the full, time-ordered list so they don't change when filtering
  const visible = all
    .map((session, index) => ({ session, slot: index + 1 }))
    .filter(({ session }) => matchesFilter(session, filter, now))
    .filter(
      ({ session }) =>
        !q || [session.studentName, session.topic, session.batchName, session.className].some((v) => v.toLowerCase().includes(q)),
    )

  const handleCopy = async (session: MentorSession) => {
    if (!session.meetLink) return
    if (await copyText(session.meetLink)) {
      setCopiedId(session.id)
      window.setTimeout(() => setCopiedId((id) => (id === session.id ? null : id)), 2000)
    }
  }

  const handleLogout = () => {
    signOut(auth)
  }

  return (
    <div className="md-shell">
      {/* ---------------------------------------------------------- */}
      {/* Sidebar                                                     */}
      {/* ---------------------------------------------------------- */}
      <aside className="md-sidebar">
      <button type="button" className="sidebar-brand md-brand" onClick={onExit} title={onExit ? 'Back to CMS' : 'Mentor Desk'} disabled={!onExit} style={onExit ? undefined : { cursor: 'default' }}>
          <span className="md-brand-icon">
            <img src={edurainLogo} alt="EduRain Logo" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
          </span>
          <span>
            Mentor<span className="md-accent">Desk</span>
          </span>
        </button>

        <div className="md-profile">
          <div className="md-profile-row">
            <span className="md-avatar-lg">{initialsOf(mentorName)}</span>
            <span className="md-profile-name" title={mentorName}>
              {mentorName}
            </span>
          </div>
          {about && (
            <p className="md-profile-about" title={about}>
              {about}
            </p>
          )}
          <p className="md-profile-meta">
            <span className="md-dot" />
            Today&apos;s Sessions: {counts.today} Scheduled
          </p>
        </div>

        <p className="md-section-label">Mentor Workspace</p>
        <nav>
          <button
            type="button"
            className={`md-nav-item ${view === 'sessions' ? 'is-active' : ''}`}
            onClick={() => {
              setView('sessions')
              setFilter('all')
              if (view !== 'sessions') sync()
            }}
          >
            <CalendarIcon />
            Upcoming Sessions
            <span className="md-nav-badge">{counts.all}</span>
          </button>
          {!onExit && (
            <button type="button" className={`md-nav-item ${view === 'availability' ? 'is-active' : ''}`} onClick={() => setView('availability')}>
              <ShieldCheckIcon />
              My Availability
              {openSlots !== null && <span className="md-nav-badge">{openSlots}</span>}
            </button>
          )}
        </nav>

        <div className="md-sidebar-footer">
          <span className="md-logged-in">
            <span className="md-dot" />
            Logged in as Mentor
          </span>
          <button type="button" className="md-icon-btn" onClick={handleLogout} title="Log out">
            <LogOutIcon />
          </button>
        </div>
      </aside>

      {/* ---------------------------------------------------------- */}
      {/* Main                                                        */}
      {/* ---------------------------------------------------------- */}
      <div className="md-main">
        <header className="md-topbar">
        {onExit ? (
            <button type="button" className="btn md-btn md-btn-ghost md-back-pill" onClick={onExit}>
              <ArrowLeftIcon />
              Back to CMS
            </button>
          ) : (
            <span />
          )}

          <div className="md-topbar-actions" ref={menuRef}>
            {isSearchOpen ? (
              <label className="md-search">
                <SearchIcon />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search student, topic or batch"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setQuery('')
                      setIsSearchOpen(false)
                    }
                  }}
                />
                <button
                  type="button"
                  className="md-search-clear"
                  onClick={() => {
                    setQuery('')
                    setIsSearchOpen(false)
                  }}
                  title="Close search"
                >
                  <XIcon />
                </button>
              </label>
            ) : (
              <button type="button" className="md-icon-btn" onClick={() => setIsSearchOpen(true)} title="Search sessions">
                <SearchIcon />
              </button>
            )}

            <div className="md-menu-anchor">
              <button
                type="button"
                className="md-icon-btn"
                onClick={() => setMenu(menu === 'notifications' ? null : 'notifications')}
                title="Today's sessions"
              >
                <BellIcon />
                {counts.today > 0 && <span className="md-bell-dot" />}
              </button>
              {menu === 'notifications' && (
                <div className="md-popover">
                  <p className="md-popover-title">Today&apos;s sessions</p>
                  {todaySessions.length === 0 ? (
                    <p className="md-popover-empty">No sessions scheduled for today.</p>
                  ) : (
                    <ul className="md-popover-list">
                      {todaySessions.map((s) => (
                        <li key={s.id}>
                          <span className="md-popover-time">{formatStartClock(s)}</span>
                          <span className="md-popover-text">
                            <strong>{s.studentName}</strong>
                            {s.topic}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <span className="md-divider-v" />

            <div className="md-menu-anchor">
              <button
                type="button"
                className="md-avatar-btn"
                onClick={() => setMenu(menu === 'profile' ? null : 'profile')}
                title={email || mentorName}
              >
                <UserIcon />
              </button>
              {menu === 'profile' && (
                <div className="md-popover md-popover-profile">
                  <p className="md-popover-title">{mentorName}</p>
                  {email && <p className="md-popover-sub">{email}</p>}
                  {about && <p className="md-popover-about">{about}</p>}
                  {onExit && (
                    <button type="button" className="md-menu-item" onClick={onExit}>
                      <ArrowLeftIcon />
                      Back to CMS
                    </button>
                  )}
                  <button type="button" className="md-menu-item is-danger" onClick={handleLogout}>
                    <LogOutIcon />
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        {view === 'availability' ? (
          <main className="md-content">
            <MentorAvailability onChanged={setOpenSlots} />
          </main>
        ) : (
        <main className="md-content">
          <h1 className="md-title">My Upcoming Mentoring Sessions</h1>

          <div className="md-toolbar">
            <div className="md-tabs" role="tablist">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.id}
                  className={`md-tab ${filter === f.id ? 'is-active' : ''}`}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                  <span className="md-tab-count">{counts[f.id]}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="md-sync"
              onClick={sync}
              disabled={isSyncing}
              title={lastSynced ? `Last synced at ${lastSynced.toLocaleTimeString()} – click to refresh` : 'Refresh'}
            >
              <span className={`md-sync-icon ${isSyncing ? 'is-spinning' : ''}`}>
                {isSyncing ? <RefreshIcon /> : <ShieldCheckIcon />}
              </span>
              {isSyncing ? 'Syncing…' : 'Synced with Admin Portal'}
            </button>
          </div>

          {error ? (
            <div className="md-empty">
              <p className="md-empty-title">Couldn&apos;t load your sessions</p>
              <p>{error}</p>
              <button type="button" className="md-btn-primary" onClick={sync}>
                <RefreshIcon />
                Try again
              </button>
            </div>
          ) : sessions === null ? (
            <div className="md-grid">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="md-skeleton" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="md-empty">
              <p className="md-empty-title">{q ? 'No sessions match your search' : 'No sessions here yet'}</p>
              <p>
                {q
                  ? 'Try a student name, topic or batch.'
                  : filter === 'today'
                    ? 'Nothing is scheduled for today.'
                    : 'New bookings from students will show up here.'}
              </p>
              {(q || filter !== 'all') && (
                <button
                  type="button"
                  className="md-btn-ghost"
                  onClick={() => {
                    setQuery('')
                    setFilter('all')
                  }}
                >
                  Show all sessions
                </button>
              )}
            </div>
          ) : (
            <div className="md-grid">
              {visible.map(({ session, slot }) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  slot={slot}
                  status={getSessionStatus(session, now)}
                  copied={copiedId === session.id}
                  onCopy={() => handleCopy(session)}
                />
              ))}
            </div>
          )}
        </main>
                )}
      </div>
    </div>
  )
}
