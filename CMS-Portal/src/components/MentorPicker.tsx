import { useEffect, useMemo, useRef, useState } from 'react'

export type MentorOption = {
  uid: string
  name: string
  email: string
  about: string | null
}

type Props = {
  /** Invited mentors (GET /api/admin/mentors); null while loading */
  options: MentorOption[] | null
  error?: string | null
  /** uids already on the course, in course order */
  selected: string[]
  onToggle: (mentor: MentorOption) => void
  max: number
}

// Searchable multi-select of the mentors invited from Manage Users. Same dark styling as the
// course form inputs; ticking a mentor adds them to the course, unticking removes them.
export default function MentorPicker({ options, error, selected, onToggle, max }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const q = query.trim().toLowerCase()
  const visible = useMemo(
    () => (options ?? []).filter((m) => !q || `${m.name} ${m.email} ${m.about ?? ''}`.toLowerCase().includes(q)),
    [options, q],
  )
  const chosen = new Set(selected)
  const full = selected.length >= max

  return (
    <div ref={ref} style={{ position: 'relative', alignSelf: 'stretch' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="btn"
        style={{ background: 'transparent', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', padding: '6px 14px' }}
      >
        + Select mentors{selected.length ? ` (${selected.length} selected)` : ''} ▾
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          aria-label="Mentors"
          style={{
            position: 'absolute',
            zIndex: 20,
            top: 'calc(100% + 6px)',
            left: 0,
            width: 'min(460px, 100%)',
            maxHeight: '340px',
            display: 'flex',
            flexDirection: 'column',
            background: '#1b1f2a',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '10px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search mentors by name or email"
              className="input-field"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
            />
          </div>

          <div style={{ overflowY: 'auto', padding: '6px' }}>
            {error ? (
              <p role="alert" style={{ color: '#ff8a8a', fontSize: '0.85rem', padding: '10px' }}>{error}</p>
            ) : options === null ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '10px' }}>Loading mentors…</p>
            ) : options.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '10px', lineHeight: 1.5 }}>
                No mentors yet. The Super Admin can invite mentors from Manage Users → Invite User → Mentor.
              </p>
            ) : visible.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '10px' }}>No mentor matches "{query}".</p>
            ) : (
              visible.map((m) => {
                const isOn = chosen.has(m.uid)
                const disabled = !isOn && full
                return (
                  <label
                    key={m.uid}
                    role="option"
                    aria-selected={isOn}
                    style={{
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'flex-start',
                      padding: '9px 10px',
                      borderRadius: '8px',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled ? 0.5 : 1,
                      background: isOn ? 'rgba(255,255,255,0.06)' : 'transparent',
                    }}
                  >
                    <input type="checkbox" checked={isOn} disabled={disabled} onChange={() => onToggle(m)} style={{ marginTop: '3px' }} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', color: 'white', fontWeight: 600, fontSize: '0.9rem' }}>{m.name}</span>
                      <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.75rem', wordBreak: 'break-all' }}>{m.email}</span>
                      {m.about && (
                        <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '360px' }}>
                          {m.about}
                        </span>
                      )}
                    </span>
                  </label>
                )
              })
            )}
          </div>

          {full && <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>A course can have up to {max} mentors.</p>}
        </div>
      )}
    </div>
  )
}