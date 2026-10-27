import { useEffect, useState } from 'react'
import { AdminNotificationBody, NOTIFICATION_IMAGE_MAX_BYTES } from '@workspace/api-zod'
import { apiFetch } from '../api'

type AdminNotification = {
  id: number
  title: string
  body: string
  imageUrl: string | null
  link?: string | null
  sentBy: string | null
  recipientCount: number
  pushSentCount: number
  pushFailedCount: number
  createdAt: string
}

export type TargetStudentInfo = {
  id: number
  name: string | null
  email: string
  phone?: string | null
}

type NotificationsProps = {
  showToast: (message: string, type?: 'success' | 'error') => void
  initialTargetStudent?: TargetStudentInfo | null
  onClearInitialTarget?: () => void
}

const inputStyle = {
  width: '100%',
  padding: '12px',
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(0,0,0,0.2)',
  color: 'white',
  fontFamily: 'inherit',
} as const

const labelStyle = { display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' } as const
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

function Notifications({ showToast, initialTargetStudent, onClearInitialTarget }: NotificationsProps) {
  // Mode: 'broadcast' (all users) or 'direct' (1-to-1 specific student)
  const [mode, setMode] = useState<'broadcast' | 'direct'>(initialTargetStudent ? 'direct' : 'broadcast')
  const [selectedStudent, setSelectedStudent] = useState<TargetStudentInfo | null>(initialTargetStudent || null)
  const [studentSearchQuery, setStudentSearchQuery] = useState('')
  const [studentSearchResults, setStudentSearchResults] = useState<TargetStudentInfo[]>([])
  const [isSearchingStudents, setIsSearchingStudents] = useState(false)

  // Form fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [link, setLink] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)

  // History
  const [history, setHistory] = useState<AdminNotification[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  // Sync initialTargetStudent if passed from parent
  useEffect(() => {
    if (initialTargetStudent) {
      setMode('direct')
      setSelectedStudent(initialTargetStudent)
    }
  }, [initialTargetStudent])

  // Search students when typing in direct mode
  useEffect(() => {
    if (mode !== 'direct' || !studentSearchQuery.trim() || selectedStudent) {
      setStudentSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearchingStudents(true)
      try {
        const res = await apiFetch<{ success: boolean; data: any[] }>(`/admin/students?q=${encodeURIComponent(studentSearchQuery.trim())}`)
        setStudentSearchResults(
          (res.data || []).map((s) => ({
            id: s.id,
            name: s.name,
            email: s.email,
            phone: s.phone,
          }))
        )
      } catch (err) {
        console.error('Failed to search students', err)
      } finally {
        setIsSearchingStudents(false)
      }
    }, 280)

    return () => clearTimeout(timer)
  }, [studentSearchQuery, mode, selectedStudent])

  const fetchHistory = async () => {
    setLoadingHistory(true)
    try {
      const data = await apiFetch<{ data: AdminNotification[] }>('/admin/notifications')
      setHistory(data.data)
    } catch (e: any) {
      showToast('Failed to load notifications: ' + e.message, 'error')
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  const handleImage = (file: File | null) => {
    if (file && !IMAGE_TYPES.includes(file.type)) {
      showToast('Image must be a PNG, JPEG or WEBP file', 'error')
      return
    }
    if (file && file.size > NOTIFICATION_IMAGE_MAX_BYTES) {
      showToast('Image must be 1 MB or smaller', 'error')
      return
    }
    if (preview) URL.revokeObjectURL(preview)
    setPreview(file ? URL.createObjectURL(file) : null)
    setImage(file)
  }

  // Handle Broadcast Submission
  const handleBroadcastSend = async () => {
    const parsed = AdminNotificationBody.safeParse({
      title,
      description,
      link: link.trim() || undefined,
    })
    if (!parsed.success) {
      showToast(parsed.error.issues[0]?.message || 'Please check the notification details', 'error')
      return
    }
    if (!window.confirm(`Send "${parsed.data.title}" to ALL registered users now? This cannot be undone.`)) return

    setIsSending(true)
    try {
      const formData = new FormData()
      formData.append('title', parsed.data.title)
      formData.append('description', parsed.data.description)
      if (parsed.data.link) formData.append('link', parsed.data.link)
      if (image) formData.append('image', image)

      const data = await apiFetch<{ data: AdminNotification; devices: number }>('/admin/notifications', { method: 'POST', formData })
      showToast(`Notification Sent to ${data.data.recipientCount} users`, 'success')
      setTitle('')
      setDescription('')
      setLink('')
      handleImage(null)
      fetchHistory()
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error')
    } finally {
      setIsSending(false)
    }
  }

  // Handle Direct 1-to-1 Student Notification Submission
  const handleDirectSend = async () => {
    if (!selectedStudent) {
      showToast('Please search and select a student first', 'error')
      return
    }
    if (!title.trim()) {
      showToast('Please enter a notification title', 'error')
      return
    }
    if (!description.trim()) {
      showToast('Please enter a notification message', 'error')
      return
    }

    setIsSending(true)
    try {
      const res = await apiFetch<{ success: boolean; data: any; pushSentCount: number }>(
        '/admin/notifications/direct',
        {
          method: 'POST',
          body: JSON.stringify({
            userId: selectedStudent.id,
            title: title.trim(),
            description: description.trim(),
            link: link.trim() || undefined,
          }),
        }
      )
      showToast(
        `In-app notification sent to ${selectedStudent.name || selectedStudent.email}!${
          res.pushSentCount > 0 ? ' (Push notification delivered)' : ''
        }`,
        'success'
      )
      setTitle('')
      setDescription('')
      setLink('')
    } catch (e: any) {
      showToast('Failed to send direct notification: ' + e.message, 'error')
    } finally {
      setIsSending(false)
    }
  }

  const handleDelete = async (id: number, notificationTitle: string) => {
    if (!window.confirm(`Are you sure you want to delete "${notificationTitle}"? It will be removed from all students' in-app notification history.`)) return
    try {
      await apiFetch(`/admin/notifications/${id}`, { method: 'DELETE' })
      showToast('Notification deleted successfully', 'success')
      setHistory((prev) => prev.filter((item) => item.id !== id))
    } catch (e: any) {
      showToast('Failed to delete notification: ' + e.message, 'error')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {/* Target Mode Segmented Switcher */}
      <div
        className="glass-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>DELIVERY MODE:</span>
          <div
            style={{
              display: 'inline-flex',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '12px',
              padding: '4px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setMode('broadcast')
                if (onClearInitialTarget) onClearInitialTarget()
              }}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                background: mode === 'broadcast' ? 'rgba(255, 94, 94, 0.2)' : 'transparent',
                color: mode === 'broadcast' ? '#ff7676' : 'var(--text-secondary)',
                fontWeight: mode === 'broadcast' ? 600 : 400,
                cursor: 'pointer',
                fontSize: '0.85rem',
                transition: 'all 0.18s ease',
              }}
            >
              📢 Broadcast to All Students
            </button>
            <button
              type="button"
              onClick={() => setMode('direct')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                background: mode === 'direct' ? 'rgba(255, 94, 94, 0.2)' : 'transparent',
                color: mode === 'direct' ? '#ff7676' : 'var(--text-secondary)',
                fontWeight: mode === 'direct' ? 600 : 400,
                cursor: 'pointer',
                fontSize: '0.85rem',
                transition: 'all 0.18s ease',
              }}
            >
              👤 Direct to Specific Student (1-to-1)
            </button>
          </div>
        </div>

        {mode === 'direct' && selectedStudent && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Targeting:</span>
            <span
              style={{
                background: 'rgba(255, 94, 94, 0.15)',
                color: '#ff8a8a',
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 600,
                border: '1px solid rgba(255, 94, 94, 0.3)',
              }}
            >
              {selectedStudent.name || selectedStudent.email}
            </span>
          </div>
        )}
      </div>

      {/* Main Form */}
      <div className="glass-card">
        <h3 style={{ marginBottom: '8px' }}>
          {mode === 'broadcast' ? 'Broadcast Notification to All Users' : 'Send 1-to-1 In-App Notification'}
        </h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', fontSize: '0.9rem' }}>
          {mode === 'broadcast'
            ? 'Delivered to every registered student via app notifications and Expo push notifications.'
            : 'Sent directly into this individual student’s in-app notification center and their registered device.'}
        </p>

        {/* In Direct Mode: Student Picker */}
        {mode === 'direct' && (
          <div style={{ marginBottom: '18px', paddingBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <label style={labelStyle}>Select Target Student *</label>
            {selectedStudent ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(255, 94, 94, 0.08)',
                  border: '1px solid rgba(255, 94, 94, 0.25)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.92rem' }}>
                    {selectedStudent.name || 'Student'} ({selectedStudent.email})
                  </div>
                  {selectedStudent.phone && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Phone: {selectedStudent.phone}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStudent(null)
                    setStudentSearchQuery('')
                    if (onClearInitialTarget) onClearInitialTarget()
                  }}
                  className="btn"
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                  }}
                >
                  Change Student
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Type student name, email, or mobile number to search..."
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  style={inputStyle}
                />
                {isSearchingStudents && (
                  <div style={{ position: 'absolute', right: '12px', top: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Searching...
                  </div>
                )}
                {studentSearchResults.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '4px',
                      background: 'rgba(15, 17, 21, 0.98)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '10px',
                      maxHeight: '220px',
                      overflowY: 'auto',
                      zIndex: 100,
                      boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
                    }}
                  >
                    {studentSearchResults.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => {
                          setSelectedStudent(s)
                          setStudentSearchResults([])
                        }}
                        style={{
                          padding: '10px 14px',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255, 94, 94, 0.12)')}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                      >
                        <div>
                          <div style={{ color: '#fff', fontWeight: 500, fontSize: '0.9rem' }}>{s.name || 'Student'}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{s.email}</div>
                        </div>
                        {s.phone && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{s.phone}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <form
          noValidate
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}
          onSubmit={(e) => {
            e.preventDefault()
            if (mode === 'broadcast') handleBroadcastSend()
            else handleDirectSend()
          }}
        >
          <div>
            <label style={labelStyle}>Notification Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder={mode === 'broadcast' ? 'e.g. New batch starting Monday' : 'e.g. Update regarding your course registration'}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Message / Description ({description.length}/500)</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              placeholder={
                mode === 'broadcast'
                  ? 'What do you want to announce to all students?'
                  : `Type your message directly for ${selectedStudent?.name || 'this student'}...`
              }
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Action Link / URL (optional)</label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              maxLength={500}
              placeholder="e.g. https://youtube.com/watch?v=... or https://edurain.in/..."
              style={inputStyle}
            />
          </div>

          {mode === 'broadcast' && (
            <div>
              <label style={labelStyle}>Thumbnail / Image (optional, PNG/JPEG/WEBP, max 1 MB)</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => handleImage(e.target.files?.[0] || null)}
                style={{ ...inputStyle, padding: '9px', cursor: 'pointer' }}
              />
              {preview && (
                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <img
                    src={preview}
                    alt="Preview"
                    style={{ width: '240px', maxHeight: '135px', objectFit: 'cover', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                  <button
                    type="button"
                    onClick={() => handleImage(null)}
                    className="btn"
                    style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', fontSize: '0.8rem' }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isSending || (mode === 'direct' && !selectedStudent)}
            className="btn"
            style={{ alignSelf: 'flex-start' }}
          >
            {isSending
              ? 'Sending...'
              : mode === 'broadcast'
              ? 'Broadcast Notification'
              : `Send In-App Notification${selectedStudent ? ` to ${selectedStudent.name || selectedStudent.email}` : ''}`}
          </button>
        </form>
      </div>

      {/* Broadcast History */}
      <div className="glass-card">
        <h3 style={{ marginBottom: 'var(--space-md)' }}>Broadcast History</h3>
        {loadingHistory && history.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }} aria-busy="true" role="status">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                style={{
                  display: 'flex',
                  gap: '12px',
                  padding: '12px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div className="skeleton-box" style={{ width: '96px', height: '54px', borderRadius: '6px', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="skeleton-box" style={{ width: '50%', height: '18px' }} />
                  <div className="skeleton-box" style={{ width: '85%', height: '14px' }} />
                  <div className="skeleton-box" style={{ width: '35%', height: '12px' }} />
                </div>
              </div>
            ))}
          </div>
        ) : history.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No broadcast notifications sent yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {history.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '14px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: 0 }}>
                  {item.imageUrl && (
                    <img src={item.imageUrl} alt="" style={{ width: '96px', height: '54px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h4 style={{ color: 'white', marginBottom: '4px' }}>{item.title}</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '6px', whiteSpace: 'pre-wrap' }}>{item.body}</p>
                    {item.link && (
                      <div style={{ marginBottom: '6px' }}>
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: 'var(--accent-primary)',
                            fontSize: '0.8rem',
                            wordBreak: 'break-all',
                            textDecoration: 'underline',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          🔗 {item.link}
                        </a>
                      </div>
                    )}
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {new Date(item.createdAt).toLocaleString()} · {item.recipientCount} users · {item.pushSentCount} pushed
                      {item.pushFailedCount > 0 ? ` · ${item.pushFailedCount} failed` : ''}
                      {item.sentBy ? ` · by ${item.sentBy}` : ''}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id, item.title)}
                  className="btn"
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#f87171',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Notifications
