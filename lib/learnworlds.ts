import type { Course } from '@/app/participant/knowledge-hub/components/course-card';

/**
 * TODO:
 * Get Learnworlds endpoint and client ID so I can actually
 * implement the courses and API stuff.
 */

const BASE = 'https://api.learnworlds.com';
const API_KEY = process.env.NEXT_PUBLIC_LEARNWORLDS_API_KEY;

export const api = {
  async getCourses(page = 1, perPage = 9) {
    const res = await fetch(`${BASE}/courses?page=${page}&per_page=${perPage}`, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
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
      totalPages: data.total_pages,
      currentPage: data.page,
      total: data.total,
    };
  },
};