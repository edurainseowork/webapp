import { useEffect, useMemo, useRef, useState } from 'react'
import {
  apiFetch,
  uploadFile,
  formatINR,
  paiseToRupees,
  rupeesToPaise,
  MAX_UPLOAD_BYTES,
  type AdminCourse,
  type Category,
  type CourseMentor,
} from '../api'
import MentorPicker, { type MentorOption } from '../components/MentorPicker'
const inputStyle: React.CSSProperties = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' };
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' };

const ALLOWED_THUMBNAIL_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

type Props = {
  courses: AdminCourse[];
  isLoading?: boolean;
  reloadCourses: () => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error') => void;
  onManageContent?: (courseId: number) => void;
};

type FormState = {
  title: string;
  description: string;
  price: string;
  originalPrice: string;
  categoryId: string;
  publishNow: boolean;
  studentsEnrolled: string;
  duration: string;
  totalLessons: string;
  isPurchasedBanner: boolean;
  // Plans: Basic = price / originalPrice above; Pro and Pro Max are optional
  basicFeatures: string;
  proPrice: string;
  proOriginalPrice: string;
  proFeatures: string;
  proMaxPrice: string;
  proMaxOriginalPrice: string;
  proMaxFeatures: string;
};

const emptyForm: FormState = {
  title: '', description: '', price: '', originalPrice: '', categoryId: '', publishNow: false,
  studentsEnrolled: '', duration: '', totalLessons: '', isPurchasedBanner: false,
  basicFeatures: '', proPrice: '', proOriginalPrice: '', proFeatures: '', proMaxPrice: '', proMaxOriginalPrice: '', proMaxFeatures: '',
};

/** "What's included" textarea → list of lines (blank lines dropped). */
const featureLines = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean);
const MAX_FEATURES = 8;

/** Checks one optional paid plan (Pro / Pro Max); returns an error message or null. */
function validatePlan(name: string, price: string, mrp: string, features: string): string | null {
  if (price === '') {
    if (mrp !== '' || featureLines(features).length) return `Enter the ${name} price (or clear its other fields)`;
    return null;
  }
  const p = Number(price);
  if (!Number.isFinite(p) || p < 1) return `${name} price must be at least ₹1`;
  if (mrp !== '') {
    const m = Number(mrp);
    if (!Number.isFinite(m) || m < p) return `${name} compare price must be greater than or equal to its price`;
  }
  return null;
}

const toPaidPlan = (price: string, mrp: string, features: string) =>
  price === '' ? null : { price: rupeesToPaise(price), originalPrice: mrp === '' ? null : rupeesToPaise(mrp), features: featureLines(features) };

// One editable mentor row: `photo` is the saved URL, `photoFile` a newly picked image
// `uid` links the row to an invited mentor account; null for mentors typed in by hand earlier
type MentorRow = { key: number; uid: string | null; name: string; experience: string; photo: string | null; photoFile: File | null; photoPreview: string | null };

const MAX_MENTORS = 10;

