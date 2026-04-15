'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Loader2, Star, X } from 'lucide-react';
import { useParticipant } from '@/app/participant/contexts/participant-context';
import { toast } from 'sonner';

interface Recommendation {
  id: string;
  title: string;
  rationale: string;
  video_url: string;
}

const MOCK_DATA: Recommendation = {
  id: 'rec-fr-10',
  title: 'Video title',
  rationale: 'Based on your recent history, this video will help you with your training.',
  video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
};

export function RecommendationWidget() {
  const [data, setData] = useState<Recommendation | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Feedback Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Access participant context
  const { myTeams } = useParticipant();

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setData(MOCK_DATA);
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmitFeedback = async () => {
    if (rating === 0) {
      toast.error('Please select a rating before submitting.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Attempting to find a learner ID from team data if available
      // otherwise, the backend session usually handles this.
      const learnerId = myTeams[0]?.id || 'unknown-learner';

      const response = await fetch('/api/recommendations/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          learner_id: learnerId,
          recommendation_id: data?.id,
          feedback_type: 'rating',
          rating_value: rating,
          timestamp: new Date().toISOString(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit feedback');
      }

      toast.success('Thank you for your feedback!');
      setIsModalOpen(false);
      setRating(0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error submitting feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="w-full max-w-7xl mx-auto py-12 px-6">
      <div className="flex flex-col lg:flex-row gap-12 items-start">
        {/* Left Side: Text */}
        <div className="w-full lg:w-1/3 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
              <Sparkles className="h-4 w-4" />
              Recommended
            </div>
            <h3 className="text-4xl font-extrabold">{data.title}</h3>
            <p className="text-muted-foreground text-lg">{data.rationale}</p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 px-4 py-2"
          >
            Give Feedback
          </button>
        </div>

        {/* Right Side: Video */}
        <div className="w-full lg:w-2/3">
          <div className="relative aspect-video w-full rounded-xl bg-black border shadow-lg overflow-hidden">
            <iframe
              src={data.video_url}
              className="absolute inset-0 h-full w-full border-0"
              allowFullScreen
              title="Recommendation Video"
            />
          </div>
        </div>
      </div>

      {/* Feedback Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => !isSubmitting && setIsModalOpen(false)}
          />

          {/* Dialog Content */}
          <div className="relative bg-background border rounded-xl shadow-2xl max-w-sm w-full p-8 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 disabled:pointer-events-none"
              disabled={isSubmitting}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>

            <div className="text-center space-y-4">
              <div className="space-y-2">
                <h4 className="text-xl font-bold tracking-tight">Rate Recommendation</h4>
                <p className="text-sm text-muted-foreground">
                  Was this video helpful for your training?
                </p>
              </div>

              <div className="flex justify-center gap-1 py-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    onClick={() => setRating(star)}
                    className="p-1 transition-transform active:scale-90"
                    disabled={isSubmitting}
                  >
                    <Star
                      className={`h-8 w-8 transition-colors ${
                        (hoveredRating || rating) >= star
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-muted-foreground'
                      }`}
                    />
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={handleSubmitFeedback}
                  disabled={isSubmitting || rating === 0}
                  className="inline-flex items-center justify-center rounded-md text-sm font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Feedback'
                  )}
                </button>
                <button
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
