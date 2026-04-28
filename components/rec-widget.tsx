'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Loader2, ArrowRight, BookOpen } from 'lucide-react';

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
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setData(MOCK_DATA);
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

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
            We've analyzed your progress to find the best path forward for your training.
          </p>
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
                  ID: {data.recommended_item_id}
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
    </div>
  );
}
