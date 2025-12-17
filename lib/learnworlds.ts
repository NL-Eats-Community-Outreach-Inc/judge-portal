import type { Course } from '@/app/participant/knowledge-hub/components/course-card';

const BASE = 'https://stoplight.io/mocks/learnworlds/api/2951998/v2';
const API_KEY = process.env.LEARNWORLDS_API_KEY;
const LW_CLIENT_ID = process.env.LEARNWORLDS_CLIENT_ID;

export const api = {
  async getCourses(page = 1) {
    const res = await fetch(`${BASE}/courses?page=${page}`, {
      method: 'GET',
      headers: {
        'Lw-Client': `${LW_CLIENT_ID}`,
        Authorization: `Bearer ${API_KEY}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`LearnWorlds error: ${res.status}`);
    }

    const data = await res.json();

    // Map the LearnWorlds payload to something our UI can consume
    const courses: Course[] = data.results.map((c: Course) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      thumbnailUrl: c.thumbnailUrl,
    }));

    return {
      courses,
      totalPages: data.totalPages,
      currentPage: data.page,
      totalItems: data.totalItems,
    };
  },
};
