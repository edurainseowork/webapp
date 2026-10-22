import { useEffect, useMemo, useState } from 'react'
import { addMentorSlot, loadMentorSlots, removeMentorSlot, toDateKey, type MentorSlot } from './mentorDeskData'

// "My Availability" on the Mentor Desk: the mentor opens times for 1:1 sessions; students book
// them on the study website. Booked slots can't be removed here.

const DURATIONS = [15, 20, 30, 45, 60, 90]

const pad = (n: number) => String(n).padStart(2, '0')
const timeOf = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/** Default for the form: the next full hour at least 1 hour from now */
function nextStart() {
  const d = new Date(Date.now() + 60 * 60_000)
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 1)
  return d
}

const formatDay = (d: Date) => d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
const formatClock = (d: Date) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })

export default function MentorAvailability({ onChanged }: { onChanged?: (openCount: number) => void }) {
  const [slots, setSlots] = useState<MentorSlot[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const start = nextStart()
  const [date, setDate] = useState(toDateKey(start))
  const [time, setTime] = useState(timeOf(start))
  const [duration, setDuration] = useState(30)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = () =>
    loadMentorSlots()
      .then((list) => {
        setSlots(list)
        setError(null)
        onChanged?.(list.filter((s) => s.status === 'open' && new Date(s.startsAt) > new Date()).length)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load your availability'))

  useEffect(() => {
    void load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    const map = new Map<string, { date: Date; slots: MentorSlot[] }>()
    for (const slot of slots ?? []) {
      const d = new Date(slot.startsAt)
      const key = toDateKey(d)
      if (!map.has(key)) map.set(key, { date: d, slots: [] })
      map.get(key)!.slots.push(slot)
    }
    return [...map.values()]
  }, [slots])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    const [y, m, d] = date.split('-').map(Number)
    const [hh, mm] = time.split(':').map(Number)
    const when = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0)
    if (!date || !time || Number.isNaN(when.getTime())) return setFormError('Pick a date and a time')
    if (when.getTime() < Date.now() + 30 * 60_000) return setFormError('Pick a time at least 30 minutes from now')
    setFormError(null)
    setNotice(null)
    setSaving(true)
    try {
      await addMentorSlot(when, duration)
      setNotice(`Added ${formatDay(when)}, ${formatClock(when)} (${duration} min)`)
      await load()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Could not add this slot')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (slot: MentorSlot) => {
    setRemoving(slot.id)
    setFormError(null)
    try {
      await removeMentorSlot(slot.id)
      setNotice('Slot removed')
      await load()
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : 'Could not remove this slot')
    } finally {
      setRemoving(null)
    }
  }

  return (
    <>
      <h1 className="md-title">My Availability</h1>
      <p className="md-av-intro">Open times for 1:1 sessions. Students of your courses book them on the study website; booked sessions appear under Upcoming Sessions.</p>

      <form className="md-av-form" onSubmit={handleAdd} noValidate>
        <label>
          <span>Date</span>
          <input type="date" value={date} min={toDateKey(new Date())} onChange={(e) => { setDate(e.target.value); setFormError(null) }} required />
        </label>
        <label>
          <span>Start time</span>
          <input type="time" value={time} step={300} onChange={(e) => { setTime(e.target.value); setFormError(null) }} required />
        </label>
        <label>
          <span>Length</span>
          <select value={duration} onChange={(e) => { setDuration(Number(e.target.value)); setFormError(null) }}>
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d} min
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="md-btn-primary md-av-add" disabled={saving}>
          {saving ? 'Adding…' : '+ Add slot'}
        </button>
      </form>
      {formError && (
        <p role="alert" className="md-av-error">
          {formError}
        </p>
      )}
      {notice && !formError && <p className="md-av-notice">{notice}</p>}

      {error ? (
        <div className="md-empty">
          <p className="md-empty-title">Couldn&apos;t load your availability</p>
          <p>{error}</p>
          <button type="button" className="md-btn-primary" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : slots === null ? (
        <div className="md-av-list">
          {[0, 1].map((i) => (
            <div key={i} className="md-skeleton md-av-skeleton" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="md-empty">
          <p className="md-empty-title">No open times yet</p>
          <p>Add your first slot above. Students can only book times you open here.</p>
        </div>
      ) : (
        <div className="md-av-list">
          {groups.map((group) => (
            <section key={toDateKey(group.date)} className="md-av-day">
              <h2>{formatDay(group.date)}</h2>
              <ul>
                {group.slots.map((slot) => {
                  const startsAt = new Date(slot.startsAt)
                  const past = startsAt.getTime() < Date.now()
                  return (
                    <li key={slot.id} className={past ? 'is-past' : ''}>
                      <span className="md-av-time">
                        {formatClock(startsAt)} · {slot.durationMinutes} min
                      </span>
                      {slot.status === 'booked' ? (
                        <span className="md-av-booked" title={slot.topic ?? undefined}>
                          Booked{slot.studentName ? ` by ${slot.studentName}` : ''}
                          {slot.topic ? ` — ${slot.topic}` : ''}
                        </span>
                      ) : (
                        <span className="md-av-open">{past ? 'Not booked' : 'Open'}</span>
                      )}
                      {slot.status === 'open' && !past && (
                        <button type="button" className="md-btn-ghost md-av-remove" disabled={removing === slot.id} onClick={() => void handleRemove(slot)}>
                          {removing === slot.id ? 'Removing…' : 'Remove'}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  )
}