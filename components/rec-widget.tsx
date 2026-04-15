'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Loader2, ArrowRight, BookOpen, Star, X } from 'lucide-react';
import { authClient } from '@/lib/auth/client';
import { toast } from 'sonner';

interface RecommendationResponse {
  learner_id: string;
  recommended_item_id: string;
  recommended_title: string;
  rationale: string;
}

const MOCK_DATA: RecommendationResponse = {
  learner_id: '123',
  recommended_item_id: 'COURSE_456',
  recommended_title: 'Advanced Food Safety',
  rationale:
    'Since you completed Food Safety Basics, this course will help you master professional kitchen protocols.',
};

export function RecommendationWidget() {
  const [data, setData] = useState<RecommendationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Feedback State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const user = await authClient.getUser();
        if (user) {
          setUserId(user.id);
        }

        // Simulate fetch
        await new Promise((resolve) => setTimeout(resolve, 800));
        setData(MOCK_DATA);
      } catch (error) {
        console.error('Initialization error:', error);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  const handleSubmitFeedback = async () => {
    if (rating === 0) {
      toast.error('Please select a rating before submitting.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/recommendations/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          learner_id: userId || data?.learner_id || 'anonymous',
          recommendation_id: data?.recommended_item_id,
          feedback_type: 'rating',
          rating_value: rating,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit feedback');
      }

      toast.success('Thank you for your feedback!');
      setIsModalOpen(false);
      setRating(0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
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
      <div className="flex flex-col lg:flex-row gap-12 items-center">
        {/* Left Side: Header & Context */}
        <div className="w-full lg:w-1/3 space-y-4">
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <Sparkles className="h-4 w-4" />
            Recommended
          </div>
          <h3 className="text-4xl font-extrabold tracking-tight">Your Next Step</h3>
          <p className="text-muted-foreground text-lg leading-relaxed">
            We've analyzed your progress to find the best path forward for your training.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 px-4 py-2 shadow-sm"
          >
            Give Feedback
          </button>
        </div>

        {/* Right Side: Recommendation Card */}
        <div className="w-full lg:w-2/3">
          <div className="group relative overflow-hidden rounded-2xl border bg-card p-8 shadow-sm transition-all hover:shadow-md hover:border-primary/50">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <BookOpen className="h-8 w-8" />
              </div>

              <div className="flex-1 space-y-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-normal">
                  ID: {data.recommended_item_id}
                </span>
                <h4 className="text-2xl font-bold group-hover:text-primary transition-colors">
                  {data.recommended_title}
                </h4>
                <p className="text-muted-foreground">{data.rationale}</p>
              </div>

              <div className="pt-4 md:pt-0">
                <button className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90">
                  Start Now
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 blur-3xl group-hover:bg-primary/10 transition-colors" />
          </div>
        </div>
      </div>

      {/* Feedback Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => !isSubmitting && setIsModalOpen(false)}
          />

          <div className="relative bg-background border rounded-xl shadow-2xl max-w-sm w-full p-8 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100"
              disabled={isSubmitting}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>

            <div className="text-center space-y-4">
              <div className="space-y-2">
                <h4 className="text-xl font-bold tracking-tight">Rate Recommendation</h4>
                <p className="text-sm text-muted-foreground">
                  Was this recommendation helpful for your training?
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
                  className="inline-flex items-center justify-center rounded-md text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8 disabled:opacity-50 transition-all"
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
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 transition-colors"
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
