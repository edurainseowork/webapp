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
import CustomSelect from '../components/CustomSelect'
import '../index.css'

// Mentor Desk & Teacher Assistant Desk paths
const MENTOR_DESK_PATH = '/mentorDesk';
const TEACHER_ASSISTANT_PATH = '/teacherAssistant';

// Dedicated route path for every CMS page (Classplus-style multi-page URL routing)
const TAB_TO_PATH: Record<string, string> = {
  dashboard: '/dashboard',
  courses: '/courses',
  categories: '/categories',
  content: '/content',
  banners: '/banners',
  coupons: '/coupons',
  golive: '/go-live',
  notifications: '/notifications',
  tests: '/tests',
  supportContacts: '/support-contacts',
  students: '/students',
  admins: '/manage-staff',
  taAnalytics: '/ta-analytics',
  mentorDesk: MENTOR_DESK_PATH,
  teacherAssistant: TEACHER_ASSISTANT_PATH,
};

const pathToTab = (pathname: string): string => {
  const clean = pathname.replace(/\/+$/, '').toLowerCase();
  if (!clean || clean === '/') return 'courses';
  if (clean === '/dashboard') return 'dashboard';
  if (clean === '/courses' || clean === '/course-manager') return 'courses';
  if (clean === '/categories') return 'categories';
  if (clean === '/content' || clean === '/upload-content') return 'content';
  if (clean === '/banners' || clean === '/manage-banners') return 'banners';
  if (clean === '/coupons') return 'coupons';
  if (clean === '/go-live' || clean === '/golive') return 'golive';
  if (clean === '/notifications') return 'notifications';
  if (clean === '/tests') return 'tests';
  if (clean === '/support-contacts' || clean === '/support') return 'supportContacts';
  if (clean === '/students' || clean === '/student-management') return 'students';
  if (clean === '/manage-staff' || clean === '/admins') return 'admins';
  if (clean === '/ta-analytics' || clean === '/teacher-assistant-analysis') return 'taAnalytics';
  if (clean === MENTOR_DESK_PATH.toLowerCase()) return 'mentorDesk';
  if (clean === TEACHER_ASSISTANT_PATH.toLowerCase() || clean === '/teacherassistantdesk' || clean === '/teacher-assistant') {
    return 'teacherAssistant';
  }
  return 'courses';
};

const TOAST_DURATION_SEC = 5;

