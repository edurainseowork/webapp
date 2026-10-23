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
  LogOut,
  Lock,
  Award
} from 'lucide-react';
import { UpgradeModal } from './components/Modals/UpgradeModal';
import { DoubtSolverModal } from './components/Modals/DoubtSolverModal';
import { VaultDetailModal } from './components/Modals/VaultDetailModal';
import { NotificationDrawer } from './components/Modals/NotificationDrawer';
import { ProfileView } from './components/Profile-section/ProfileView';
import { LibraryView } from './components/LibraryView';
import { CohortGoalModal } from './components/Modals/CohortGoalModal';
import { fetchGoal, saveGoal, type StudentGoal } from './lib/goal';
import { PurchasesModal } from './components/Modals/PurchasesModal';
import { PurchasesView } from './components/PurchasesView';
import { PiView } from './components/PiView';
import { TestSeriesView } from './components/TestSeriesView';
import { AiMentorView } from './components/AiMentorView';
import { BookDoubtSessionView } from './components/askYourDoubt';
import { BookmarksView } from './components/BookmarksView';
import { EBookLibraryView } from './components/EBookLibraryView';
import { useAuth } from './AuthGate';
import { CoursesHub } from './components/Courses/CoursesHub';
import { MentorshipHub } from './components/Mentorship/MentorshipHub';
import { CourseTestSeriesView } from './components/CourseTestSeriesView';
import { VaultResource, NotificationItem } from './types';

