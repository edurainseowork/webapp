import { useEffect, useState } from 'react'
import { apiFetch, type AdminCourse } from '../api'
import CustomSelect from '../components/CustomSelect'

type StudentEnrollment = {
  id: number
  courseId: number
  courseTitle: string
  paymentMethod: string | null
  purchasedAt: string
}

export type StudentItem = {
  id: number
  firebaseUid: string
  email: string
  name: string | null
  phone: string | null
  city: string | null
  state: string | null
  createdAt: string
  lastActiveAt: string | null
  enrollments: StudentEnrollment[]
}

type StudentManagerProps = {
  coursesList: AdminCourse[]
  showToast: (message: string, type?: 'success' | 'error') => void
  onSendDirectNotification: (student: { id: number; name: string | null; email: string; phone: string | null }) => void
}

const inputStyle = {
  padding: '10px 14px',
  borderRadius: '10px',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  background: 'rgba(0, 0, 0, 0.25)',
  color: 'white',
  fontSize: '0.9rem',
} as const

export default function StudentManager({ coursesList, showToast, onSendDirectNotification }: StudentManagerProps) {
  const [students, setStudents] = useState<StudentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)
  const [selectedStudentForGrant, setSelectedStudentForGrant] = useState<StudentItem | null>(null)
  const [grantCourseId, setGrantCourseId] = useState<number | ''>('')
  const [isGranting, setIsGranting] = useState(false)

  const fetchStudents = async () => {
    setLoading(true)
    try {
      const res = await apiFetch<{ success: boolean; data: StudentItem[] }>('/admin/students')
      setStudents(res.data || [])
    } catch (e: any) {
      showToast('Failed to load students: ' + (e.message || 'Network error'), 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStudents()
  }, [])

  const handleRevoke = async (studentId: number, courseId: number, courseTitle: string, studentName: string) => {
    if (!window.confirm(`Revoke access to "${courseTitle}" for student ${studentName}? This will immediately remove their access.`)) return
    setActionLoadingId(studentId)
    try {
      await apiFetch(`/admin/students/${studentId}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ courseId }),
      })
      showToast(`Revoked access to "${courseTitle}" for ${studentName}`, 'success')
      setStudents((prev) =>
        prev.map((s) => {
          if (s.id !== studentId) return s
          return {
            ...s,
            enrollments: s.enrollments.filter((en) => en.courseId !== courseId),
          }
        })
      )
    } catch (e: any) {
      showToast('Failed to revoke access: ' + (e.message || 'Error occurred'), 'error')
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleGrant = async () => {
    if (!selectedStudentForGrant || !grantCourseId) {
      showToast('Please select a course to grant', 'error')
      return
    }
    const courseIdNum = Number(grantCourseId)
    const targetCourse = coursesList.find((c) => c.id === courseIdNum)
    setIsGranting(true)
    try {
      await apiFetch(`/admin/students/${selectedStudentForGrant.id}/enroll`, {
        method: 'POST',
        body: JSON.stringify({ courseId: courseIdNum }),
      })
      showToast(`Granted "${targetCourse?.title || 'Course'}" access to ${selectedStudentForGrant.name || selectedStudentForGrant.email}`, 'success')
      setSelectedStudentForGrant(null)
      setGrantCourseId('')
      fetchStudents()
    } catch (e: any) {
      showToast('Failed to grant access: ' + (e.message || 'Error occurred'), 'error')
    } finally {
      setIsGranting(false)
    }
  }

  const filtered = students.filter((s) => {
    if (!search.trim()) return true
    const term = search.toLowerCase()
    return (
      (s.name && s.name.toLowerCase().includes(term)) ||
      (s.email && s.email.toLowerCase().includes(term)) ||
      (s.phone && s.phone.includes(term))
    )
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {/* Header & Search */}
      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
            User & Student Management
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Manage registered students, grant/revoke course access, and send targeted in-app notifications.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search by name, email, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, width: '280px' }}
          />
          <button
            type="button"
            onClick={fetchStudents}
            className="btn"
            style={{ padding: '8px 14px', background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.15)' }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Grant Course Modal */}
      {selectedStudentForGrant && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div className="glass-card" style={{ width: '100%', maxWidth: '480px', background: 'rgba(18, 20, 26, 0.95)', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
            <h3 style={{ marginBottom: '8px', fontSize: '1.2rem', color: '#fff' }}>Grant Course Access</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '16px' }}>
              Assign a batch or course to <strong>{selectedStudentForGrant.name || selectedStudentForGrant.email}</strong>.
            </p>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Select Course / Batch</label>
              <CustomSelect
                options={coursesList.map((c) => ({
                  value: c.id,
                  label: c.title,
                  category: c.category,
                  badge: c.isPublished ? 'Live' : 'Draft',
                }))}
                value={grantCourseId}
                onChange={(val) => setGrantCourseId(val ? Number(val) : '')}
                placeholder="-- Choose a course / batch --"
                searchPlaceholder="Search course name or category (e.g. JEE, NEET)..."
                clearable
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setSelectedStudentForGrant(null)}
                className="btn"
                style={{ background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.2)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isGranting || !grantCourseId}
                onClick={handleGrant}
                className="btn"
              >
                {isGranting ? 'Granting...' : 'Grant Access'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Students Table */}
      <div className="glass-card" style={{ overflowX: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
            <div className="skeleton-box" style={{ width: '100%', height: '44px' }} />
            <div className="skeleton-box" style={{ width: '100%', height: '44px' }} />
            <div className="skeleton-box" style={{ width: '100%', height: '44px' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            <p>No students found matching your criteria.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '820px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <th style={{ padding: '12px 14px', fontWeight: 600 }}>STUDENT</th>
                <th style={{ padding: '12px 14px', fontWeight: 600 }}>CONTACT</th>
                <th style={{ padding: '12px 14px', fontWeight: 600 }}>LOCATION</th>
                <th style={{ padding: '12px 14px', fontWeight: 600 }}>ACTIVE ENROLLMENTS (REVOKE)</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <td style={{ padding: '14px', verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          background: 'rgba(255, 94, 94, 0.15)',
                          color: '#ff7676',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.9rem',
                          flexShrink: 0,
                        }}
                      >
                        {(s.name || s.email)[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.92rem' }}>
                          {s.name || 'Student'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          Joined {new Date(s.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: '0.88rem', color: '#f1f5f9' }}>{s.email}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{s.phone || 'No phone'}</div>
                  </td>
                  <td style={{ padding: '14px', verticalAlign: 'top', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {[s.city, s.state].filter(Boolean).join(', ') || '-'}
                  </td>
                  <td style={{ padding: '14px', verticalAlign: 'top' }}>
                    {s.enrollments.length === 0 ? (
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        No courses enrolled
                      </span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {s.enrollments.map((en) => (
                          <span
                            key={en.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              background: 'rgba(255, 255, 255, 0.08)',
                              border: '1px solid rgba(255, 255, 255, 0.15)',
                              borderRadius: '8px',
                              padding: '3px 8px',
                              fontSize: '0.78rem',
                              color: '#fff',
                            }}
                          >
                            <span>{en.courseTitle}</span>
                            <button
                              type="button"
                              title="Revoke access to this course"
                              disabled={actionLoadingId === s.id}
                              onClick={() => handleRevoke(s.id, en.courseId, en.courseTitle, s.name || s.email)}
                              style={{
                                background: 'rgba(239, 68, 68, 0.25)',
                                color: '#fca5a5',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                borderRadius: '4px',
                                padding: '1px 5px',
                                fontSize: '0.72rem',
                                cursor: 'pointer',
                                fontWeight: 600,
                              }}
                            >
                              Revoke
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '14px', verticalAlign: 'top', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStudentForGrant(s)
                          setGrantCourseId('')
                        }}
                        style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: '#fff',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '8px',
                          padding: '6px 10px',
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                        }}
                      >
                        + Grant Course
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onSendDirectNotification({
                            id: s.id,
                            name: s.name,
                            email: s.email,
                            phone: s.phone,
                          })
                        }
                        style={{
                          background: 'rgba(255, 94, 94, 0.15)',
                          color: '#ff7676',
                          border: '1px solid rgba(255, 94, 94, 0.35)',
                          borderRadius: '8px',
                          padding: '6px 10px',
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        ✉ In-App Msg
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
