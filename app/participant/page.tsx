import { ParticipantHeader } from './components/participant-header';
import { ParticipantTabs } from './components/participant-tabs';
import { ParticipantEventProvider } from './contexts/participant-event-context';

export default function ParticipantPage() {
  return (
    <ParticipantEventProvider>
      <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-50/30 via-background to-slate-50/20 dark:from-gray-950/50 dark:via-background dark:to-gray-900/20">
        <div className="sticky top-0 z-50">
          <ParticipantHeader />
        </div>
        <main className="flex-1 container mx-auto px-4 md:px-6 py-6">
          <ParticipantTabs />
        </main>
      </div>
    </ParticipantEventProvider>
  );
}
