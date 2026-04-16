'use client';

import { Card } from '@/components/ui/card';
import { Target, Sparkles, Users, Clock, Rocket, ChevronRight, Search, X } from 'lucide-react';
import { useParticipant } from './contexts/participant-context';
import { EventCard, getEventTags } from './components/event-card';
import { TeamCard } from './components/team-card';
import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

function SkeletonCard() {
  return (
    <Card className="overflow-hidden">
      <div className="p-5 md:p-6 animate-pulse">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="h-5 w-16 bg-muted rounded mb-2" />
            <div className="h-6 w-48 bg-muted rounded mb-1" />
            <div className="h-4 w-32 bg-muted rounded" />
          </div>
          <div className="w-12 h-12 bg-muted rounded-xl" />
        </div>
        <div className="h-4 w-full bg-muted rounded mb-2" />
        <div className="h-4 w-2/3 bg-muted rounded mb-4" />
        <div className="flex gap-2 mb-4">
          <div className="h-5 w-16 bg-muted rounded-full" />
          <div className="h-5 w-20 bg-muted rounded-full" />
        </div>
        <div className="pt-4 border-t border-border/50 flex justify-between">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-8 w-20 bg-muted rounded" />
        </div>
      </div>
    </Card>
  );
}

function SkeletonTeamCard() {
  return (
    <Card className="min-w-[280px] md:min-w-[320px] snap-start border-l-4 border-l-muted">
      <div className="p-4 sm:p-5 animate-pulse">
        <div className="h-5 w-32 bg-muted rounded mb-2" />
        <div className="h-4 w-24 bg-muted rounded mb-3" />
        <div className="h-4 w-20 bg-muted rounded mb-3" />
        <div className="h-9 w-full bg-muted rounded-lg" />
      </div>
    </Card>
  );
}

export default function ParticipantPage() {
  const { events, myTeams, isLoading, registerForEvent, getTeamForEvent } = useParticipant();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const availableCategories = useMemo(() => {
    const allTags = new Set<string>();
    // Pre-populate core categories
    allTags.add('Global');
    allTags.add('Local');

    events.forEach((event) => {
      const tags = getEventTags(event);
      tags.forEach((tag) => allTags.add(tag));
    });
    return ['All', ...Array.from(allTags)];
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const tags = getEventTags(event);

      const matchesSearch =
        event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (event.description?.toLowerCase() || '').includes(searchQuery.toLowerCase());

      const matchesCategory = selectedCategory === 'All' || tags.includes(selectedCategory);

      return matchesSearch && matchesCategory;
    });
  }, [events, searchQuery, selectedCategory]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All');
  };

  return (
    <div className="min-h-full">
      {/* Hero section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-teal-500/5 via-emerald-500/5 to-cyan-500/5 border-b border-border/50">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-500/3 via-transparent to-transparent" />
        <div className="relative px-4 py-6 sm:py-8 md:px-6 md:py-10 max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/25">
              <Target className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
                Innovation Hub
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Explore events & build with your team
              </p>
            </div>
          </div>

          {/* Quick stats */}
          {!isLoading && (
            <div className="flex flex-wrap gap-3 mt-5">
              <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white/60 dark:bg-white/5 border border-border/50 backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500" />
                <span className="text-xs sm:text-sm font-medium">
                  {events.length} Event{events.length !== 1 ? 's' : ''} Available
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white/60 dark:bg-white/5 border border-border/50 backdrop-blur-sm">
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-teal-500" />
                <span className="text-xs sm:text-sm font-medium">
                  {myTeams.length} Team{myTeams.length !== 1 ? 's' : ''} Joined
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="px-4 py-5 sm:py-6 md:px-6 md:py-8 max-w-5xl mx-auto space-y-8">
        {/* My Teams section */}
        {isLoading ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="h-6 w-28 bg-muted rounded animate-pulse" />
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
              <SkeletonTeamCard />
              <SkeletonTeamCard />
            </div>
          </div>
        ) : (
          myTeams.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Rocket className="h-5 w-5 text-teal-500" />
                  <h2 className="text-lg sm:text-xl font-semibold text-foreground">My Teams</h2>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {myTeams.length}
                  </span>
                </div>
              </div>
              <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-3 snap-x snap-mandatory -mx-1 px-1">
                {myTeams.map((team) => (
                  <TeamCard key={team.id} team={team} />
                ))}
              </div>
            </div>
          )
        )}

        {/* Events section */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg sm:text-xl font-semibold text-foreground">
                Open & Active Events
              </h2>
              {!isLoading && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {filteredEvents.length}
                </span>
              )}
            </div>

            {/* Search Input Area */}
            {!isLoading && events.length > 0 && (
              <div className="relative w-full sm:w-64">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-muted-foreground" />
                </div>
                <Input
                  type="text"
                  placeholder="Search challenges..."
                  className="pl-9 pr-4 h-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Filter Chips Container */}
          {!isLoading && events.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {availableCategories.map((category) => (
                <Badge
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  className={`cursor-pointer transition-colors ${
                    selectedCategory === category
                      ? 'bg-teal-600 hover:bg-teal-700 text-white'
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Badge>
              ))}

              {/* Show Clear button if any filter is heavily active */}
              {(searchQuery || selectedCategory !== 'All') && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 ml-2"
                >
                  <X className="h-3 w-3" /> Clear Filters
                </button>
              )}
            </div>
          )}

          {/* Event Cards Grid */}
          {isLoading ? (
            <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : filteredEvents.length > 0 ? (
            <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
              {filteredEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  team={getTeamForEvent(event.id)}
                  onRegister={registerForEvent}
                />
              ))}
            </div>
          ) : events.length > 0 ? (
            <div className="text-center py-10 sm:py-12 bg-muted/20 rounded-xl border border-dashed">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <Search className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">No challenges found</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
                We couldn't find any challenges matching your search or selected category.
              </p>
              <button
                className="text-sm font-medium text-teal-600 hover:underline"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="text-center py-10 sm:py-12">
              <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <Clock className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">
                No Active Events
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                There are currently no events open for participation. Check back soon for new
                innovation challenges!
              </p>
            </div>
          )}
        </div>

        {/* Getting started card - show when no teams */}
        {!isLoading && myTeams.length === 0 && events.length > 0 && (
          <Card className="p-5 sm:p-6 md:p-8 bg-gradient-to-br from-teal-500/5 via-emerald-500/5 to-cyan-500/5 border-teal-500/10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Rocket className="h-6 w-6 text-teal-600 dark:text-teal-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1">
                  Ready to Get Started?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Register for an event, then create or join a team to start building your solution.
                  Share your team&apos;s join code with teammates!
                </p>
              </div>
              <Link href={`/participant/event/${events[0]?.id}`} className="flex-shrink-0">
                <span className="inline-flex items-center gap-1 text-sm font-medium text-teal-600 dark:text-teal-400 hover:underline">
                  Browse Events <ChevronRight className="h-4 w-4" />
                </span>
              </Link>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
