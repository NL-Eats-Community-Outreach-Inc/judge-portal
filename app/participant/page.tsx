import { Card } from '@/components/ui/card';
import { Users, Calendar, Trophy, Rocket } from 'lucide-react';

export default function ParticipantPage() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="space-y-4 md:space-y-6">
        {/* Welcome section */}
        <div className="text-center space-y-3 md:space-y-4">
          <div className="w-20 h-20 md:w-24 md:h-24 mx-auto bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center">
            <Rocket className="h-10 w-10 md:h-12 md:w-12 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Welcome to Participant Portal
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl md:max-w-2xl mx-auto px-2 md:px-0">
            Your event participation dashboard is coming soon. Stay tuned for exciting features!
          </p>
        </div>

        {/* Coming soon features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          <Card className="p-4 md:p-6 text-center">
            <Calendar className="h-6 w-6 md:h-8 md:w-8 mx-auto mb-2 md:mb-3 text-primary" />
            <h3 className="font-semibold text-foreground text-sm md:text-base">Event Registration</h3>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              Browse and register for upcoming events
            </p>
          </Card>

          <Card className="p-4 md:p-6 text-center">
            <Users className="h-6 w-6 md:h-8 md:w-8 mx-auto mb-2 md:mb-3 text-primary" />
            <h3 className="font-semibold text-foreground text-sm md:text-base">Team Management</h3>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              Create and manage your team
            </p>
          </Card>

          <Card className="p-4 md:p-6 text-center">
            <Trophy className="h-6 w-6 md:h-8 md:w-8 mx-auto mb-2 md:mb-3 text-primary" />
            <h3 className="font-semibold text-foreground text-sm md:text-base">View Results</h3>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              Track your team&apos;s performance
            </p>
          </Card>
        </div>

        {/* Info card */}
        <Card className="p-4 md:p-6 bg-muted/30">
          <h2 className="text-lg md:text-xl font-semibold text-foreground mb-3 md:mb-4">
            What&apos;s Coming Next?
          </h2>
          <div className="space-y-2.5 md:space-y-3">
            <div className="flex items-center gap-2.5 md:gap-3">
              <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center shrink-0">
                1
              </div>
              <p className="text-muted-foreground text-sm md:text-base">
                Browse available events and competitions
              </p>
            </div>
            <div className="flex items-center gap-2.5 md:gap-3">
              <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center shrink-0">
                2
              </div>
              <p className="text-muted-foreground text-sm md:text-base">
                Create or join teams for events
              </p>
            </div>
            <div className="flex items-center gap-2.5 md:gap-3">
              <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center shrink-0">
                3
              </div>
              <p className="text-muted-foreground text-sm md:text-base">
                Submit your project details and materials
              </p>
            </div>
            <div className="flex items-center gap-2.5 md:gap-3">
              <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center shrink-0">
                4
              </div>
              <p className="text-muted-foreground text-sm md:text-base">
                View real-time judging progress and results
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
