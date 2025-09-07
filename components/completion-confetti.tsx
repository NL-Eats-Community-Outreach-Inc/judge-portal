'use client';

import { useEffect, useState } from 'react';
import ConfettiExplosion from 'react-confetti-explosion';

interface CompletionConfettiProps {
  show: boolean;
  onComplete: () => void;
}

export function CompletionConfetti({ show, onComplete }: CompletionConfettiProps) {
  const [screenSize, setScreenSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  useEffect(() => {
    const updateScreenSize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setScreenSize('mobile');
      } else if (width < 1024) {
        setScreenSize('tablet');
      } else {
        setScreenSize('desktop');
      }
    };

    updateScreenSize();
    window.addEventListener('resize', updateScreenSize);
    return () => window.removeEventListener('resize', updateScreenSize);
  }, []);

  if (!show) return null;

  const getConfettiConfig = () => {
    switch (screenSize) {
      case 'mobile':
        return {
          particleCount: 100,
          width: 1000,
          duration: 3500,
          force: 0.4,
        };
      case 'tablet':
        return {
          particleCount: 150,
          width: 1200,
          duration: 4000,
          force: 0.5,
        };
      case 'desktop':
      default:
        return {
          particleCount: 200,
          width: 1400,
          duration: 4500,
          force: 0.6,
        };
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
      <ConfettiExplosion {...getConfettiConfig()} onComplete={onComplete} />
    </div>
  );
}
