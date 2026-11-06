import { BookOpen, LayoutDashboard } from 'lucide-react';

export const learnerNavItems = [
  {
    label: 'Dashboard',
    mobileLabel: 'Home',
    href: '/learner',
    icon: LayoutDashboard,
    active: (path: string) => path === '/learner',
  },
  {
    label: 'My Learning',
    mobileLabel: 'Learning',
    href: '/learner/courses',
    icon: BookOpen,
    active: (path: string) =>
      path === '/learner/courses' ||
      path.startsWith('/learner/courses/') ||
      path.startsWith('/learner/lessons/'),
  },
];
