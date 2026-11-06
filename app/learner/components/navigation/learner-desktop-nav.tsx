import { LearnerSidebar } from '../learner-sidebar';

export function LearnerDesktopNav() {
  return (
    <div className="fixed left-0 top-0 z-40 hidden h-full lg:block">
      <LearnerSidebar />
    </div>
  );
}