export function App() {
  // Signed-in student (AuthGate only renders App when there is one)
  const { session, firstName, logout } = useAuth();
  const initials = session.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'ST';

  // Navigation States
  const [activeNav, setActiveNav] = useState<'study-central' | 'pi' | 'library' | 'courses' | 'test-series' | 'profile'>('study-central');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState('12th - IIT JEE');
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  // Student's goal = a CMS category, saved on their profile
  const [goal, setGoal] = useState<StudentGoal | null>(null);
  const [isDrawerBatchOpen, setIsDrawerBatchOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Modals
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [isDoubtSolverOpen, setIsDoubtSolverOpen] = useState(false);
  const [isAiMentorPageOpen, setIsAiMentorPageOpen] = useState(false);
  const [isBookDoubtSessionOpen, setIsBookDoubtSessionOpen] = useState(false);
  const [isBookmarksPageOpen, setIsBookmarksPageOpen] = useState(false);
  const [isEbookLibraryOpen, setIsEbookLibraryOpen] = useState(false);
  const [isCourseTestsOpen, setIsCourseTestsOpen] = useState(false);

  const [isMyCoursesOpen, setIsMyCoursesOpen] = useState(false);
  const [isPurchasesPageOpen, setIsPurchasesPageOpen] = useState(false);
  const [isMentorshipOpen, setIsMentorshipOpen] = useState(false);
  const [selectedVaultItem, setSelectedVaultItem] = useState<VaultResource | null>(null);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isPurchasesModalOpen, setIsPurchasesModalOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Notifications
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'n1',
      title: 'Mock Test 04 Result Published',
      description: 'You scored 148/180 in JEE Advanced All-India Mock 04. Estimated All-India Rank: #42.',
      time: '15m ago',
      read: false,
      type: 'test'
    },
    {
      id: 'n2',
      title: 'PI Doubt Answered',
      description: 'Step-by-step solution for "Carnot Engine Entropy" has been synthesized with derivation.',
      time: '1h ago',
      read: false,
      type: 'doubt'
    },
    {
      id: 'n3',
      title: '14-Day Streak Bonus',
      description: 'You earned +150 XP for completing your daily revision quota 14 days in a row.',
      time: '4h ago',
      read: true,
      type: 'streak'
    }
  ]);

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
    } else if (path.endsWith('/doubts')) {
      setIsBookDoubtSessionOpen(true);
    } else if (path.endsWith('/ai-mentor') || path.endsWith('/edu-ai')) {
      setIsAiMentorPageOpen(true);
    } else if (path.endsWith('/my-courses')) {
      setIsMyCoursesOpen(true);
    } else if (path.endsWith('/purchases')) {
      setIsPurchasesPageOpen(true);
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
      const slug = customSlug !== undefined ? customSlug : (nav === 'study-central' ? '' : nav === 'pi' ? 'daily-doubts' : nav);
      const url = `/study/${slug ? slug : ''}`;
      if (window.location.pathname !== url) {
        window.history.pushState(null, '', url);
      }
    }
  };

  const openSubView = (type: 'ebooks' | 'bookmarks' | 'doubts' | 'ai-mentor' | 'my-courses' | 'purchases' | 'mentorship' | 'batch-tests') => {
    resetSubViews();
    setSearchQuery('');
    if (type === 'ebooks') setIsEbookLibraryOpen(true);
    else if (type === 'bookmarks') setIsBookmarksPageOpen(true);
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

  // After login: load the saved goal once; students who haven't picked one yet get the goal popup.
  // Returning students with a goal go straight in (they can change it from the top navigation).
  const goalLoadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (goalLoadedFor.current === session.uid) return;
    goalLoadedFor.current = session.uid;
    fetchGoal()
      .then((saved) => {
        if (goalLoadedFor.current !== session.uid) return; // signed out meanwhile
        setGoal(saved);
        if (!saved) setIsGoalModalOpen(true);
      })
      .catch((err) => console.error('Could not load the saved goal', err));
  }, [session.uid]);

  const getSearchPlaceholder = () => {
    if (activeNav === 'courses' || isMyCoursesOpen) return 'Search in Courses';
    if (activeNav === 'pi') return 'Search in Daily Drop';
    if (activeNav === 'test-series') return 'Search in All India Test Pass';
    if (isEbookLibraryOpen) return 'Search in E-Books';
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
      title: 'Bookmark',
      subject: 'Physics',
      second_text: 'Watch Later',
      countLabel: 'saved Items',
      tags: ['Rotational Motion', 'Wave Optics', 'Electrodynamics'],
      iconType: 'book',
      description: 'Comprehensive high-yield notes, derivation sheets, and Irodov problem breakdowns curated by IIT Top 100 rankers.',
      downloadSize: '48.2 MB',
      rating: 4.9,
    },
    {
      id: 'vault-chemistry',
      title: 'Your Class Material',
      subject: 'Chemistry',
      second_text: 'Recorded Lecture',
      countLabel: 'Lecture Notes',
      tags: ['Reaction Maps', 'Coordination Chem', 'Thermodynamics'],
      iconType: 'archive',
      description: 'Master organic synthesis pathways, NCERT line-by-line highlight maps, and inorganic memorization mnemonics.',
      downloadSize: '64.5 MB',
      rating: 4.8,
    },
    {
      id: 'vault-combat',
      title: 'Your Ebook',
      subject: 'Mock Tests',
      second_text: '',
      countLabel: 'LIVE NOW',
      tags: ['Full Syllabus', 'Real NTA Engine', 'AIR Predictor'],
      iconType: 'combat',
      isLive: true,
      statusText: 'LIVE NOW',
      description: 'Live 3-hour adaptive mock test mirroring actual JEE Advanced CBT interface with instant percentile and weak area diagnosis.',
      downloadSize: 'Online CBT',
      rating: 5.0,
    },
    {
      id: 'vault-math',
      title: 'Test Series',
      second_text: '',
      subject: 'Mock Tests',
      countLabel: 'Active Tests',
      tags: ['Full Syllabus', 'Part Tests', 'Real NTA Engine'],
      iconType: 'analytics',
      description: 'Live adaptive mock test mirror mimicking actual JEE and NEET CBT interfaces with instant rank analytics.',
      downloadSize: 'Online CBT',
      rating: 4.9,
    },
  ];

  const studyPlans = [
    {
      id: 'sp1',
      title: '1 to 1 MENTORSHIP',
      subtitle: '',
      icon: Users,
      action: () => openSubView('mentorship'),
    },
    {
      id: 'sp2',
      title: 'ASK YOUR DOUBT',
      subtitle: '',
      icon: HelpCircle,
      action: () => openSubView('doubts'),
    },
    {
      id: 'sp3',
      title: 'EduAI',
      subtitle: '',
      icon: Bot,
      action: () => openSubView('ai-mentor'),
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
              alt="EduRAIN Logo"
              className="h-9 sm:h-10 w-auto object-contain transition-transform hover:scale-105"
            />
            <div className="flex items-center text-lg sm:text-xl font-bold tracking-tight">
              <span className="text-emerald-600 font-bold">Edu</span>
              <span className="text-amber-400 font-black uppercase">RAIN</span>
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
                <div className="w-full h-full rounded-full bg-[#EAE3DE] flex items-center justify-center text-xs font-bold text-[#175A67]">
                  {initials}
                </div>
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#10B981] ring-2 ring-[#EAE3DE]" />
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
                  alt="EduRAIN Logo"
                  className="h-8 w-auto object-contain"
                />
                <div className="flex items-center text-lg font-bold tracking-tight">
                  <span className="text-emerald-600 font-bold">Edu</span>
                  <span className="text-amber-400 font-black uppercase">RAIN</span>
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

              {/* Batch Selector inside mobile drawer */}
              <div className="mt-2 relative">
                <button
                  onClick={() => setIsDrawerBatchOpen(!isDrawerBatchOpen)}
                  className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-white/70 border border-[#175A67]/20 text-xs font-semibold text-[#175A67]"
                >
                  <span>{selectedBatch}</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {isDrawerBatchOpen && (
                  <div className="mt-1 w-full rounded-xl bg-[#EAE3DE] border border-[#175A67]/30 shadow-lg p-1">
                    {batches.map((b) => (
                      <button
                        key={b}
                        onClick={() => {
                          setSelectedBatch(b);
                          setIsDrawerBatchOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold ${selectedBatch === b ? 'bg-[#175A67] text-white' : 'text-[#175A67] hover:bg-white/60'
                          }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                )}
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
                className={`w-full font-semibold rounded-xl px-3.5 py-2.5 flex items-center gap-3 text-sm transition-all ${activeNav === 'study-central' && !isAiMentorPageOpen && !isBookDoubtSessionOpen && !isBookmarksPageOpen && !isEbookLibraryOpen && !isMyCoursesOpen
                  ? 'bg-[#175A67] text-white shadow-sm'
                  : 'text-[#175A67] hover:bg-[#175A67]/10'
                  }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>Home</span>
              </button>

              <button
                onClick={() => {
                  navigateTo('pi');
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full font-semibold rounded-xl px-3.5 py-2.5 flex items-center gap-3 text-sm transition-all ${activeNav === 'pi'
                  ? 'bg-[#175A67] text-white shadow-sm'
                  : 'text-[#175A67] hover:bg-[#175A67]/10'
                  }`}
              >
                <Terminal className="w-4 h-4" />
                <span>Daily Drop</span>
              </button>

              <button
                onClick={() => {
                  navigateTo('courses');
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full font-semibold rounded-xl px-3.5 py-2.5 flex items-center gap-3 text-sm transition-all ${activeNav === 'courses' || isMyCoursesOpen
                  ? 'bg-[#175A67] text-white shadow-sm'
                  : 'text-[#175A67] hover:bg-[#175A67]/10'
                  }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>COURSES</span>
              </button>

              <button
                onClick={() => {
                  navigateTo('test-series');
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full font-semibold rounded-xl px-3.5 py-2.5 flex items-center justify-between text-sm transition-all ${activeNav === 'test-series'
                  ? 'bg-[#175A67] text-white shadow-sm'
                  : 'text-[#175A67] hover:bg-[#175A67]/10'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Award className="w-4 h-4" />
                  <span>ALL INDIA TEST PASS</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-800">Live</span>
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
                className={`w-full font-semibold rounded-xl px-4 py-3 flex items-center gap-3 text-sm transition-all ${activeNav === 'study-central' && !isAiMentorPageOpen && !isBookDoubtSessionOpen && !isBookmarksPageOpen && !isEbookLibraryOpen && !isMyCoursesOpen
                  ? 'bg-[#175A67] text-white shadow-md'
                  : 'text-[#175A67] hover:bg-[#175A67]/10'
                  }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>Home</span>
              </button>

              <button
                onClick={() => navigateTo('pi')}
                className={`w-full font-semibold rounded-xl px-4 py-3 flex items-center gap-3 text-sm transition-all ${activeNav === 'pi'
                  ? 'bg-[#175A67] text-white shadow-md'
                  : 'text-[#175A67] hover:bg-[#175A67]/10'
                  }`}
              >
                <Terminal className="w-4 h-4" />
                <span>Daily Drop</span>
              </button>

              <button
                onClick={() => navigateTo('courses')}
                className={`w-full font-semibold rounded-xl px-4 py-3 flex items-center gap-3 text-sm transition-all ${activeNav === 'courses' || isMyCoursesOpen
                  ? 'bg-[#175A67] text-white shadow-md'
                  : 'text-[#175A67] hover:bg-[#175A67]/10'
                  }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>COURSES</span>
              </button>

              <button
                onClick={() => navigateTo('test-series')}
                className={`w-full font-semibold rounded-xl px-4 py-3 flex items-center justify-between text-sm transition-all ${activeNav === 'test-series'
                  ? 'bg-[#175A67] text-white shadow-md'
                  : 'text-[#175A67] hover:bg-[#175A67]/10'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Award className="w-4 h-4" />
                  <span>ALL INDIA TEST PASS</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-800">Live</span>
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
          {isPurchasesPageOpen ? (
            <PurchasesView
              onBack={() => setIsPurchasesPageOpen(false)}
              selectedBatch={selectedBatch}

            />
          ) : isMentorshipOpen ? (
            <MentorshipHub
              studentEmail={session.email}
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
              onWatchVideo={(video) => console.log('Resuming video:', video.title)}
              onOpenPdfViewer={() => console.log('Opening saved PDF viewer…')}
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
          ) : isCourseTestsOpen ? (
            <CourseTestSeriesView
              onBack={() => setIsCourseTestsOpen(false)}
              selectedBatch={selectedBatch}
              searchQuery={searchQuery}
              onOpenUpgrade={() => setIsUpgradeOpen(true)}
              studentName={session?.name}
            />
          ) : isMyCoursesOpen ? (
            <PurchasesView
              initialView="enrolled"
              onBack={() => setIsMyCoursesOpen(false)}
              selectedBatch={selectedBatch}

            />
          ) : activeNav === 'profile' ? (
            <ProfileView onBack={() => navigateTo('study-central')} />
          ) : activeNav === 'library' ? (
            <LibraryView
              onBack={() => navigateTo('study-central')}
              searchQuery={searchQuery}
              onOpenUpgrade={() => setIsUpgradeOpen(true)}
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
              onExit={() => navigateTo('study-central')}
            />
          ) : activeNav === 'test-series' ? (
            <TestSeriesView
              onBack={() => navigateTo('study-central')}
              onOpenUpgrade={() => setIsUpgradeOpen(true)}
              onOpenCourseTests={() => setIsCourseTestsOpen(true)}
            />
          ) : (
            <>
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
                    • Current Batch: <span className="font-bold text-[#175A67]">{selectedBatch}</span>
                  </div>
                </div>

                {/* <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/60 border border-white/80 text-[11px] text-[#175A67] font-semibold self-start sm:self-auto backdrop-blur-md shadow-sm">
                  <Wifi className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>Wi-Fi Preview Active: 192.168.29.39:5173</span>
                </div> */}
              </div>

              {/* Study Plans Row */}
              <section className="mb-8 sm:mb-10">
                <div className="flex items-center gap-2.5 mb-4">
                  <Cpu className="w-5 h-5 text-[#175A67]" />
                  <h2 className="text-lg sm:text-xl font-bold text-[#175A67]">Features</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-4">
                  {filteredStudyPlans.map((plan) => {
                    const IconComponent = plan.icon;
                    return (
                      <div
                        key={plan.id}
                        onClick={plan.action}
                        className="group bg-white/50 hover:bg-white/70 backdrop-blur-xl border border-white/70 hover:border-white rounded-2xl p-5 sm:p-6 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] hover:shadow-[0_14px_44px_0_rgba(31,38,135,0.12)] transition-all duration-300 ease-out hover:-translate-y-1 cursor-pointer flex flex-col  min-h-[140px] sm:min-h-[120px] active:scale-[0.98]"
                      >
                        <div className="w-full flex items-start justify-between">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#1a5b65] text-white rounded-xl flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                            <IconComponent className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                          </div>
                          <ChevronRight className="w-5 h-5 text-[#175A67] group-hover:translate-x-1 transition-transform" />
                        </div>
                        <div>
                          <h3 className="font-bold text-[#175A67] text-[15px] mt-3 leading-tight tracking-tightt">
                            {plan.title}
                          </h3>
                          <p className="text-[#2A707C] text-[12px] mt-1 font-medium">{plan.subtitle}</p>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-4">
                  {filteredVaultItems.map((item) => {
                    const iconMap: Record<string, any> = {
                      book: BookOpen,
                      archive: Library,
                      combat: Swords,
                      analytics: Crosshair
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
                          } else if (item.id === 'vault-combat') {
                            openSubView('ebooks');
                          } else if (item.id === 'vault-math') {
                            openSubView('batch-tests');
                          } else {
                            resetSubViews();
                            setSelectedVaultItem(item);
                          }
                        }}
                        className="bg-white/60 hover:bg-white/85 backdrop-blur-md border border-white/80 rounded-2xl p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.05)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.09)] transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col items-center justify-between min-h-[190px] sm:min-h-[220px] active:scale-[0.98]"
                      >
                        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#175A67] text-white rounded-2xl flex items-center justify-center shadow-md mb-2 sm:mb-3">
                          <IconComp className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                        </div>
                        <div className="text-center">
                          <h3 className="font-bold text-[#175A67] text-center text-base sm:text-lg lg:text-[15px] lg:min-w-[200px] lg:leading-normal">{item.title}</h3>
                          <p className={`text-xs text-center mt-1 ${item.isLive ? 'text-[#10B981] font-bold' : 'text-[#2A707C]'
                            }`}>
                            {item.countLabel}
                          </p>
                          <p className={`text-xs text-center mt-1 ${item.isLive ? 'text-[#10B981] font-bold' : 'text-[#2A707C]'
                            }`}>
                            {item.second_text}
                          </p>
                        </div>
                        <span className="text-[#175A67] text-xs text-center block mt-2 sm:mt-3 font-semibold hover:underline">
                          Enter Library &gt;
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
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
        onMarkAllRead={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
      />

      <PurchasesModal
        isOpen={isPurchasesModalOpen}
        onClose={() => setIsPurchasesModalOpen(false)}
      />

      <CohortGoalModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        activeGoalId={goal?.id ?? null}
        onConfirm={async (category) => {
          // Save first; if it fails the popup stays open with the error
          const saved = await saveGoal(category);
          setGoal(saved);
          setSelectedBatch(category.name);
          navigateTo('courses');
        }}
      />

    </div>
  );
}

export default App;
