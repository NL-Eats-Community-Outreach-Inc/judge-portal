import { BookOpen, LayoutDashboard } from 'lucide-react';
import type { ClassroomRole } from '../classroom-layout-client';

export interface ClassroomNavItem {
  label: string;
  mobileLabel: string;
  href: string;
  icon: typeof LayoutDashboard;
  active: (path: string) => boolean;
}

/** Navigation destinations shared by the learner and teacher portals. */
export function getClassroomNavItems(role: ClassroomRole): ClassroomNavItem[] {
  const basePath = `/classroom/${role}`;

  if (role === 'teacher') {
    // The teacher dashboard is also the course list; individual courses
    // are managed beneath /classroom/teacher/courses/[courseSlug].
    return [
      {
        label: 'Your Courses',
        mobileLabel: 'Courses',
        href: basePath,
        icon: BookOpen,
        active: (path) => path === basePath || path.startsWith(`${basePath}/courses/`),
      },
    ];
  }

  return [
    {
      label: 'Dashboard',
      mobileLabel: 'Home',
      href: basePath,
      icon: LayoutDashboard,
      active: (path) => path === basePath,
    },
    {
      label: 'My Learning',
      mobileLabel: 'Learning',
      href: `${basePath}/courses`,
      icon: BookOpen,
      active: (path) => path === `${basePath}/courses` || path.startsWith(`${basePath}/courses/`),
    },
  ];
}