const experienceFromAbout = (about: string | null) => {
  const line = (about ?? '').split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? '';
  if (line.length <= 120) return line;
  const cut = line.slice(0, 119);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 80 ? cut.lastIndexOf(' ') : 119)}…`;
};

let mentorKey = 0;
const newMentorRow = (m?: CourseMentor): MentorRow => ({
  key: ++mentorKey,
  uid: m?.uid ?? null,
  name: m?.name ?? '',
  experience: m?.experience ?? '',
  photo: m?.photo ?? null,
  photoFile: null,
  photoPreview: null,
});

const toCount = (value: string) => (value.trim() === '' ? null : Math.round(Number(value)));
const isValidCount = (value: string) => value.trim() === '' || (Number.isInteger(Number(value)) && Number(value) >= 0);

export default function CourseManager({ courses, isLoading = false, reloadCourses, showToast, onManageContent }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState<AdminCourse | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [bannerImageFile, setBannerImageFile] = useState<File | null>(null);
  const [bannerImagePreview, setBannerImagePreview] = useState<string | null>(null);
  const [mentors, setMentors] = useState<MentorRow[]>([]);
  const [mentorOptions, setMentorOptions] = useState<MentorOption[] | null>(null);
  const [mentorOptionsError, setMentorOptionsError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savingTimer, setSavingTimer] = useState<number>(0);
  const [busyCourseId, setBusyCourseId] = useState<number | null>(null);
  const formSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch<{ data: Category[] }>('/admin/categories')
      .then((res) => setCategories(res.data))
      .catch((e) => showToast('Failed to load categories: ' + e.message, 'error'));
    apiFetch<{ data: MentorOption[] }>('/admin/mentors')
      .then((res) => setMentorOptions(res.data))
      .catch((e) => setMentorOptionsError('Could not load mentors: ' + e.message));
  }, []);

  // Countdown timer while saving course
  useEffect(() => {
    if (!isSaving) {
      setSavingTimer(0);
      return;
    }
    setSavingTimer(5);
    const interval = setInterval(() => {
      setSavingTimer((prev) => (prev > 1 ? prev - 1 : 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isSaving]);

  useEffect(() => {
    if (!thumbnailFile) {
      setThumbnailPreview(null);
      return;
    }
    const url = URL.createObjectURL(thumbnailFile);
    setThumbnailPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [thumbnailFile]);

  useEffect(() => {
    if (!bannerImageFile) {
      setBannerImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(bannerImageFile);
    setBannerImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [bannerImageFile]);

  const updateMentor = (key: number, patch: Partial<MentorRow>) =>
    setMentors((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const removeMentor = (key: number) =>
    setMentors((rows) => {
      const row = rows.find((r) => r.key === key);
      if (row?.photoPreview) URL.revokeObjectURL(row.photoPreview);
      return rows.filter((r) => r.key !== key);
    });

  const toggleMentor = (option: MentorOption) => {
    const existing = mentors.find((m) => m.uid === option.uid);
    if (existing) return removeMentor(existing.key);
    if (mentors.length >= MAX_MENTORS) return;
    setMentors((rows) => [...rows, newMentorRow({ uid: option.uid, name: option.name, experience: experienceFromAbout(option.about) || null, photo: null })]);
  };

  const clearMentors = () =>
    setMentors((rows) => {
      rows.forEach((row) => row.photoPreview && URL.revokeObjectURL(row.photoPreview));
      return [];
    });

  const visibleCourses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courses.filter((c) =>
      (statusFilter === 'all' || (statusFilter === 'published') === c.isPublished) &&
      (!categoryFilter || String(c.categoryId) === categoryFilter) &&
      (!q || `${c.title} ${c.description}`.toLowerCase().includes(q)),
    );
  }, [courses, statusFilter, categoryFilter, search]);

  const update = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const resetForm = () => {
    setEditing(null);
    setForm(emptyForm);
    setThumbnailFile(null);
    setBannerImageFile(null);
    clearMentors();
  };

  const startEdit = (course: AdminCourse) => {
    setEditing(course);
    setForm({
      title: course.title,
      description: course.description,
      price: paiseToRupees(course.price),
      originalPrice: course.originalPrice != null ? paiseToRupees(course.originalPrice) : '',
      categoryId: course.categoryId ? String(course.categoryId) : '',
      publishNow: course.isPublished,
      studentsEnrolled: course.studentsEnrolled != null ? String(course.studentsEnrolled) : '',
      duration: course.duration ?? '',
      totalLessons: course.totalLessons != null ? String(course.totalLessons) : '',
      isPurchasedBanner: Boolean(course.isPurchasedBanner),
      basicFeatures: (course.plans?.basic?.features ?? []).join('\n'),
      proPrice: course.plans?.pro ? paiseToRupees(course.plans.pro.price) : '',
      proOriginalPrice: course.plans?.pro?.originalPrice != null ? paiseToRupees(course.plans.pro.originalPrice) : '',
      proFeatures: (course.plans?.pro?.features ?? []).join('\n'),
      proMaxPrice: course.plans?.proMax ? paiseToRupees(course.plans.proMax.price) : '',
      proMaxOriginalPrice: course.plans?.proMax?.originalPrice != null ? paiseToRupees(course.plans.proMax.originalPrice) : '',
      proMaxFeatures: (course.plans?.proMax?.features ?? []).join('\n'),
    });
    setThumbnailFile(null);
    setBannerImageFile(null);
    clearMentors();
    setMentors((course.mentors ?? []).map(newMentorRow));
    setTimeout(() => {
      formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const pickThumbnail = (file: File | null) => {
    if (file && !ALLOWED_THUMBNAIL_TYPES.includes(file.type)) {
      showToast('Thumbnail must be a PNG, JPEG or WEBP image', 'error');
      return;
    }
    if (file && file.size > MAX_UPLOAD_BYTES) {
      showToast('Thumbnail must be 500 KB or smaller', 'error');
      return;
    }
    setThumbnailFile(file);
  };

  const pickBannerImage = (file: File | null) => {
    if (file && !ALLOWED_THUMBNAIL_TYPES.includes(file.type)) {
      showToast('Banner image must be a PNG, JPEG or WEBP image', 'error');
      return;
    }
    if (file && file.size > MAX_UPLOAD_BYTES) {
      showToast('Banner image must be 500 KB or smaller', 'error');
      return;
    }
    setBannerImageFile(file);
  };

  const pickMentorPhoto = (row: MentorRow, file: File | null) => {
    if (!file) return;
    if (!ALLOWED_THUMBNAIL_TYPES.includes(file.type)) {
      showToast('Mentor photo must be a PNG, JPEG or WEBP image', 'error');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      showToast('Mentor photo must be 500 KB or smaller', 'error');
      return;
    }
    if (row.photoPreview) URL.revokeObjectURL(row.photoPreview);
    updateMentor(row.key, { photoFile: file, photoPreview: URL.createObjectURL(file) });
  };

  const removeMentorPhoto = (row: MentorRow) => {
    if (row.photoPreview) URL.revokeObjectURL(row.photoPreview);
    updateMentor(row.key, { photo: null, photoFile: null, photoPreview: null });
  };

  const validate = (): string | null => {
    if (form.title.trim().length < 3) return 'Title must be at least 3 characters';
    if (form.description.trim().length < 10) return 'Description must be at least 10 characters';
    if (!form.categoryId) return 'Please choose a category';
    const price = Number(form.price);
    if (form.price === '' || !Number.isFinite(price) || price < 0) return 'Enter a valid price';
    if (form.originalPrice !== '') {
      const mrp = Number(form.originalPrice);
      if (!Number.isFinite(mrp) || mrp < price) return 'Original price must be greater than or equal to the price';
    }
    const planError =
      validatePlan('Pro', form.proPrice, form.proOriginalPrice, form.proFeatures) ??
      validatePlan('Pro Max', form.proMaxPrice, form.proMaxOriginalPrice, form.proMaxFeatures);
    if (planError) return planError;
    for (const [name, text] of [['Basic', form.basicFeatures], ['Pro', form.proFeatures], ['Pro Max', form.proMaxFeatures]] as const) {
      const lines = featureLines(text);
      if (lines.length > MAX_FEATURES) return `${name}: up to ${MAX_FEATURES} "What's included" lines`;
      if (lines.some((l) => l.length > 120)) return `${name}: each "What's included" line can be up to 120 characters`;
    }
    if (!isValidCount(form.studentsEnrolled)) return 'Students enrolled must be a whole number';
    if (!isValidCount(form.totalLessons)) return 'Total lessons must be a whole number';
    if (mentors.some((m) => !m.name.trim() && (m.experience.trim() || m.photo || m.photoFile))) return 'Every mentor needs a name';
    if (!editing && !thumbnailFile) return 'Please select a thumbnail';
    return null;
  };

  const handleSave = async () => {
    const error = validate();
    if (error) {
      showToast(error, 'error');
      return;
    }
    setIsSaving(true);
    try {
      const thumbnail = thumbnailFile ? await uploadFile(thumbnailFile) : undefined;
      const bannerImage = bannerImageFile ? await uploadFile(bannerImageFile) : undefined;
      const mentorList: CourseMentor[] = [];
      for (const m of mentors) {
        if (!m.name.trim()) continue;
        mentorList.push({
          uid: m.uid,
          name: m.name.trim(),
          experience: m.experience.trim() || null,
          photo: m.photoFile ? await uploadFile(m.photoFile) : m.photo,
        });
      }
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        price: rupeesToPaise(form.price),
        originalPrice: form.originalPrice === '' ? null : rupeesToPaise(form.originalPrice),
        categoryId: Number(form.categoryId),
        ...(thumbnail ? { thumbnail } : {}),
        ...(bannerImage !== undefined ? { bannerImage } : {}),
        isPurchasedBanner: form.isPurchasedBanner,
        mentors: mentorList,
        studentsEnrolled: toCount(form.studentsEnrolled),
        duration: form.duration.trim() || null,
        totalLessons: toCount(form.totalLessons),
        plans: {
          basic: { features: featureLines(form.basicFeatures) },
          pro: toPaidPlan(form.proPrice, form.proOriginalPrice, form.proFeatures),
          proMax: toPaidPlan(form.proMaxPrice, form.proMaxOriginalPrice, form.proMaxFeatures),
        },
      };

      if (editing) {
        await apiFetch(`/admin/courses/${editing.id}`, { method: 'PATCH', body: payload });
        showToast('Course updated successfully', 'success');
      } else {
        await apiFetch('/admin/courses', { method: 'POST', body: { ...payload, isPublished: form.publishNow } });
        showToast(form.publishNow ? 'Course published successfully!' : 'Course saved as draft', 'success');
      }
      resetForm();
      await reloadCourses();
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const togglePurchasedBanner = async (course: AdminCourse) => {
    setBusyCourseId(course.id);
    const nextVal = !course.isPurchasedBanner;
    try {
      await apiFetch(`/admin/courses/${course.id}/purchased-banner`, {
        method: 'PATCH',
        body: { isPurchasedBanner: nextVal },
      });
      showToast(nextVal ? `Course "${course.title}" set as Purchases section banner!` : `Removed banner feature from "${course.title}"`, 'success');
      await reloadCourses();
    } catch (e: any) {
      showToast('Error updating banner: ' + e.message, 'error');
    } finally {
      setBusyCourseId(null);
    }
  };

  const togglePublish = async (course: AdminCourse) => {
    setBusyCourseId(course.id);
    try {
      await apiFetch(`/admin/courses/${course.id}/publish`, { method: 'PATCH', body: { isPublished: !course.isPublished } });
      showToast(course.isPublished ? 'Course unpublished' : 'Course published successfully', 'success');
      await reloadCourses();
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setBusyCourseId(null);
    }
  };

  const handleDelete = async (course: AdminCourse) => {
    if (!window.confirm(`Delete "${course.title}" permanently? All of its content will be removed too.`)) return;
    setBusyCourseId(course.id);
    try {
      await apiFetch(`/admin/courses/${course.id}`, { method: 'DELETE' });
      showToast('Course deleted', 'success');
      if (editing?.id === course.id) resetForm();
      await reloadCourses();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setBusyCourseId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

      {/* Existing Courses List */}
      <div className="glass-card">
        <h3 style={{ marginBottom: 'var(--space-md)' }}>Existing Courses ({courses.length})</h3>

        {/* Quick Purchased Section Banner Control */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(15,59,66,0.6) 0%, rgba(11,28,48,0.85) 100%)',
          border: '1px solid rgba(245,158,11,0.4)',
          borderRadius: '10px',
          padding: '12px 16px',
          marginBottom: 'var(--space-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#f59e0b', fontSize: '1rem', fontWeight: 'bold' }}>★ Purchased Section Banner</span>
              <span style={{ fontSize: '0.75rem', background: 'rgba(245,158,11,0.2)', color: '#fcd34d', padding: '2px 8px', borderRadius: '999px', border: '1px solid rgba(245,158,11,0.3)' }}>
                {courses.some(c => c.isPurchasedBanner) ? 'Custom Banner Selected' : 'Auto (Highest Discount Offer)'}
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Select which course is featured as the hero banner card on the student's <b>"Your Enrolled Courses"</b> (Purchases) page.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              value={courses.find(c => c.isPurchasedBanner)?.id || ''}
              onChange={async (e) => {
                const targetId = Number(e.target.value);
                try {
                  if (!targetId) {
                    for (const c of courses.filter(c => c.isPurchasedBanner)) {
                      await apiFetch(`/admin/courses/${c.id}/purchased-banner`, { method: 'PATCH', body: { isPurchasedBanner: false } });
                    }
                    showToast('Reset banner to auto-selection', 'success');
                  } else {
                    await apiFetch(`/admin/courses/${targetId}/purchased-banner`, { method: 'PATCH', body: { isPurchasedBanner: true } });
                    showToast('Purchased section banner updated!', 'success');
                  }
                  await reloadCourses();
                } catch (err: any) {
                  showToast('Error: ' + err.message, 'error');
                }
              }}
              style={{ ...inputStyle, width: 'auto', minWidth: '240px', padding: '8px 12px', fontSize: '0.85rem', borderColor: 'rgba(245,158,11,0.4)' }}
            >
              <option value="">-- Auto (Highest Discount Offer) --</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.isPurchasedBanner ? '★ ' : ''}{c.title} ({c.isPublished ? 'Published' : 'Draft'})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
          <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search courses..." style={{ ...inputStyle, flex: 2, minWidth: '180px', width: 'auto' }} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} style={{ ...inputStyle, flex: 1, minWidth: '140px', width: 'auto' }}>
            <option value="all">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
          </select>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '140px', width: 'auto' }}>
            <option value="">All categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {isLoading && visibleCourses.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }} aria-busy="true" role="status">
            {[1, 2, 3].map((n) => (
              <div key={n} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="skeleton-box" style={{ width: '96px', height: '54px', borderRadius: '6px', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="skeleton-box" style={{ width: '45%', height: '18px' }} />
                  <div className="skeleton-box" style={{ width: '30%', height: '14px' }} />
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <div className="skeleton-box" style={{ width: '80px', height: '30px' }} />
                  <div className="skeleton-box" style={{ width: '60px', height: '30px' }} />
                </div>
              </div>
            ))}
          </div>
        ) : visibleCourses.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No courses found.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {visibleCourses.map((course) => (
              <div key={course.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: course.isPurchasedBanner ? '1px solid rgba(245,158,11,0.5)' : '1px solid rgba(255,255,255,0.1)' }}>
                <img src={course.thumbnail} alt="" style={{ width: '96px', height: '54px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0, background: 'rgba(255,255,255,0.05)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <h4 style={{ color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{course.title}</h4>
                    <span style={{ fontSize: '0.7rem', fontWeight: 'bold', padding: '2px 8px', borderRadius: '999px', background: course.isPublished ? 'var(--mint)' : 'rgba(255,255,255,0.15)', color: course.isPublished ? 'var(--navy)' : 'white' }}>
                      {course.isPublished ? 'PUBLISHED' : 'DRAFT'}
                    </span>
                    {course.isPurchasedBanner && (
                      <span style={{ fontSize: '0.7rem', fontWeight: 'bold', padding: '2px 8px', borderRadius: '999px', background: '#f59e0b', color: '#000' }}>
                        ★ PURCHASES BANNER
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {formatINR(course.price)}
                    {course.originalPrice != null && course.originalPrice > course.price && <s style={{ marginLeft: '6px' }}>{formatINR(course.originalPrice)}</s>}
                    {course.plans?.pro && <> • Pro {formatINR(course.plans.pro.price)}</>}
                    {course.plans?.proMax && <> • Pro Max {formatINR(course.plans.proMax.price)}</>}
                    {' • '}{course.category} • {course.enrollmentCount} enrolled
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => togglePurchasedBanner(course)}
                    disabled={busyCourseId === course.id}
                    className="btn"
                    style={{
                      background: course.isPurchasedBanner ? '#d97706' : 'transparent',
                      border: course.isPurchasedBanner ? 'none' : '1px solid rgba(245, 158, 11, 0.4)',
                      color: course.isPurchasedBanner ? '#fff' : '#fcd34d',
                      padding: '6px 12px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                    }}
                    title="Feature as hero banner in Purchases section"
                  >
                    {course.isPurchasedBanner ? '★ Banner Active' : '☆ Set Banner'}
                  </button>
                  {onManageContent && (
                    <button
                      onClick={() => onManageContent(course.id)}
                      className="btn"
                      style={{ background: '#3b82f6', border: 'none', padding: '6px 12px', fontSize: '0.8rem' }}
                      title="Manage curriculum, videos, PDFs and folders"
                    >
                      Manage Content
                    </button>
                  )}
                  <button onClick={() => togglePublish(course)} disabled={busyCourseId === course.id} className="btn" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', fontSize: '0.8rem' }}>
                    {course.isPublished ? 'Unpublish' : 'Publish'}
                  </button>
                  <button onClick={() => startEdit(course)} disabled={busyCourseId === course.id} className="btn" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Edit</button>
                  <button
                    onClick={() => handleDelete(course)}
                    disabled={busyCourseId === course.id || course.enrollmentCount > 0}
                    title={course.enrollmentCount > 0 ? 'Courses with enrolled students cannot be deleted — unpublish instead' : undefined}
                    className="btn"
                    style={{ background: '#ff5e5e', border: 'none', padding: '6px 12px', fontSize: '0.8rem', opacity: course.enrollmentCount > 0 ? 0.5 : 1 }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Course Form */}
      <div ref={formSectionRef} className="glass-card" style={{ scrollMarginTop: '24px' }}>
        <h3 style={{ marginBottom: 'var(--space-md)' }}>{editing ? `Edit Course: ${editing.title}` : 'Create New Course'}</h3>
        {categories.length === 0 && (
          <p style={{ color: '#ffb35e', marginBottom: 'var(--space-md)', fontSize: '0.9rem' }}>No categories yet — add one in the Categories tab first.</p>
        )}
        <form onSubmit={e => { e.preventDefault(); handleSave(); }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div>
            <label style={labelStyle}>Course Title</label>
            <input type="text" value={form.title} maxLength={150} onChange={e => update({ title: e.target.value })} placeholder="e.g. Advanced Mechanics" className="input-field" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Category</label>
            <select value={form.categoryId} onChange={e => update({ categoryId: e.target.value })} className="input-field" style={inputStyle}>
              <option value="">Select category...</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea rows={5} value={form.description} maxLength={5000} onChange={e => update({ description: e.target.value })} placeholder="What students will learn, who it is for, what is included..." className="input-field" style={inputStyle} />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', textAlign: 'right' }}>{form.description.length}/5000</p>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 'var(--space-md)' }}>
            <h4 style={{ marginBottom: '4px' }}>Pricing Plans</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
              Basic is required. Add a Pro and / or Pro Max price to show the plan cards (Basic, Pro, Pro Max) on the course page.
              Leave Pro and Pro Max empty for a single price.
            </p>
            {([
              { name: 'Basic', price: 'price', mrp: 'originalPrice', features: 'basicFeatures', pricePh: '999', mrpPh: '1499', required: true },
              { name: 'Pro', price: 'proPrice', mrp: 'proOriginalPrice', features: 'proFeatures', pricePh: '1499', mrpPh: '2499', required: false },
              { name: 'Pro Max', price: 'proMaxPrice', mrp: 'proMaxOriginalPrice', features: 'proMaxFeatures', pricePh: '2499', mrpPh: '3999', required: false },
            ] as const).map((plan) => (
              <div key={plan.name} style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: 'var(--space-md)', marginBottom: 'var(--space-sm)' }}>
                <p style={{ fontWeight: 600, marginBottom: '8px' }}>{plan.name}{plan.required ? '' : ' (optional)'}</p>
                <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>{plan.name} Price (INR)</label>
                    <input type="number" min="0" step="0.01" value={form[plan.price]} onChange={e => update({ [plan.price]: e.target.value } as Partial<FormState>)} placeholder={plan.pricePh} aria-label={`${plan.name} price`} className="input-field" style={inputStyle} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>{plan.name} Compare Price / MRP (optional)</label>
                    <input type="number" min="0" step="0.01" value={form[plan.mrp]} onChange={e => update({ [plan.mrp]: e.target.value } as Partial<FormState>)} placeholder={plan.mrpPh} aria-label={`${plan.name} compare price`} className="input-field" style={inputStyle} />
                  </div>
                </div>
                <label style={{ ...labelStyle, marginTop: '10px' }}>What&apos;s included in {plan.name} (optional, one per line)</label>
                <textarea rows={2} value={form[plan.features]} onChange={e => update({ [plan.features]: e.target.value } as Partial<FormState>)} placeholder={plan.name === 'Basic' ? 'Live & recorded lectures\nDaily practice problems' : `Everything in ${plan.name === 'Pro' ? 'Basic' : 'Pro'}\nWeekly full tests`} aria-label={`What's included in ${plan.name}`} className="input-field" style={inputStyle} />
              </div>
            ))}
          </div>
          <div>
            <label style={labelStyle}>{editing ? 'Replace Thumbnail (optional)' : 'Upload Thumbnail (From PC)'}</label>
            <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
              <input type="file" accept="image/png, image/jpeg, image/webp" onChange={e => pickThumbnail(e.target.files?.[0] || null)} className="input-field" style={{ ...inputStyle, padding: '9px', cursor: 'pointer', flex: 1 }} />
              {(thumbnailPreview || editing?.thumbnail) && (
                <img src={thumbnailPreview || editing!.thumbnail} alt="Thumbnail preview" style={{ width: '128px', height: '72px', objectFit: 'cover', borderRadius: '6px' }} />
              )}
            </div>
            <p style={{ fontSize: '0.75rem', color: '#ff5e5e', marginTop: '6px' }}>
              * Max size: 500 KB. Recommended: 1280x720 px (16:9) to prevent UI breaking.
            </p>
          </div>

          {/* Purchased Section Banner Options */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 'var(--space-md)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fcd34d', cursor: 'pointer', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={form.isPurchasedBanner}
                onChange={e => update({ isPurchasedBanner: e.target.checked })}
              />
              ★ Feature as Banner in Purchased Section (Show on student's My Purchases page)
            </label>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', marginLeft: '24px' }}>
              When enabled, this course offer is featured as the hero banner card on the student's "Your Enrolled Courses" view.
            </p>
            {form.isPurchasedBanner && (
              <div style={{ marginTop: 'var(--space-sm)', marginLeft: '24px' }}>
                <label style={labelStyle}>{editing ? 'Custom Banner Image (Optional - replaces thumbnail in banner)' : 'Upload Custom Banner Image (Optional)'}</label>
                <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={e => pickBannerImage(e.target.files?.[0] || null)}
                    className="input-field"
                    style={{ ...inputStyle, padding: '9px', cursor: 'pointer', flex: 1 }}
                  />
                  {(bannerImagePreview || editing?.bannerImage) && (
                    <img
                      src={bannerImagePreview || editing!.bannerImage!}
                      alt="Banner preview"
                      style={{ width: '160px', height: '60px', objectFit: 'cover', borderRadius: '6px' }}
                    />
                  )}
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  * Optional wide banner graphic. Max size: 500 KB. If omitted, the course thumbnail will be used.
                </p>
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 'var(--space-md)' }}>
            <h4 style={{ marginBottom: '4px' }}>Course Metrics</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)' }}>Shown at the top of the course page in the app. Leave a field empty to hide it.</p>
            <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Students Enrolled</label>
                <input type="number" min="0" step="1" value={form.studentsEnrolled} onChange={e => update({ studentsEnrolled: e.target.value })} placeholder="2000" className="input-field" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Course Duration</label>
                <input type="text" maxLength={40} value={form.duration} onChange={e => update({ duration: e.target.value })} placeholder="e.g. 40 hours or 6 months" className="input-field" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Total Lessons</label>
                <input type="number" min="0" step="1" value={form.totalLessons} onChange={e => update({ totalLessons: e.target.value })} placeholder="42" className="input-field" style={inputStyle} />
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 'var(--space-md)' }}>
            <h4 style={{ marginBottom: '4px' }}>Mentors</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)' }}>Select from the mentors invited in Manage Users. Shown under "Your Mentor" on the course page, in this order. Photo is optional (square, max 500 KB).</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {mentors.map((mentor, index) => (
                <div key={mentor.key} style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-start', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ width: '64px', flexShrink: 0, textAlign: 'center' }}>
                    {mentor.photoPreview || mentor.photo ? (
                      <img src={mentor.photoPreview || mentor.photo!} alt="" style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '50%' }} />
                    ) : (
                      <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', color: 'var(--text-secondary)' }}>{mentor.name.trim()[0]?.toUpperCase() || '?'}</div>
                    )}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                      <input type="text" maxLength={80} value={mentor.name} readOnly={!!mentor.uid} title={mentor.uid ? 'Name comes from the mentor\'s account (Manage Users)' : undefined} onChange={e => updateMentor(mentor.key, { name: e.target.value })} placeholder={`Mentor ${index + 1} name`} className="input-field" style={{ ...inputStyle, flex: 1, ...(mentor.uid ? { opacity: 0.85, cursor: 'default' } : {}) }} />
                      <input type="text" maxLength={120} value={mentor.experience} onChange={e => updateMentor(mentor.key, { experience: e.target.value })} placeholder="Experience (one line), e.g. 15+ years teaching JEE Maths" className="input-field" style={{ ...inputStyle, flex: 2 }} />
                    </div>
                    {mentor.uid && mentorOptions && !mentorOptions.some((o) => o.uid === mentor.uid) ? (
                      <p role="alert" style={{ color: '#ff8a8a', fontSize: '0.75rem' }}>This account is no longer a mentor. Remove it before saving.</p>
                    ) : !mentor.uid ? (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Added by hand earlier (not linked to a mentor account). You can remove it and select the mentor from the list.</p>
                    ) : null}
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                      <input type="file" accept="image/png, image/jpeg, image/webp" onChange={e => { pickMentorPhoto(mentor, e.target.files?.[0] || null); e.target.value = ''; }} className="input-field" style={{ ...inputStyle, padding: '7px', cursor: 'pointer', flex: 1 }} />
                      {(mentor.photoPreview || mentor.photo) && (
                        <button type="button" onClick={() => removeMentorPhoto(mentor)} className="btn" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', fontSize: '0.8rem' }}>Remove photo</button>
                      )}
                      <button type="button" onClick={() => removeMentor(mentor.key)} className="btn" style={{ background: '#ff5e5e', border: 'none', padding: '6px 12px', fontSize: '0.8rem' }}>Remove mentor</button>
                    </div>
                  </div>
                </div>
              ))}
              <MentorPicker
                options={mentorOptions}
                error={mentorOptionsError}
                selected={mentors.filter((m) => m.uid).map((m) => m.uid!)}
                onToggle={toggleMentor}
                max={MAX_MENTORS}
              />
            </div>
          </div>
          {!editing && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.publishNow} onChange={e => update({ publishNow: e.target.checked })} />
              Publish immediately (otherwise saved as a draft, hidden from the app)
            </label>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <button
              type="submit"
              disabled={isSaving}
              className="btn"
              style={{
                alignSelf: 'flex-start',
                marginTop: 'var(--space-sm)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                background: editing ? '#0ea5e9' : 'var(--accent-primary)',
                borderRadius: '999px',
                padding: '10px 24px',
              }}
            >
              {isSaving ? (
                <>
                  <svg className="cms-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                  <span>Saving… {savingTimer > 0 ? `(${savingTimer}s)` : ''}</span>
                </>
              ) : editing ? (
                <span>Update Course Details →</span>
              ) : form.publishNow ? (
                <span>Publish Course →</span>
              ) : (
                <span>Save Draft</span>
              )}
            </button>
            {editing && (
              <button type="button" onClick={resetForm} className="btn" style={{ alignSelf: 'flex-start', marginTop: 'var(--space-sm)', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '999px' }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
