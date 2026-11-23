import { ClassroomSidebar } from '../classroom-sidebar';
import type { ClassroomRole } from '../classroom-layout-client';

export function ClassroomDesktopNav({ role }: { role: ClassroomRole }) {
  return (
    <div className="fixed left-0 top-0 z-40 hidden h-full lg:block">
      <ClassroomSidebar role={role} />
    </div>
  );
}
