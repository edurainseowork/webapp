import React, { useState, useRef, useEffect } from 'react';
import logo from "../study/components/photos/EDURAIN_Logo-Photoroom.png";
import {
  Menu,
  Search,
  Bell,
  BookOpen,
  Library,
  Crosshair,
  ChevronRight,
  Home,
  LayoutGrid,
  Terminal,
  HelpCircle,
  Bot,
  Users,
  Swords,
  Cpu,
  FileText,
  Sparkles,
  X,
  AlignLeft,
  Wifi,
  ChevronDown,
  User,
  ShoppingBag,
  Headphones,
  LogOut,
  Lock,
  Award,
  Radio,
  Target,
  Zap,
  Flame,
  Bookmark,
  Video,
} from 'lucide-react';
import { UpgradeModal } from './components/Modals/UpgradeModal';
import { DoubtSolverModal } from './components/Modals/DoubtSolverModal';
import { VaultDetailModal } from './components/Modals/VaultDetailModal';
import { NotificationDrawer } from './components/Modals/NotificationDrawer';
import { ProfileView } from './components/Profile-section/ProfileView';
import { LibraryView } from './components/LibraryView';
import { CohortGoalModal } from './components/Modals/CohortGoalModal';
import { fetchGoal, saveGoal, type StudentGoal } from './lib/goal';
import { loadActiveCourse, resetActiveCourse, useActiveCourse } from './lib/activeCourse';
import { useCourses, resetCoursesForUser } from './lib/courses';
import { fetchProfile, recordActivity } from './lib/profile';
import { apiFetch } from './lib/api';
import { PurchasesModal } from './components/Modals/PurchasesModal';
import { SupportModal } from './components/Modals/SupportModal';
import { PurchasesView } from './components/PurchasesView';
import { PiView } from './components/PiView';
import { TestSeriesView } from './components/TestSeriesView';
import { AiMentorView } from './components/AiMentorView';
import { BookDoubtSessionView } from './components/askYourDoubt';
import { BookmarksView } from './components/BookmarksView';
import { EBookLibraryView } from './components/EBookLibraryView';
import { useAuth } from './AuthGate';
import { CoursesHub } from './components/Courses/CoursesHub';
import { BannerCarousel } from './components/Courses/BannerCarousel';
import { MentorshipHub } from './components/Mentorship/MentorshipHub';
import { CourseTestSeriesView } from './components/CourseTestSeriesView';
import { LiveClassesView } from './components/LiveClassesView';
import { SavedPdfsView } from './components/SavedPdfsView';
import { VaultResource, NotificationItem } from './types';

