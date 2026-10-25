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

type NotificationsProps = {
  showToast: (message: string, type?: 'success' | 'error') => void
}

const inputStyle = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' } as const
const labelStyle = { display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' } as const
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

function Notifications({ showToast }: NotificationsProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [link, setLink] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [history, setHistory] = useState<AdminNotification[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

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

  // Load the history once when the tab opens
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

  const handleSend = async () => {
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
      <div className="glass-card">
        <h3 style={{ marginBottom: '8px' }}>Send Notification</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', fontSize: '0.9rem' }}>
          Goes to every registered user as a push notification (even if the app is closed) and is saved in their in-app notification history.
        </p>
        <form noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }} onSubmit={(e) => { e.preventDefault(); handleSend() }}>
          <div>
            <label style={labelStyle}>Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} maxLength={100} placeholder="e.g. New batch starting Monday" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Description ({description.length}/500)</label>
            <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} maxLength={500} placeholder="What do you want to tell your students?" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Action Link / URL (optional)</label>
            <input
              type="url"
              value={link}
              onChange={e => setLink(e.target.value)}
              maxLength={500}
              placeholder="e.g. https://youtube.com/watch?v=... or https://edurain.in/..."
              style={inputStyle}
            />
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '4px' }}>
              Students can tap this link in the app or notification to open it directly in their browser or YouTube app.
            </p>
          </div>
          <div>
            <label style={labelStyle}>Thumbnail / Image (optional, PNG/JPEG/WEBP, max 1 MB)</label>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => handleImage(e.target.files?.[0] || null)} style={{ ...inputStyle, padding: '9px', cursor: 'pointer' }} />
            {preview && (
              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <img src={preview} alt="Preview" style={{ width: '240px', maxHeight: '135px', objectFit: 'cover', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} />
                <button type="button" onClick={() => handleImage(null)} className="btn" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', fontSize: '0.8rem' }}>Remove</button>
              </div>
            )}
          </div>
          <button type="submit" disabled={isSending} className="btn" style={{ alignSelf: 'flex-start' }}>
            {isSending ? 'Sending...' : 'Send Notification'}
          </button>
        </form>
      </div>

      <div className="glass-card">
        <h3 style={{ marginBottom: 'var(--space-md)' }}>Sent Notifications</h3>
        {loadingHistory && history.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }} aria-busy="true" role="status">
            {[1, 2, 3].map((n) => (
              <div key={n} style={{ display: 'flex', gap: '12px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
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
          <p style={{ color: 'var(--text-secondary)' }}>No notifications sent yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {history.map((item) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', padding: '14px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: 0 }}>
                  {item.imageUrl && <img src={item.imageUrl} alt="" style={{ width: '96px', height: '54px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />}
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
