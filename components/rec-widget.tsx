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

// Mock Data -- To be replaced with API response
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const user = await authClient.getUser();
        if (user) {
          setUserId(user.id);
        } else {
          throw new Error('Failed to get user id.');
        }

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
    if (rating === 0 || isSubmitting || hasSubmitted) {
      if (rating === 0) toast.error('Please select a rating before submitting.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/recommendations/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          learner_id: userId || data?.learner_id || 'ERROR FETCHING ID',
          recommendation_id: data?.recommended_item_id,
          rating_value: rating,
          timestamp: new Date().toISOString(),
          comment: comment,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      toast.success('Thank you for your feedback!');
      setHasSubmitted(true);
      setIsModalOpen(false);
      setRating(0);
    } catch (error) {
      toast.error('Something went wrong:');
      console.error('Feedback Submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="sr-only">Loading recommendation...</span>
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
            We have analyzed your progress to find the best path forward for your training.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            disabled={hasSubmitted}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 px-4 py-2 shadow-sm disabled:opacity-50"
          >
            {hasSubmitted ? 'Feedback Received' : 'Give Feedback'}
          </button>
        </div>

        {/* Right Side: Recommendation Card */}
        <div className="w-full lg:w-2/3">
          <div className="group relative overflow-hidden rounded-2xl border bg-card p-8 shadow-sm transition-all hover:shadow-md hover:border-primary/50">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <BookOpen className="h-8 w-8" />
              </div>

              {/* Content */}
              <div className="flex-1 space-y-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-normal">
                  Item Ref: {data.recommended_item_id}
                </span>
                <h4 className="text-2xl font-bold group-hover:text-primary transition-colors">
                  {data.recommended_title}
                </h4>
                <p className="text-muted-foreground">{data.rationale}</p>
              </div>

              {/* Content Link: When content source is provided, will link to content source */}
              <div className="pt-4 md:pt-0">
                <button className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90">
                  Start Now
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Background decoration */}
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 blur-3xl group-hover:bg-primary/10 transition-colors" />
          </div>
        </div>
      </div>

      {/* Feedback Overlay */}
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
            </button>

            <div className="text-center space-y-4">
              <div className="space-y-2">
                <h4 className="text-xl font-bold tracking-tight">Rate Recommendation</h4>
                <p className="text-sm text-muted-foreground">
                  How accurate was this recommendation?
                </p>
              </div>

              <div className="flex justify-center gap-1 py-2">
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

              <div className="text-left space-y-2">
                <label
                  htmlFor="comment"
                  className="text-xs font-semibold uppercase text-muted-foreground"
                >
                  Additional Comments (Optional)
                </label>
                <textarea
                  id="comment"
                  className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Tell us why this was or wasn't helpful..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={handleSubmitFeedback}
                  disabled={isSubmitting || rating === 0}
                  className="inline-flex items-center justify-center rounded-md text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8 disabled:opacity-50 transition-all"
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
