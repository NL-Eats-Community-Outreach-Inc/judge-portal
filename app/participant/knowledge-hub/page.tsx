import { Card } from '@/components/ui/card';
import { BookOpenText, ListChecks, GraduationCap } from 'lucide-react';

export default function KnowledgeHubPage() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="space-y-4 md:space-y-6">
        {/* Welcome section */}
        <div className="text-center space-y-3 md:space-y-4">
          <div className="w-20 h-20 md:w-24 md:h-24 mx-auto bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center">
            <GraduationCap className="h-10 w-10 md:h-12 md:w-12 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Welcome to the Knowledge Hub
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl md:max-w-2xl mx-auto px-2 md:px-0">
            The Knowledge Hub is currently under construction.
            As such, this is just a placeholder page while we work.
            Stay tuned for exciting features!
          </p>
        </div>

        {/* Coming soon features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          <Card className="p-4 md:p-6 text-center">
            <BookOpenText className="h-6 w-6 md:h-8 md:w-8 mx-auto mb-2 md:mb-3 text-primary" />
            <h3 className="font-semibold text-foreground text-sm md:text-base">
              LearnWorlds Integration
            </h3>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              Browse custom hand-crafted courses
            </p>
          </Card>

          <Card className="p-4 md:p-6 text-center">
            <ListChecks className="h-6 w-6 md:h-8 md:w-8 mx-auto mb-2 md:mb-3 text-primary" />
            <h3 className="font-semibold text-foreground text-sm md:text-base">View Results</h3>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              Track your progress
            </p>
          </Card>
        </div>

        {/* Info card */}
        <Card className="p-4 md:p-6 bg-muted/30">
          <h2 className="text-lg md:text-xl font-semibold text-foreground mb-3 md:mb-4">
            Stay tuned!
          </h2>
          <div className="space-y-2.5 md:space-y-3">
            <div className="flex items-center gap-2.5 md:gap-3">
              <p className="text-muted-foreground text-sm md:text-base">
                Browse available courses and material to build your knowledge and assist you in your endeavours
              </p>
            </div>
          </div>
        </Card>

        {/* CTA */}
        <div className="text-center">
          <p className="text-muted-foreground text-sm md:text-base px-4 md:px-0">
            We&apos;re working hard to bring these features to you. Thank you for your patience!
          </p>
        </div>
      </div>
    </div>
  );
}
