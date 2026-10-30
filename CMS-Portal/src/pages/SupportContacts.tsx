import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

// CMS → Support Contacts: phone numbers shown to students on the study website
// (course pages and Help & Support). Add, edit and delete; lowest sort order first.

export type SupportContact = {
  id: number;
  label: string;
  phone: string;
  whatsapp: boolean;
  sortOrder: number;
};

type Draft = { label: string; phone: string; whatsapp: boolean; sortOrder: string };

const EMPTY: Draft = { label: '', phone: '', whatsapp: false, sortOrder: '0' };

const inputStyle: React.CSSProperties = { padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' };
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' };

const cleanPhone = (v: string) => v.trim().replace(/[\s().-]/g, '');
const PHONE_RE = /^\+?[0-9]{7,15}$/;

/** Checks a draft the same way the backend does; returns an error message or null. */
function validate(d: Draft): string | null {
  if (d.label.trim().length < 2) return 'Label must be at least 2 characters (e.g. Student Advisor).';
  if (!PHONE_RE.test(cleanPhone(d.phone))) return 'Enter a valid phone number (7 to 15 digits, + allowed at the start).';
  return null;
}

const toBody = (d: Draft) => ({ label: d.label.trim(), phone: cleanPhone(d.phone), whatsapp: d.whatsapp, sortOrder: Number(d.sortOrder) || 0 });

type Props = {
  showToast: (message: string, type?: 'success' | 'error') => void;
};

export default function SupportContacts({ showToast }: Props) {
  const [contacts, setContacts] = useState<SupportContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [edit, setEdit] = useState<Draft>(EMPTY);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: SupportContact[] }>('/admin/support-contacts');
      setContacts(res.data);
    } catch (e: any) {
      showToast('Failed to load support contacts: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const handleCreate = async () => {
    const error = validate(draft);
    if (error) return showToast(error, 'error');
    setIsSaving(true);
    try {
      await apiFetch('/admin/support-contacts', { method: 'POST', body: toBody(draft) });
      showToast(`"${draft.label.trim()}" added`, 'success');
      setDraft(EMPTY);
      await fetchContacts();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (c: SupportContact) => {
    setEditingId(c.id);
    setEdit({ label: c.label, phone: c.phone, whatsapp: c.whatsapp, sortOrder: String(c.sortOrder) });
  };

  const handleUpdate = async (id: number) => {
    const error = validate(edit);
    if (error) return showToast(error, 'error');
    try {
      await apiFetch(`/admin/support-contacts/${id}`, { method: 'PATCH', body: toBody(edit) });
      showToast('Support contact updated', 'success');
      setEditingId(null);
      await fetchContacts();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleDelete = async (c: SupportContact) => {
    if (!window.confirm(`Delete "${c.label}" (${c.phone})? Students will no longer see this number.`)) return;
    try {
      await apiFetch(`/admin/support-contacts/${c.id}`, { method: 'DELETE' });
      showToast('Support contact deleted', 'success');
      if (editingId === c.id) setEditingId(null);
      await fetchContacts();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <div className="glass-card">
        <h3 style={{ marginBottom: 'var(--space-md)' }}>Support Numbers ({contacts.length})</h3>
        {loading && contacts.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }} aria-busy="true" role="status">
            {[1, 2].map((n) => (
              <div key={n} style={{ padding: '16px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="skeleton-box" style={{ width: '35%', height: '18px', marginBottom: '8px' }} />
                <div className="skeleton-box" style={{ width: '20%', height: '12px' }} />
              </div>
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No support numbers yet. Add one below; students will see it on the website.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {contacts.map((c) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', flexWrap: 'wrap' }}>
                {editingId === c.id ? (
                  <>
                    <input type="text" value={edit.label} maxLength={60} onChange={e => setEdit({ ...edit, label: e.target.value })} placeholder="Label" aria-label="Label" style={{ ...inputStyle, flex: 2, minWidth: '160px' }} />
                    <input type="tel" value={edit.phone} maxLength={20} onChange={e => setEdit({ ...edit, phone: e.target.value })} placeholder="Phone" aria-label="Phone" style={{ ...inputStyle, flex: 2, minWidth: '160px' }} />
                    <input type="number" min="0" value={edit.sortOrder} onChange={e => setEdit({ ...edit, sortOrder: e.target.value })} title="Sort order" aria-label="Sort order" style={{ ...inputStyle, width: '90px' }} />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      <input type="checkbox" checked={edit.whatsapp} onChange={e => setEdit({ ...edit, whatsapp: e.target.checked })} />
                      WhatsApp
                    </label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => handleUpdate(c.id)} className="btn" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Save</button>
                      <button onClick={() => setEditingId(null)} className="btn" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', fontSize: '0.8rem' }}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <h4 style={{ color: 'white', marginBottom: '4px' }}>{c.label}</h4>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {c.phone} • order {c.sortOrder}{c.whatsapp ? ' • WhatsApp' : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => startEdit(c)} className="btn" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Edit</button>
                      <button onClick={() => handleDelete(c)} className="btn" style={{ background: '#ff5e5e', border: 'none', padding: '6px 12px', fontSize: '0.8rem' }}>Delete</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-card">
        <h3 style={{ marginBottom: 'var(--space-md)' }}>Add Support Number</h3>
        <form onSubmit={e => { e.preventDefault(); handleCreate(); }} style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: '180px' }}>
            <label style={labelStyle}>Label</label>
            <input type="text" value={draft.label} maxLength={60} onChange={e => setDraft({ ...draft, label: e.target.value })} placeholder="e.g. Student Advisor" style={{ ...inputStyle, width: '100%' }} />
          </div>
          <div style={{ flex: 2, minWidth: '180px' }}>
            <label style={labelStyle}>Phone number</label>
            <input type="tel" value={draft.phone} maxLength={20} onChange={e => setDraft({ ...draft, phone: e.target.value })} placeholder="e.g. +91 98765 43210" style={{ ...inputStyle, width: '100%' }} />
          </div>
          <div style={{ width: '110px' }}>
            <label style={labelStyle}>Sort order</label>
            <input type="number" min="0" value={draft.sortOrder} onChange={e => setDraft({ ...draft, sortOrder: e.target.value })} style={{ ...inputStyle, width: '100%' }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', paddingBottom: '12px' }}>
            <input type="checkbox" checked={draft.whatsapp} onChange={e => setDraft({ ...draft, whatsapp: e.target.checked })} />
            Also on WhatsApp
          </label>
          <button type="submit" disabled={isSaving} className="btn">{isSaving ? 'Adding...' : 'Add Number'}</button>
        </form>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 'var(--space-md)' }}>
          Students see these numbers on course pages and in Help &amp; Support on the website, lowest sort order first.
          Tick WhatsApp to also show a WhatsApp chat button.
        </p>
      </div>
    </div>
  );
}