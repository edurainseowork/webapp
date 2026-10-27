import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronRight,
  Camera,
  Pencil,
  Award,
  CheckCircle2,
  User,
  Phone,
  Mail,
  Building2,
  GraduationCap,
  Timer,
  Target,
  Flame,
  X,
  Check,
  ArrowLeft,
  School,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Trash2,
  CalendarDays,
  Activity,
  HelpCircle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { useAuth } from '../../AuthGate';
import type { StudentGoal } from '../../lib/goal';
import {
  PHOTO_MAX_BYTES,
  PHOTO_TYPES,
  fetchProfile,
  removeProfilePhoto,
  updateProfile,
  uploadProfilePhoto,
  type Gender,
  type StudentProfile,
} from '../../lib/profile';

/* ------------------------------------------------------------------ */
/*  Student profile — everything comes from the database               */
/*   GET / PATCH /api/profile, POST / DELETE /api/profile/photo,       */
/*   goal (target exam) via /api/me/goal, goals = CMS categories.      */
/* ------------------------------------------------------------------ */

interface ProfileViewProps {
  onBack: () => void;
  /** The student's goal (target exam), chosen in the goal popup; read-only here */
  goal: StudentGoal | null;
  /** Keeps the top-bar avatar in step with the profile photo */
  onPhotoChange?: (url: string | null) => void;
}

type Draft = {
  name: string;
  phone: string;
  gender: Gender | '';
  city: string;
  state: string;
};

