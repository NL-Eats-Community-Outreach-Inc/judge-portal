import { RecommendationWidget } from '@/components/rec-widget';

/**
 * Mentor page
 */
export default function MentorPage() {
  return (
    <main className="min-h-screen bg-background pb-20">
      <div className="container mx-auto px-4 py-12">
        <section className="rounded-xl border bg-card/50 p-4 md:p-8">
          <RecommendationWidget />
        </section>
      </div>
    </main>
  );
}
