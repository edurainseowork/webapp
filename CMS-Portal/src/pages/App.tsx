import edurainLogo from '../assets/logo.webp'
import { useState, useEffect, useRef } from 'react'
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, sendEmailVerification, type User } from 'firebase/auth'
import { auth } from '../firebase'
import { apiFetch, uploadFile, API_BASE_URL, type AdminCourse } from '../api'
import CourseManager from './CourseManager'
import CategoryManager from './CategoryManager'
import CourseContentManager from './CourseContentManager'
import EBookUploadManager from './EBookUploadManager'
import RoleGuard from '../components/RoleGuard'
import type { AllowedRole } from '../components/RoleGuard'
import Coupons from './Coupons'
import GoLive from './GoLive'
import Notifications from './Notifications'
import Tests from './Tests'
import ManageAdmins from './ManageAdmins'
import StudentManager from './StudentManager'
import MentorDesk from './MentorDesk'
import TeacherAssistantDesk from './TeacherAssistantDesk'
import TeacherAssistantAnalysis from './TeacherAssistantAnalysis'
import { handoffError } from '../handoff'
import SupportContacts from './SupportContacts'
import '../index.css'

// Mentor Desk has its own URL: /mentorDesk
const MENTOR_DESK_PATH = '/mentorDesk';
const isMentorDeskPath = () => window.location.pathname.replace(/\/+$/, '').toLowerCase() === MENTOR_DESK_PATH.toLowerCase();

// Teacher Assistant Desk has its own URL: /teacherAssistant
const TEACHER_ASSISTANT_PATH = '/teacherAssistant';
const isTeacherAssistantPath = () => {
  const p = window.location.pathname.replace(/\/+$/, '').toLowerCase();
  return p === TEACHER_ASSISTANT_PATH.toLowerCase() || p === '/teacherassistantdesk' || p === '/teacher-assistant';
};

const TOAST_DURATION_SEC = 5;

