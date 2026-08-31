import {
  BarChart3,
  Bookmark,
  BookOpen,
  CalendarDays,
  CircleGauge,
  ClipboardCheck,
  FlaskConical,
  GraduationCap,
  Home,
  Languages,
  Library,
  NotebookPen,
  Settings,
  Sigma,
  Sparkles,
  Target,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  mobile?: boolean;
  end?: boolean;
}

export const primaryNav: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: Home, mobile: true, end: true },
  { label: 'Today', path: '/today', icon: Sparkles },
  { label: 'Roadmap', path: '/roadmap', icon: CalendarDays },
  { label: 'Mathematics', path: '/mathematics', icon: Sigma },
  { label: 'Physics', path: '/physics', icon: FlaskConical },
  { label: 'Vocabulary', path: '/vocabulary', icon: Languages },
  { label: 'Practice', path: '/practice', icon: Target, mobile: true },
  { label: 'Mock exams', path: '/mock', icon: ClipboardCheck },
  { label: 'Mistakes', path: '/mistakes', icon: NotebookPen },
  { label: 'Formula trainer', path: '/formulas', icon: Library },
  { label: 'Progress', path: '/progress', icon: BarChart3, mobile: true },
  { label: 'Bookmarks', path: '/bookmarks', icon: Bookmark },
  { label: 'Settings', path: '/settings', icon: Settings },
];

export const mobileMore: NavItem = { label: 'More tools', path: '/more', icon: CircleGauge, mobile: true };
export const mobileLearn: NavItem = { label: 'Learn', path: '/learn', icon: BookOpen, mobile: true };
export const adminNav: NavItem = { label: 'Admin', path: '/admin', icon: GraduationCap };
