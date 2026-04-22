'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Linkedin, Calendar, User, Loader2, Search, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Mentor {
  id: string;
  full_name: string;
  organization: string;
  photo_url: string | null;
  linkedin_url: string | null;
  calendly_url: string | null;
  tags: string[];
  is_visible: boolean;
}

export function MentorGrid() {
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExpertise, setSelectedExpertise] = useState('');

  useEffect(() => {
    setIsLoading(true);
    fetch('/api/mentors')
      .then((res) => res.json())
      .then((data) => {
        const mentorList = (Array.isArray(data) ? data : data.mentors).filter(
          (m: Mentor) => m.is_visible === true
        );
        setMentors(mentorList || []);
      })
      .catch(() => toast.error('Failed to load mentors'))
      .finally(() => setIsLoading(false));
  }, []);

  const expertiseTags = useMemo(() => {
    return Array.from(new Set(mentors.flatMap((m) => m.tags))).sort();
  }, [mentors]);

  const filteredMentors = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return mentors.filter((mentor) => {
      const matchesSearch =
        normalizedSearch === '' ||
        mentor.full_name.toLowerCase().includes(normalizedSearch) ||
        mentor.organization.toLowerCase().includes(normalizedSearch);

      const matchesExpertise = selectedExpertise === '' || mentor.tags.includes(selectedExpertise);

      return matchesSearch && matchesExpertise;
    });
  }, [mentors, searchTerm, selectedExpertise]);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedExpertise('');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium">Loading mentor directory...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 space-y-4">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or organization..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-md border bg-background pl-10 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedExpertise === '' ? 'default' : 'outline'}
            onClick={() => setSelectedExpertise('')}
          >
            All
          </Button>

          {expertiseTags.map((tag) => (
            <Button
              key={tag}
              variant={selectedExpertise === tag ? 'default' : 'outline'}
              onClick={() => setSelectedExpertise(tag)}
            >
              {tag}
            </Button>
          ))}

          <Button variant="ghost" onClick={clearFilters} className="ml-auto">
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
      </Card>

      <p className="text-sm text-muted-foreground">
        {filteredMentors.length} mentor
        {filteredMentors.length !== 1 ? 's' : ''} found
      </p>

      {filteredMentors.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredMentors.map((mentor) => (
            <Card
              key={mentor.id}
              className="mentor-card flex flex-col overflow-hidden transition-all hover:shadow-lg"
            >
              <CardHeader className="flex flex-row items-center gap-4 p-6 pb-4">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border bg-muted">
                  {mentor.photo_url ? (
                    <img
                      src={mentor.photo_url}
                      alt={mentor.full_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-primary/5">
                      <User className="h-6 w-6 text-primary/40" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg font-bold truncate">{mentor.full_name}</CardTitle>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider truncate">
                    {mentor.organization}
                  </p>
                </div>
              </CardHeader>

              <CardContent className="flex flex-col flex-grow p-6 pt-0">
                <div className="flex flex-wrap gap-1.5 mb-6">
                  {mentor.tags?.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="text-[10px] uppercase font-bold px-2 py-0"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>

                <div className="flex items-center gap-3 pt-4 border-t mt-auto">
                  {mentor.calendly_url && (
                    <Button asChild className="w-full flex-1" size="sm">
                      <a href={mentor.calendly_url} target="_blank" rel="noopener noreferrer">
                        <Calendar className="h-4 w-4 mr-2" />
                        Book Session
                      </a>
                    </Button>
                  )}

                  {mentor.linkedin_url && (
                    <Button asChild variant="outline" size="icon" className="h-9 w-9 shrink-0">
                      <a href={mentor.linkedin_url} target="_blank" rel="noopener noreferrer">
                        <Linkedin className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">No mentors found</p>
          <Button variant="outline" onClick={clearFilters}>
            Clear Filters
          </Button>
        </Card>
      )}
    </div>
  );
}
