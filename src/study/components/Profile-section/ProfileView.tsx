import React, { useState } from 'react';
import {
  ChevronRight,
  ShieldCheck,
  Lock,
  Camera,
  Share2,
  Pencil,
  Award,
  CheckCircle2,
  User,
  Phone,
  Mail,
  Building2,
  GraduationCap,
  Fingerprint,
  Download,
  Timer,
  Target,
  Flame,
  X,
  Check,
  ArrowLeft,
  RefreshCw,
  School,
  Activity,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';
import { PerformanceProjectionView } from './PerformanceProjectionView';
import { SyllabusVelocityView } from './SyllabusVelocityView';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export interface StudentProfileData {
  fullName: string;
  mobile: string;
  mobileVerified: boolean;
  email: string;
  emailAdded: boolean;
  gender: 'Male' | 'Female' | 'Other' | 'Prefer not to say';
  city: string;
  cityAdded: boolean;
  targetExam: 'IIT-JEE' | 'NEET' | 'UPSC';
  classGrade: string;
  batchLabel: string;
  ssoId: string;
  isPro: boolean;
  centerVerified: boolean;
}

interface ProfileViewProps {
  onBack: () => void;
  profile?: StudentProfileData;
}

const DEFAULT_PROFILE: StudentProfileData = {
  fullName: 'Abhinav Chauhan',
  mobile: '+91 87078 75454',
  mobileVerified: true,
  email: '',
  emailAdded: false,
  gender: 'Male',
  city: '',
  cityAdded: false,
  targetExam: 'IIT-JEE',
  classGrade: 'Class 12th',
  batchLabel: 'Allen Kota Batch 2024-25',
  ssoId: 'ED-04821-X',
  isPro: true,
  centerVerified: false,
};

const TOP_TEN_STATS = [
  { icon: Target, label: 'Predictive AIR Marks Analysis', value: 'AIR 1,420', sub: '+380 positions jump this mock', trend: TrendingUp },
  { icon: Activity, label: 'Overall Syllabus Velocity', value: '68.4%', sub: '14.2 hrs remaining for Physics Phase 2' },
  { icon: HelpCircle, label: 'AI Accuracy Rate', value: '84.2%', sub: 'Highest in Organic Chem (+6% vs Avg)', trend: TrendingUp },
];

/* ------------------------------------------------------------------ */
/*  Small shared bits                                                   */
/* ------------------------------------------------------------------ */

function DetailCard({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
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

function EditInput({
  value,
  onChange,
  type = 'text',
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'email' | 'tel';
  options?: string[];
  placeholder?: string;
}) {
  if (options) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-[#175A67]/20 text-[#175A67] text-sm font-bold px-2.5 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#175A67]/25"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-white border border-[#175A67]/20 text-[#175A67] text-sm font-bold px-2.5 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#175A67]/25 placeholder-[#2A707C]/50"
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Main view                                                           */
/* ------------------------------------------------------------------ */

export function ProfileView({ onBack, profile }: ProfileViewProps) {
  const [data, setData] = useState<StudentProfileData>(profile ?? DEFAULT_PROFILE);
  const [draft, setDraft] = useState<StudentProfileData>(profile ?? DEFAULT_PROFILE);
  const [isEditing, setIsEditing] = useState(false);
  const [bonusClaimed, setBonusClaimed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showPerformanceProjection, setShowPerformanceProjection] = useState(false);
  const [showSyllabusVelocity, setShowSyllabusVelocity] = useState(false);

  const view = isEditing ? draft : data;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const startEdit = () => {
    setDraft(data);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setDraft(data);
    setIsEditing(false);
  };

  const saveEdit = () => {
    const emailJustAdded = !data.emailAdded && draft.email.trim().length > 0;
    const cityJustAdded = !data.cityAdded && draft.city.trim().length > 0;
    const updated: StudentProfileData = {
      ...draft,
      emailAdded: draft.email.trim().length > 0,
      cityAdded: draft.city.trim().length > 0,
    };
    setData(updated);
    setIsEditing(false);
    if (emailJustAdded) showToast('Email added — +25 XP earned!');
    else if (cityJustAdded) showToast('City updated.');
    else showToast('Profile updated.');
  };

  const update = (key: keyof StudentProfileData) => (value: string) =>
    setDraft((d) => ({ ...d, [key]: value } as StudentProfileData));

  const handleVerifyCenter = () => {
    setData((d) => ({ ...d, centerVerified: true }));
    showToast('Test center verified successfully!');
  };

  const handleClaimBonus = () => {
    setBonusClaimed(true);
    showToast('+50 pts bonus claimed!');
  };

  const handleDownloadId = () => showToast('Downloading your Student ID card…');
  const handleShareProfile = () => showToast('Profile link copied to clipboard!');

  // Sub-pages temporarily disabled until completely ready
  // const handleOpenAirRankDetail = () => setShowPerformanceProjection(true);
  // const handleOpenSyllabusVelocity = () => setShowSyllabusVelocity(true);

  // Profile strength: Name + Mobile + Stream always complete; Email is the 4th step
  const completedSteps = ['Name', 'Mobile', 'Stream', ...(data.emailAdded ? ['Email'] : [])];
  const strengthPct = Math.round((completedSteps.length / 4) * 100);
  const strengthLabel = strengthPct >= 100 ? 'All Set' : strengthPct >= 75 ? 'Intermediate' : strengthPct >= 50 ? 'Getting Started' : 'New';
  const missingItems = [
    ...(!data.emailAdded ? ['Email'] : []),
    ...(!data.centerVerified ? ['Center'] : []),
  ];

  const initials = data.fullName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  /* Sub-pages commented out until inner pages are finished
  if (showPerformanceProjection) {
    return (
      <>
        <PerformanceProjectionView
          onBack={() => setShowPerformanceProjection(false)}
          onOpenSubjectBreakdown={() => showToast('Loading subject-wise breakdown…')}
          onOpenTestHistory={() => showToast('Opening your test history…')}
          onPracticeDrills={(spot) => showToast(`Loading ${spot.drillCount} drills for ${spot.topic}…`)}
        />
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-[#175A67] text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            {toast}
          </div>
        )}
      </>
    );
  }

  if (showSyllabusVelocity) {
    return (
      <>
        <SyllabusVelocityView
          onBack={() => setShowSyllabusVelocity(false)}
          onViewChapterChecklist={() => showToast('Opening chapter checklist…')}
          onOpenRevisionPlan={() => showToast('Opening Chemistry revision plan…')}
          onOpenSubject={(subject) => showToast(`Loading ${subject.subject} chapter-wise detail…`)}
        />
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-[#175A67] text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            {toast}
          </div>
        )}
      </>
    );
  }
  */

  return (
    <div className="bg-[#DCEAE3] rounded-[28px] p-4 sm:p-6 lg:p-8 pb-10 relative">
      {/* Breadcrumb + title */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold">
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-[#40484B] hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Settings
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-[#40484B]" />
            <span className="text-[#40484B]">Account Profile</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#0B1C30] mt-1.5">Student Profile &amp; Preferences</h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-bold bg-sky-100 text-sky-700 px-3 py-1.5 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" />
            SSO ID: {data.ssoId}
          </span>
          <button className="flex items-center gap-1.5 text-xs font-bold bg-white hover:bg-white/80 text-[#175A67] px-3.5 py-1.5 rounded-full shadow-sm transition-all active:scale-95">
            <Lock className="w-3.5 h-3.5" />
            Security
          </button>
        </div>
      </div>

      {/* Hero card */}
      <div className="bg-gradient-to-r from-white to-[#EAF6F1] rounded-2xl p-5 sm:p-6 shadow-[0_6px_24px_rgb(0,0,0,0.05)] flex flex-col sm:flex-row sm:items-center justify-between gap-5 mb-6">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#175A67] to-[#2A707C] p-1">
              <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-xl font-black text-[#175A67]">
                {initials}
              </div>
            </div>
            <button
              title="Change photo"
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-amber-300 hover:bg-amber-400 border-2 border-white flex items-center justify-center text-[#175A67] transition-all active:scale-95"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-[#0B1C30] uppercase tracking-tight">{data.fullName}</h2>
              <span className="flex items-center gap-1 text-[10px] font-bold bg-[#003441] text-white px-2.5 py-1 rounded-full text-[#9FF0FB]">
                <GraduationCap className="w-3 h-3" />
                ER Student Master
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {data.isPro && (
                <span className="text-[11px] font-bold bg-sky-100 text-sky-700 px-2.5 py-0.5 rounded-full">PRO Subscriber</span>
              )}
              <span className="flex items-center gap-1 text-[11px] font-semibold text-[#2A707C]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                Profile Active
              </span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-[#2A707C]">
                <RefreshCw className="w-3 h-3" />
                Synced across 2 active devices
              </span>
            </div>
            <p className="flex items-center gap-1.5 text-[11px] text-[#2A707C] font-medium mt-1.5">
              <School className="w-3.5 h-3.5" />
              {data.batchLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleShareProfile}
            className="flex items-center gap-1.5 bg-white hover:bg-white/80 text-[#0B1C30] font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all active:scale-95"
          >
            <Share2 className="w-4 h-4" />
            Share Profile
          </button>
          {!isEditing ? (
            <button
              onClick={startEdit}
              className="flex items-center gap-1.5 bg-[#0F3B42] hover:bg-[#0b2c31] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all active:scale-95"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit Profile
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1.5 bg-white text-[#175A67] font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-sm transition-all active:scale-95"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="flex items-center gap-1.5 bg-[#10B981] hover:bg-[#059669] text-white font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-sm transition-all active:scale-95"
              >
                <Check className="w-3.5 h-3.5" />
                Save
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
              <h3 className="font-bold text-[#0B1C30] text-sm sm:text-base whitespace-nowrap">
                Profile Strength: {strengthPct}%
              </h3>
              <span className="text-[10px] font-bold bg-sky-100 text-sky-700 px-2.5 py-1 rounded-full">{strengthLabel}</span>
              <span className="text-[11px] font-semibold text-[#2A707C]">{completedSteps.length} of 4 Done</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[#175A67]/10 overflow-hidden mt-2.5">
              <div className="h-full bg-[#0F3B42] rounded-full transition-all duration-500" style={{ width: `${strengthPct}%` }} />
            </div>
            <div className="flex items-center gap-4 flex-wrap mt-2 text-[11px] font-medium">
              <span className="text-[#2A707C]">
                Completed: <span className="text-[#175A67] font-semibold">{completedSteps.join(', ')}</span>
              </span>
              {missingItems.length > 0 && (
                <span className="text-[#2A707C]">
                  Missing: <span className="text-red-500 font-semibold">{missingItems.join(', ')}</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!data.emailAdded && (
              <button
                onClick={startEdit}
                className="flex items-center gap-1.5 bg-sky-100 hover:bg-sky-200 text-[#0B1C30] text-xs font-bold pl-3 pr-1 py-1.5 rounded-full transition-all active:scale-95"
              >
                <Mail className="w-3.5 h-3.5" />
                Add Email
                <span className="bg-white text-sky-700 text-[10px] font-black px-2 py-1 rounded-full">+25 XP</span>
              </button>
            )}
            <button
              onClick={handleVerifyCenter}
              disabled={data.centerVerified}
              className="flex items-center gap-1.5 bg-[#EAF3F1] hover:bg-[#dcece7] disabled:opacity-60 text-[#0B1C30] text-xs font-bold px-3.5 py-2 rounded-full transition-all active:scale-95"
            >
              <Target className="w-3.5 h-3.5" />
              {data.centerVerified ? 'Center Verified' : 'Verify Center'}
            </button>
            <button
              onClick={handleClaimBonus}
              disabled={bonusClaimed}
              className="flex items-center gap-1.5 bg-amber-200 hover:bg-amber-300 disabled:opacity-60 text-[#2A1700] text-xs font-bold px-3.5 py-2 rounded-full transition-all active:scale-95"
            >
              <Award className="w-3.5 h-3.5" />
              {bonusClaimed ? 'Bonus Claimed' : 'Claim Bonus'}
            </button>
          </div>
        </div>
      </div>

      {/* Personal & Academic Details */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-[0_6px_24px_rgb(0,0,0,0.05)] mb-6">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF3F1] flex items-center justify-center shrink-0">
              <User className="w-4.5 h-4.5 text-[#175A67]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#0B1C30] text-sm sm:text-base">Personal &amp; Academic Details</h3>
              <p className="text-xs text-[#2A707C] mt-0.5">Manage your contact credentials, center allocation, and target exam stream.</p>
            </div>
          </div>
          <button
            onClick={handleDownloadId}
            className="flex items-center gap-1.5 text-xs font-bold bg-[#EAF3F1] hover:bg-[#dcece7] text-[#40484B] px-3.5 py-2 rounded-full transition-all active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            Download Student ID
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Full Name */}
          <DetailCard label="Full Name" icon={User}>
            {isEditing ? (
              <EditInput value={draft.fullName} onChange={update('fullName')} />
            ) : (
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#003441] text-sm uppercase truncate">{data.fullName}</span>
                <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 ml-2" />
              </div>
            )}
          </DetailCard>

          {/* Mobile */}
          <DetailCard label="Mobile Number" icon={Phone}>
            {isEditing ? (
              <EditInput value={draft.mobile} onChange={update('mobile')} type="tel" />
            ) : (
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#0B1C30] text-sm truncate">{data.mobile}</span>
                {data.mobileVerified && (
                  <span className="flex items-center gap-1 text-[10px] font-bold bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full shrink-0 ml-2">
                    <CheckCircle2 className="w-3 h-3" /> Verified
                  </span>
                )}
              </div>
            )}
          </DetailCard>

          {/* Email */}
          <DetailCard label="Email Address" icon={Mail}>
            {isEditing ? (
              <EditInput value={draft.email} onChange={update('email')} type="email" placeholder="you@example.com" />
            ) : data.emailAdded ? (
              <span className="font-semibold text-[#0B1C30] text-sm truncate block">{data.email}</span>
            ) : (
              <button onClick={startEdit} className="flex items-center justify-between w-full text-left group">
                <span className="font-bold text-[#006972] text-sm group-hover:underline">+ Add Email Address</span>
                <span className="bg-amber-200 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ml-2">+25 XP</span>
              </button>
            )}
          </DetailCard>

          {/* Gender */}
          <DetailCard label="Gender" icon={User}>
            {isEditing ? (
              <EditInput
                value={draft.gender}
                onChange={update('gender')}
                options={['Male', 'Female', 'Other', 'Prefer not to say']}
              />
            ) : (
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#0B1C30] text-sm">{data.gender}</span>
                <span className="text-[10px] font-semibold text-[#2A707C] shrink-0 ml-2">Self-Declared</span>
              </div>
            )}
          </DetailCard>

          {/* City */}
          <DetailCard label="Living City / Town" icon={Building2}>
            {isEditing ? (
              <EditInput value={draft.city} onChange={update('city')} placeholder="e.g. Jaipur" />
            ) : data.cityAdded ? (
              <span className="font-semibold text-[#0B1C30] text-sm truncate block">{data.city}</span>
            ) : (
              <button onClick={startEdit} className="flex items-center justify-between w-full text-left group">
                <span className="font-semibold text-[#70787C] text-sm">Not Specified</span>
                <span className="text-xs font-semibold text-[#40484B] group-hover:underline shrink-0 ml-2">Add City</span>
              </button>
            )}
          </DetailCard>

          {/* Target Exam */}
          <DetailCard label="Target Exam & Stream" icon={GraduationCap}>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <EditInput
                  value={draft.targetExam}
                  onChange={update('targetExam')}
                  options={['IIT-JEE', 'NEET', 'UPSC']}
                />
                <EditInput value={draft.classGrade} onChange={update('classGrade')} placeholder="Class 12th" />
              </div>
            ) : (
              <button onClick={startEdit} className="flex items-center justify-between w-full text-left group">
                <span className="font-semibold text-[#003441] text-sm truncate">
                  {data.targetExam} ({data.classGrade})
                </span>
                <span className="text-xs font-bold text-[#175A67] group-hover:underline shrink-0 ml-2">Change</span>
              </button>
            )}
          </DetailCard>
        </div>
      </div>

      {/* Bottom stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-[0_4px_18px_rgb(0,0,0,0.05)] flex items-center gap-3 select-none">
          <div className="w-10 h-10 rounded-xl bg-[#EAF3F1] flex items-center justify-center shrink-0">
            <Timer className="w-4.5 h-4.5 text-[#175A67]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-[#70787C] uppercase tracking-wide">Avg. Mock Pace</p>
            <p className="text-base font-semibold text-[#0B1C30] mt-0.5">
              1m 14s <span className="text-xs font-semibold text-[#006972]">/ question</span>
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-[0_4px_18px_rgb(0,0,0,0.05)] flex items-center gap-3 select-none">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <Award className="w-4.5 h-4.5 text-amber-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-[#70787C] uppercase tracking-wide">AIR Marks Prediction</p>
            <p className="text-base font-semibold text-[#0B1C30] mt-0.5">
              Top 1.2% <span className="text-xs font-semibold text-[#643D00]">AIR ~2,840</span>
            </p>
          </div>
        </div>
            
        <div className="bg-white rounded-2xl p-4 shadow-[0_4px_18px_rgb(0,0,0,0.05)] flex items-center gap-3 select-none">
          <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
            <Flame className="w-4.5 h-4.5 text-sky-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-[#70787C] uppercase tracking-wide">Daily Streak</p>
            <p className="text-base font-semibold text-[#0B1C30] mt-0.5">
              18 Days <span className="text-xs font-semibold text-[#006972]">Personal Best</span>
            </p>
          </div>
        </div>
      </div>

      {/* Rank & Performance Insight Tiles (Static, non-clickable, no hover) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
        {TOP_TEN_STATS.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-2xl p-4 shadow-[0_4px_18px_rgb(0,0,0,0.05)] flex items-start gap-3 select-none"
          >
            <div className="w-9 h-9 rounded-xl bg-[#EAF3F1] flex items-center justify-center text-[#175A67] shrink-0">
              <stat.icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-[#40484B] uppercase tracking-wide">{stat.label}</p>
              <p className="text-lg font-semibold font-black text-[#003441] mt-0.5">{stat.value}</p>
              <p className="text-[11px] text-[#006972] mt-0.5 flex items-center gap-1">
                {stat.trend && <stat.trend className="w-3 h-3 text-emerald-500 shrink-0" />}
                <span className="truncate">{stat.sub}</span>
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-[#175A67] text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
          {toast}
        </div>
      )}
    </div>
  );
}

export default ProfileView;