const GENDERS: { value: Gender | ''; label: string }[] = [
  { value: '', label: 'Not specified' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];
const genderLabel = (g: Gender | null) => GENDERS.find((x) => x.value === (g ?? ''))?.label ?? 'Not specified';

const PHONE_RE = /^\+?[0-9]{10,15}$/;
const cleanPhone = (v: string) => v.replace(/[\s()-]/g, '');

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase() || '?';

const formatMonth = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

const formatPace = (seconds: number) => (seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`);

/* ------------------------------------------------------------------ */
/*  Small shared bits                                                   */
/* ------------------------------------------------------------------ */

function DetailCard({ label, icon: Icon, children }: { label: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="bg-[#EAF3F1]/70 rounded-2xl px-4 py-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-[#70787C] uppercase tracking-wide">{label}</span>
        <Icon className="w-3.5 h-3.5 text-[#2A707C]" />
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

const inputClass =
  'w-full bg-white border border-[#175A67]/20 text-[#175A67] text-sm font-bold px-2.5 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#175A67]/25 placeholder-[#2A707C]/50';

/** One activity tile; `sub` is a muted note, `trend` adds an up / down arrow before it. */
function StatTile({
  icon: Icon,
  tone,
  label,
  value,
  accent,
  accentClass = 'text-[#006972]',
  sub,
  trend,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  label: string;
  value: string;
  /** Small text right after the value, e.g. "/ question" */
  accent?: string;
  accentClass?: string;
  sub?: string;
  trend?: 'up' | 'down';
}) {
  const Trend = trend === 'down' ? TrendingDown : TrendingUp;
  return (
    <div className="bg-white rounded-2xl p-4 shadow-[0_4px_18px_rgb(0,0,0,0.05)] flex items-start gap-3 select-none">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-[#70787C] uppercase tracking-wide">{label}</p>
        <p className="text-base font-semibold text-[#0B1C30] mt-0.5 truncate">
          {value} {accent && <span className={`text-xs font-semibold ${accentClass}`}>{accent}</span>}
        </p>
        {sub && (
          <p className="text-[11px] text-[#006972] mt-0.5 flex items-center gap-1 min-w-0">
            {trend && <Trend className={`w-3 h-3 shrink-0 ${trend === 'down' ? 'text-red-500' : 'text-emerald-500'}`} />}
            <span className="truncate">{sub}</span>
          </p>
        )}
      </div>
    </div>
  );
}

const formatNumber = (n: number) => n.toLocaleString('en-IN');

/* ------------------------------------------------------------------ */
/*  Main view                                                           */
/* ------------------------------------------------------------------ */

export function ProfileView({ onBack, goal, onPhotoChange }: ProfileViewProps) {
  const { updateSessionName } = useAuth();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number>();

  const showToast = (text: string, error = false) => {
    setToast({ text, error });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2800);
  };

  const load = async () => {
    setLoadError(null);
    try {
      setProfile(await fetchProfile());
    } catch (err) {
      setLoadError(errorText(err, 'Could not load your profile.'));
    }
  };

  useEffect(() => {
    void load();
    return () => window.clearTimeout(toastTimer.current);
  }, []);

  // Show the same photo in the top bar (after load, upload and remove)
  const photo = profile?.profilePhoto;
  useEffect(() => {
    if (photo !== undefined) onPhotoChange?.(photo);
  }, [photo, onPhotoChange]);


  const startEdit = () => {
    if (!profile) return;
    setDraft({
      name: profile.name ?? '',
      phone: profile.phone ?? '',
      gender: profile.gender ?? '',
      city: profile.city ?? '',
      state: profile.state ?? '',
      
    });
    setFormError(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    if (saving) return;
    setIsEditing(false);
    setDraft(null);
    setFormError(null);
  };

  const update = <K extends keyof Draft>(key: K) => (value: Draft[K]) => {
    setFormError(null);
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  };

  const saveEdit = async () => {
    if (!draft || !profile || saving) return;
    const name = draft.name.trim().replace(/\s+/g, ' ');
    const phone = cleanPhone(draft.phone.trim());
    if (name.length < 2) return setFormError('Name must be at least 2 characters.');
    if (name.length > 80) return setFormError('Name is too long.');
    if (phone && !PHONE_RE.test(phone)) return setFormError('Enter a valid mobile number (10 to 15 digits).');

    setSaving(true);
    setFormError(null);
    try {
      const saved = await updateProfile({
        name,
        phone: phone || null,
        gender: draft.gender || null,
        city: draft.city.trim() || null,
        state: draft.state.trim() || null,
      });

      setProfile(saved);
      if (saved.name) updateSessionName(saved.name);
      setIsEditing(false);
      setDraft(null);
      showToast('Profile saved.');
    } catch (err) {
      setFormError(errorText(err, 'Could not save your profile. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) return showToast('Photo must be a PNG, JPEG or WEBP image.', true);
    if (file.size > PHOTO_MAX_BYTES) return showToast('Photo must be 2 MB or smaller.', true);
    setPhotoBusy(true);
    try {
      setProfile(await uploadProfilePhoto(file));
      showToast('Photo updated.');
    } catch (err) {
      showToast(errorText(err, 'Could not upload the photo.'), true);
    } finally {
      setPhotoBusy(false);
    }
  };

  const deletePhoto = async () => {
    setPhotoBusy(true);
    try {
      setProfile(await removeProfilePhoto());
      showToast('Photo removed.');
    } catch (err) {
      showToast(errorText(err, 'Could not remove the photo.'), true);
    } finally {
      setPhotoBusy(false);
    }
  };

  /* ---------- Loading / error ---------- */

  const shell = (children: React.ReactNode) => (
    <div className="bg-[#DCEAE3] rounded-[28px] p-4 sm:p-6 lg:p-8 pb-10 relative animate-tab-content">
      <div className="mb-5">
        <div className="flex items-center gap-2 text-xs font-bold">
          <button onClick={onBack} className="flex items-center gap-1 text-[#40484B] hover:underline">
            <ArrowLeft className="w-3.5 h-3.5" />
            Settings
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-[#40484B]" />
          <span className="text-[#40484B]">Account Profile</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-[#0B1C30] mt-1.5">Student Profile &amp; Preferences</h1>
      </div>
      {children}
    </div>
  );

  if (loadError && !profile) {
    return shell(
      <div className="bg-white rounded-2xl py-14 px-6 flex flex-col items-center text-center shadow-[0_6px_24px_rgb(0,0,0,0.05)]">
        <AlertTriangle className="w-6 h-6 text-amber-500 mb-2" />
        <p className="font-semibold text-[#0B1C30]">Couldn&apos;t load your profile</p>
        <p className="text-xs text-[#2A707C] mt-1">{loadError}</p>
        <button onClick={() => void load()} className="mt-4 flex items-center gap-1.5 bg-[#0F3B42] text-white text-xs font-bold px-4 py-2 rounded-xl">
          <RefreshCw className="w-3.5 h-3.5" /> Try again
        </button>
      </div>,
    );
  }

  if (!profile) {
    return shell(
      <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading your profile">
        <div className="bg-white rounded-2xl p-6 flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-[#EAF3F1]" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-48 rounded bg-slate-200" />
            <div className="h-3 w-64 rounded bg-slate-100" />
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-[#EAF3F1]" />
          ))}
        </div>
      </div>,
    );
  }

  /* ---------- Data ---------- */

  const displayName = profile.name?.trim() || profile.email.split('@')[0];
  const location = [profile.city, profile.state].filter(Boolean).join(', ');
  const checklist: { label: string; done: boolean }[] = [
    { label: 'Name', done: !!profile.name?.trim() },
    { label: 'Mobile', done: !!profile.phone },
    { label: 'Email', done: !!profile.email },
    { label: 'Target Exam', done: !!goal },
    { label: 'Gender', done: !!profile.gender },
    { label: 'City', done: !!profile.city },
    { label: 'Photo', done: !!profile.profilePhoto },
  ];
  const completed = checklist.filter((c) => c.done);
  const missing = checklist.filter((c) => !c.done);
  const strengthPct = Math.round((completed.length / checklist.length) * 100);
  const strengthLabel = strengthPct >= 100 ? 'All Set' : strengthPct >= 70 ? 'Intermediate' : strengthPct >= 40 ? 'Getting Started' : 'New';
  const stats = profile.stats ?? null;
  const streak = profile.streak;
  const accuracyDiff = stats?.accuracy && stats.accuracy.platformPercent !== null ? Math.round((stats.accuracy.percent - stats.accuracy.platformPercent) * 10) / 10 : null;
  const gained = stats?.latestTest?.positionsGained ?? null;
  const courseNames = profile.courses.map((c) => c.title);

  return shell(
    <>
      {/* Hero card */}
      <div className="bg-gradient-to-r from-white to-[#EAF6F1] rounded-2xl p-5 sm:p-6 shadow-[0_6px_24px_rgb(0,0,0,0.05)] flex flex-col sm:flex-row sm:items-center justify-between gap-5 mb-6">
        <div className="flex items-center gap-4 min-w-0">
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#175A67] to-[#2A707C] p-1">
              {profile.profilePhoto ? (
                <img src={profile.profilePhoto} alt="" className="w-full h-full rounded-full object-cover bg-white" />
              ) : (
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-xl font-black text-[#175A67]">{initialsOf(displayName)}</div>
              )}
            </div>
            <button
              title="Change photo"
              onClick={() => fileRef.current?.click()}
              disabled={photoBusy}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-amber-300 hover:bg-amber-400 border-2 border-white flex items-center justify-center text-[#175A67] transition-all active:scale-95 disabled:opacity-60"
            >
              {photoBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png, image/jpeg, image/webp"
              aria-label="Profile photo"
              className="hidden"
              onChange={(e) => {
                void pickPhoto(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>

          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-[#0B1C30] uppercase tracking-tight truncate">{displayName}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {goal ? (
                <span className="flex items-center gap-1 text-[11px] font-bold bg-[#003441] text-[#9FF0FB] px-2.5 py-0.5 rounded-full">
                  <GraduationCap className="w-3 h-3" />
                  {goal.name}
                </span>
              ) : (
                <span className="text-[11px] font-bold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full">Target exam not set</span>
              )}
              <span className="flex items-center gap-1 text-[11px] font-semibold text-[#2A707C]">
                <CalendarDays className="w-3 h-3" />
                Member since {formatMonth(profile.memberSince)}
              </span>
              {profile.profilePhoto && (
                <button onClick={() => void deletePhoto()} disabled={photoBusy} className="flex items-center gap-1 text-[11px] font-semibold text-[#70787C] hover:text-red-600 disabled:opacity-60">
                  <Trash2 className="w-3 h-3" />
                  Remove photo
                </button>
              )}
            </div>
            <p className="flex items-center gap-1.5 text-[11px] text-[#2A707C] font-medium mt-1.5 min-w-0" title={courseNames.join(', ')}>
              <School className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{courseNames.length ? `Enrolled: ${courseNames.join(', ')}` : 'Not enrolled in a course yet'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {!isEditing ? (
            <button onClick={startEdit} className="flex items-center gap-1.5 bg-[#0F3B42] hover:bg-[#0b2c31] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all active:scale-95">
              <Pencil className="w-3.5 h-3.5" />
              Edit Profile
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={cancelEdit} disabled={saving} className="flex items-center gap-1.5 bg-white text-[#175A67] font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-60">
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
              <button onClick={() => void saveEdit()} disabled={saving} className="flex items-center gap-1.5 bg-[#10B981] hover:bg-[#059669] text-white font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-70">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Profile Strength card */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-[0_6px_24px_rgb(0,0,0,0.05)] mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="font-bold text-[#0B1C30] text-sm sm:text-base whitespace-nowrap">Profile Strength: {strengthPct}%</h3>
              <span className="text-[10px] font-bold bg-sky-100 text-sky-700 px-2.5 py-1 rounded-full">{strengthLabel}</span>
              <span className="text-[11px] font-semibold text-[#2A707C]">
                {completed.length} of {checklist.length} Done
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[#175A67]/10 overflow-hidden mt-2.5">
              <div className="h-full bg-[#0F3B42] rounded-full transition-all duration-500" style={{ width: `${strengthPct}%` }} />
            </div>
            <div className="flex items-center gap-4 flex-wrap mt-2 text-[11px] font-medium">
              <span className="text-[#2A707C]">
                Completed: <span className="text-[#175A67] font-semibold">{completed.map((c) => c.label).join(', ') || '—'}</span>
              </span>
              {missing.length > 0 && (
                <span className="text-[#2A707C]">
                  Missing: <span className="text-red-500 font-semibold">{missing.map((c) => c.label).join(', ')}</span>
                </span>
              )}
            </div>
          </div>
          {missing.length > 0 && !isEditing && (
            <button
              onClick={() => (missing.length === 1 && missing[0].label === 'Photo' ? fileRef.current?.click() : startEdit())}
              className="flex items-center gap-1.5 bg-sky-100 hover:bg-sky-200 text-[#0B1C30] text-xs font-bold px-3.5 py-2 rounded-full transition-all active:scale-95 shrink-0 self-start lg:self-auto"
            >
              <Pencil className="w-3.5 h-3.5" />
              Complete Profile
            </button>
          )}
        </div>
      </div>

      {/* Personal & Academic Details */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-[0_6px_24px_rgb(0,0,0,0.05)] mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#EAF3F1] flex items-center justify-center shrink-0">
            <User className="w-4.5 h-4.5 text-[#175A67]" />
          </div>
          <div>
            <h3 className="font-semibold text-[#0B1C30] text-sm sm:text-base">Personal &amp; Academic Details</h3>
            <p className="text-xs text-[#2A707C] mt-0.5">Manage your contact details and location.</p>
          </div>
        </div>

        {formError && (
          <p role="alert" className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 rounded-xl px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {formError}
          </p>
        )}

<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <DetailCard label="Full Name" icon={User}>
            {isEditing && draft ? (
              <input className={inputClass} value={draft.name} maxLength={80} onChange={(e) => update('name')(e.target.value)} aria-label="Full name" />
            ) : (
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#003441] text-sm uppercase truncate">{profile.name || 'Not specified'}</span>
                {profile.name && <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 ml-2" />}
              </div>
            )}
          </DetailCard>

          <DetailCard label="Mobile Number" icon={Phone}>
            {isEditing && draft ? (
              <input className={inputClass} type="tel" value={draft.phone} maxLength={20} placeholder="e.g. 9876543210" onChange={(e) => update('phone')(e.target.value)} aria-label="Mobile number" />
            ) : profile.phone ? (
              <span className="font-semibold text-[#0B1C30] text-sm truncate block">{profile.phone}</span>
            ) : (
              <button onClick={startEdit} className="font-bold text-[#006972] text-sm hover:underline">
                + Add Mobile Number
              </button>
            )}
          </DetailCard>

          <DetailCard label="Target Exam & Stream" icon={GraduationCap}>
            <span className={`font-semibold text-sm truncate block ${goal ? 'text-[#003441]' : 'text-[#70787C]'}`}>{goal?.name ?? 'Not set'}</span>
          </DetailCard>

          <DetailCard label="Gender" icon={User}>
            {isEditing && draft ? (
              <select className={inputClass} value={draft.gender} onChange={(e) => update('gender')(e.target.value as Gender | '')} aria-label="Gender">
                {GENDERS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className={`font-semibold text-sm ${profile.gender ? 'text-[#0B1C30]' : 'text-[#70787C]'}`}>{genderLabel(profile.gender)}</span>
            )}
          </DetailCard>

          <DetailCard label="City / State" icon={Building2}>
            {isEditing && draft ? (
              <div className="flex items-center gap-2">
                <input className={inputClass} value={draft.city} maxLength={80} placeholder="City" onChange={(e) => update('city')(e.target.value)} aria-label="City" />
                <input className={inputClass} value={draft.state} maxLength={80} placeholder="State" onChange={(e) => update('state')(e.target.value)} aria-label="State" />
              </div>
            ) : location ? (
              <span className="font-semibold text-[#0B1C30] text-sm truncate block">{location}</span>
            ) : (
              <button onClick={startEdit} className="flex items-center justify-between w-full text-left group">
                <span className="font-semibold text-[#70787C] text-sm">Not Specified</span>
                <span className="text-xs font-semibold text-[#40484B] group-hover:underline shrink-0 ml-2">Add City</span>
              </button>
            )}
          </DetailCard>

          <DetailCard label="Email Address" icon={Mail}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-[#0B1C30] text-sm truncate" title={profile.email}>
                {profile.email}
              </span>
              <span className="text-[10px] font-semibold text-[#2A707C] shrink-0">Login email</span>
            </div>
          </DetailCard>
        </div>
      </div>

      {/* Activity — real numbers from tests, lessons and logins; "—" until there is data */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile
          icon={Timer}
          tone="bg-[#EAF3F1] text-[#175A67]"
          label="Avg. Mock Pace"
          value={stats?.pace ? formatPace(stats.pace.secondsPerQuestion) : '—'}
          accent={stats?.pace ? '/ question' : undefined}
          sub={stats?.pace ? `Across ${stats.pace.tests} submitted test${stats.pace.tests === 1 ? '' : 's'}` : 'Shown after your first test'}
        />
        <StatTile
          icon={Award}
          tone="bg-amber-100 text-amber-500"
          label="AIR Marks Prediction"
          value={stats?.standing ? `Top ${stats.standing.topPercent}%` : '—'}
          accent={stats?.standing ? `AIR ~${formatNumber(stats.standing.rank)}` : undefined}
          accentClass="text-[#643D00]"
          sub={stats?.standing ? `Avg ${stats.standing.averagePercent}% marks • ${formatNumber(stats.standing.students)} students` : 'Shown after your first test'}
        />
        <StatTile
          icon={Flame}
          tone="bg-sky-100 text-sky-600"
          label="Daily Streak"
          value={`${streak.current} Day${streak.current === 1 ? '' : 's'}`}
          accent={streak.current > 0 && streak.current >= streak.longest ? 'Personal Best' : undefined}
          sub={streak.current > 0 && streak.current >= streak.longest ? 'Keep it going tomorrow' : `Best: ${streak.longest} day${streak.longest === 1 ? '' : 's'}`}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
        <StatTile
          icon={Target}
          tone="bg-[#EAF3F1] text-[#175A67]"
          label="Predictive AIR Marks Analysis"
          value={stats?.latestTest ? `AIR ${formatNumber(stats.latestTest.rank)}` : '—'}
          accent={stats?.latestTest ? `${stats.latestTest.score}/${stats.latestTest.maxMarks} marks` : undefined}
          sub={
            !stats?.latestTest
              ? 'Shown after your first test'
              : gained === null
              ? `In ${stats.latestTest.title} (first mock)`
              : gained > 0
              ? `+${formatNumber(gained)} positions jump this mock`
              : gained < 0
              ? `${formatNumber(Math.abs(gained))} positions down this mock`
              : 'Same position as last mock'
          }
          trend={gained === null || gained === 0 ? undefined : gained > 0 ? 'up' : 'down'}
        />
        <StatTile
          icon={Activity}
          tone="bg-[#EAF3F1] text-[#175A67]"
          label="Overall Syllabus Velocity"
          value={stats?.syllabus ? `${stats.syllabus.percent}%` : '—'}
          sub={
            !stats?.syllabus
              ? courseNames.length
                ? 'No lessons in your courses yet'
                : 'Enrol in a course to start'
              : stats.syllabus.focus
              ? `${stats.syllabus.focus.remaining} lesson${stats.syllabus.focus.remaining === 1 ? '' : 's'} remaining in ${stats.syllabus.focus.title}`
              : `All ${stats.syllabus.total} lessons done`
          }
        />
        <StatTile
          icon={HelpCircle}
          tone="bg-[#EAF3F1] text-[#175A67]"
          label="AI Accuracy Rate"
          value={stats?.accuracy ? `${stats.accuracy.percent}%` : '—'}
          sub={
            !stats?.accuracy
              ? 'Shown after your first test'
              : accuracyDiff === null || accuracyDiff === 0
              ? `${stats.accuracy.correct} of ${stats.accuracy.answered} answers correct`
              : `${accuracyDiff > 0 ? '+' : ''}${accuracyDiff}% vs average student • ${stats.accuracy.correct}/${stats.accuracy.answered} correct`
          }
          trend={accuracyDiff === null || accuracyDiff === 0 ? undefined : accuracyDiff > 0 ? 'up' : 'down'}
        />
      </div>

      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2 animate-fadeIn ${
            toast.error ? 'bg-red-600' : 'bg-[#175A67]'
          }`}
        >
          {toast.error ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4 text-[#10B981]" />}
          {toast.text}
        </div>
      )}
    </>,
  );
}

export default ProfileView;