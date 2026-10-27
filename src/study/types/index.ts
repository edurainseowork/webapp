export interface Mission {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeType: 'emerald' | 'gold' | 'cyan' | 'purple';
  progress: number;
  icon: string;
  details?: string;
  actionText: string;
}

export interface VaultResource {
  second_text: string;
  id: string;
  title: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics' | 'Mock Tests' | 'Live Sessions';
  countLabel: string;
  tags: string[];
  iconType: 'book' | 'archive' | 'combat' | 'analytics' | 'live';
  isLive?: boolean;
  statusText?: string;
  description: string;
  downloadSize?: string;
  rating?: number;
  pdfUrl?: string;
}

export interface NotificationItem {
  id: string;
  rawId?: number;
  title: string;
  description: string;
  time: string;
  read: boolean;
  type: 'test' | 'doubt' | 'system' | 'streak';
  imageUrl?: string | null;
  link?: string | null;
}

export interface QuizQuestion {
  id: number;
  subject: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: 'JEE Main' | 'JEE Advanced' | 'Olympiad';
}

export interface UserProfile {
  name: string;
  grade: string;
  targetExam: string;
  airRank: number;
  xp: number;
  streakDays: number;
  dailyGoalPercent: number;
  avatarUrl?: string;
}