export function App() {
  // Signed-in student (AuthGate only renders App when there is one)
  const { session, firstName, logout } = useAuth();
  const initials = session.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'ST';

  // Navigation States
  const [activeNav, setActiveNav] = useState<'study-central' | 'pi' | 'library' | 'courses' | 'test-series' | 'profile'>('study-central');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState('Loading...');
  const [directOpenCourseId, setDirectOpenCourseId] = useState<string | null>(null);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  // Student's goal = a CMS category, saved on their profile
  const [goal, setGoal] = useState<StudentGoal | null>(null);
  const { courses: cmsCourses, ownedIds, status: coursesStatus } = useCourses();

  useEffect(() => {
    resetCoursesForUser(session.uid);
  }, [session.uid]);

  // The one active course (Your Enrolled Courses → Set as Active), saved on the account
  useEffect(() => {
    resetActiveCourse();
    void loadActiveCourse();
  }, [session.uid]);
  const { activeCourseId, goalVersion } = useActiveCourse();

  const enrolledCourses = cmsCourses.filter((c) => ownedIds.includes(c.id));
  const activeCourse = enrolledCourses.find((c) => c.id === activeCourseId) ?? null;

  // Making a course active moves the goal (cohort) to its category on the server: show the new goal
  useEffect(() => {
    if (goalVersion === 0) return;
    let cancelled = false;
    fetchGoal()
      .then((g) => {
        if (!cancelled && g) setGoal(g);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [goalVersion]);
  const enrolledForGoal = goal
    ? enrolledCourses.filter(
        (c) =>
          (goal.id != null && c.categoryId === goal.id) ||
          c.category.trim().toLowerCase() === goal.name.trim().toLowerCase()
      )
    : enrolledCourses;

  useEffect(() => {
    if (activeCourse) {
      setSelectedBatch(activeCourse.title);
    } else if (enrolledForGoal.length > 0) {
      setSelectedBatch(enrolledForGoal.map((c) => c.title).join(', '));
    } else if (!goal && enrolledCourses.length > 0) {
      setSelectedBatch(enrolledCourses[0].title);
    } else if (coursesStatus === 'ready') {
      setSelectedBatch('Not enrolled yet');
    }
  }, [goal, cmsCourses, ownedIds, coursesStatus, activeCourseId]);

  const [isDrawerBatchOpen, setIsDrawerBatchOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Modals
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [isDoubtSolverOpen, setIsDoubtSolverOpen] = useState(false);
  const [isAiMentorPageOpen, setIsAiMentorPageOpen] = useState(false);
  const [isBookDoubtSessionOpen, setIsBookDoubtSessionOpen] = useState(false);
  const [isBookmarksPageOpen, setIsBookmarksPageOpen] = useState(false);
  const [isEbookLibraryOpen, setIsEbookLibraryOpen] = useState(false);
  const [isLiveClassesOpen, setIsLiveClassesOpen] = useState(false);
  const [isCourseTestsOpen, setIsCourseTestsOpen] = useState(false);
  const [isSavedPdfsPageOpen, setIsSavedPdfsPageOpen] = useState(false);

  const [isMyCoursesOpen, setIsMyCoursesOpen] = useState(false);
  const [isPurchasesPageOpen, setIsPurchasesPageOpen] = useState(false);
  const [isMentorshipOpen, setIsMentorshipOpen] = useState(false);
  const [selectedVaultItem, setSelectedVaultItem] = useState<VaultResource | null>(null);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isPurchasesModalOpen, setIsPurchasesModalOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Notifications (live from Backend /api/notifications: personal + broadcast)
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const readBroadcastKey = `edurain_read_broadcasts_${session.uid}`;

  const formatRelativeTime = (iso?: string): string => {
    if (!iso) return 'Just now';
    const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  };

  const fetchStudentNotifications = async () => {
    try {
      const res = await apiFetch<{ success: boolean; data: any[] }>('/notifications');
      if (!Array.isArray(res?.data)) return;
      let readBroadcastIds = new Set<number>();
      try {
        const saved = JSON.parse(localStorage.getItem(readBroadcastKey) || '[]');
        if (Array.isArray(saved)) readBroadcastIds = new Set(saved.map(Number));
      } catch {}

      const mapped: NotificationItem[] = res.data.map((row: any) => {
        const numId = Number(row.id);
        const isBroadcast = numId < 0 || row.type === 'broadcast';
        const isRead = isBroadcast ? readBroadcastIds.has(numId) : Boolean(row.isRead);
        return {
          id: String(row.id),
          rawId: numId,
          title: row.title || 'Update',
          description: row.body || '',
          time: formatRelativeTime(row.createdAt),
          read: isRead,
          type: row.type === 'test' ? 'test' : row.type === 'doubt' ? 'doubt' : 'system',
          imageUrl: row.imageUrl ?? null,
          // Live classes: the server sends the Meet link only to enrolled students and only until the class ends
          link: row.link ?? (row.liveClass?.meetUrl || null),
          linkLabel: row.liveClass?.meetUrl ? (row.liveClass.status === 'live' ? 'Join Live Class now' : 'Google Meet link') : undefined,
        };
      });
      setNotifications(mapped);
    } catch (err) {
      console.error('Could not load notifications:', err);
    }
  };

  useEffect(() => {
    fetchStudentNotifications();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') fetchStudentNotifications();
    }, 30_000);
    const onFocus = () => fetchStudentNotifications();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [session.uid]);

  useEffect(() => {
    if (isNotificationOpen) fetchStudentNotifications();
  }, [isNotificationOpen]);

  const handleMarkNotificationRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    const numId = Number(id);
    if (numId < 0) {
      try {
        const saved = JSON.parse(localStorage.getItem(readBroadcastKey) || '[]');
        const next = Array.from(new Set([...(Array.isArray(saved) ? saved : []), numId]));
        localStorage.setItem(readBroadcastKey, JSON.stringify(next));
      } catch {}
    } else if (numId > 0) {
      apiFetch(`/notifications/${numId}/read`, { method: 'POST' }).catch(() => {});
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      const broadcastIds = notifications.map((n) => Number(n.id)).filter((id) => id < 0);
      if (broadcastIds.length > 0) {
        const saved = JSON.parse(localStorage.getItem(readBroadcastKey) || '[]');
        const next = Array.from(new Set([...(Array.isArray(saved) ? saved : []), ...broadcastIds]));
        localStorage.setItem(readBroadcastKey, JSON.stringify(next));
      }
    } catch {}
    apiFetch('/notifications/read-all', { method: 'POST' }).catch(() => {});
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  // Close profile dropdown on outside click
  useEffect(() => {
    if (!isProfileDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileDropdownOpen]);

  const resetSubViews = () => {
    setIsAiMentorPageOpen(false);
    setIsBookDoubtSessionOpen(false);
    setIsBookmarksPageOpen(false);
    setIsEbookLibraryOpen(false);
    setIsMyCoursesOpen(false);
    setIsPurchasesPageOpen(false);
    setIsMentorshipOpen(false);
    setIsCourseTestsOpen(false);
    setIsLiveClassesOpen(false);
    setIsSavedPdfsPageOpen(false);
  };

  const syncRouteFromUrl = () => {
    if (typeof window === 'undefined') return;
    const path = window.location.pathname.replace(/\/$/, '');
    resetSubViews();
    setSearchQuery('');
    if (path.endsWith('/courses')) {
      setActiveNav('courses');
    } else if (path.endsWith('/daily-doubts') || path.endsWith('/daily-drop') || path.endsWith('/pi')) {
      setActiveNav('pi');
    } else if (path.endsWith('/test-series')) {
      setActiveNav('test-series');
    } else if (path.endsWith('/arena')) {
      setIsCourseTestsOpen(true);
      setActiveNav('study-central');
    } else if (path.endsWith('/profile')) {
      setActiveNav('profile');
    } else if (path.endsWith('/library')) {
      setActiveNav('library');
    } else if (path.endsWith('/ebooks')) {
      setIsEbookLibraryOpen(true);
    } else if (path.endsWith('/bookmarks')) {
      setIsBookmarksPageOpen(true);
    } else if (path.endsWith('/saved-pdfs') || path.endsWith('/saved-pdf') || path.endsWith('/saved_pdfs')) {
      setIsSavedPdfsPageOpen(true);
    } else if (path.endsWith('/doubts')) {
      setIsBookDoubtSessionOpen(true);
    } else if (path.endsWith('/ai-mentor') || path.endsWith('/edu-ai')) {
      setIsAiMentorPageOpen(true);
    } else if (path.endsWith('/my-courses')) {
      setIsMyCoursesOpen(true);
    } else if (path.endsWith('/purchases')) {
      setIsPurchasesPageOpen(true);
    } else if (path.endsWith('/live-classes')) {
      setIsLiveClassesOpen(true);
    } else if (path.endsWith('/mentorship')) {
      setIsMentorshipOpen(true);
    } else if (path.endsWith('/batch-tests') || path.endsWith('/course-tests')) {
      setIsCourseTestsOpen(true);
    } else {
      setActiveNav('study-central');
    }
  };

  const navigateTo = (nav: typeof activeNav, customSlug?: string) => {
    resetSubViews();
    setSearchQuery('');
    setActiveNav(nav);
    if (typeof window !== 'undefined') {
      const slug = customSlug !== undefined ? customSlug : (nav === 'study-central' ? '' : nav === 'pi' ? 'daily-drop' : nav);
      const url = `/study/${slug ? slug : ''}`;
      if (window.location.pathname !== url) {
        window.history.pushState(null, '', url);
      }
    }
  };

  const openSubView = (type: 'ebooks' | 'bookmarks' | 'saved-pdfs' | 'doubts' | 'ai-mentor' | 'my-courses' | 'purchases' | 'mentorship' | 'batch-tests' | 'live-classes') => {
    resetSubViews();
    setSearchQuery('');
    if (type === 'ebooks') setIsEbookLibraryOpen(true);
    else if (type === 'live-classes') setIsLiveClassesOpen(true);
    else if (type === 'bookmarks') setIsBookmarksPageOpen(true);
    else if (type === 'saved-pdfs') setIsSavedPdfsPageOpen(true);
    else if (type === 'doubts') setIsBookDoubtSessionOpen(true);
    else if (type === 'ai-mentor') setIsAiMentorPageOpen(true);
    else if (type === 'my-courses') setIsMyCoursesOpen(true);
    else if (type === 'purchases') setIsPurchasesPageOpen(true);
    else if (type === 'mentorship') setIsMentorshipOpen(true);
    else if (type === 'batch-tests') setIsCourseTestsOpen(true);
    if (typeof window !== 'undefined') {
      const url = `/study/${type}`;
      if (window.location.pathname !== url) {
        window.history.pushState(null, '', url);
      }
    }
  };

  useEffect(() => {
    syncRouteFromUrl();
    const handlePopState = () => {
      syncRouteFromUrl();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  // Daily streak: record one visit per login session (the backend counts days, not visits)
  useEffect(() => {
    recordActivity();
  }, [session.uid]);

  // Profile photo for the top-bar avatar (initials until the student adds one)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchProfile()
      .then((p) => !cancelled && setAvatarUrl(p.profilePhoto))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [session.uid]);
  // After login: load the saved goal once; students who haven't picked one yet get the goal popup.
  // Returning students with a goal land on Daily Drop (they can change the goal from the top navigation).
  const goalLoadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (goalLoadedFor.current === session.uid) return;
    goalLoadedFor.current = session.uid;
    fetchGoal()
      .then((saved) => {
        if (goalLoadedFor.current !== session.uid) return; // signed out meanwhile
        setGoal(saved);
        if (!saved) {
          setIsGoalModalOpen(true);
          return;
        }
        // Opened on the home address (e.g. right after login): go to Daily Drop. A direct link or a
        // refresh of another page (/study/courses, /study/mentorship…) stays where it is.
        if (window.location.pathname.replace(/\/+$/, '') === '/study') {
          setActiveNav('pi');
          window.history.replaceState(null, '', '/study/daily-doubts');
        }
      })
      .catch((err) => console.error('Could not load the saved goal', err));
  }, [session.uid]);

  const getSearchPlaceholder = () => {
    if (activeNav === 'courses' || isMyCoursesOpen) return 'Search in Courses';
    if (activeNav === 'pi') return 'Search in Daily Drop';
    if (activeNav === 'test-series') return 'Search in All India Test Pass';
    if (isEbookLibraryOpen) return 'Search in E-Books';
    if (isLiveClassesOpen) return 'Search live classes…';
    if (isAiMentorPageOpen) return 'Search in EduAI';
    if (isBookmarksPageOpen) return 'Search in Bookmarks';
    return 'Search in Resources';
  };

  const handleLogout = () => {
    setIsProfileDropdownOpen(false);
    navigateTo('study-central');
    // Signing out returns AuthGate to the login screen
    logout().catch((err) => console.error('Logout failed', err));
  };


  const batches = [
    '12th - IIT JEE',
    '11th - IIT JEE',
    'Dropper - JEE Advanced',
    '12th - NEET',
    '11th - NEET',
    'Dropper - NEET Premier',
    'Class 10th - Foundation',
    'Class 9th - Foundation',
  ];

  const vaultItems: VaultResource[] = [
    {
      id: 'vault-physics',
      title: 'Saved Bookmarks',
      subject: 'Physics',
      second_text: 'Watch Later & Fast Revision',
      countLabel: 'Saved Items',
      actionLabel: 'Open Bookmarks',
      tags: ['Rotational Motion', 'Wave Optics', 'Electrodynamics'],
      iconType: 'bookmark',
      gradient: 'from-amber-400 to-amber-600',
      shadow: 'shadow-amber-900/20',
      badgeColor: 'bg-amber-500/15 text-amber-800 border-amber-500/30',
      borderHover: 'hover:border-amber-400/50',
      hoverGlow: 'hover:shadow-[0_16px_40px_-8px_rgba(245,158,11,0.22)]',
      description: 'Comprehensive high-yield notes, derivation sheets, and Irodov problem breakdowns curated by IIT Top 100 rankers.',
      downloadSize: '48.2 MB',
      rating: 4.9,
    },
    {
      id: 'vault-chemistry',
      title: 'Your Class Material',
      subject: 'Chemistry',
      second_text: 'Recorded Lectures & Archives',
      countLabel: 'PDF Notes & Maps',
      actionLabel: 'View Materials',
      tags: ['Reaction Maps', 'Coordination Chem', 'Thermodynamics'],
      iconType: 'archive',
      gradient: 'from-emerald-500 to-teal-700',
      shadow: 'shadow-emerald-900/20',
      badgeColor: 'bg-emerald-500/15 text-emerald-800 border-emerald-500/30',
      borderHover: 'hover:border-emerald-500/50',
      hoverGlow: 'hover:shadow-[0_16px_40px_-8px_rgba(16,185,129,0.22)]',
      description: 'Master organic synthesis pathways, NCERT line-by-line highlight maps, and inorganic memorization mnemonics.',
      downloadSize: '64.5 MB',
      rating: 4.8,
    },
    {
      id: 'vault-live-classes',
      title: 'Your Live Classes',
      subject: 'Live Sessions',
      second_text: 'Interactive Q&A Rooms',
      countLabel: 'LIVE STREAM',
      actionLabel: 'Join Live Room',
      tags: ['Live Stream', 'Doubt Solving', 'Teacher Connect'],
      iconType: 'live',
      isLive: true,
      statusText: 'LIVE NOW',
      gradient: 'from-rose-500 to-red-600',
      shadow: 'shadow-rose-900/20',
      badgeColor: 'bg-rose-500/15 text-rose-800 border-rose-500/30',
      borderHover: 'hover:border-rose-400/50',
      hoverGlow: 'hover:shadow-[0_16px_40px_-8px_rgba(244,63,94,0.25)]',
      description: 'Join live interactive classes directly with expert educators with real-time doubt resolution.',
      downloadSize: 'Live Stream',
      rating: 5.0,
    },
    {
      id: 'vault-math',
      title: 'All India Test Series',
      second_text: 'Real NTA Exam Pattern',
      subject: 'Mock Tests',
      countLabel: 'Active CBT Tests',
      actionLabel: 'Start Practice Test',
      tags: ['Full Syllabus', 'Part Tests', 'Real NTA Engine'],
      iconType: 'analytics',
      gradient: 'from-emerald-500 to-teal-700',
      shadow: 'shadow-emerald-900/20',
      badgeColor: 'bg-emerald-500/15 text-emerald-800 border-emerald-500/30',
      borderHover: 'hover:border-emerald-500/50',
      hoverGlow: 'hover:shadow-[0_16px_40px_-8px_rgba(16,185,129,0.22)]',
      description: 'Live adaptive mock test mirror mimicking actual JEE and NEET CBT interfaces with instant rank analytics.',
      downloadSize: 'Online CBT',
      rating: 4.9,
    },
  ];

  const studyPlans = [
    {
      id: 'sp1',
      title: '1 to 1 Mentorship',
      badge: 'TOP IIT / AIIMS MENTORS',
      subtitle: 'Personalized 1-on-1 strategy, rank roadmap & study motivation',
      icon: Users,
      action: () => openSubView('mentorship'),
      gradient: 'from-emerald-500 to-teal-700',
      shadow: 'shadow-emerald-900/20',
      badgeColor: 'bg-emerald-500/15 text-emerald-800 border-emerald-500/30',
      borderHover: 'hover:border-emerald-500/40',
      hoverGlow: 'hover:shadow-[0_16px_40px_-8px_rgba(16,185,129,0.22)]',
    },
    {
      id: 'sp2',
      title: 'Ask Your Doubt',
      badge: 'INSTANT 24/7 HELP',
      subtitle: 'Snap a photo or chat with educators for instant step-by-step solutions',
      icon: HelpCircle,
      action: () => openSubView('doubts'),
      gradient: 'from-emerald-500 to-teal-700',
      shadow: 'shadow-emerald-900/20',
      badgeColor: 'bg-emerald-500/15 text-emerald-800 border-emerald-500/30',
      borderHover: 'hover:border-emerald-500/40',
      hoverGlow: 'hover:shadow-[0_16px_40px_-8px_rgba(16,185,129,0.22)]',
    },
    {
      id: 'sp3',
      title: 'EduAI Tutor',
      badge: 'SMART AI ASSISTANT',
      subtitle: 'Adaptive AI problem-solver, revision quizzes & 24/7 concept breakdown',
      icon: Bot,
      action: () => openSubView('ai-mentor'),
      gradient: 'from-emerald-500 to-teal-700',
      shadow: 'shadow-emerald-900/20',
      badgeColor: 'bg-emerald-500/15 text-emerald-800 border-emerald-500/30',
      borderHover: 'hover:border-emerald-500/40',
      hoverGlow: 'hover:shadow-[0_16px_40px_-8px_rgba(16,185,129,0.22)]',
    }
  ];

  const filteredStudyPlans = studyPlans.filter(p =>
    !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredVaultItems = vaultItems.filter(v =>
    !searchQuery || v.title.toLowerCase().includes(searchQuery.toLowerCase()) || v.subject.toLowerCase().includes(searchQuery.toLowerCase()) || v.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="relative min-h-screen w-full font-sans antialiased text-[#175A67] bg-[#DCEAE3] selection:bg-[#175A67] selection:text-[#EAE3DE] overflow-x-hidden">

      {/* 1. SOFT AMBIENT BACKGROUND ACCENTS FOR FROSTED GLASS DEPTH */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-20 -left-20 w-[550px] h-[550px] rounded-full bg-emerald-200/40 blur-[130px]" />
        <div className="absolute top-1/3 -right-20 w-[600px] h-[600px] rounded-full bg-teal-200/35 blur-[140px]" />
        <div className="absolute bottom-10 left-1/4 w-[550px] h-[550px] rounded-full bg-sky-200/35 blur-[130px]" />
        <div className="absolute top-2/3 right-1/3 w-[450px] h-[450px] rounded-full bg-amber-100/50 blur-[120px]" />
      </div>

      {/* 2. TOP NAVIGATION BAR */}
      <header className="fixed top-0 left-0 right-0 z-40 h-16 bg-white/60 backdrop-blur-[16px] flex items-center justify-between px-3 sm:px-6 shadow-[0px_1px_2px_0px_#0000000D]">

        {/* Left: Brand + Desktop Target Selector */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div
            onClick={() => navigateTo('study-central')}
            className="flex items-center gap-2 sm:gap-2.5 cursor-pointer"
          >

            <img
              src={logo}
              alt="EduRain Logo"
              className="h-9 sm:h-10 w-auto object-contain transition-transform hover:scale-105"
            />
            <div className="flex items-center text-lg sm:text-xl font-bold tracking-tight">
              <span className="text-emerald-600 font-bold">Edu</span>
              <span className="text-amber-400 font-black">Rain</span>
            </div>
          </div>

          {/* Desktop Batch Selector */}
          <div className="relative hidden md:block">
            <button
              onClick={() => setIsGoalModalOpen(true)}
              className="border border-white/80 text-[#175A67] bg-white/60 hover:bg-white/85 backdrop-blur-md rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5"
            >
              <span>{goal?.name ?? selectedBatch} &gt;</span>
            </button>
          </div>
        </div>

        {/* Center Search Bar (Desktop) */}
        <div className="flex-1 max-w-md mx-4 lg:mx-8 relative hidden md:block">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 w-4 h-4 text-[#2A707C] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={getSearchPlaceholder()}
              className="bg-white/60 border border-white/80 text-[#175A67] placeholder-[#2A707C] pl-10 pr-8 py-1.5 rounded-full w-full text-xs sm:text-sm focus:outline-none focus:border-[#175A67] focus:ring-2 focus:ring-[#175A67]/20 transition-all shadow-inner backdrop-blur-md"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 text-[#2A707C] hover:text-[#175A67]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right Action: Mobile Search Toggle + CTA Button + Notification + User Badge */}
        <div className="flex items-center gap-2 sm:gap-3">

          {/* Mobile Search Toggle Icon */}
          <button
            onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
            className="md:hidden p-2 rounded-full text-[#175A67] hover:bg-white/50 transition-colors"
            title="Search"
          >
            <Search className="w-5 h-5 text-[#175A67]" />
          </button>

          {/* Upgrade CTA (Hidden for now as requested) */}
          {/*
          <button
            onClick={() => setIsUpgradeOpen(true)}
            className="bg-[#10B981] hover:bg-[#059669] text-white font-bold text-[11px] sm:text-xs px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1 shrink-0"
          >
            <span>UPGRADE TO PRO</span>
          </button>
          */}

          {/* Bell Notifications */}
          <button
            onClick={() => setIsNotificationOpen(true)}
            className="relative p-2 rounded-full text-[#175A67] hover:bg-white/50 transition-colors"
            title="Notifications"
          >
            <Bell className="w-5 h-5 text-[#175A67]" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[#10B981] shadow-[0_0_6px_#10B981] ring-2 ring-[#EAE3DE]" />
            )}
          </button>

          {/* User Avatar */}
          <div className="relative flex items-center gap-2 sm:gap-3 pl-1 sm:pl-3 border-l border-[#175A67]/20" ref={profileMenuRef}>
            <div className="text-right hidden sm:block leading-tight">
              <span className="text-xs font-bold text-[#175A67] tracking-wide block">Hi, {firstName.toUpperCase()}</span>
            </div>
            <div
              className="relative cursor-pointer"
              onClick={() => setIsProfileDropdownOpen((o) => !o)}
              title={session.name}
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-[#175A67] to-[#2A707C] p-0.5 shadow-sm">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-full h-full rounded-full object-cover bg-[#EAE3DE]" onError={() => setAvatarUrl(null)} />
                ) : (
                  <div className="w-full h-full rounded-full bg-[#EAE3DE] flex items-center justify-center text-xs font-bold text-[#175A67]">
                    {initials}
                  </div>
                )}
              </div>
            </div>

            {isProfileDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-white/95 backdrop-blur-md border border-[#175A67]/10 rounded-2xl shadow-xl py-1.5 z-50 overflow-hidden">
                <div className="px-3.5 py-2.5 border-b border-[#175A67]/10">
                  <p className="text-xs font-bold text-[#175A67]">{session.name}</p>
                  <p className="text-[10px] text-[#2A707C] truncate">{session.email}</p>
                </div>
                <button
                  onClick={() => {
                    setIsProfileDropdownOpen(false);
                    navigateTo('profile');
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-semibold text-[#175A67] hover:bg-[#175A67]/5 transition-colors"
                >
                  <User className="w-4 h-4" />
                  My Profile
                </button>
                <button
                  onClick={() => {
                    setIsProfileDropdownOpen(false);
                    openSubView('purchases');
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-semibold text-[#175A67] hover:bg-[#175A67]/5 transition-colors"
                >
                  <ShoppingBag className="w-4 h-4" />
                  My Purchases
                </button>
                <button
                  onClick={() => {
                    setIsProfileDropdownOpen(false);
                    setIsSupportOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-semibold text-[#175A67] hover:bg-[#175A67]/5 transition-colors"
                >
                  <Headphones className="w-4 h-4" />
                  Help &amp; Support
                </button>
                <div className="border-t border-[#175A67]/10 mt-1 pt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* Mobile Expandable Search Bar */}
      {isMobileSearchOpen && (
        <div className="fixed top-16 left-0 right-0 z-30 bg-[#EAE3DE]/90 backdrop-blur-xl border-b border-[#175A67]/20 p-3 md:hidden animate-fadeIn">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 w-4 h-4 text-[#2A707C] pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={getSearchPlaceholder()}
              className="bg-white/60 border border-[#175A67]/30 text-[#175A67] placeholder-[#2A707C] pl-10 pr-8 py-2 rounded-xl w-full text-sm focus:outline-none focus:ring-2 focus:ring-[#175A67]/20 shadow-inner"
            />
            <button
              onClick={() => {
                setSearchQuery('');
                setIsMobileSearchOpen(false);
              }}
              className="absolute right-3 text-[#2A707C] hover:text-[#175A67] p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 3. SLIDE-OUT MOBILE NAVIGATION DRAWER */}
      <div
        className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${isMobileSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileSidebarOpen(false)}
        />

        {/* Drawer Panel */}
        <aside
          className={`relative w-[280px] max-w-[85vw] h-full bg-white/80 backdrop-blur-2xl border-r border-white/80 shadow-2xl flex flex-col justify-between p-5 transform transition-transform duration-300 ease-out ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
        >
          <div>
            {/* Drawer Header with Brand & Close */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#175A67]/15">
              <div className="flex items-center gap-2">
                <img
                  src={logo}
                  alt="EduRain Logo"
                  className="h-8 w-auto object-contain"
                />
                <div className="flex items-center text-lg font-bold tracking-tight">
                  <span className="text-emerald-600 font-bold">Edu</span>
                  <span className="text-amber-400 font-black">Rain</span>
                </div>
              </div>
              <button
                onClick={() => setIsMobileSidebarOpen(false)}
                className="p-1.5 rounded-full bg-white/60 text-[#175A67] hover:bg-white transition-colors"
                title="Close Navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile User Card & Batch Selector */}
            <div className="mb-5 p-3 rounded-2xl bg-white/50 border border-[#175A67]/20 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-[#2A707C]">USER PROFILE</span>
                <span className="text-[10px] bg-[#10B981]/20 text-[#059669] font-bold px-2 py-0.5 rounded-full">PRO ACTIVE</span>
              </div>
              <button
                onClick={() => {
                  setIsMobileSidebarOpen(false);
                  navigateTo('profile');
                }}
                className="text-xs font-bold text-[#175A67] hover:underline"
              >
                {session.name}
              </button>

              {/* Cohort Selector inside mobile drawer */}
              <div className="mt-2 relative">
                <button
                  onClick={() => {
                    setIsGoalModalOpen(true);
                    setIsMobileSidebarOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/70 border border-[#175A67]/20 text-xs font-semibold text-[#175A67] hover:bg-white/90 transition-all shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-[#175A67]" />
                    <span>{goal?.name ?? selectedBatch}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-[#2A707C]" />
                </button>
              </div>
            </div>

            {/* Nav Group: MENU */}
            <div className="text-[11px] font-bold text-[#2A707C] px-2 mb-2 tracking-wider uppercase">
              MENU
            </div>
            <div className="space-y-1">
              <button
                onClick={() => {
                  navigateTo('study-central');
                  setIsMobileSidebarOpen(false);
                }}
                className={`group w-full font-semibold rounded-xl px-3.5 py-2.5 flex items-center gap-3 text-sm transition-all ${activeNav === 'study-central' && !isAiMentorPageOpen && !isBookDoubtSessionOpen && !isBookmarksPageOpen && !isEbookLibraryOpen && !isLiveClassesOpen && !isMyCoursesOpen
                  ? 'bg-gradient-to-r from-[#175A67] to-[#1e6f7e] text-white shadow-md shadow-[#175A67]/20 border border-white/20'
                  : 'text-[#175A67] hover:bg-[#175A67]/10'
                  }`}
              >
                <Home className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>Home</span>
              </button>

              <button
                onClick={() => {
                  navigateTo('pi');
                  setIsMobileSidebarOpen(false);
                }}
                className={`group w-full font-semibold rounded-xl px-3.5 py-2.5 flex items-center gap-3 text-sm transition-all ${activeNav === 'pi'
                  ? 'bg-gradient-to-r from-[#175A67] to-[#1e6f7e] text-white shadow-md shadow-[#175A67]/20 border border-white/20'
                  : 'text-[#175A67] hover:bg-[#175A67]/10'
                  }`}
              >
                <Zap className="w-4 h-4 text-amber-500 fill-amber-500/20 group-hover:scale-110 transition-transform" />
                <span>Daily Drop</span>
              </button>

              <button
                onClick={() => {
                  navigateTo('courses');
                  setIsMobileSidebarOpen(false);
                }}
                className={`group w-full font-semibold rounded-xl px-3.5 py-2.5 flex items-center gap-3 text-sm transition-all ${activeNav === 'courses' || isMyCoursesOpen
                  ? 'bg-gradient-to-r from-[#175A67] to-[#1e6f7e] text-white shadow-md shadow-[#175A67]/20 border border-white/20'
                  : 'text-[#175A67] hover:bg-[#175A67]/10'
                  }`}
              >
                <BookOpen className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>COURSES</span>
              </button>

              <button
                onClick={() => {
                  navigateTo('test-series');
                  setIsMobileSidebarOpen(false);
                }}
                className={`group w-full font-semibold rounded-xl px-3.5 py-2.5 flex items-center gap-3 text-sm transition-all ${activeNav === 'test-series'
                  ? 'bg-gradient-to-r from-[#175A67] to-[#1e6f7e] text-white shadow-md shadow-[#175A67]/20 border border-white/20'
                  : 'text-[#175A67] hover:bg-[#175A67]/10'
                  }`}
              >
                <Award className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>ALL INDIA TEST PASS</span>
              </button>
            </div>
          </div>

          {/* Drawer Footer CTA (Hidden for now as requested) */}
          {/*
          <div className="pt-4 border-t border-[#175A67]/15">
            <button
              onClick={() => {
                setIsUpgradeOpen(true);
                setIsMobileSidebarOpen(false);
              }}
              className="w-full bg-[#175A67] hover:bg-[#124853] text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"
            >
              <span className="text-amber-400">★</span>
              <span>UPGRADE TO PRO</span>
            </button>
          </div>
          */}
        </aside>
      </div>

      {/* 4. DESKTOP FIXED SIDEBAR */}
      <div className="pt-16 flex">

        <aside className="hidden lg:flex fixed top-16 left-0 bottom-0 w-[250px] backdrop-blur-[16px] bg-white/50 border-r border-[#FFFFFFA6] p-4 z-30 flex-col justify-between overflow-y-auto no-scrollbar shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <div>
            {/* Group: MENU */}
            <div className="text-xs font-bold text-[#2A707C] px-3 mb-2 tracking-wider uppercase">
              MENU
            </div>
            <div className="space-y-1">
              <button
                onClick={() => navigateTo('study-central')}
                className={`group w-full font-semibold rounded-xl px-4 py-3 flex items-center gap-3 text-sm transition-all ${activeNav === 'study-central' && !isAiMentorPageOpen && !isBookDoubtSessionOpen && !isBookmarksPageOpen && !isEbookLibraryOpen && !isLiveClassesOpen && !isMyCoursesOpen
                  ? 'bg-gradient-to-r from-[#175A67] to-[#1e6f7e] text-white shadow-md shadow-[#175A67]/20 border border-white/20'
                  : 'text-[#175A67] hover:bg-[#175A67]/10'
                  }`}
              >
                <Home className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>Home</span>
              </button>

              <button
                onClick={() => navigateTo('pi')}
                className={`group w-full font-semibold rounded-xl px-4 py-3 flex items-center gap-3 text-sm transition-all ${activeNav === 'pi'
                  ? 'bg-gradient-to-r from-[#175A67] to-[#1e6f7e] text-white shadow-md shadow-[#175A67]/20 border border-white/20'
                  : 'text-[#175A67] hover:bg-[#175A67]/10'
                  }`}
              >
                <Zap className="w-4 h-4 text-amber-500 fill-amber-500/20 group-hover:scale-110 transition-transform" />
                <span>Daily Drop</span>
              </button>

              <button
                onClick={() => navigateTo('courses')}
                className={`group w-full font-semibold rounded-xl px-4 py-3 flex items-center gap-3 text-sm transition-all ${activeNav === 'courses' || isMyCoursesOpen
                  ? 'bg-gradient-to-r from-[#175A67] to-[#1e6f7e] text-white shadow-md shadow-[#175A67]/20 border border-white/20'
                  : 'text-[#175A67] hover:bg-[#175A67]/10'
                  }`}
              >
                <BookOpen className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>COURSES</span>
              </button>

              <button
                onClick={() => navigateTo('test-series')}
                className={`group w-full font-semibold rounded-xl px-4 py-3 flex items-center gap-3 text-sm transition-all ${activeNav === 'test-series'
                  ? 'bg-gradient-to-r from-[#175A67] to-[#1e6f7e] text-white shadow-md shadow-[#175A67]/20 border border-white/20'
                  : 'text-[#175A67] hover:bg-[#175A67]/10'
                  }`}
              >
                <Award className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>ALL INDIA TEST PASS</span>
              </button>
            </div>
          </div>

          {/* Bottom CTA (Hidden for now as requested) */}
          {/*
          <div className="pt-4">
            <button
              onClick={() => setIsUpgradeOpen(true)}
              className="w-full bg-[#175A67] hover:bg-[#124853] text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md active:scale-95"
            >
              <span className="text-amber-400">★</span>
              <span>UPGRADE TO PRO</span>
            </button>
          </div>
          */}
        </aside>

        {/* 5. MAIN DASHBOARD BODY */}
        <main className="flex-1 lg:ml-[250px] px-4 sm:px-8 py-5 sm:py-6 max-w-[1600px] w-full overflow-hidden">

          {/* Active View Switching */}
          {isSavedPdfsPageOpen ? (
            <SavedPdfsView
              onBack={() => {
                setIsSavedPdfsPageOpen(false);
                setIsBookmarksPageOpen(true);
                if (typeof window !== 'undefined') {
                  window.history.pushState(null, '', '/study/bookmarks');
                }
              }}
              onGoBookmarks={() => {
                setIsSavedPdfsPageOpen(false);
                setIsBookmarksPageOpen(true);
                if (typeof window !== 'undefined') {
                  window.history.pushState(null, '', '/study/bookmarks');
                }
              }}
              onGoLibrary={() => {
                setIsSavedPdfsPageOpen(false);
                navigateTo('study-central');
              }}
              onBrowseCourses={() => {
                setIsSavedPdfsPageOpen(false);
                navigateTo('courses');
              }}
            />
          ) : isPurchasesPageOpen ? (
            <PurchasesView
              onBack={() => setIsPurchasesPageOpen(false)}
              selectedBatch={selectedBatch}

            />
          ) : isMentorshipOpen ? (
            <MentorshipHub
              studentEmail={session.email}
              goalId={goal?.id ?? null}
              goalName={goal?.name ?? null}
              onChangeGoal={() => setIsGoalModalOpen(true)}
              onExit={() => setIsMentorshipOpen(false)}
            />

          ) : isAiMentorPageOpen ? (
            <AiMentorView
              userName={firstName}
              onBack={() => setIsAiMentorPageOpen(false)}
            />
          ) : isBookDoubtSessionOpen ? (
            <BookDoubtSessionView
              onBack={() => setIsBookDoubtSessionOpen(false)}
              onOpenMySessions={() => openSubView('purchases')}
              selectedBatch={selectedBatch}
              goalName={goal?.name}
              studentName={session?.name}
              studentEmail={session?.email}
            />
          ) : isBookmarksPageOpen ? (
            <BookmarksView
              onBack={() => setIsBookmarksPageOpen(false)}
              onGoLibrary={() => {
                setIsBookmarksPageOpen(false);
                navigateTo('study-central');
              }}
              searchQuery={searchQuery}
              onBrowseEbooks={() => openSubView('ebooks')}
              onOpenSavedPdfsPage={() => openSubView('saved-pdfs')}
              onOpenPdfViewer={() => openSubView('saved-pdfs')}
              onWatchVideo={(video) => console.log('Resuming video:', video.title)}
              onOpenWatchLater={() => console.log('Opening Watch Later list…')}
              onAddDocument={() => console.log('Add document to wishlist…')}
              onClearHistory={() => console.log('Clearing watch history…')}
            />
          ) : isEbookLibraryOpen ? (
            <EBookLibraryView
              onBack={() => setIsEbookLibraryOpen(false)}
              onGoLibrary={() => {
                setIsEbookLibraryOpen(false);
                navigateTo('study-central');
              }}
              searchQuery={searchQuery}
            />
          ) : isLiveClassesOpen ? (
            <LiveClassesView
              onBack={() => setIsLiveClassesOpen(false)}
              selectedBatch={selectedBatch}
              searchQuery={searchQuery}
              onExploreCourses={() => {
                setIsLiveClassesOpen(false);
                navigateTo('courses');
              }}
            />
          ) : isCourseTestsOpen ? (
            <CourseTestSeriesView
              onBack={() => setIsCourseTestsOpen(false)}
              selectedBatch={selectedBatch}
              studentName={session?.name}
            />
          ) : isMyCoursesOpen ? (
            <PurchasesView
              initialView="enrolled"
              onBack={() => setIsMyCoursesOpen(false)}
              selectedBatch={selectedBatch}

            />
          ) : activeNav === 'profile' ? (
            <ProfileView
              onBack={() => navigateTo('study-central')}
              goal={goal}
              onPhotoChange={setAvatarUrl}
            />
          ) : activeNav === 'library' ? (
            <LibraryView
              onBack={() => navigateTo('study-central')}
              onOpenEbooks={() => openSubView('ebooks')}
            />
          ) : activeNav === 'pi' ? (
            <PiView
              searchQuery={searchQuery}
              onBack={() => navigateTo('study-central')}
              onOpenUpgrade={() => setIsUpgradeOpen(true)}
              onOpenDoubtSolver={() => setIsDoubtSolverOpen(true)}
            />
          ) : activeNav === 'courses' ? (
            <CoursesHub
              // A new goal re-opens the catalogue on that goal's tab
              key={goal?.id ?? 'no-goal'}
              mode="catalog"
              selectedBatch={selectedBatch}
              searchQuery={searchQuery}
              goalCategoryId={goal?.id ?? null}
              initialOpenBatchId={directOpenCourseId}
              onExit={() => {
                setDirectOpenCourseId(null);
                navigateTo('study-central');
              }}
            />
          ) : activeNav === 'test-series' ? (
            <TestSeriesView
              onBack={() => navigateTo('study-central')}
              onOpenUpgrade={() => setIsUpgradeOpen(true)}
              onOpenCourseTests={() => setIsCourseTestsOpen(true)}
            />
          ) : (
            <div className="animate-tab-content">
              {/* Subheader & Wi-Fi Sync Indicator */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                <div>
                  <div className="text-[#175A67] font-semibold text-base sm:text-lg">
                    Welcome back, <span className="text-[#B8860B]">{firstName}</span>
                  </div>
                  <div className="text-xs text-[#2A707C]">
                    Target:{' '}
                    <button onClick={() => setIsGoalModalOpen(true)} className="font-bold text-[#175A67] hover:underline">
                      {goal?.name ?? 'Set your goal'}
                    </button>{' '}
                    • Current Batch:{' '}
                    <button
                      onClick={() => (enrolledForGoal.length > 0 ? openSubView('purchases') : navigateTo('courses'))}
                      className="font-bold text-[#175A67] hover:underline"
                      title={enrolledForGoal.length > 0 ? 'Open your enrolled batch' : 'Explore courses for this goal'}
                    >
                      {activeCourse
                        ? activeCourse.title
                        : enrolledForGoal.length > 0
                        ? enrolledForGoal.map((c) => c.title).join(', ')
                        : coursesStatus === 'ready'
                        ? 'Not enrolled yet'
                        : selectedBatch}
                    </button>
                  </div>
                </div>

                {/* <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/60 border border-white/80 text-[11px] text-[#175A67] font-semibold self-start sm:self-auto backdrop-blur-md shadow-sm">
                  <Wifi className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>Wi-Fi Preview Active: 192.168.29.39:5173</span>
                </div> */}
              </div>

              {/* Web Home Page Hero Banner (Strict 3.2:1 Aspect Ratio) */}
              <BannerCarousel
                placement="web_home"
                className="mb-8"
                onOpenBatch={(courseId) => {
                  setDirectOpenCourseId(courseId);
                  navigateTo('courses');
                }}
              />

              {/* Study Plans Row */}
              <section className="mb-8 sm:mb-10">
                <div className="flex items-center gap-2.5 mb-4">
                  <Cpu className="w-5 h-5 text-[#175A67]" />
                  <h2 className="text-lg sm:text-xl font-bold text-[#175A67]">Features</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
                  {filteredStudyPlans.map((plan: any) => {
                    const IconComponent = plan.icon;
                    return (
                      <div
                        key={plan.id}
                        onClick={plan.action}
                        className={`group relative bg-white/60 hover:bg-white/85 backdrop-blur-xl border border-white/80 ${plan.borderHover || 'hover:border-white'} rounded-2xl p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.05)] ${plan.hoverGlow || 'hover:shadow-lg'} transition-all duration-300 ease-out hover:-translate-y-1.5 cursor-pointer flex flex-col justify-between min-h-[160px] active:scale-[0.98] overflow-hidden`}
                      >
                        <div className="w-full flex items-start justify-between gap-3">
                          <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br ${plan.gradient} text-white flex items-center justify-center shadow-lg ${plan.shadow} group-hover:scale-110 group-hover:rotate-2 transition-all duration-300 relative border border-white/30 flex-shrink-0`}>
                            <IconComponent className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                          </div>
                          <div className="w-8 h-8 rounded-full bg-white/80 border border-white flex items-center justify-center text-[#175A67] shadow-sm group-hover:bg-[#175A67] group-hover:text-white group-hover:translate-x-1 transition-all">
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="mt-3">
                          <h3 className="font-extrabold text-[#175A67] text-[15px] sm:text-base leading-tight tracking-tight">
                            {plan.title}
                          </h3>
                          <p className="text-[#2A707C] text-xs sm:text-[13px] mt-1.5 font-medium leading-relaxed">
                            {plan.subtitle}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Library Row */}
              <section className="pb-12">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <AlignLeft className="w-5 h-5 text-[#175A67]" />
                    <h2 className="text-lg sm:text-xl font-bold text-[#175A67]">Library</h2>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-5">
                  {filteredVaultItems.map((item: any) => {
                    const iconMap: Record<string, any> = {
                      bookmark: Bookmark,
                      book: Bookmark,
                      archive: Library,
                      combat: Swords,
                      live: Video,
                      analytics: Target
                    };
                    const IconComp = iconMap[item.iconType] || BookOpen;

                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (item.id === 'vault-physics') {
                            openSubView('bookmarks');
                          } else if (item.id === 'vault-chemistry') {
                            navigateTo('library');
                          } else if (item.id === 'vault-live-classes') {
                            openSubView('live-classes');
                          } else if (item.id === 'vault-combat') {
                            openSubView('ebooks');
                          } else if (item.id === 'vault-math') {
                            openSubView('batch-tests');
                          } else {
                            resetSubViews();
                            setSelectedVaultItem(item);
                          }
                        }}
                        className={`group bg-white/60 hover:bg-white/85 backdrop-blur-xl border border-white/80 ${item.borderHover || 'hover:border-white'} rounded-2xl p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.05)] ${item.hoverGlow || 'hover:shadow-xl'} transition-all duration-300 hover:-translate-y-1.5 cursor-pointer flex flex-col items-center justify-between min-h-[220px] active:scale-[0.98] relative overflow-hidden`}
                      >
                        <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br ${item.gradient || 'from-[#175A67] to-[#2A707C]'} text-white flex items-center justify-center shadow-lg ${item.shadow || ''} group-hover:scale-110 group-hover:rotate-2 transition-all duration-300 border border-white/30 my-1`}>
                          <IconComp className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                        </div>

                        <div className="text-center w-full">
                          <h3 className="font-extrabold text-[#175A67] text-center text-base sm:text-[17px] leading-snug">
                            {item.title}
                          </h3>
                          <p className="text-xs font-bold text-[#175A67]/80 mt-1">
                            {item.countLabel}
                          </p>
                          <p className="text-[11px] text-[#2A707C] mt-0.5 font-medium">
                            {item.second_text}
                          </p>
                        </div>

                        <div className="w-full pt-2.5 border-t border-[#175A67]/10 flex items-center justify-center gap-1.5 text-xs font-bold text-[#175A67] group-hover:text-emerald-700 transition-colors">
                          <span>{item.actionLabel || 'Enter Library'}</span>
                          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

        </main>
      </div>

      {/* 6. MODALS */}
      <UpgradeModal
        isOpen={isUpgradeOpen}
        onClose={() => setIsUpgradeOpen(false)}
      />

      <DoubtSolverModal
        isOpen={isDoubtSolverOpen}
        onClose={() => setIsDoubtSolverOpen(false)}
      />

      <VaultDetailModal
        item={selectedVaultItem}
        onClose={() => setSelectedVaultItem(null)}
        onOpenUpgrade={() => {
          setSelectedVaultItem(null);
          setIsUpgradeOpen(true);
        }}
      />

      <NotificationDrawer
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        notifications={notifications}
        onMarkAllRead={handleMarkAllNotificationsRead}
        onMarkRead={handleMarkNotificationRead}
      />

      <PurchasesModal
        isOpen={isPurchasesModalOpen}
        onClose={() => setIsPurchasesModalOpen(false)}
      />
      
      <SupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />

      <CohortGoalModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        activeGoalId={goal?.id ?? null}
        onConfirm={async (category) => {
          // Save first; if it fails the popup stays open with the error
          const saved = await saveGoal(category);
          setGoal(saved);
          // The server keeps the active course in the new cohort (or picks / clears it)
          void loadActiveCourse();
          const matchingEnrolled = cmsCourses.filter(
            (c) =>
              ownedIds.includes(c.id) &&
              ((saved.id != null && c.categoryId === saved.id) ||
                c.category.trim().toLowerCase() === saved.name.trim().toLowerCase())
          );
          setSelectedBatch(
            matchingEnrolled.length > 0
              ? matchingEnrolled.map((c) => c.title).join(', ')
              : 'Not enrolled yet'
          );
          // Stay on Home, Mentorship, or Courses when switching goals so the updated Target & Batch are visible
          if (!isMentorshipOpen && activeNav !== 'courses' && activeNav !== 'study-central') {
            navigateTo('pi');
          }
        }}
      />

    </div>
  );
}

export default App;
