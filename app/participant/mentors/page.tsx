'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Linkedin, Calendar, User, Loader2, Search, X, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image'; // Added for optimization

type Mentor = {
  id: string;
  full_name: string;
  organization: string;
  photo_url: string | null;
  linkedin_url: string | null;
  calendly_url: string | null;
  tags: string[];
  is_visible: boolean;
};

export default function MentorsPage() {
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExpertise, setSelectedExpertise] = useState('');

  useEffect(() => {
    setIsLoading(true);
    fetch('/api/mentors')
      .then((res) => res.json())
      .then((data) => {
        const mentorList = Array.isArray(data)
          ? data
          : Array.isArray(data?.mentors)
            ? data.mentors
            : [];

        // Fixed: Removed the unused expression that was causing the lint error
        setMentors(mentorList.filter((m: Mentor) => m.is_visible === true) || []);
      })
      .catch(() => toast.error('Failed to load mentors'))
      .finally(() => setIsLoading(false));
  }, []);

  const expertiseTags = useMemo(() => {
    return Array.from(new Set(mentors.flatMap((mentor) => mentor.tags ?? []))).sort();
  }, [mentors]);

  const filteredMentors = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return mentors.filter((mentor) => {
      const matchesSearch =
        normalizedSearch === '' ||
        mentor.full_name.toLowerCase().includes(normalizedSearch) ||
        (mentor.organization ?? '').toLowerCase().includes(normalizedSearch);

      const matchesExpertise = selectedExpertise === '' || mentor.tags.includes(selectedExpertise);

      return matchesSearch && matchesExpertise;
    });
  }, [mentors, searchTerm, selectedExpertise]);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedExpertise('');
  };

  return (
    <div className="min-h-full px-4 py-6 md:px-6 md:py-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/25">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Find Mentors</h1>
            <p className="text-sm text-muted-foreground">
              Search by name or company and filter by expertise.
            </p>
          </div>
        </div>
      </div>

      <Card className="p-4 md:p-5 mb-6 space-y-4">
        <div className="relative">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-md border bg-background pl-10 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500/30"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={selectedExpertise === '' ? 'default' : 'outline'}
            onClick={() => setSelectedExpertise('')}
            className={selectedExpertise === '' ? 'bg-teal-600 hover:bg-teal-700 text-white' : ''}
          >
            All
          </Button>

          {expertiseTags.map((tag) => (
            <Button
              key={tag}
              type="button"
              variant={selectedExpertise === tag ? 'default' : 'outline'}
              onClick={() => setSelectedExpertise(tag)}
              className={
                selectedExpertise === tag ? 'bg-teal-600 hover:bg-teal-700 text-white' : ''
              }
            >
              {tag}
            </Button>
          ))}

          <Button type="button" variant="ghost" onClick={clearFilters} className="ml-auto">
            <X className="h-4 w-4 mr-1" />
            Clear Filters
          </Button>
        </div>
      </Card>

      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          {filteredMentors.length} mentor{filteredMentors.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
          <p className="text-sm text-muted-foreground font-medium">Loading mentor directory...</p>
        </div>
      ) : filteredMentors.length > 0 ? (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredMentors.map((mentor) => (
            <Card
              key={mentor.id}
              className="flex flex-col overflow-hidden transition-all hover:shadow-lg border-muted/60"
            >
              <CardHeader className="flex flex-row items-center gap-4 p-6 pb-4">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border bg-muted relative">
                  {mentor.photo_url ? (
                    <Image
                      src={mentor.photo_url}
                      alt={mentor.full_name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-teal-500/5">
                      <User className="h-6 w-6 text-teal-600/40" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg font-bold truncate">{mentor.full_name}</CardTitle>
                  <p className="text-xs font-semibold text-teal-600 uppercase tracking-wider truncate">
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
                      className="text-[10px] uppercase font-bold px-2 py-0 bg-muted/50"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>

                <div className="flex items-center gap-3 pt-4 border-t mt-auto">
                  {mentor.calendly_url && (
                    <Button
                      asChild
                      className="w-full flex-1 bg-teal-600 hover:bg-teal-700"
                      size="sm"
                    >
                      <a href={mentor.calendly_url} target="_blank" rel="noopener noreferrer">
                        <Calendar className="h-4 w-4 mr-2" />
                        Book Session
                      </a>
                    </Button>
                  )}

                  {mentor.linkedin_url && (
                    <Button
                      asChild
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0 border-teal-200 hover:bg-teal-50"
                    >
                      <a href={mentor.linkedin_url} target="_blank" rel="noopener noreferrer">
                        <Linkedin className="h-4 w-4 text-teal-700" />
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center border-dashed">
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">No mentors match your search</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Try adjusting your expertise filters or checking your spelling.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={clearFilters}
              className="border-teal-200"
            >
              Reset Filters
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
