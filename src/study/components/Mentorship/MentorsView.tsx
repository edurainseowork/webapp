import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  X,
  GraduationCap,
  LayoutGrid,
  Rows3,
  BadgeCheck,
  Heart,
  CalendarDays,
  SearchX,
  AlertTriangle,
  RefreshCw,
  Target,
  Users,
} from 'lucide-react';
import { availabilityOf, courseLineOf, descriptionOf, errorText, fetchMentors, initialsOf, setFavorite, type Mentor, type MentorList } from './mentorData';
import { SubPageHeader } from '../SubPageHeader';

type ViewMode = 'list' | 'grid';

/* ------------------------------------------------------------------ */
/*  Small pieces                                                        */
/* ------------------------------------------------------------------ */

export function MentorAvatar({ mentor, size = 'md' }: { mentor: Pick<Mentor, 'name' | 'photo' | 'openSlots'>; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'w-16 h-16 text-lg' : 'w-14 h-14 text-base';
  const [broken, setBroken] = useState(false);
  return (
    <div className="relative shrink-0">
      {mentor.photo && !broken ? (
        <img src={mentor.photo} alt="" onError={() => setBroken(true)} className={`${box} rounded-xl object-cover shadow-md bg-[#EEF6F3]`} />
      ) : (
        <div className={`${box} rounded-xl bg-gradient-to-br from-[#0F3B42] to-[#0A262C] text-white font-bold flex items-center justify-center shadow-md`}>
          {initialsOf(mentor.name)}
        </div>
      )}
      {mentor.openSlots > 0 && (
        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-white" title="Has open slots" />
      )}
    </div>
  );
}

function AvailabilityPill({ mentor }: { mentor: Mentor }) {
  const meta = availabilityOf(mentor);
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${meta.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function SkeletonCard({ grid }: { grid: boolean }) {
  return (
    <div className={`bg-white rounded-2xl p-5 sm:p-6 shadow-[0_6px_24px_rgb(0,0,0,0.04)] flex gap-4 animate-pulse ${grid ? 'flex-col' : 'items-center'}`}>
      <div className="flex items-start gap-4 flex-1">
        <div className="w-14 h-14 rounded-xl bg-[#EEF6F3]" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3.5 w-1/2 rounded bg-slate-200" />
          <div className="h-2.5 w-2/3 rounded bg-slate-100" />
          <div className="h-4 w-24 rounded-full bg-slate-100" />
        </div>
      </div>
      <div className="h-8 w-24 rounded-lg bg-slate-200 shrink-0" />
    </div>
  );
}

function StateCard({ icon: Icon, title, text, action }: { icon: typeof SearchX; title: string; text: string; action?: { label: string; onClick: () => void; icon?: typeof RefreshCw } }) {
  return (
    <div className="bg-white rounded-2xl py-14 px-6 flex flex-col items-center text-center">
      <Icon className="w-6 h-6 text-slate-400 mb-2" />
      <p className="font-semibold">{title}</p>
      <p className="text-xs text-slate-500 mt-1 max-w-sm">{text}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 flex items-center gap-1.5 bg-[#0F3B42] hover:bg-[#0b2c31] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          {action.icon && <action.icon className="w-3.5 h-3.5" />}
          {action.label}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main view                                                           */
/* ------------------------------------------------------------------ */

interface MentorsViewProps {
  /** Student's goal (CMS category); mentors come from that goal's courses */
  goalId: number | null;
  goalName: string | null;
  onChangeGoal: () => void;
  onBack: () => void;
  onOpenMentor: (mentor: Mentor) => void;
  /** Bumped by the parent after a booking so availability is re-read */
  refreshKey?: number;
}

export function MentorsView({ goalId, goalName, onChangeGoal, onBack, onOpenMentor, refreshKey = 0 }: MentorsViewProps) {
  const [data, setData] = useState<MentorList | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [favoriteBusy, setFavoriteBusy] = useState<string | null>(null);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);

  // A new goal starts from all of its courses
  useEffect(() => setCourseId(null), [goalId]);

  const load = useCallback(
    async (background = false) => {
      const id = ++requestId.current;
      if (!background) setStatus('loading');
      try {
        const res = await fetchMentors({ categoryId: goalId, courseId });
        if (id !== requestId.current) return; // a newer request is on its way
        setData(res);
        setStatus('ready');
        setError(null);
      } catch (err) {
        if (id !== requestId.current) return;
        setError(errorText(err, 'Could not load mentors.'));
        setStatus(background && data ? 'ready' : 'error');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [goalId, courseId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Coming back from a booking: refresh availability quietly
  useEffect(() => {
    if (refreshKey) void load(true);
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ctrl/Cmd + K focuses the mentor search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const mentors = data?.mentors ?? [];
  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      mentors.filter(
        (m) =>
          !q ||
          [m.name, m.institute, m.achievement, m.headline, ...m.courses.map((c) => c.title)].some((v) => v?.toLowerCase().includes(q)),
      ),
    [mentors, q],
  );
  const shownGoal = data?.goal?.name ?? goalName;

  const toggleFavorite = async (mentor: Mentor) => {
    if (favoriteBusy) return;
    const next = !mentor.isFavorite;
    const apply = (value: boolean) =>
      setData((d) => (d ? { ...d, mentors: d.mentors.map((m) => (m.id === mentor.id ? { ...m, isFavorite: value } : m)) } : d));
    apply(next); // show it straight away; undone if the server says no
    setFavoriteBusy(mentor.id);
    setFavoriteError(null);
    try {
      apply(await setFavorite(mentor.id, next));
    } catch (err) {
      apply(!next);
      setFavoriteError(errorText(err, 'Could not update favourites.'));
    } finally {
      setFavoriteBusy(null);
    }
  };

  const resetFilters = () => {
    setCourseId(null);
    setQuery('');
  };

  return (
    <div className="relative w-full rounded-[24px] overflow-hidden flex flex-col bg-[#DCEAE3] font-sans text-[#0B1C30] min-h-[calc(100vh-6rem)] shadow-sm">
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 pb-20">
        <SubPageHeader
          onBack={onBack}
          crumbs={[
            { label: 'Home', onClick: onBack },
            { label: 'Features', onClick: onBack },
            { label: '1 to 1 Mentorship' },
          ]}
          rightElement={
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#2A707C]" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search mentor, course or college..."
                  className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-white/90 text-xs text-[#0B1C30] placeholder-[#70787C] border border-white/80 focus:outline-none focus:ring-2 focus:ring-[#175A67]/20 shadow-sm"
                />
                {query && (
                  <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0B1C30]">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          }
        />

        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-black text-[#0B1C30] tracking-tight">1-on-1 Mentorship Sessions</h1>
          <p className="text-xs sm:text-sm text-[#2A707C] font-medium mt-1">
            {shownGoal ? (
              <>
                Book live personalized guidance with the mentors of your <span className="font-bold">{shownGoal}</span> courses.{' '}
                <button onClick={onChangeGoal} className="underline underline-offset-2 hover:text-[#0F3B42]">
                  Change goal
                </button>
              </>
            ) : (
              'Book live personalized guidance with the mentors of your courses.'
            )}
          </p>
        </div>

        {/* Filter bar */}
        <div className="bg-white rounded-2xl px-3 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_6px_24px_rgb(0,0,0,0.04)] mb-6">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#0F3B42] text-white shadow-sm">
              <GraduationCap className="w-3.5 h-3.5" />
              Course Mentor
            </span>
            {(data?.courses.length ?? 0) > 1 && (
              <select
                value={courseId ?? ''}
                onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : null)}
                aria-label="Filter by course"
                className="min-w-0 max-w-[220px] sm:max-w-xs truncate px-3 py-2 rounded-lg text-xs font-semibold bg-[#EEF6F3] text-[#0B1C30] hover:bg-[#E2EFEA] border-none focus:outline-none focus:ring-2 focus:ring-[#175A67]/20 cursor-pointer"
              >
                <option value="">All courses</option>
                {data!.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.mentorCount})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
            <span className="text-xs text-[#175A67]">
              {status === 'loading' ? (
                'Loading mentors…'
              ) : (
                <>
                  Showing <span className="font-bold text-[#0B1C30] text-sm">{visible.length}</span> of {data?.total ?? 0} mentors
                </>
              )}
            </span>
            <div className="flex items-center bg-[#F4EDE7] rounded-lg p-0.5">
              {(
                [
                  { id: 'grid', icon: LayoutGrid, title: 'Grid view' },
                  { id: 'list', icon: Rows3, title: 'List view' },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setViewMode(mode.id)}
                  title={mode.title}
                  aria-pressed={viewMode === mode.id}
                  className={`p-1.5 rounded-md transition-all ${viewMode === mode.id ? 'bg-white text-[#0B1C30] shadow-sm' : 'text-slate-500 hover:text-[#0B1C30]'}`}
                >
                  <mode.icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {favoriteError && (
          <p role="alert" className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-red-600">
            <AlertTriangle className="w-3.5 h-3.5" />
            {favoriteError}
          </p>
        )}

        {/* Mentors */}
        {status === 'loading' ? (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'} aria-busy="true" aria-label="Loading mentors">
            {Array.from({ length: 3 }, (_, i) => (
              <SkeletonCard key={i} grid={viewMode === 'grid'} />
            ))}
          </div>
        ) : status === 'error' ? (
          <StateCard icon={AlertTriangle} title="Couldn't load mentors" text={error ?? 'Please check your connection and try again.'} action={{ label: 'Try again', onClick: () => void load(), icon: RefreshCw }} />
        ) : !goalId && !data?.goal ? (
          <StateCard icon={Target} title="Set your goal to see your mentors" text="Mentors are matched to the courses of your goal (JEE, NEET…)." action={{ label: 'Select your goal', onClick: onChangeGoal }} />
        ) : (data?.total ?? 0) === 0 ? (
          <StateCard
            icon={Users}
            title={`No mentors for ${shownGoal ?? 'your goal'} yet`}
            text="Mentors appear here once they are added to the courses of your goal. Please check back soon."
            action={{ label: 'Change goal', onClick: onChangeGoal }}
          />
        ) : visible.length === 0 ? (
          <StateCard
            icon={SearchX}
            title={q ? 'No mentors match your search' : 'No mentors for this course'}
            text="Try a mentor name, a course or a college."
            action={{ label: 'Show all mentors', onClick: resetFilters }}
          />
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
            {visible.map((mentor) => {
              const courseLine = courseLineOf(mentor);
              const description = descriptionOf(mentor);
              return (
                <article
                  key={mentor.id}
                  onClick={() => onOpenMentor(mentor)}
                  className={`bg-white rounded-2xl p-5 sm:p-6 shadow-[0_6px_24px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_32px_rgb(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer flex gap-4 ${
                    viewMode === 'grid' ? 'flex-col' : 'items-center'
                  }`}
                >
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <MentorAvatar mentor={mentor} />
                    <div className="min-w-0 flex-1">
                      <h3 className="flex items-center gap-1.5 font-semibold text-[15px]">
                        <span className="truncate">{mentor.name}</span>
                        {mentor.verified && <BadgeCheck className="w-4 h-4 text-white fill-[#175A67] shrink-0" aria-label="Verified mentor" />}
                      </h3>
                      {courseLine && (
                        <p className="text-[11px] text-slate-600 mt-0.5 truncate" title={courseLine}>
                          • {courseLine}
                        </p>
                      )}
                      {description && (
                        <p className="text-[11px] text-[#2A707C] mt-0.5 line-clamp-2 break-words" title={description}>
                          {description}
                        </p>
                      )}
                      <div className="mt-2">
                        <AvailabilityPill mentor={mentor} />
                      </div>
                    </div>
                  </div>

                  <div className={`flex shrink-0 ${viewMode === 'grid' ? 'items-center justify-between' : 'flex-col items-end justify-between gap-5 self-stretch'}`}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleFavorite(mentor);
                      }}
                      disabled={favoriteBusy === mentor.id}
                      title={mentor.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
                      aria-pressed={mentor.isFavorite}
                      className="p-1 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-60"
                    >
                      {/* <Heart className={`w-5 h-5 transition-colors ${mentor.isFavorite ? 'text-red-600 fill-red-600' : 'text-[#0B1C30]'}`} /> */}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenMentor(mentor);
                      }}
                      className="flex items-center gap-1.5 bg-[#0F3B42] hover:bg-[#0b2c31] text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-all active:scale-95"
                    >
                      <CalendarDays className="w-3.5 h-3.5" />
                      Book 1:1
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default MentorsView;