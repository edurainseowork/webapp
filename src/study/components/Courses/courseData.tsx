import {
  BookOpen,
  Clock3,
  FileText,
  FlaskConical,
  GraduationCap,
  Hexagon,
  Layers,
  Network,
  Sigma,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { useMemo } from 'react';
import { useCourses, type CmsCategory, type CmsContentItem, type CmsCourse, type CmsMentor } from '../../lib/courses';

/* ------------------------------------------------------------------ */
/*  View models                                                         */
/*                                                                      */
/*  All course data comes from the admin CMS (see lib/courses.ts).      */
/*  The adapters below shape it into what the course screens render,   */
/*  so the UI stays the same and only the data source changed.          */
/* ------------------------------------------------------------------ */

export type HeaderTone = 'deep' | 'teal' | 'brown';
export type StatusTone = 'live' | 'new' | 'flash';

export interface Batch {
  /** Course id as a string (used for navigation) */
  id: string;
  courseId: number;
  /** Uppercase name used on catalogue cards */
  name: string;
  /** Ribbon on the card header (category) */
  label: string;
  tone: HeaderTone;
  /** Category slug(s) used by the catalogue filters */
  categories: string[];
  chips: string[];
  status: { text: string; tone: StatusTone };
  features: { icon: LucideIcon; text: string }[];
  /** Rupees */
  price: number;
  /** Rupees (equals price when the CMS has no original price) */
  mrp: number;
  offerText: string;
  thumbnail: string | null;
  mentors: CmsMentor[];

  // Detail page
  title: string;
  description: string;
  breadcrumb: string;
  category: string;
  duration: string | null;
  totalLessons: number | null;
  studentsEnrolled: number | null;
}

export interface EnrolledCourse {
  id: string;
  /** Course the card opens */
  batchId: string;
  batchLabel: string;
  title: string;
  progress: number;
  completedLectures: number;
  totalLectures: number;
  currentTopic: string;
}

export interface Lecture {
  id: string;
  code: string;
  title: string;
  meta: string;
  type: CmsContentItem['type'];
  url: string | null;
}

export interface Chapter {
  id: string;
  num: number;
  title: string;
  summary?: string;
  lectures: Lecture[];
}

export interface Subject {
  id: string;
  name: string;
  icon: LucideIcon;
  badge: string;
  stats: string;
  moduleTitle: string;
  chapters: Chapter[];
}

export interface CatalogFilter {
  id: string;
  label: string;
}

/* ------------------------------------------------------------------ */
/*  Course → card                                                       */
/* ------------------------------------------------------------------ */

const TONES: HeaderTone[] = ['deep', 'teal', 'brown'];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const paiseToRupees = (paise: number | null | undefined) => Math.round((paise ?? 0) / 100);

export function toBatch(course: CmsCourse, index: number): Batch {
  const price = paiseToRupees(course.price);
  const mrp = Math.max(price, paiseToRupees(course.originalPrice ?? course.price));
  const off = mrp > 0 ? Math.round((1 - price / mrp) * 100) : 0;
  const category = course.category?.trim() || 'Course';
  const mentors = (course.mentors ?? []).filter((m) => m?.name);

  const features: Batch['features'] = [];
  if (mentors.length) features.push({ icon: GraduationCap, text: `By ${mentors.map((m) => m.name).join(', ')}` });
  if (course.duration) features.push({ icon: Clock3, text: course.duration });
  if (course.totalLessons) features.push({ icon: Video, text: plural(course.totalLessons, 'lesson') });
  if (course.studentsEnrolled) features.push({ icon: Users, text: `${course.studentsEnrolled.toLocaleString('en-IN')}+ students enrolled` });
  if (!features.length) features.push({ icon: BookOpen, text: 'Full course access after enrolment' });

  const chips = [category, course.duration, course.totalLessons ? plural(course.totalLessons, 'lesson') : null].filter(
    (chip): chip is string => !!chip
  );

  return {
    id: String(course.id),
    courseId: course.id,
    name: course.title.toUpperCase(),
    label: category.toUpperCase(),
    tone: TONES[index % TONES.length],
    categories: [course.categorySlug || category.toLowerCase()],
    chips,
    status:
      price === 0
        ? { text: 'Free Course', tone: 'new' }
        : off > 0
        ? { text: `${off}% OFF • Enrolments open`, tone: 'flash' }
        : { text: 'Enrolments open', tone: 'live' },
    features,
    price,
    mrp,
    offerText: price === 0 ? 'FREE' : off > 0 ? `${off}% OFF • Save ₹${(mrp - price).toLocaleString('en-IN')}` : '',
    thumbnail: course.thumbnail || null,
    mentors,
    title: course.title,
    description: course.description ?? '',
    breadcrumb: category,
    category,
    duration: course.duration,
    totalLessons: course.totalLessons,
    studentsEnrolled: course.studentsEnrolled,
  };
}

/** Category filter chips: CMS categories that have at least one course, in CMS order. */
export function catalogFilters(batches: Batch[], categories: CmsCategory[]): CatalogFilter[] {
  const used = new Map<string, string>();
  batches.forEach((b) => b.categories.forEach((slug) => used.set(slug, b.category)));
  const ordered = [...categories]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .filter((c) => used.has(c.slug))
    .map((c) => ({ id: c.slug, label: c.name }));
  // Courses whose category isn't in /api/categories still get a chip
  used.forEach((label, slug) => {
    if (!ordered.some((f) => f.id === slug)) ordered.push({ id: slug, label });
  });
  return [{ id: 'all', label: 'All Courses' }, ...ordered];
}

export function toEnrolledCourse(batch: Batch): EnrolledCourse {
  return {
    id: `enrolled-${batch.id}`,
    batchId: batch.id,
    batchLabel: batch.category,
    title: batch.title,
    progress: 0,
    completedLectures: 0,
    totalLectures: batch.totalLessons ?? 0,
    currentTopic: batch.duration ? `${batch.duration} course • open to start learning` : 'Open the course to start learning',
  };
}

/* ------------------------------------------------------------------ */
/*  Content tree → subjects / chapters / lectures                       */
/*                                                                      */
/*  Top-level folders = subjects, their sub-folders = chapters, and the */
/*  videos / PDFs / notes / quizzes inside = lectures. Loose files get  */
/*  a "Lessons" chapter (or a "Course Material" subject at the top).    */
/* ------------------------------------------------------------------ */

const SUBJECT_ICONS: LucideIcon[] = [Sigma, FlaskConical, Hexagon, Network, Layers, BookOpen];

const TYPE_LABEL: Record<CmsContentItem['type'], string> = {
  folder: 'Folder',
  video: 'Video',
  pdf: 'PDF',
  note: 'Notes',
  quiz: 'Quiz',
};

export const lectureIcon = (type: CmsContentItem['type']): LucideIcon => (type === 'video' ? Video : FileText);

export function buildSyllabus(items: CmsContentItem[]): Subject[] {
  const byParent = new Map<string | null, CmsContentItem[]>();
  items.forEach((item) => {
    const key = item.parentId ?? null;
    byParent.set(key, [...(byParent.get(key) ?? []), item]);
  });
  byParent.forEach((list) => list.sort((a, b) => a.order - b.order));
  const children = (id: string | null) => byParent.get(id) ?? [];

  // Every file below a folder, depth-first, in CMS order
  const filesUnder = (id: string): CmsContentItem[] =>
    children(id).flatMap((item) => (item.type === 'folder' ? filesUnder(item.id) : [item]));

  const toLectures = (files: CmsContentItem[]): Lecture[] =>
    files.map((file, i) => ({
      id: file.id,
      code: `L${String(i + 1).padStart(2, '0')}`,
      title: file.title,
      meta: [TYPE_LABEL[file.type] ?? 'File', file.fileSize].filter(Boolean).join(' • '),
      type: file.type,
      url: file.mediaUrl,
    }));

  const toSubject = (id: string, name: string, chapters: Chapter[], index: number): Subject => {
    const lessons = chapters.reduce((sum, c) => sum + c.lectures.length, 0);
    return {
      id,
      name,
      icon: SUBJECT_ICONS[index % SUBJECT_ICONS.length],
      badge: plural(chapters.length, 'Chapter'),
      stats: plural(lessons, 'Lesson'),
      moduleTitle: name,
      chapters,
    };
  };

  const roots = children(null);
  const subjects: Subject[] = roots
    .filter((r) => r.type === 'folder')
    .map((folder, index) => {
      const kids = children(folder.id);
      const chapters: Chapter[] = kids
        .filter((k) => k.type === 'folder')
        .map((chapter, i) => {
          const lectures = toLectures(filesUnder(chapter.id));
          return { id: chapter.id, num: i + 1, title: chapter.title, summary: plural(lectures.length, 'lesson'), lectures };
        });
      const loose = kids.filter((k) => k.type !== 'folder');
      if (loose.length) {
        chapters.push({
          id: `${folder.id}-lessons`,
          num: chapters.length + 1,
          title: 'Lessons',
          summary: plural(loose.length, 'lesson'),
          lectures: toLectures(loose),
        });
      }
      return toSubject(folder.id, folder.title, chapters, index);
    });

  const looseRoot = roots.filter((r) => r.type !== 'folder');
  if (looseRoot.length) {
    subjects.push(
      toSubject(
        'course-material',
        'Course Material',
        [{ id: 'course-material-lessons', num: 1, title: 'Lessons', summary: plural(looseRoot.length, 'lesson'), lectures: toLectures(looseRoot) }],
        subjects.length
      )
    );
  }
  return subjects;
}

/* ------------------------------------------------------------------ */
/*  Hook used by every course screen                                    */
/* ------------------------------------------------------------------ */

/** Live CMS courses shaped for the course screens, plus what the student owns. */
export function useCatalog() {
  const { status, error, courses, categories, ownedIds, reload } = useCourses();

  return useMemo(() => {
    const batches = courses.map(toBatch);
    const owned = new Set(ownedIds.map(String));
    const byId = new Map(batches.map((b) => [b.id, b]));
    return {
      status,
      error,
      reload,
      batches,
      filters: catalogFilters(batches, categories),
      ownedBatches: batches.filter((b) => owned.has(b.id)),
      getBatch: (id: string) => byId.get(id) ?? null,
      isOwned: (id: string) => owned.has(id),
    };
  }, [status, error, courses, categories, ownedIds, reload]);
}