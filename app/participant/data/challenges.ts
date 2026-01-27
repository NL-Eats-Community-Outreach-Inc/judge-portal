export interface CriteriaItem {
  name: string;
  weight: number;
}

export interface Challenge {
  id: string;
  name: string;
  organizer: string;
  description: string;
  prize: string;
  status: 'Open' | 'Closing Soon' | 'Closed';
  tags: string[];
  teamsCount: number;
  deadline: string;
  criteria: CriteriaItem[];
  image?: string;
}

export const DEMO_CHALLENGES: Challenge[] = [
  {
    id: 'zero-waste-packaging',
    name: 'Zero-Waste Packaging Challenge',
    organizer: 'Circular Economy Incubator',
    description:
      'Design a biodegradable packaging solution for fresh produce that extends shelf life.',
    prize: '$10,000',
    status: 'Open',
    tags: ['Sustainability', 'Materials Science', 'Design'],
    teamsCount: 12,
    deadline: '2026-02-28',
    criteria: [
      { name: 'Innovation & Creativity', weight: 25 },
      { name: 'Environmental Impact', weight: 30 },
      { name: 'Technical Feasibility', weight: 25 },
      { name: 'Scalability', weight: 20 },
    ],
  },
  {
    id: 'urban-farming-iot',
    name: 'Urban Farming IoT Hackathon',
    organizer: 'CityGrow Hub',
    description: 'Develop a low-cost IoT sensor network for vertical farms.',
    prize: '$5,000 + Mentorship',
    status: 'Open',
    tags: ['IoT', 'Hardware', 'Urban Ag'],
    teamsCount: 8,
    deadline: '2026-03-15',
    criteria: [
      { name: 'Technical Merit', weight: 30 },
      { name: 'Cost-Effectiveness', weight: 25 },
      { name: 'User Experience', weight: 20 },
      { name: 'Social Impact', weight: 25 },
    ],
  },
];

export function getChallengeById(id: string): Challenge | undefined {
  return DEMO_CHALLENGES.find((c) => c.id === id);
}

export function getAllChallenges(): Challenge[] {
  return DEMO_CHALLENGES;
}
