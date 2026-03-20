'use client';

import { useMemo, useState } from 'react';
import { Search, Users, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Mentor = {
  id: string;
  name: string;
  company: string;
  expertise: string[];
};

const mentors: Mentor[] = [
  {
    id: '1',
    name: 'Sarah Ahmed',
    company: 'AgriTech Labs',
    expertise: ['AgriTech', 'Sustainability'],
  },
  {
    id: '2',
    name: 'David Chen',
    company: 'AI Works',
    expertise: ['AI', 'Machine Learning'],
  },
  {
    id: '3',
    name: 'Maria Gonzalez',
    company: 'Green Future',
    expertise: ['Sustainability', 'Climate'],
  },
  {
    id: '4',
    name: 'James Patel',
    company: 'BuildStack',
    expertise: ['Web Development', 'AI'],
  },
];

export default function MentorsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExpertise, setSelectedExpertise] = useState('');

  const expertiseTags = useMemo(() => {
    return Array.from(new Set(mentors.flatMap((mentor) => mentor.expertise))).sort();
  }, []);

  const filteredMentors = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return mentors.filter((mentor) => {
      const matchesSearch =
        normalizedSearch === '' ||
        mentor.name.toLowerCase().includes(normalizedSearch) ||
        mentor.company.toLowerCase().includes(normalizedSearch);

      const matchesExpertise =
        selectedExpertise === '' || mentor.expertise.includes(selectedExpertise);

      return matchesSearch && matchesExpertise;
    });
  }, [searchTerm, selectedExpertise]);

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
              className={selectedExpertise === tag ? 'bg-teal-600 hover:bg-teal-700 text-white' : ''}
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

      {filteredMentors.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredMentors.map((mentor) => (
            <Card key={mentor.id} className="p-5">
              <div className="space-y-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{mentor.name}</h2>
                  <p className="text-sm text-muted-foreground">{mentor.company}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {mentor.expertise.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <h2 className="text-lg font-semibold text-foreground mb-2">No mentors found</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Try adjusting your search or clearing the filters.
          </p>
          <Button type="button" variant="outline" onClick={clearFilters}>
            Clear Filters
          </Button>
        </Card>
      )}
    </div>
  );
}