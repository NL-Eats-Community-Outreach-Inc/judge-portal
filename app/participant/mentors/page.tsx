import { MentorGrid } from "@/components/mentor-widget";

/**
 * Mentor page
 */
export default function MentorPage() {
  return (
    <main className="min-h-screen bg-background pb-20">
      <div className="container mx-auto px-4 py-12">
        
        {/* Page header */}
        <section className="mb-10 space-y-2">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Find a Mentor
          </h1>
          <p className="text-muted-foreground text-lg">
            Browse our network of industry experts.<br></br>Book a 1:1 session directly via Calendly.
          </p>
        </section>

        {/* Grid component */}
        <section className="rounded-xl border bg-card/50 p-4 md:p-8">
          <MentorGrid />
        </section>
        
      </div>
    </main>
  );
}
