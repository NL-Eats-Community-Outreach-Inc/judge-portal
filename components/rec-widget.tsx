'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Sparkles, Loader2 } from 'lucide-react';

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
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="w-full max-w-7xl mx-auto py-12 px-6">
      {/* Main Layout: 
          - Stacked (flex-col) on mobile. 
          - Row (flex-row) and large gap on desktop.
      */}
      <div className="flex flex-col lg:flex-row gap-12 items-start">
        
        {/* Left Side: Text */}
        <div className="w-full lg:w-1/3 space-y-4">
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <Sparkles className="h-4 w-4" />
            Recommended
          </div>
          <h3 className="text-4xl font-extrabold">{data.title}</h3>
          <p className="text-muted-foreground text-lg">{data.rationale}</p>
        </div>

        {/* Right Side: Video 
            - lg:w-2/3 makes the video take up the majority of the row.
        */}
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
    </div>
  );
}