type MeInfo = { isSuperAdmin: boolean; superAdminEmailUnverified: boolean }
function App() {
  // Whether to show Super Admin controls. Decided by the backend from the verified token;
  // every admin-management API checks it again on its own.
  const [me, setMe] = useState<MeInfo>({ isSuperAdmin: false, superAdminEmailUnverified: false });
  const [openCreateAdmin, setOpenCreateAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    if (isMentorDeskPath()) return 'mentorDesk';
    if (isTeacherAssistantPath()) return 'teacherAssistant';
    return 'courses';
  });
  const [isPageLoading, setIsPageLoading] = useState(false);
  const pageLoadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTabChange = (nextTab: string) => {
    if (nextTab === activeTab) return;
    if (pageLoadingTimeoutRef.current) clearTimeout(pageLoadingTimeoutRef.current);
    setIsPageLoading(true);
    setActiveTab(nextTab);
    pageLoadingTimeoutRef.current = setTimeout(() => {
      setIsPageLoading(false);
    }, 240);
  };

  useEffect(() => {
    return () => {
      if (pageLoadingTimeoutRef.current) clearTimeout(pageLoadingTimeoutRef.current);
    };
  }, []);
  const [targetStudentForNotification, setTargetStudentForNotification] = useState<{ id: number; name: string | null; email: string; phone: string | null } | null>(null);
  const [openEBookModal, setOpenEBookModal] = useState(false);
  const [highlightEBookSection, setHighlightEBookSection] = useState(false);
  const ebookUploadSectionRef = useRef<HTMLDivElement>(null);

  // Role detected by RoleGuard from the verified Firebase token / backend (never from the URL)
  const [cmsRole, setCmsRole] = useState<string | null>(null);
  const isMentor = cmsRole === 'mentor';
  const isTeacherAssistant = cmsRole === 'teacher_assistant';
  const isStaff = cmsRole === 'admin' || cmsRole === 'faculty';
  const lastCmsTab = useRef('courses');
  const isFirstUrlSync = useRef(true);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(handoffError);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeStudents, setActiveStudents] = useState(0);
  const [contentStats, setContentStats] = useState<Record<string, number>>({});
  const [usersList, setUsersList] = useState<any[]>([]);

  const [coursesList, setCoursesList] = useState<AdminCourse[]>([]);

  // Classplus-style Top-Right Toast State with Countdown Timer
  const [toast, setToast] = useState<{ id: number; message: string; type: 'success' | 'error' } | null>(null);
  const [toastCountdown, setToastCountdown] = useState<number>(TOAST_DURATION_SEC);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    const id = Date.now();
    setToast({ id, message, type });
    setToastCountdown(TOAST_DURATION_SEC);
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, TOAST_DURATION_SEC * 1000);
  };

  useEffect(() => {
    if (!toast) return;
    setToastCountdown(TOAST_DURATION_SEC);
    const interval = setInterval(() => {
      setToastCountdown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [toast?.id]);

  // Smooth auto-scroll to E-Book Upload Section using useRef
  const handleScrollToEBookUpload = () => {
    setOpenEBookModal(true);
    setHighlightEBookSection(true);
    setTimeout(() => {
      ebookUploadSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
    setTimeout(() => {
      setHighlightEBookSection(false);
    }, 1800);
  };

  // Upload Content State
  const [selectedCourseForContent, setSelectedCourseForContent] = useState('');

  // Banners State
  const [bannersList, setBannersList] = useState<any[]>([]);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPlacement, setBannerPlacement] = useState<'home' | 'purchases'>('home');
  const [bannerLinkedCourseId, setBannerLinkedCourseId] = useState<string>('');
  const [bannerTitle, setBannerTitle] = useState<string>('');
  const [bannerInputKey, setBannerInputKey] = useState<number>(0);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  // Loading states for client-side skeletons (250ms rule)
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isLoadingBanners, setIsLoadingBanners] = useState(false);

  const fetchBanners = async () => {
    setIsLoadingBanners(true);
    try {
      const data = await apiFetch('/banners');
      if (data.success) {
        setBannersList(data.data);
      }
    } catch (e) {
      console.error("Failed to fetch banners", e);
    } finally {
      setIsLoadingBanners(false);
    }
  };

  // Admin access is decided by the `admin` custom claim set server-side
  // (Backend/tools/set-admin.mjs). The backend re-checks it on every request.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const fetchCourses = async () => {
    setIsLoadingCourses(true);
    try {
      const data = await apiFetch<{ data: AdminCourse[] }>('/admin/courses');
      setCoursesList(data.data);
    } catch (e) {
      console.error("Failed to fetch courses", e);
    } finally {
      setIsLoadingCourses(false);
    }
  };

  const fetchStats = async () => {
    setIsLoadingStats(true);
    try {
      const data = await apiFetch<any>('/stats');
      if (data.success) {
        setActiveStudents(data.activeStudents);
        setContentStats(data.content || {});
        setUsersList(data.users || []);
      }
    } catch (e) {
      console.error("Failed to fetch stats", e);
    } finally {
      setIsLoadingStats(false);
    }
  };
  const fetchMe = async () => {
    try {
      const data = await apiFetch<{ user?: Partial<MeInfo> }>('/auth/me');
      setMe({ isSuperAdmin: data.user?.isSuperAdmin === true, superAdminEmailUnverified: data.user?.superAdminEmailUnverified === true });
    } catch {
      setMe({ isSuperAdmin: false, superAdminEmailUnverified: false });
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (user) {
      apiFetch<{ user?: Partial<MeInfo> }>('/auth/me')
        .then((data) => {
          if (!cancelled) {
            setMe({
              isSuperAdmin: data.user?.isSuperAdmin === true,
              superAdminEmailUnverified: data.user?.superAdminEmailUnverified === true,
            });
          }
        })
        .catch(() => {
          if (!cancelled) {
            setMe({ isSuperAdmin: false, superAdminEmailUnverified: false });
          }
        });
    } else {
      setMe({ isSuperAdmin: false, superAdminEmailUnverified: false });
    }
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Leave the admin page if the signed-in account is not the Super Admin
  useEffect(() => {
    if ((activeTab === 'admins' || activeTab === 'taAnalytics') && !me.isSuperAdmin) setActiveTab('dashboard');
  }, [activeTab, me.isSuperAdmin]);

  const handleSendVerification = async () => {
    if (!auth.currentUser) return;
    try {
      await sendEmailVerification(auth.currentUser);
      showToast(`Verification email sent to ${auth.currentUser.email}`, 'success');
    } catch (e: any) {
      showToast('Could not send the verification email: ' + (e?.message || e?.code), 'error');
    }
  };

  const handleVerifiedCheck = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
    await fetchMe();
    if (!auth.currentUser.emailVerified) showToast('Email not verified yet — open the link in the verification email first', 'error');
  };
  // Keep the address bar in sync: /mentorDesk for Mentor Desk, /teacherAssistant for Teacher Assistant, / for the other CMS tabs
  useEffect(() => {
    if (activeTab !== 'mentorDesk' && activeTab !== 'teacherAssistant') lastCmsTab.current = activeTab;
    const path = activeTab === 'mentorDesk' ? MENTOR_DESK_PATH : activeTab === 'teacherAssistant' ? TEACHER_ASSISTANT_PATH : '/';
    if (window.location.pathname !== path) {
      const url = path + window.location.search;
      if (isFirstUrlSync.current) window.history.replaceState(null, '', url);
      else window.history.pushState(null, '', url);
    }
    isFirstUrlSync.current = false;
  }, [activeTab]);
  // Mentor accounts only ever see the Mentor Desk: whatever URL or Back button, they stay on /mentorDesk
  useEffect(() => {
    if (isMentor && activeTab !== 'mentorDesk') setActiveTab('mentorDesk');
  }, [isMentor, activeTab]);

  // Teacher Assistant accounts only ever see the Teacher Assistant Desk: whatever URL or Back button, they stay on /teacherAssistant
  useEffect(() => {
    if (isTeacherAssistant && activeTab !== 'teacherAssistant') setActiveTab('teacherAssistant');
  }, [isTeacherAssistant, activeTab]);

  // Browser back / forward buttons
  useEffect(() => {
    const onPopState = () =>
      setActiveTab((prev) => (
        isMentorDeskPath() ? 'mentorDesk' :
        isTeacherAssistantPath() ? 'teacherAssistant' :
        (prev === 'mentorDesk' || prev === 'teacherAssistant') ? lastCmsTab.current : prev
      ));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // CMS data is only loaded for admins and faculty (mentors have no access to it)
  useEffect(() => {
    if (!isStaff) return;
    if (user && (activeTab === 'courses' || activeTab === 'dashboard' || activeTab === 'content')) {
      fetchCourses();
      if (activeTab === 'dashboard') {
        fetchStats();
      }
    }
    if (user && activeTab === 'banners') {
      fetchBanners();
      fetchCourses();
    }
  }, [activeTab, user, isStaff]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error: any) {
      const code: string = error?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found' || code === 'auth/invalid-email') {
        setLoginError('Wrong email or password, or this email has no Firebase account. Check Firebase Console → Authentication → Users.');
      } else if (code === 'auth/too-many-requests') {
        setLoginError('Too many attempts. Wait a few minutes or reset the password in Firebase Console.');
      } else if (code === 'auth/network-request-failed') {
        setLoginError('Network error — check your internet connection.');
      } else {
        setLoginError('Login failed: ' + (error?.message || code));
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleUploadBanner = async () => {
    if (!bannerFile) {
      showToast("Please select an image file first", "error");
      return;
    }
    const currentPlacementBanners = bannersList.filter(b => (b.placement || 'home') === bannerPlacement);
    if (currentPlacementBanners.length >= 5) {
      showToast(`Maximum 5 banners allowed for ${bannerPlacement === 'home' ? 'Homepage' : 'Purchases Section'}. Delete one first.`, "error");
      return;
    }
    
    setIsUploadingBanner(true);
    try {
      // Banners store absolute URLs (the banners API predates server-relative paths).
      const uploadedUrl = await uploadFile(bannerFile);
      const imageUrl = uploadedUrl.startsWith('/') ? API_BASE_URL + uploadedUrl : uploadedUrl;

      const data = await apiFetch('/banners', {
        method: 'POST',
        body: {
          imageUrl,
          placement: bannerPlacement,
          courseId: bannerLinkedCourseId ? Number(bannerLinkedCourseId) : null,
          title: bannerTitle.trim() || null,
        },
      });
      if (data.success) {
        showToast(`${bannerPlacement === 'purchases' ? 'Purchases section banner' : 'Homepage banner'} uploaded successfully!`, "success");
        setBannerFile(null);
        setBannerTitle('');
        setBannerLinkedCourseId('');
        setBannerInputKey(k => k + 1);
        fetchBanners();
      } else {
        throw new Error(data.error);
      }
    } catch (e: any) {
      showToast("Banner Upload Error: " + e.message, "error");
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleDeleteBanner = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this banner?")) return;
    try {
      const data = await apiFetch(`/banners/${id}`, { method: 'DELETE' });
      if (data.success) {
        showToast("Banner deleted", "success");
        fetchBanners();
      } else {
        showToast(data.error, "error");
      }
    } catch (e: any) {
      showToast("Error: " + e.message, "error");
    }
  };

  const loginForm = (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
      <form onSubmit={handleLogin} className="glass-card" style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-md)' }}>
          <h2 style={{ color: 'white', marginBottom: '8px' }}>Admin & Faculty CMS Login</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Enter your Firebase credentials</p>
        </div>
        <input 
          type="email" 
          placeholder="Admin Email" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-field" 
          style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }} 
          required 
        />
        <input 
          type="password" 
          placeholder="Password" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input-field" 
          style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }} 
          required 
        />
        {loginError && (
          <p role="alert" style={{ color: '#ff8a8a', fontSize: '0.85rem', lineHeight: 1.5, background: 'rgba(255,94,94,0.1)', border: '1px solid rgba(255,94,94,0.3)', borderRadius: '8px', padding: '10px 12px', wordBreak: 'break-word' }}>
            {loginError}
          </p>
        )}
        <button type="submit" disabled={isLoggingIn} className="btn" style={{ width: '100%', marginTop: 'var(--space-sm)' }}>{isLoggingIn ? 'Logging in...' : 'Login'}</button>
      </form>
    </div>
  );

  // Allowed roles for the current layout view: CMS layout strictly permits admin and faculty only
  const currentAllowedRoles: AllowedRole[] = isMentor
    ? ['mentor', 'admin', 'faculty']
    : isTeacherAssistant
    ? ['teacher_assistant', 'admin', 'faculty']
    : ['admin', 'faculty'];

  return (
    <RoleGuard allowedRoles={currentAllowedRoles} fallbackLogin={loginForm} onRoleResolved={setCmsRole}>
      {isMentor ? (
        <MentorDesk user={user} />
      ) : activeTab === 'mentorDesk' ? (
        <MentorDesk user={user} onExit={() => setActiveTab(lastCmsTab.current)} />
      ) : isTeacherAssistant ? (
        <TeacherAssistantDesk user={user} />
      ) : activeTab === 'teacherAssistant' ? (
        <TeacherAssistantDesk user={user} onExit={() => setActiveTab(lastCmsTab.current)} />
      ) : cmsRole === 'mentor' || cmsRole === 'teacher_assistant' ? (
        null
      ) : (
        <div className="layout">
          {/* Classplus-Style Top-Right Toast Notification with Countdown Progress Bar */}
          {toast && (
            <div
              key={toast.id}
              role="status"
              aria-live="polite"
              style={{
                position: 'fixed',
                top: '22px',
                right: '24px',
                minWidth: '320px',
                maxWidth: '420px',
                backgroundColor: toast.type === 'success' ? '#55b959' : '#ef4444',
                color: '#ffffff',
                borderRadius: '14px',
                zIndex: 99999,
                boxShadow:
                  toast.type === 'success'
                    ? '0 14px 32px rgba(85, 185, 89, 0.38)'
                    : '0 14px 32px rgba(239, 68, 68, 0.38)',
                overflow: 'hidden',
                animation: 'toastSlideInRight 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '14px 16px 15px 16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: '#ffffff',
                      color: toast.type === 'success' ? '#55b959' : '#ef4444',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontWeight: 900,
                      fontSize: '0.85rem',
                    }}
                  >
                    {toast.type === 'success' ? '✓' : '!'}
                  </span>
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: '0.92rem',
                      lineHeight: 1.35,
                      letterSpacing: '-0.1px',
                    }}
                  >
                    {toast.message}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      backgroundColor: 'rgba(0, 0, 0, 0.16)',
                      padding: '2px 7px',
                      borderRadius: '999px',
                    }}
                  >
                    {toastCountdown}s
                  </span>
                  <button
                    type="button"
                    onClick={() => setToast(null)}
                    aria-label="Close notification"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'rgba(255, 255, 255, 0.9)',
                      fontSize: '1.15rem',
                      lineHeight: 1,
                      cursor: 'pointer',
                      padding: '2px 4px',
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Animated Bottom Progress Bar */}
              <div
                style={{
                  height: '4px',
                  width: '100%',
                  backgroundColor: 'rgba(255, 255, 255, 0.25)',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    backgroundColor: 'rgba(255, 255, 255, 0.85)',
                    animation: `toastProgressShrink ${TOAST_DURATION_SEC}s linear forwards`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Sidebar */}
          <aside className="sidebar">
            <div className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img src={edurainLogo} alt="EduRain Logo" style={{ width: '32px', height: '32px', objectFit: 'contain', flexShrink: 0 }} />
              <span>Edurain CMS</span>
            </div>
            <nav className="sidebar-nav">
              <div className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => handleTabChange('dashboard')}>
                Dashboard
              </div>
              <div className={`nav-link ${activeTab === 'courses' ? 'active' : ''}`} onClick={() => handleTabChange('courses')}>
                Course Manager
              </div>
              <div className={`nav-link ${activeTab === 'categories' ? 'active' : ''}`} onClick={() => handleTabChange('categories')}>
                Categories
              </div>
              <div className={`nav-link ${activeTab === 'content' ? 'active' : ''}`} onClick={() => handleTabChange('content')}>
                Upload Content (PDF/Video/E-Books)
              </div>
              <div className={`nav-link ${activeTab === 'banners' ? 'active' : ''}`} onClick={() => handleTabChange('banners')}>
                Manage Banners
              </div>
              <div className={`nav-link ${activeTab === 'coupons' ? 'active' : ''}`} onClick={() => handleTabChange('coupons')}>
                Private/Public Coupons
              </div>
              <div className={`nav-link ${activeTab === 'golive' ? 'active' : ''}`} onClick={() => handleTabChange('golive')}>
                Go Live (Google Meet)
              </div>
              <div className={`nav-link ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => handleTabChange('notifications')}>
                Notifications
              </div>
              <div className={`nav-link ${activeTab === 'tests' ? 'active' : ''}`} onClick={() => handleTabChange('tests')}>
                Tests
              </div>
              <div className={`nav-link ${activeTab === 'supportContacts' ? 'active' : ''}`} onClick={() => handleTabChange('supportContacts')}>
                Support Contacts
              </div>
              <div className={`nav-link ${activeTab === 'students' ? 'active' : ''}`} onClick={() => handleTabChange('students')}>
                Student Management
              </div>
              {me.isSuperAdmin && (
                <div className={`nav-link ${activeTab === 'admins' ? 'active' : ''}`} onClick={() => handleTabChange('admins')}>
                  Manage Staff
                </div>
              )}
              {me.isSuperAdmin && (
                <button
                  type="button"
                  className={`nav-link ${activeTab === 'taAnalytics' ? 'active' : ''}`}
                  onClick={() => handleTabChange('taAnalytics')}
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', font: 'inherit', cursor: 'pointer' }}
                >
                  Teacher Assistant Analysis
                </button>
              )}
              <div className={`nav-link ${activeTab === 'mentorDesk' ? 'active' : ''}`} onClick={() => handleTabChange('mentorDesk')}>
                Mentor Desk
              </div>
              <div className={`nav-link ${activeTab === 'teacherAssistant' ? 'active' : ''}`} onClick={() => handleTabChange('teacherAssistant')}>
                Teacher Assistant Desk
              </div>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="main-content">
            {isPageLoading && <div className="cms-page-progress-bar" role="progressbar" aria-label="Loading page" />}
            <header className="page-header">
              <h1 className="page-title">
                {activeTab === 'dashboard' && 'Overview'}
                {activeTab === 'courses' && 'Course Manager'}
                {activeTab === 'categories' && 'Category Management'}
                {activeTab === 'content' && 'Post-Purchase Content'}
                {activeTab === 'banners' && 'Manage Banners'}
                {activeTab === 'coupons' && 'Coupon Generator'}
                {activeTab === 'golive' && 'Live Classes'}
                {activeTab === 'notifications' && 'Notifications'}
                {activeTab === 'tests' && 'Test Management'}
                {activeTab === 'supportContacts' && 'Support Contacts'}
                {activeTab === 'students' && 'User & Student Management'}
                {activeTab === 'admins' && 'Manage Staff'}
                {activeTab === 'taAnalytics' && 'Teacher Assistant Analysis'}
              </h1>
              <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                {me.isSuperAdmin && (
                  <button
                    onClick={() => { handleTabChange('admins'); setOpenCreateAdmin(true); }}
                    className="btn"
                    style={{ padding: '6px 12px' }}
                  >
                    + Invite User
                  </button>
                )}
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{user?.email}</span>
                <button onClick={() => signOut(auth)} className="btn" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px' }}>Logout</button>
              </div>
            </header>
            {me.superAdminEmailUnverified && (
              <div className="glass-card" role="status" style={{ marginBottom: 'var(--space-lg)', border: '1px solid rgba(214,158,46,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <p style={{ color: 'white', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  Verify your email address to unlock user management (inviting Admins, Mentors and Teacher Assistance).
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button className="btn" style={{ padding: '6px 12px' }} onClick={handleSendVerification}>Send Verification Email</button>
                  <button className="btn" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px' }} onClick={handleVerifiedCheck}>I've Verified</button>
                </div>
              </div>
            )}
            {isPageLoading ? (
              <div className="cms-page-loader" role="status" aria-label="Loading view">
                <div className="cms-page-spinner" />
                <span className="cms-page-loading-text">Loading view...</span>
              </div>
            ) : (
              <>
            {activeTab === 'dashboard' && (
              <div className="animate-view">
                <div className="dashboard-grid">
                  <div className="glass-card stat-card" role="status" aria-busy={isLoadingCourses}>
                    <span className="stat-label">Total Courses</span>
                    {isLoadingCourses ? (
                      <div className="skeleton-box" style={{ width: '80px', height: '48px', marginTop: '6px' }} />
                    ) : (
                      <span className="stat-value">{coursesList.length}</span>
                    )}
                  </div>
                  <div className="glass-card stat-card" role="status" aria-busy={isLoadingCourses}>
                    <span className="stat-label">Published</span>
                    {isLoadingCourses ? (
                      <div className="skeleton-box" style={{ width: '80px', height: '48px', marginTop: '6px' }} />
                    ) : (
                      <span className="stat-value">{coursesList.filter(c => c.isPublished).length}</span>
                    )}
                  </div>
                  <div className="glass-card stat-card" role="status" aria-busy={isLoadingStats}>
                    <span className="stat-label">Active Students</span>
                    {isLoadingStats ? (
                      <div className="skeleton-box" style={{ width: '80px', height: '48px', marginTop: '6px' }} />
                    ) : (
                      <span className="stat-value">{activeStudents}</span>
                    )}
                  </div>
                  {Object.entries(contentStats).map(([k, v]) => (
                    <div key={k} className="glass-card stat-card" role="status" aria-busy={isLoadingStats}>
                      <span className="stat-label" style={{ textTransform: 'capitalize' }}>
                        {k.replace(/([A-Z])/g, ' $1')}
                      </span>
                      {isLoadingStats ? (
                        <div className="skeleton-box" style={{ width: '60px', height: '48px', marginTop: '6px' }} />
                      ) : (
                        <span className="stat-value">{v}</span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="glass-card" style={{ minHeight: '300px', overflowX: 'auto', marginTop: 'var(--space-lg)' }}>
                  <h3 style={{ marginBottom: 'var(--space-md)' }}>Registered Students</h3>
                  {isLoadingStats ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }} aria-busy="true" role="status">
                      <div className="skeleton-box" style={{ width: '100%', height: '42px' }} />
                      <div className="skeleton-box" style={{ width: '90%', height: '42px' }} />
                      <div className="skeleton-box" style={{ width: '75%', height: '42px' }} />
                    </div>
                  ) : usersList.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)' }}>No students registered yet.</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                          <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500 }}>Name</th>
                          <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500 }}>Email</th>
                          <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500 }}>Phone</th>
                          <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500 }}>Location</th>
                          <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500 }}>Joined</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usersList.map((u, i) => (
                          <tr key={u.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '12px 8px' }}>{u.name || '-'}</td>
                            <td style={{ padding: '12px 8px' }}>{u.email}</td>
                            <td style={{ padding: '12px 8px' }}>{u.phone || '-'}</td>
                            <td style={{ padding: '12px 8px' }}>
                              {[u.city, u.state].filter(Boolean).join(', ') || '-'}
                            </td>
                            <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>
                              {new Date(u.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'courses' && (
              <div className="animate-view">
                <CourseManager
                  courses={coursesList}
                  isLoading={isLoadingCourses}
                  reloadCourses={fetchCourses}
                  showToast={showToast}
                  onManageContent={(courseId) => {
                    setSelectedCourseForContent(String(courseId));
                    handleTabChange('content');
                  }}
                />
              </div>
            )}

            {activeTab === 'categories' && (
              <div className="animate-view">
                <CategoryManager showToast={showToast} onCategoriesChanged={fetchCourses} />
              </div>
            )}

            {activeTab === 'content' && (
              <div className="animate-view" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                <CourseContentManager
                  courses={coursesList}
                  selectedCourseId={selectedCourseForContent}
                  onSelectCourse={setSelectedCourseForContent}
                  showToast={showToast}
                  onOpenEBookUpload={handleScrollToEBookUpload}
                />

                <div
                  ref={ebookUploadSectionRef}
                  id="upload-ebooks-section"
                  className={highlightEBookSection ? 'ebook-scroll-highlight' : ''}
                  style={{ borderRadius: '20px', scrollMarginTop: '24px' }}
                >
                  <EBookUploadManager
                    courses={coursesList}
                    selectedCourseId={selectedCourseForContent}
                    showToast={showToast}
                    isModalOpen={openEBookModal}
                    onCloseModal={() => setOpenEBookModal(false)}
                  />
                </div>
              </div>
            )}

            {activeTab === 'banners' && (() => {
              const activeBanners = bannersList.filter(b => (b.placement || 'home') === bannerPlacement);
              return (
                <div className="animate-view" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                  {/* Tab Selector */}
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setBannerPlacement('home')}
                      className="btn"
                      style={{
                        background: bannerPlacement === 'home' ? 'var(--mint)' : 'transparent',
                        color: bannerPlacement === 'home' ? 'var(--navy)' : 'white',
                        border: '1px solid rgba(255,255,255,0.2)',
                        padding: '8px 18px',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                      }}
                    >
                      📱 Mobile Homepage Banners ({bannersList.filter(b => (b.placement || 'home') === 'home').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setBannerPlacement('purchases')}
                      className="btn"
                      style={{
                        background: bannerPlacement === 'purchases' ? '#f59e0b' : 'transparent',
                        color: bannerPlacement === 'purchases' ? '#000' : 'white',
                        border: '1px solid rgba(245,158,11,0.5)',
                        padding: '8px 18px',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                      }}
                    >
                      🎓 Purchased Section Banners ({bannersList.filter(b => b.placement === 'purchases').length})
                    </button>
                  </div>

                  {/* Uploaded Banners Card */}
                  <div className="glass-card">
                    <h3 style={{ marginBottom: 'var(--space-md)' }}>
                      {bannerPlacement === 'purchases' ? '🎓 Uploaded Purchased Section Banners' : '📱 Uploaded Homepage Banners'} ({activeBanners.length}/5)
                    </h3>
                    {isLoadingBanners ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }} aria-busy="true" role="status">
                        <div className="skeleton-box" style={{ width: '100%', height: '140px', borderRadius: '12px' }} />
                        <div className="skeleton-box" style={{ width: '100%', height: '140px', borderRadius: '12px' }} />
                      </div>
                    ) : activeBanners.length === 0 ? (
                      <p style={{ color: 'var(--text-secondary)' }}>
                        {bannerPlacement === 'purchases'
                          ? 'No banners uploaded for the Purchased section yet. Upload one below to feature it at the top of "Your Enrolled Courses".'
                          : 'No homepage banners uploaded yet.'}
                      </p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                        {activeBanners.map(banner => {
                          const linkedCourse = banner.courseId ? coursesList.find(c => c.id === banner.courseId) : null;
                          return (
                            <div key={banner.id} style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: banner.placement === 'purchases' ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)' }}>
                              <img src={banner.imageUrl} alt="Banner" style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }} />
                              <div style={{ padding: '8px 12px', fontSize: '0.8rem' }}>
                                {banner.title && <div style={{ fontWeight: 'bold', color: 'white' }}>{banner.title}</div>}
                                {linkedCourse && (
                                  <div style={{ color: '#fcd34d', fontSize: '0.75rem', marginTop: '2px' }}>
                                    🔗 Links to: {linkedCourse.title}
                                  </div>
                                )}
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', marginTop: '2px' }}>
                                  Added: {new Date(banner.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                              <button 
                                onClick={() => handleDeleteBanner(banner.id)}
                                style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(255,0,0,0.85)', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem' }}
                              >
                                Delete
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Upload Form Card */}
                  <div className="glass-card">
                    <h3 style={{ marginBottom: 'var(--space-md)' }}>
                      Upload New {bannerPlacement === 'purchases' ? 'Purchased Section Banner' : 'Homepage Banner'}
                    </h3>
                    <form onSubmit={e => { e.preventDefault(); handleUploadBanner(); }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Banner Placement Target</label>
                        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'white', cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name="bannerPlacement"
                              checked={bannerPlacement === 'home'}
                              onChange={() => setBannerPlacement('home')}
                            />
                            📱 Mobile App Homepage
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fcd34d', cursor: 'pointer', fontWeight: 600 }}>
                            <input
                              type="radio"
                              name="bannerPlacement"
                              checked={bannerPlacement === 'purchases'}
                              onChange={() => setBannerPlacement('purchases')}
                            />
                            🎓 Purchased Section (Your Enrolled Courses)
                          </label>
                        </div>
                      </div>

                      <div style={{ border: '2px dashed rgba(255,255,255,0.2)', padding: 'var(--space-xl)', textAlign: 'center', borderRadius: 'var(--radius-md)' }}>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)' }}>
                          Select {bannerPlacement === 'purchases' ? 'Purchased Section' : 'Homepage'} Banner Image
                        </p>
                        <input key={bannerInputKey} type="file" accept="image/*" onChange={e => setBannerFile(e.target.files?.[0] || null)} className="input-field" style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', cursor: 'pointer' }} />
                      </div>

                      {bannerPlacement === 'purchases' && (
                        <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: '220px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Link to Course (Optional)</label>
                            <select
                              value={bannerLinkedCourseId}
                              onChange={e => setBannerLinkedCourseId(e.target.value)}
                              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                            >
                              <option value="">-- No linked course (Display Graphic Only) --</option>
                              {coursesList.map(c => (
                                <option key={c.id} value={c.id}>{c.title} ({c.category})</option>
                              ))}
                            </select>
                          </div>
                          <div style={{ flex: 1, minWidth: '220px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Banner Title / Caption (Optional)</label>
                            <input
                              type="text"
                              value={bannerTitle}
                              onChange={e => setBannerTitle(e.target.value)}
                              placeholder="e.g. Special Offer for Enrolled Students"
                              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                            />
                          </div>
                        </div>
                      )}
                      
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {bannerPlacement === 'purchases'
                          ? 'Note: This banner will appear prominently as the hero banner at the top of the student\'s "Your Enrolled Courses" (My Purchases) page. Recommended: 16:9 or 21:9 banner image, max 500 KB.'
                          : 'Note: These banners are used for notices and will appear as a sliding carousel on the top of the mobile app home screen.'}
                      </p>

                      <button
                        type="button"
                        onClick={handleUploadBanner}
                        disabled={isUploadingBanner || !bannerFile}
                        className="btn"
                        style={{
                          alignSelf: 'flex-start',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          background: bannerPlacement === 'purchases' ? '#d97706' : undefined,
                          color: bannerPlacement === 'purchases' ? '#fff' : undefined,
                        }}
                      >
                        {isUploadingBanner && (
                          <svg className="cms-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                            <path d="M12 2a10 10 0 0 1 10 10" />
                          </svg>
                        )}
                        {isUploadingBanner ? 'Uploading...' : bannerPlacement === 'purchases' ? 'Upload & Set in Purchases Section' : 'Upload & Set Live'}
                      </button>
                    </form>
                  </div>
                </div>
              );
            })()}

            {activeTab === 'coupons' && (
              <div className="animate-view">
                <Coupons user={user!} coursesList={coursesList} showToast={showToast} />
              </div>
            )}

            {activeTab === 'golive' && (
              <div className="animate-view">
                <GoLive user={user!} coursesList={coursesList} showToast={showToast} />
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="animate-view">
                <Notifications
                  showToast={showToast}
                  initialTargetStudent={targetStudentForNotification}
                  onClearInitialTarget={() => setTargetStudentForNotification(null)}
                />
              </div>
            )}

            {activeTab === 'tests' && (
              <div className="animate-view">
                <Tests showToast={showToast} />
              </div>
            )}

            {activeTab === 'supportContacts' && (
              <div className="animate-view">
                <SupportContacts showToast={showToast} />
              </div>
            )}

            {activeTab === 'students' && (
              <div className="animate-view">
                <StudentManager
                  coursesList={coursesList}
                  showToast={showToast}
                  onSendDirectNotification={(student) => {
                    setTargetStudentForNotification(student);
                    handleTabChange('notifications');
                  }}
                />
              </div>
            )}
            {activeTab === 'admins' && me.isSuperAdmin && (
              <div className="animate-view">
                <ManageAdmins
                  showToast={showToast}
                  openCreate={openCreateAdmin}
                  onCreateOpened={() => setOpenCreateAdmin(false)}
                />
              </div>
            )}
            {activeTab === 'taAnalytics' && me.isSuperAdmin && (
              <div className="animate-view">
                <TeacherAssistantAnalysis />
              </div>
            )}
              </>
            )}
          </main>
        </div>
      )}
    </RoleGuard>
  )
}

export default App
