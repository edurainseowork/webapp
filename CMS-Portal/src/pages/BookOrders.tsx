import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

// CMS → Book Orders: "<batch> Books" bought in the Android app. Each order has the delivery details the
// student entered before paying; paying also unlocked the batch for them. Pack, ship, mark delivered.

type BookOrder = {
  id: number;
  razorpay_order_id: string;
  book_name: string;
  student_name: string;
  receiver_name: string;
  receiver_phone: string;
  email: string;
  address_line: string;
  city: string;
  state: string;
  pincode: string;
  delivery_status: 'new' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
  courier: string | null;
  tracking_number: string | null;
  admin_note: string | null;
  payment_status: string | null;
  amount_paise: number | null;
  account_email: string | null;
  created_at: string;
};

type Edit = { deliveryStatus: BookOrder['delivery_status']; courier: string; trackingNumber: string; adminNote: string };

type Props = {
  showToast: (message: string, type?: 'success' | 'error') => void;
};

const STATUS_LABEL: Record<BookOrder['delivery_status'], string> = {
  new: 'New',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const inputStyle: React.CSSProperties = { padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' };
const fullAddress = (o: BookOrder) => `${o.address_line}, ${o.city}, ${o.state} - ${o.pincode}`;
const rupees = (paise: number | null) => (paise == null ? '' : `₹${(paise / 100).toLocaleString('en-IN')}`);

function toCsv(rows: BookOrder[]) {
  const head = ['Order date', 'Book', 'Student name', 'Receiver name', 'Receiver phone', 'Email', 'Address', 'City', 'State', 'Pincode', 'Amount', 'Payment', 'Delivery', 'Courier', 'Tracking', 'Razorpay order'];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = rows.map((o) => [
    new Date(o.created_at).toLocaleString('en-IN'), o.book_name, o.student_name, o.receiver_name, o.receiver_phone, o.email,
    o.address_line, o.city, o.state, o.pincode, rupees(o.amount_paise), o.payment_status, STATUS_LABEL[o.delivery_status],
    o.courier, o.tracking_number, o.razorpay_order_id,
  ].map(esc).join(','));
  return [head.map(esc).join(','), ...lines].join('\n');
}

export default function BookOrders({ showToast }: Props) {
  const [orders, setOrders] = useState<BookOrder[]>([]);
  const [filter, setFilter] = useState<'paid' | 'all'>('paid');
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<number, Edit>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: BookOrder[] }>(`/cms/book-orders?status=${filter}`);
      setOrders(res.data);
      setEdits({});
    } catch (e: any) {
      showToast('Could not load book orders: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filter]);

  const editOf = (o: BookOrder): Edit =>
    edits[o.id] ?? { deliveryStatus: o.delivery_status, courier: o.courier ?? '', trackingNumber: o.tracking_number ?? '', adminNote: o.admin_note ?? '' };

  const setEdit = (o: BookOrder, patch: Partial<Edit>) => setEdits((prev) => ({ ...prev, [o.id]: { ...editOf(o), ...patch } }));

  const save = async (o: BookOrder) => {
    const e = editOf(o);
    setSavingId(o.id);
    try {
      await apiFetch(`/cms/book-orders/${o.id}`, { method: 'PATCH', body: e });
      showToast(`Order of ${o.receiver_name} updated`, 'success');
      await load();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSavingId(null);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied', 'success');
    } catch {
      showToast('Could not copy', 'error');
    }
  };

  const downloadCsv = () => {
    const blob = new Blob([toCsv(orders)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `book-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ marginBottom: '6px' }}>Book orders ({orders.length})</h3>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Books bought in the Android app, with the address entered before payment. Paying also unlocked the batch.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn" onClick={() => setFilter('paid')} style={{ opacity: filter === 'paid' ? 1 : 0.6 }}>Paid</button>
          <button className="btn" onClick={() => setFilter('all')} style={{ opacity: filter === 'all' ? 1 : 0.6 }}>All (incl. unpaid)</button>
          <button className="btn" onClick={downloadCsv} disabled={!orders.length} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)' }}>Download CSV</button>
        </div>
      </div>

      {loading ? (
        <div className="glass-card"><div className="skeleton-box" style={{ width: '100%', height: '120px' }} aria-busy="true" /></div>
      ) : orders.length === 0 ? (
        <div className="glass-card"><p style={{ color: 'var(--text-secondary)', margin: 0 }}>No book orders yet.</p></div>
      ) : (
        orders.map((o) => {
          const e = editOf(o);
          const paid = o.payment_status === 'paid';
          return (
            <div key={o.id} className="glass-card" style={{ display: 'grid', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <h4 style={{ color: 'white', margin: '0 0 4px' }}>{o.book_name}</h4>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {new Date(o.created_at).toLocaleString('en-IN')} • {rupees(o.amount_paise)} • {o.razorpay_order_id}
                  </span>
                </div>
                <span style={{ alignSelf: 'flex-start', padding: '4px 10px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600, background: paid ? 'rgba(52,211,153,0.15)' : 'rgba(251,191,36,0.15)', color: paid ? '#34d399' : '#fbbf24' }}>
                  {paid ? 'Paid' : `Payment: ${o.payment_status || 'unknown'}`}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', fontSize: '0.92rem' }}>
                <div><span style={{ color: 'var(--text-secondary)' }}>Student</span><br />{o.student_name}</div>
                <div><span style={{ color: 'var(--text-secondary)' }}>Receiver</span><br />{o.receiver_name}</div>
                <div><span style={{ color: 'var(--text-secondary)' }}>Receiver phone</span><br /><a href={`tel:+91${o.receiver_phone}`} style={{ color: 'var(--accent, #38bdf8)' }}>{o.receiver_phone}</a></div>
                <div><span style={{ color: 'var(--text-secondary)' }}>Email</span><br />{o.email}{o.account_email && o.account_email !== o.email ? ` (account: ${o.account_email})` : ''}</div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ lineHeight: 1.5 }}>{fullAddress(o)}</span>
                <button className="btn" onClick={() => copy(`${o.receiver_name}\n${fullAddress(o)}\n${o.receiver_phone}`)} style={{ padding: '4px 10px', fontSize: '0.8rem', flexShrink: 0 }}>Copy</button>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <select value={e.deliveryStatus} onChange={(ev) => setEdit(o, { deliveryStatus: ev.target.value as Edit['deliveryStatus'] })} style={inputStyle} aria-label="Delivery status">
                  {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <input value={e.courier} onChange={(ev) => setEdit(o, { courier: ev.target.value })} placeholder="Courier" aria-label="Courier" maxLength={80} style={{ ...inputStyle, width: '140px' }} />
                <input value={e.trackingNumber} onChange={(ev) => setEdit(o, { trackingNumber: ev.target.value })} placeholder="Tracking number" aria-label="Tracking number" maxLength={80} style={{ ...inputStyle, width: '170px' }} />
                <input value={e.adminNote} onChange={(ev) => setEdit(o, { adminNote: ev.target.value })} placeholder="Note (staff only)" aria-label="Note" maxLength={500} style={{ ...inputStyle, flex: 1, minWidth: '160px' }} />
                <button className="btn" onClick={() => save(o)} disabled={savingId === o.id}>{savingId === o.id ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
