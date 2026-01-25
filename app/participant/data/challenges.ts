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
    id: 'sustainable-packaging',
    name: 'Sustainable Packaging Innovation',
    organizer: 'EcoVentures Accelerator',
    description:
      'Design a biodegradable or reusable packaging solution for fresh produce that extends shelf life while minimizing environmental impact. Solutions should be cost-effective and scalable for small-to-medium businesses.',
    prize: '$10,000 + Mentorship',
    status: 'Open',
    tags: ['Sustainability', 'Materials', 'Design', 'Environment'],
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
    id: 'smart-agriculture',
    name: 'Smart Agriculture IoT Challenge',
    organizer: 'AgriTech Hub',
    description:
      'Develop a low-cost IoT sensor network for monitoring soil health, water usage, and crop conditions. Focus on solutions that can be deployed in resource-limited settings to help smallholder farmers.',
    prize: '$7,500 + Pilot Program',
    status: 'Open',
    tags: ['IoT', 'Hardware', 'Agriculture', 'Data'],
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
