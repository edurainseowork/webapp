import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { apiFetch, type AdminCourse } from '../api'

// CMS → FAQs: questions and answers shown at the end of the course page on the website.
// Each FAQ goes on chosen courses, or on every course ("All courses", also future ones).
// Answers are written with a small toolbar and saved as Markdown (bold, italic, lists, links);
// the website renders them without raw HTML, so nothing typed here can run as a script.

export type Faq = {
  id: number;
  question: string;
  answer: string;
  allCourses: boolean;
  courseIds: number[];
  sortOrder: number;
  updatedAt: string;
};

type Draft = { question: string; answer: string; allCourses: boolean; courseIds: number[]; sortOrder: string };
const EMPTY: Draft = { question: '', answer: '', allCourses: false, courseIds: [], sortOrder: '0' };

type Props = {
  showToast: (message: string, type?: 'success' | 'error') => void;
};

const inputStyle: React.CSSProperties = { padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', width: '100%' };
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' };
const smallBtn: React.CSSProperties = { padding: '6px 12px', fontSize: '0.8rem' };
const ghostBtn: React.CSSProperties = { ...smallBtn, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)' };

/* ------------------------------------------------------------------ */
/*  Preview: the same Markdown subset the toolbar writes                */
/* ------------------------------------------------------------------ */

/** **bold**, *italic*, [text](https://link) inside one line → React nodes (no HTML strings). */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={m.index}>{m[1]}</strong>);
    else if (m[2]) out.push(<em key={m.index}>{m[2]}</em>);
    else out.push(<a key={m.index} href={m[4]} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--mint, #6ee7b7)' }}>{m[3]}</a>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function MarkdownPreview({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; ) {
    const line = lines[i];
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && (ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/).test(lines[i])) {
        items.push(lines[i].replace(/^\s*(?:[-*]|\d+\.)\s+/, ''));
        i++;
      }
      const List = ordered ? 'ol' : 'ul';
      blocks.push(
        <List key={i} style={{ paddingLeft: '20px', margin: '6px 0' }}>
          {items.map((item, k) => <li key={k}>{inline(item)}</li>)}
        </List>,
      );
    } else if (line.trim()) {
      const para: string[] = [];
      while (i < lines.length && lines[i].trim() && !/^\s*([-*]|\d+\.)\s+/.test(lines[i])) para.push(lines[i++]);
      blocks.push(
        <p key={i} style={{ margin: '6px 0' }}>
          {para.map((l, k) => <Fragment key={k}>{k > 0 && <br />}{inline(l)}</Fragment>)}
        </p>,
      );
    } else i++;
  }
  return <div style={{ lineHeight: 1.55 }}>{blocks.length ? blocks : <span style={{ color: 'var(--text-secondary)' }}>Nothing to preview yet.</span>}</div>;
}

/* ------------------------------------------------------------------ */
/*  Answer editor: toolbar buttons write Markdown around the selection  */
/* ------------------------------------------------------------------ */

function AnswerEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const wrap = (before: string, after: string, placeholder: string) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const picked = value.slice(s, e) || placeholder;
    onChange(value.slice(0, s) + before + picked + after + value.slice(e));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + picked.length);
    });
  };

  const prefixLines = (numbered: boolean) => {
    const el = ref.current;
    if (!el) return;
    const s = value.lastIndexOf('\n', el.selectionStart - 1) + 1;
    const e = el.selectionEnd;
    const lines = (value.slice(s, e) || 'List item').split('\n');
    const block = lines.map((l, i) => `${numbered ? `${i + 1}.` : '-'} ${l.replace(/^\s*(?:[-*]|\d+\.)\s+/, '')}`).join('\n');
    onChange(value.slice(0, s) + block + value.slice(e));
    requestAnimationFrame(() => el.focus());
  };

  const addLink = () => {
    const url = window.prompt('Link address (https://...)', 'https://');
    if (!url) return;
    if (!/^https?:\/\/\S+$/.test(url.trim())) return window.alert('Enter a full link that starts with https://');
    wrap('[', `](${url.trim()})`, 'link text');
  };

  const tools: { label: ReactNode; title: string; run: () => void }[] = [
    { label: <strong>B</strong>, title: 'Bold', run: () => wrap('**', '**', 'bold text') },
    { label: <em>I</em>, title: 'Italic', run: () => wrap('*', '*', 'italic text') },
    { label: '• List', title: 'Bullet list', run: () => prefixLines(false) },
    { label: '1. List', title: 'Numbered list', run: () => prefixLines(true) },
    { label: '🔗 Link', title: 'Link', run: addLink },
  ];

  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: '4px', padding: '6px', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {tools.map((t) => (
          <button key={t.title} type="button" title={t.title} aria-label={t.title} onClick={t.run} className="btn" style={{ ...ghostBtn, padding: '4px 10px' }}>
            {t.label}
          </button>
        ))}
      </div>
      <textarea
        ref={ref}
        rows={6}
        value={value}
        maxLength={5000}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write the answer. Select text and use the buttons above for bold, lists and links."
        aria-label="Answer"
        style={{ ...inputStyle, border: 'none', borderRadius: 0, resize: 'vertical' }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Course picker: dropdown with search, Select all, Clear              */
/* ------------------------------------------------------------------ */

function CoursePicker({ courses, selected, onChange }: { courses: AdminCourse[]; selected: number[]; onChange: (ids: number[]) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => !boxRef.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, []);

  const visible = courses.filter((c) => c.title.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (id: number) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const names = courses.filter((c) => selected.includes(c.id)).map((c) => c.title);

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} style={{ ...inputStyle, textAlign: 'left', cursor: 'pointer' }}>
        {names.length === 0 ? 'Choose courses ▾' : names.length === courses.length ? `All ${courses.length} courses selected ▾` : `${names.length} selected: ${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''} ▾`}
      </button>
      {open && (
        <div role="listbox" aria-label="Courses" style={{ position: 'absolute', zIndex: 20, top: 'calc(100% + 4px)', left: 0, right: 0, background: '#1c1f26', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '10px', boxShadow: '0 12px 30px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search courses..." aria-label="Search courses" style={{ ...inputStyle, padding: '8px' }} />
            <button type="button" className="btn" style={smallBtn} onClick={() => onChange([...new Set([...selected, ...visible.map((c) => c.id)])])}>Select all</button>
            <button type="button" className="btn" style={ghostBtn} onClick={() => onChange(q ? selected.filter((id) => !visible.some((c) => c.id === id)) : [])}>Clear</button>
          </div>
          <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
            {visible.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', padding: '6px' }}>No course matches “{q}”.</p>
            ) : (
              visible.map((c) => (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
                  <span>{c.title}</span>
                  {!c.isPublished && <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>(draft)</span>}
                </label>
              ))
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{selected.length} of {courses.length} selected</span>
            <button type="button" className="btn" style={smallBtn} onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export default function FaqManager({ showToast }: Props) {
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseFilter, setCourseFilter] = useState('');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const courseName = useMemo(() => new Map(courses.map((c) => [c.id, c.title])), [courses]);

  useEffect(() => {
    apiFetch<{ data: AdminCourse[] }>('/admin/courses')
      .then((res) => setCourses(res.data))
      .catch((e: any) => showToast('Could not load courses: ' + e.message, 'error'));
  }, []);

  // Course filter + search (debounced) → server-side list
  const loadSeq = useRef(0);
  const fetchFaqs = async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (courseFilter) params.set('courseId', courseFilter);
      if (search.trim()) params.set('q', search.trim());
      const qs = params.toString();
      const res = await apiFetch<{ data: Faq[] }>(`/admin/faqs${qs ? `?${qs}` : ''}`);
      if (seq === loadSeq.current) setFaqs(res.data);
    } catch (e: any) {
      if (seq === loadSeq.current) showToast('Failed to load FAQs: ' + e.message, 'error');
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  };
  useEffect(() => {
    const t = window.setTimeout(fetchFaqs, search ? 300 : 0);
    return () => window.clearTimeout(t);
  }, [courseFilter, search]);

  const startEdit = (faq: Faq) => {
    setEditingId(faq.id);
    setDraft({ question: faq.question, answer: faq.answer, allCourses: faq.allCourses, courseIds: faq.courseIds, sortOrder: String(faq.sortOrder) });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const resetForm = () => {
    setEditingId(null);
    setDraft(EMPTY);
  };

  const validate = (): string | null => {
    if (draft.question.trim().length < 5) return 'Question must be at least 5 characters';
    if (draft.answer.trim().length < 2) return 'Write an answer';
    if (!draft.allCourses && draft.courseIds.length === 0) return 'Choose at least one course, or tick "Show on every course"';
    return null;
  };

  const save = async () => {
    const error = validate();
    if (error) return showToast(error, 'error');
    setSaving(true);
    const body = {
      question: draft.question.trim(),
      answer: draft.answer.trim(),
      allCourses: draft.allCourses,
      courseIds: draft.allCourses ? [] : draft.courseIds,
      sortOrder: Number(draft.sortOrder) || 0,
    };
    try {
      if (editingId) {
        const res = await apiFetch<{ data: Faq }>(`/admin/faqs/${editingId}`, { method: 'PUT', body });
        setFaqs((list) => list.map((f) => (f.id === editingId ? res.data : f)));
        showToast('FAQ updated', 'success');
      } else {
        await apiFetch('/admin/faqs', { method: 'POST', body });
        showToast('FAQ added', 'success');
      }
      resetForm();
      void fetchFaqs(); // keep filter / search / order in sync
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Optimistic delete: gone from the list at once, back again if the server refuses
  const remove = async (faq: Faq) => {
    if (!window.confirm(`Delete this FAQ?\n\n"${faq.question}"`)) return;
    const previous = faqs;
    setFaqs((list) => list.filter((f) => f.id !== faq.id));
    if (editingId === faq.id) resetForm();
    try {
      await apiFetch(`/admin/faqs/${faq.id}`, { method: 'DELETE' });
      showToast('FAQ deleted', 'success');
    } catch (e: any) {
      setFaqs(previous);
      showToast('Failed to delete: ' + e.message, 'error');
    }
  };

  const tagStyle: React.CSSProperties = { fontSize: '0.72rem', padding: '2px 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: 'var(--space-md)' }}>
          <h3>FAQs ({faqs.length})</h3>
          <div style={{ display: 'flex', gap: '8px', flex: 1, justifyContent: 'flex-end', minWidth: '280px' }}>
            <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} aria-label="Filter by course" style={{ ...inputStyle, width: 'auto', minWidth: '180px' }}>
              <option value="">All courses</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search FAQs..." aria-label="Search FAQs" style={{ ...inputStyle, maxWidth: '260px' }} />
          </div>
        </div>

        {loading && faqs.length === 0 ? (
          <div aria-busy="true" role="status" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {[1, 2, 3].map((n) => (
              <div key={n} style={{ padding: '16px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                <div className="skeleton-box" style={{ width: '50%', height: '16px', marginBottom: '8px' }} />
                <div className="skeleton-box" style={{ width: '25%', height: '12px' }} />
              </div>
            ))}
          </div>
        ) : faqs.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>{search || courseFilter ? 'No FAQ matches this filter.' : 'No FAQs yet. Add the first one below.'}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {faqs.map((faq) => (
              <div key={faq.id} data-faq-row style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: `1px solid ${editingId === faq.id ? 'var(--mint, #6ee7b7)' : 'rgba(255,255,255,0.1)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <button type="button" onClick={() => setOpenId(openId === faq.id ? null : faq.id)} aria-expanded={openId === faq.id} style={{ background: 'none', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', padding: 0, flex: 1 }}>
                    <h4 style={{ marginBottom: '6px' }}>{openId === faq.id ? '▾' : '▸'} {faq.question}</h4>
                    <span style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {faq.allCourses ? (
                        <span style={{ ...tagStyle, background: 'rgba(110,231,183,0.15)', color: '#6ee7b7' }}>All courses</span>
                      ) : faq.courseIds.length === 0 ? (
                        <span style={{ ...tagStyle, color: '#ff8a8a' }}>No course (its courses were deleted)</span>
                      ) : (
                        faq.courseIds.map((id) => <span key={id} style={tagStyle}>{courseName.get(id) ?? `Course #${id}`}</span>)
                      )}
                      <span style={tagStyle}>order {faq.sortOrder}</span>
                    </span>
                  </button>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button onClick={() => startEdit(faq)} className="btn" style={smallBtn}>Edit</button>
                    <button onClick={() => remove(faq)} className="btn" style={{ ...smallBtn, background: '#ff5e5e', border: 'none' }}>Delete</button>
                  </div>
                </div>
                {openId === faq.id && (
                  <div style={{ marginTop: '10px', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', color: 'rgba(255,255,255,0.85)' }}>
                    <MarkdownPreview text={faq.answer} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-card" ref={formRef}>
        <h3 style={{ marginBottom: 'var(--space-md)' }}>{editingId ? 'Edit FAQ' : 'Add FAQ'}</h3>
        <form onSubmit={(e) => { e.preventDefault(); void save(); }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div>
            <label style={labelStyle}>Question</label>
            <input type="text" value={draft.question} maxLength={300} onChange={(e) => setDraft({ ...draft, question: e.target.value })} placeholder="e.g. Is there a refund policy?" aria-label="Question" style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Show on</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={draft.allCourses} onChange={(e) => setDraft({ ...draft, allCourses: e.target.checked })} />
              Show on every course (also courses added later)
            </label>
            {!draft.allCourses && <CoursePicker courses={courses} selected={draft.courseIds} onChange={(courseIds) => setDraft({ ...draft, courseIds })} />}
          </div>

          <div>
            <label style={labelStyle}>Answer</label>
            <AnswerEditor value={draft.answer} onChange={(answer) => setDraft({ ...draft, answer })} />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', textAlign: 'right' }}>{draft.answer.length}/5000</p>
            <p style={{ ...labelStyle, marginTop: '4px' }}>Preview</p>
            <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: '8px' }}>
              <MarkdownPreview text={draft.answer} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-end' }}>
            <div style={{ width: '140px' }}>
              <label style={labelStyle}>Sort order</label>
              <input type="number" min="0" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })} aria-label="Sort order" style={inputStyle} />
            </div>
            <button type="submit" disabled={saving} className="btn">{saving ? 'Saving...' : editingId ? 'Save FAQ' : 'Add FAQ'}</button>
            {editingId && <button type="button" onClick={resetForm} className="btn" style={ghostBtn}>Cancel</button>}
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            FAQs appear at the end of the course page on the website, lowest sort order first.
          </p>
        </form>
      </div>
    </div>
  );
}