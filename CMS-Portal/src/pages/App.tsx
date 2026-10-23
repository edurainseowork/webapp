import edurainLogo from '../assets/logo.webp'
import { useState, useEffect, useRef } from 'react'
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, sendEmailVerification, type User } from 'firebase/auth'
import { auth } from '../firebase'
import { apiFetch, uploadFile, API_BASE_URL, type AdminCourse } from '../api'
import CourseManager from './CourseManager'
import CategoryManager from './CategoryManager'
import CourseContentManager from './CourseContentManager'
import RoleGuard from '../components/RoleGuard'
import Coupons from './Coupons'
import GoLive from './GoLive'
import Notifications from './Notifications'
import Tests from './Tests'
import ManageAdmins from './ManageAdmins'
import MentorDesk from './MentorDesk'
import TeacherAssistantDesk from './TeacherAssistantDesk'
import { handoffError } from '../handoff'

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

  const [coursesList, setCoursesList] = useState<AdminCourse[]>([]);
  
  // Toast State
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Upload Content State
  const [selectedCourseForContent, setSelectedCourseForContent] = useState('');

  // Banners State
  const [bannersList, setBannersList] = useState<any[]>([]);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  const fetchBanners = async () => {
    try {
      const data = await apiFetch('/banners');
      if (data.success) {
        setBannersList(data.data);
      }
    } catch (e) {
      console.error("Failed to fetch banners", e);
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
    try {
      const data = await apiFetch<{ data: AdminCourse[] }>('/admin/courses');
      setCoursesList(data.data);
    } catch (e) {
      console.error("Failed to fetch courses", e);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await apiFetch('/stats');
      if (data.success) {
        setActiveStudents(data.activeStudents);
      }
    } catch (e) {
      console.error("Failed to fetch stats", e);
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
    if (user) fetchMe();
    else setMe({ isSuperAdmin: false, superAdminEmailUnverified: false });
  }, [user]);

  // Leave the admin page if the signed-in account is not the Super Admin
  useEffect(() => {
    if (activeTab === 'admins' && !me.isSuperAdmin) setActiveTab('dashboard');
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
    if (bannersList.length >= 5) {
      showToast("Maximum 5 banners allowed. Delete one first.", "error");
      return;
    }
    
    setIsUploadingBanner(true);
    try {
      // Banners store absolute URLs (the banners API predates server-relative paths).
            // Images now come back as full S3 URLs; older local uploads are server-relative paths
      const uploadedUrl = await uploadFile(bannerFile);
      const imageUrl = uploadedUrl.startsWith('/') ? API_BASE_URL + uploadedUrl : uploadedUrl;

      const data = await apiFetch('/banners', { method: 'POST', body: { imageUrl } });
      if (data.success) {
        showToast("Banner uploaded successfully", "success");
        setBannerFile(null);
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

  // Mentor accounts: the Mentor Desk only, with no "Back to CMS" (the backend refuses them every CMS API too)
  if (isMentor) {
    return (
      <RoleGuard allowedRoles={['admin', 'faculty', 'mentor', 'teacher_assistant']} fallbackLogin={loginForm} onRoleResolved={setCmsRole}>
        <MentorDesk user={user} />
      </RoleGuard>
    );
  }

  // Mentor Desk is a full page with its own sidebar (admins / faculty can preview it and go back)
  if (activeTab === 'mentorDesk') {
    return (
      <RoleGuard allowedRoles={['admin', 'faculty', 'mentor', 'teacher_assistant']} fallbackLogin={loginForm} onRoleResolved={setCmsRole}>
        <MentorDesk user={user} onExit={() => setActiveTab(lastCmsTab.current)} />
      </RoleGuard>
    );
  }


  // Teacher Assistant accounts: the Teacher Assistant Desk only, with no "Back to CMS"
  if (isTeacherAssistant) {
    return (
      <RoleGuard allowedRoles={['admin', 'faculty', 'mentor', 'teacher_assistant']} fallbackLogin={loginForm} onRoleResolved={setCmsRole}>
        <TeacherAssistantDesk user={user} />
      </RoleGuard>
    );
  }

  // Teacher Assistant Desk is a full page with its own sidebar (admins / faculty can preview it and go back)
  if (activeTab === 'teacherAssistant') {
    return (
      <RoleGuard allowedRoles={['admin', 'faculty', 'mentor', 'teacher_assistant']} fallbackLogin={loginForm} onRoleResolved={setCmsRole}>
        <TeacherAssistantDesk user={user} onExit={() => setActiveTab(lastCmsTab.current)} />
      </RoleGuard>
    );
  }

  return (
    <RoleGuard allowedRoles={['admin', 'faculty', 'mentor', 'teacher_assistant']} fallbackLogin={loginForm} onRoleResolved={setCmsRole}>
      <div className="layout">
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: toast.type === 'success' ? 'var(--mint)' : '#ff5e5e',
          color: toast.type === 'success' ? 'var(--navy)' : 'white',
          padding: '12px 24px',
          borderRadius: '8px',
          fontWeight: 'bold',
          zIndex: 9999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          {toast.message}
        </div>
      )}

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={edurainLogo} alt="EduRain Logo" style={{ width: '32px', height: '32px', objectFit: 'contain', flexShrink: 0 }} />
          <span>Edurain CMS</span>
        </div>
        <nav className="sidebar-nav">
          <div className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            Dashboard
          </div>
          <div className={`nav-link ${activeTab === 'courses' ? 'active' : ''}`} onClick={() => setActiveTab('courses')}>
            Course Manager
          </div>
          <div className={`nav-link ${activeTab === 'categories' ? 'active' : ''}`} onClick={() => setActiveTab('categories')}>
            Categories
          </div>
          <div className={`nav-link ${activeTab === 'content' ? 'active' : ''}`} onClick={() => setActiveTab('content')}>
            Upload Content (PDF/Video/Test)
          </div>
          <div className={`nav-link ${activeTab === 'banners' ? 'active' : ''}`} onClick={() => setActiveTab('banners')}>
            Manage Banners
          </div>
          <div className={`nav-link ${activeTab === 'coupons' ? 'active' : ''}`} onClick={() => setActiveTab('coupons')}>
            Private/Public Coupons
          </div>
          <div className={`nav-link ${activeTab === 'golive' ? 'active' : ''}`} onClick={() => setActiveTab('golive')}>
            Go Live (Google Meet)
          </div>
          <div className={`nav-link ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => setActiveTab('notifications')}>
            Notifications
          </div>
          <div className={`nav-link ${activeTab === 'tests' ? 'active' : ''}`} onClick={() => setActiveTab('tests')}>
            Tests
          </div>
          {me.isSuperAdmin && (
            <div className={`nav-link ${activeTab === 'admins' ? 'active' : ''}`} onClick={() => setActiveTab('admins')}>
              Manage Users
            </div>
          )}
          <div className={`nav-link ${activeTab === 'mentorDesk' ? 'active' : ''}`} onClick={() => setActiveTab('mentorDesk')}>
            Mentor Desk
          </div>
          <div className={`nav-link ${activeTab === 'teacherAssistant' ? 'active' : ''}`} onClick={() => setActiveTab('teacherAssistant')}>
            Teacher Assistant Desk
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="page-header">
          <h1 className="page-title">
            {activeTab === 'dashboard' && 'Overview'}
            {activeTab === 'courses' && 'Course Manager'}
            {activeTab === 'categories' && 'Category Management'}
            {activeTab === 'content' && 'Post-Purchase Content'}
            {activeTab === 'banners' && 'Manage Homepage Banners'}
            {activeTab === 'coupons' && 'Coupon Generator'}
            {activeTab === 'golive' && 'Live Classes'}
            {activeTab === 'notifications' && 'Notifications'}
            {activeTab === 'tests' && 'Test Management'}
            {activeTab === 'admins' && 'Manage Users'}
          </h1>
          <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          {me.isSuperAdmin && (
              <button
                onClick={() => { setActiveTab('admins'); setOpenCreateAdmin(true); }}
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
        {activeTab === 'dashboard' && (
          <>
            <div className="dashboard-grid">
              <div className="glass-card stat-card">
                <span className="stat-label">Total Courses</span>
                <span className="stat-value">{coursesList.length}</span>
              </div>
              <div className="glass-card stat-card">
                <span className="stat-label">Published</span>
                <span className="stat-value">{coursesList.filter(c => c.isPublished).length}</span>
              </div>
              <div className="glass-card stat-card">
                <span className="stat-label">Active Students</span>
                <span className="stat-value">{activeStudents}</span>
              </div>
            </div>
            <div className="glass-card" style={{ minHeight: '300px' }}>
              <h3 style={{ marginBottom: 'var(--space-md)' }}>Recent Activity</h3>
              <p style={{ color: 'var(--text-secondary)' }}>Welcome to the CMS Dashboard.</p>
            </div>
          </>
        )}

        {activeTab === 'courses' && (
          <CourseManager
            courses={coursesList}
            reloadCourses={fetchCourses}
            showToast={showToast}
            onManageContent={(courseId) => {
              setSelectedCourseForContent(String(courseId));
              setActiveTab('content');
            }}
          />
        )}

        {activeTab === 'categories' && (
          <CategoryManager showToast={showToast} onCategoriesChanged={fetchCourses} />
        )}

        {activeTab === 'content' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            <CourseContentManager
              courses={coursesList}
              selectedCourseId={selectedCourseForContent}
              onSelectCourse={setSelectedCourseForContent}
              showToast={showToast}
            />

            <div className="glass-card">
              <h3 style={{ marginBottom: 'var(--space-md)' }}>Create Weekly Test / Quiz</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', fontSize: '0.9rem' }}>
                Note: In the app, this test will open in strict Full-Screen mode. If the user presses back, the test will end automatically and score will be submitted to AWS.
              </p>
              <form style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                <input type="text" placeholder="Test Title (e.g. Thermodynamics Week 1)" style={{ padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }} />
                <textarea rows={3} placeholder="Question 1 (Text format)" style={{ padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }} />
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                  <input type="text" placeholder="Option A" style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }} />
                  <input type="text" placeholder="Option B" style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }} />
                </div>
                <button type="button" className="btn" style={{ alignSelf: 'flex-start', marginTop: 'var(--space-sm)', background: 'transparent', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)' }}>+ Add Next Question</button>
                <button type="button" className="btn" style={{ alignSelf: 'flex-start', marginTop: 'var(--space-md)' }}>Publish Test</button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'banners' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            <div className="glass-card">
              <h3 style={{ marginBottom: 'var(--space-md)' }}>Uploaded Banners ({bannersList.length}/5)</h3>
              {bannersList.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)' }}>No banners uploaded yet.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {bannersList.map(banner => (
                    <div key={banner.id} style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <img src={banner.imageUrl} alt="Banner" style={{ width: '100%', height: '120px', objectFit: 'cover', display: 'block' }} />
                      <button 
                        onClick={() => handleDeleteBanner(banner.id)}
                        style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(255,0,0,0.8)', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem' }}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-card">
              <h3 style={{ marginBottom: 'var(--space-md)' }}>Upload New Banner</h3>
              <form style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                <div style={{ border: '2px dashed rgba(255,255,255,0.2)', padding: 'var(--space-xl)', textAlign: 'center', borderRadius: 'var(--radius-md)' }}>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)' }}>Select Banner Image</p>
                  <input type="file" accept="image/*" onChange={e => setBannerFile(e.target.files?.[0] || null)} className="input-field" style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', cursor: 'pointer' }} />
                </div>
                
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Note: These banners are used for notices and will appear as a sliding carousel on the top of the mobile app home screen.
                </p>

                <button type="button" onClick={handleUploadBanner} disabled={isUploadingBanner || !bannerFile} className="btn" style={{ alignSelf: 'flex-start' }}>
                  {isUploadingBanner ? 'Uploading...' : 'Upload & Set Live'}
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'coupons' && (
          <Coupons user={user!} coursesList={coursesList} showToast={showToast} />
        )}

        {activeTab === 'golive' && (
          <GoLive user={user!} coursesList={coursesList} showToast={showToast} />
        )}

        {activeTab === 'notifications' && (
          <Notifications showToast={showToast} />
        )}

        {activeTab === 'tests' && (
          <Tests showToast={showToast} />
        )}
                {activeTab === 'admins' && me.isSuperAdmin && (
          <ManageAdmins
            showToast={showToast}
            openCreate={openCreateAdmin}
            onCreateOpened={() => setOpenCreateAdmin(false)}
          />
        )}
      </main>
    </div>
  </RoleGuard>
  )
}

export default App