type MeInfo = { isSuperAdmin: boolean; superAdminEmailUnverified: boolean }
function App() {
  // Whether to show Super Admin controls. Decided by the backend from the verified token;
  // every admin-management API checks it again on its own.
  const [me, setMe] = useState<MeInfo>({ isSuperAdmin: false, superAdminEmailUnverified: false });
  const [meLoaded, setMeLoaded] = useState(false);
  const [openCreateAdmin, setOpenCreateAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState(() => pathToTab(window.location.pathname));
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
  const [bannerPlatform, setBannerPlatform] = useState<'web' | 'mobile'>('web');
  const [bannerPlacement, setBannerPlacement] = useState<'web_home' | 'courses' | 'purchases' | 'home' | 'mobile_courses' | 'mobile_purchases'>('web_home');
  const [bannerLinkedCourseId, setBannerLinkedCourseId] = useState<string>('');
  const [bannerInputKey, setBannerInputKey] = useState<number>(0);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [hasUnsavedBannerOrder, setHasUnsavedBannerOrder] = useState(false);
  const [isSavingBannerOrder, setIsSavingBannerOrder] = useState(false);
  const bannerSaveButtonRef = useRef<HTMLButtonElement | null>(null);

  // Loading states for client-side skeletons (250ms rule)
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isLoadingBanners, setIsLoadingBanners] = useState(false);

  const fetchBanners = async () => {
    setIsLoadingBanners(true);
    try {
      const data = await apiFetch('/banners?placement=all');
      if (data.success) {
        setBannersList(data.data);
        setHasUnsavedBannerOrder(false);
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
    } finally {
      setMeLoaded(true);
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (user) {
      setMeLoaded(false);
      apiFetch<{ user?: Partial<MeInfo> }>('/auth/me')
        .then((data) => {
          if (!cancelled) {
            setMe({
              isSuperAdmin: data.user?.isSuperAdmin === true,
              superAdminEmailUnverified: data.user?.superAdminEmailUnverified === true,
            });
            setMeLoaded(true);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setMe({ isSuperAdmin: false, superAdminEmailUnverified: false });
            setMeLoaded(true);
          }
        });
    } else {
      setMe({ isSuperAdmin: false, superAdminEmailUnverified: false });
      setMeLoaded(false);
    }
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Leave the Super Admin pages if the signed-in account is confirmed not to be the Super Admin
  useEffect(() => {
    if (meLoaded && (activeTab === 'admins' || activeTab === 'taAnalytics') && !me.isSuperAdmin) {
      setActiveTab('dashboard');
    }
  }, [activeTab, me.isSuperAdmin, meLoaded]);

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

  // Keep the address bar in sync with every CMS page route (/dashboard, /courses, /categories, ..., /manage-staff)
  useEffect(() => {
    if (activeTab !== 'mentorDesk' && activeTab !== 'teacherAssistant') lastCmsTab.current = activeTab;
    const path = TAB_TO_PATH[activeTab] || '/courses';
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

  // Browser back / forward buttons navigate smoothly across all CMS routes
  useEffect(() => {
    const onPopState = () => {
      const nextTab = pathToTab(window.location.pathname);
      setActiveTab((prev) => {
        if (prev === nextTab) return prev;
        if (pageLoadingTimeoutRef.current) clearTimeout(pageLoadingTimeoutRef.current);
        setIsPageLoading(true);
        pageLoadingTimeoutRef.current = setTimeout(() => {
          setIsPageLoading(false);
        }, 200);
        return nextTab;
      });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // CMS data is dynamically loaded for admins and faculty across all pages that use courses/stats/banners
  useEffect(() => {
    if (!isStaff || !user) return;
    const tabsNeedingCourses = ['courses', 'dashboard', 'content', 'banners', 'coupons', 'golive', 'students'];
    if (tabsNeedingCourses.includes(activeTab)) {
      fetchCourses();
    }
    if (activeTab === 'dashboard') {
      fetchStats();
    }
    if (activeTab === 'banners') {
      fetchBanners();
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


  const PLACEMENT_CONFIG: Record<
    'web_home' | 'courses' | 'purchases' | 'home' | 'mobile_courses' | 'mobile_purchases',
    { title: string; platform: 'Web' | 'Mobile'; ratioName: string; minRatio: number; maxRatio: number; idealSize: string }
  > = {
    web_home: { title: 'Web Home Page', platform: 'Web', ratioName: '~3.2:1', minRatio: 2.85, maxRatio: 3.55, idealSize: '1200×375 px (or 1600×500 px)' },
    courses: { title: 'Web Courses Page', platform: 'Web', ratioName: '~3.2:1', minRatio: 2.85, maxRatio: 3.55, idealSize: '1200×375 px' },
    purchases: { title: 'Web Purchases (Your Enrolled Courses)', platform: 'Web', ratioName: '~3.2:1', minRatio: 2.85, maxRatio: 3.55, idealSize: '1200×375 px' },
    home: { title: 'Mobile Home Page', platform: 'Mobile', ratioName: '~1.8:1', minRatio: 1.55, maxRatio: 2.05, idealSize: '1080×600 px (or 720×400 px)' },
    mobile_courses: { title: 'Mobile Courses Page', platform: 'Mobile', ratioName: '~1.8:1', minRatio: 1.55, maxRatio: 2.05, idealSize: '1080×600 px (or 720×400 px)' },
    mobile_purchases: { title: 'Mobile Purchases Page', platform: 'Mobile', ratioName: '~1.8:1', minRatio: 1.55, maxRatio: 2.05, idealSize: '1080×600 px (or 720×400 px)' },
  };

  const handleBannerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setBannerFile(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      showToast("Please choose a valid image file (PNG, JPG, WEBP)", "error");
      e.target.value = '';
      setBannerFile(null);
      return;
    }

    const cfg = PLACEMENT_CONFIG[bannerPlacement];
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      const ratio = width / height;

      if (ratio < cfg.minRatio || ratio > cfg.maxRatio) {
        showToast(`Invalid dimension! ${cfg.title} banner must have ${cfg.ratioName} aspect ratio (${cfg.idealSize}). Selected: ${width}×${height} (${ratio.toFixed(2)}:1).`, "error");
        e.target.value = '';
        setBannerFile(null);
        return;
      }

      setBannerFile(file);
      showToast(`Image verified: ${width}×${height} (${ratio.toFixed(2)}:1 ratio matches requirement)`, "success");
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      showToast("Failed to read image file. Please try another image.", "error");
      e.target.value = '';
      setBannerFile(null);
    };
    img.src = objUrl;
  };

  const handleUploadBanner = async () => {
    if (!bannerFile) {
      showToast("Please select a verified banner image first", "error");
      return;
    }
    const currentPlacementBanners = bannersList.filter(b => (b.placement || 'home') === bannerPlacement);
    if (currentPlacementBanners.length >= 5) {
      showToast(`Maximum 5 banners allowed for ${PLACEMENT_CONFIG[bannerPlacement].title}. Delete one first.`, "error");
      return;
    }
    
    setIsUploadingBanner(true);
    try {
      const uploadedUrl = await uploadFile(bannerFile);
      const imageUrl = uploadedUrl.startsWith('/') ? API_BASE_URL + uploadedUrl : uploadedUrl;

      const data = await apiFetch('/banners', {
        method: 'POST',
        body: {
          imageUrl,
          placement: bannerPlacement,
          courseId: bannerLinkedCourseId ? Number(bannerLinkedCourseId) : null,
        },
      });
      if (data.success) {
        showToast(`${PLACEMENT_CONFIG[bannerPlacement].title} banner uploaded successfully!`, "success");
        setBannerFile(null);
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

  const handleMoveBanner = (bannerId: number, direction: 'left' | 'right') => {
    const currentPlacementBanners = bannersList.filter(b => (b.placement || 'home') === bannerPlacement);
    const index = currentPlacementBanners.findIndex(b => b.id === bannerId);
    if (index === -1) return;
    if (direction === 'left' && index === 0) return;
    if (direction === 'right' && index === currentPlacementBanners.length - 1) return;

    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    const reordered = [...currentPlacementBanners];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    const otherBanners = bannersList.filter(b => (b.placement || 'home') !== bannerPlacement);
    setBannersList([...otherBanners, ...reordered]);
    setHasUnsavedBannerOrder(true);

    setTimeout(() => {
      bannerSaveButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  };

  const handleSaveBannerOrder = async () => {
    const currentPlacementBanners = bannersList.filter(b => (b.placement || 'home') === bannerPlacement);
    const items = currentPlacementBanners.map((b, idx) => ({
      id: b.id,
      sortOrder: idx,
    }));

    setIsSavingBannerOrder(true);
    try {
      const data = await apiFetch('/banners/reorder', {
        method: 'PUT',
        body: { items },
      });
      if (data.success) {
        showToast("Banner order saved successfully! Applied across website and mobile app.", "success");
        setHasUnsavedBannerOrder(false);
        fetchBanners();
      } else {
        throw new Error(data.error);
      }
    } catch (e: any) {
      showToast("Error saving banner order: " + e.message, "error");
    } finally {
      setIsSavingBannerOrder(false);
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
              const currentCfg = PLACEMENT_CONFIG[bannerPlacement];

              const webHomeCount = bannersList.filter(b => b.placement === 'web_home').length;
              const webCoursesCount = bannersList.filter(b => b.placement === 'courses').length;
              const webPurchasesCount = bannersList.filter(b => b.placement === 'purchases').length;

              const mobileHomeCount = bannersList.filter(b => (b.placement || 'home') === 'home').length;
              const mobileCoursesCount = bannersList.filter(b => b.placement === 'mobile_courses').length;
              const mobilePurchasesCount = bannersList.filter(b => b.placement === 'mobile_purchases').length;

              return (
                <div className="animate-view" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                  {/* Top-Level Platform Selector */}
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>PLATFORM TARGET:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setBannerPlatform('web');
                        setBannerPlacement('web_home');
                        setBannerFile(null);
                      }}
                      className="btn"
                      style={{
                        padding: '9px 20px',
                        borderRadius: '10px',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        border: bannerPlatform === 'web' ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.15)',
                        background: bannerPlatform === 'web' ? 'rgba(56,189,248,0.2)' : 'transparent',
                        color: bannerPlatform === 'web' ? '#38bdf8' : 'white',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: bannerPlatform === 'web' ? '0 0 16px rgba(56,189,248,0.3)' : 'none',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      🌐 Web App Banners (3.2:1 Ratio)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBannerPlatform('mobile');
                        setBannerPlacement('home');
                        setBannerFile(null);
                      }}
                      className="btn"
                      style={{
                        padding: '9px 20px',
                        borderRadius: '10px',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        border: bannerPlatform === 'mobile' ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.15)',
                        background: bannerPlatform === 'mobile' ? 'rgba(16,185,129,0.2)' : 'transparent',
                        color: bannerPlatform === 'mobile' ? '#10b981' : 'white',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: bannerPlatform === 'mobile' ? '0 0 16px rgba(16,185,129,0.3)' : 'none',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      📱 Mobile App Banners (1.8:1 Ratio)
                    </button>
                  </div>

                  {/* Section Sub-Tabs */}
                  {bannerPlatform === 'web' ? (
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => { setBannerPlacement('web_home'); setBannerFile(null); }}
                        className="btn"
                        style={{
                          background: bannerPlacement === 'web_home' ? '#38bdf8' : 'rgba(255,255,255,0.05)',
                          color: bannerPlacement === 'web_home' ? '#000' : 'white',
                          border: bannerPlacement === 'web_home' ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.15)',
                          padding: '8px 18px',
                          fontSize: '0.88rem',
                          fontWeight: 600,
                        }}
                      >
                        🏠 Web Home Page ({webHomeCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => { setBannerPlacement('courses'); setBannerFile(null); }}
                        className="btn"
                        style={{
                          background: bannerPlacement === 'courses' ? '#a855f7' : 'rgba(255,255,255,0.05)',
                          color: bannerPlacement === 'courses' ? '#fff' : 'white',
                          border: bannerPlacement === 'courses' ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.15)',
                          padding: '8px 18px',
                          fontSize: '0.88rem',
                          fontWeight: 600,
                        }}
                      >
                        📚 Web Courses Page ({webCoursesCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => { setBannerPlacement('purchases'); setBannerFile(null); }}
                        className="btn"
                        style={{
                          background: bannerPlacement === 'purchases' ? '#f59e0b' : 'rgba(255,255,255,0.05)',
                          color: bannerPlacement === 'purchases' ? '#000' : 'white',
                          border: bannerPlacement === 'purchases' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.15)',
                          padding: '8px 18px',
                          fontSize: '0.88rem',
                          fontWeight: 600,
                        }}
                      >
                        🎓 Web Purchases Page ({webPurchasesCount})
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => { setBannerPlacement('home'); setBannerFile(null); }}
                        className="btn"
                        style={{
                          background: bannerPlacement === 'home' ? 'var(--mint)' : 'rgba(255,255,255,0.05)',
                          color: bannerPlacement === 'home' ? 'var(--navy)' : 'white',
                          border: bannerPlacement === 'home' ? '1px solid var(--mint)' : '1px solid rgba(255,255,255,0.15)',
                          padding: '8px 18px',
                          fontSize: '0.88rem',
                          fontWeight: 600,
                        }}
                      >
                        🏠 Mobile Home Page ({mobileHomeCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => { setBannerPlacement('mobile_courses'); setBannerFile(null); }}
                        className="btn"
                        style={{
                          background: bannerPlacement === 'mobile_courses' ? '#34d399' : 'rgba(255,255,255,0.05)',
                          color: bannerPlacement === 'mobile_courses' ? '#000' : 'white',
                          border: bannerPlacement === 'mobile_courses' ? '1px solid #34d399' : '1px solid rgba(255,255,255,0.15)',
                          padding: '8px 18px',
                          fontSize: '0.88rem',
                          fontWeight: 600,
                        }}
                      >
                        📚 Mobile Courses Page ({mobileCoursesCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => { setBannerPlacement('mobile_purchases'); setBannerFile(null); }}
                        className="btn"
                        style={{
                          background: bannerPlacement === 'mobile_purchases' ? '#fcd34d' : 'rgba(255,255,255,0.05)',
                          color: bannerPlacement === 'mobile_purchases' ? '#000' : 'white',
                          border: bannerPlacement === 'mobile_purchases' ? '1px solid #fcd34d' : '1px solid rgba(255,255,255,0.15)',
                          padding: '8px 18px',
                          fontSize: '0.88rem',
                          fontWeight: 600,
                        }}
                      >
                        🎓 Mobile Purchases Page ({mobilePurchasesCount})
                      </button>
                    </div>
                  )}

                  {/* Uploaded Banners Card */}
                  <div className="glass-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: 'var(--space-md)' }}>
                      <div>
                        <h3 style={{ margin: 0 }}>
                          {currentCfg.title} Banners ({activeBanners.length}/5)
                        </h3>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          Target Platform: <strong>{currentCfg.platform}</strong> • Ratio: <strong>{currentCfg.ratioName}</strong> ({currentCfg.idealSize})
                        </p>
                      </div>
                      {activeBanners.length > 0 && (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          {hasUnsavedBannerOrder && (
                            <span style={{ fontSize: '0.85rem', color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', animation: 'pulse 1.5s infinite' }} />
                              Order Changed (Unsaved)
                            </span>
                          )}
                          <button
                            ref={bannerSaveButtonRef}
                            type="button"
                            onClick={handleSaveBannerOrder}
                            disabled={!hasUnsavedBannerOrder || isSavingBannerOrder}
                            className="btn"
                            style={{
                              background: hasUnsavedBannerOrder ? '#10b981' : 'rgba(255,255,255,0.08)',
                              color: hasUnsavedBannerOrder ? '#ffffff' : 'rgba(255,255,255,0.4)',
                              border: hasUnsavedBannerOrder ? '1px solid #059669' : '1px solid rgba(255,255,255,0.1)',
                              padding: '8px 18px',
                              fontSize: '0.85rem',
                              fontWeight: 700,
                              cursor: hasUnsavedBannerOrder ? 'pointer' : 'not-allowed',
                              boxShadow: hasUnsavedBannerOrder ? '0 0 16px rgba(16, 185, 129, 0.5)' : 'none',
                              transform: hasUnsavedBannerOrder ? 'scale(1.02)' : 'none',
                              transition: 'all 0.25s ease',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            {isSavingBannerOrder ? '💾 Saving Order...' : '💾 Save Banner Order'}
                          </button>
                        </div>
                      )}
                    </div>

                    {isLoadingBanners ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }} aria-busy="true" role="status">
                        <div className="skeleton-box" style={{ width: '100%', height: '140px', borderRadius: '12px' }} />
                        <div className="skeleton-box" style={{ width: '100%', height: '140px', borderRadius: '12px' }} />
                      </div>
                    ) : activeBanners.length === 0 ? (
                      <p style={{ color: 'var(--text-secondary)' }}>
                        No banners uploaded for {currentCfg.title} yet. Upload one below to feature it live.
                      </p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                        {activeBanners.map((banner, index) => {
                          const linkedCourse = banner.courseId ? coursesList.find(c => c.id === banner.courseId) : null;
                          return (
                            <div key={banner.id} style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>
                              {/* Order Badge */}
                              <div style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 2, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', color: '#10b981', border: '1px solid rgba(16,185,129,0.5)', borderRadius: '6px', padding: '3px 8px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                #{index + 1}
                              </div>

                              <button 
                                onClick={() => handleDeleteBanner(banner.id)}
                                style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 2, background: 'rgba(255,0,0,0.85)', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem' }}
                                title="Delete Banner"
                              >
                                Delete
                              </button>

                              <img src={banner.imageUrl} alt="Banner" style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }} />
                              
                              <div style={{ padding: '10px 12px', fontSize: '0.8rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '8px' }}>
                                <div>
                                  {linkedCourse ? (
                                    <div style={{ color: '#fcd34d', fontSize: '0.75rem', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      🔗 Links to: <strong>{linkedCourse.title}</strong>
                                    </div>
                                  ) : (
                                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginTop: '3px' }}>
                                      🖼️ Graphic Only (No Course Link)
                                    </div>
                                  )}
                                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', marginTop: '4px' }}>
                                    Added: {new Date(banner.createdAt).toLocaleDateString()}
                                  </div>
                                </div>

                                {/* Reorder Controls */}
                                <div style={{ display: 'flex', gap: '6px', marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px' }}>
                                  <button
                                    type="button"
                                    disabled={index === 0}
                                    onClick={() => handleMoveBanner(banner.id, 'left')}
                                    style={{
                                      flex: 1,
                                      padding: '5px 8px',
                                      fontSize: '0.75rem',
                                      background: index === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.1)',
                                      color: index === 0 ? 'rgba(255,255,255,0.2)' : 'white',
                                      border: '1px solid rgba(255,255,255,0.15)',
                                      borderRadius: '6px',
                                      cursor: index === 0 ? 'not-allowed' : 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '4px',
                                    }}
                                    title="Move earlier in order"
                                  >
                                    ◀ Move Earlier
                                  </button>
                                  <button
                                    type="button"
                                    disabled={index === activeBanners.length - 1}
                                    onClick={() => handleMoveBanner(banner.id, 'right')}
                                    style={{
                                      flex: 1,
                                      padding: '5px 8px',
                                      fontSize: '0.75rem',
                                      background: index === activeBanners.length - 1 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.1)',
                                      color: index === activeBanners.length - 1 ? 'rgba(255,255,255,0.2)' : 'white',
                                      border: '1px solid rgba(255,255,255,0.15)',
                                      borderRadius: '6px',
                                      cursor: index === activeBanners.length - 1 ? 'not-allowed' : 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '4px',
                                    }}
                                    title="Move later in order"
                                  >
                                    Move Later ▶
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Upload Form Card */}
                  <div className="glass-card">
                    <h3 style={{ marginBottom: 'var(--space-md)' }}>
                      Upload New {currentCfg.title} Banner
                    </h3>
                    <form onSubmit={e => { e.preventDefault(); handleUploadBanner(); }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                      
                      <div style={{ border: '2px dashed rgba(255,255,255,0.2)', padding: 'var(--space-xl)', textAlign: 'center', borderRadius: 'var(--radius-md)' }}>
                        <p style={{ color: 'white', fontWeight: 600, marginBottom: '6px' }}>
                          Select {currentCfg.title} Banner Image
                        </p>
                        <p style={{ color: '#38bdf8', fontSize: '0.85rem', marginBottom: 'var(--space-md)' }}>
                          📐 Required Aspect Ratio for {currentCfg.platform}: <strong>{currentCfg.ratioName}</strong> ({currentCfg.idealSize})
                        </p>
                        <input
                          key={bannerInputKey}
                          type="file"
                          accept="image/*"
                          onChange={handleBannerFileChange}
                          className="input-field"
                          style={{ width: '100%', maxWidth: '420px', margin: '0 auto', padding: '9px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: 'white', cursor: 'pointer' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Link to Course (Optional)</label>
                        <CustomSelect
                          options={[
                            { value: '', label: '-- No linked course (Display Graphic Only) --' },
                            ...coursesList.map((c) => ({
                              value: String(c.id),
                              label: c.title,
                              category: c.category,
                              badge: c.isPublished ? 'Published' : 'Draft',
                            })),
                          ]}
                          value={bannerLinkedCourseId}
                          onChange={(val) => setBannerLinkedCourseId(String(val ?? ''))}
                          placeholder="-- No linked course (Display Graphic Only) --"
                          searchPlaceholder="Search course or category..."
                          clearable
                        />
                      </div>
                      
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Note: Non-compliant banner ratios will be automatically blocked to maintain visual symmetry across devices.
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
                          background: '#10b981',
                          color: '#fff',
                          fontWeight: 600,
                          padding: '10px 22px',
                        }}
                      >
                        {isUploadingBanner && (
                          <svg className="cms-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                            <path d="M12 2a10 10 0 0 1 10 10" />
                          </svg>
                        )}
                        {isUploadingBanner ? 'Uploading...' : `Upload & Set Live in ${currentCfg.title}`}
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
