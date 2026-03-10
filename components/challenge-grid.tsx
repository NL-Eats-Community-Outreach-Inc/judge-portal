'use client';

/**
 * Challenge Grid Component
 *
 * Fetches challenge data from /api/challenges endpoint
 * and displays the result in a grid
 *
 * Challenges are rendered in cards that contain:
 *   Title
 *   Description
 *   Tag(s)
 *   Deadline
 *   Application button
 *
 * If no challenges are return, an error message is
 * displayed instead.
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Type definition for Challenge Object
 */
interface Challenge {
  title: string;
  description: string;
  tags: string[];
  deadline: string;
}

export function ChallengeGrid() {
  //State that stores list of challenges from API
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  //State that indicates whether an error occured or no challenges were found
  const [error, setError] = useState(false);

  /**
   * Runs on component launch
   * Fetches challenge data from /api/challenges
   */
  useEffect(() => {
    async function fetchChallenges() {
      try {
        const res = await fetch('/api/challenges');
        if (!res.ok) throw new Error('API error');
        const data: Challenge[] = await res.json();
        if (!data || data.length === 0) {
          setError(true);
        } else {
          setChallenges(data);
        }
      } catch (e) {
        console.error(e);
        setError(true);
      }
    }

    fetchChallenges();
  }, []);

  /**
   * HTML Component
   */
  return (
    <div className="py-12 px-4">
      <h2 className="text-3xl font-bold text-center mb-8">Available Challenges</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {challenges.map((ch, idx) => (
          <div
            key={idx}
            className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between"
          >
            <div>
              <h3 className="text-xl font-semibold mb-2">{ch.title}</h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm mb-3">
                {ch.description || 'No description available.'}
              </p>
              <div className="mb-3">
                {ch.tags?.map((t, i) => (
                  <span
                    key={i}
                    className="inline-block bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium px-2 py-1 rounded mr-2 mb-1"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm font-medium">Deadline: {ch.deadline || 'N/A'}</p>
              <Button size="sm" className="bg-gray-900 dark:bg-white dark:text-gray-900">
                Apply
              </Button>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-red-500 mt-4 text-center">No challenges found.</p>}
    </div>
  );
}
