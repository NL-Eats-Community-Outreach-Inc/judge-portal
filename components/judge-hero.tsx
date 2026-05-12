import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, Gavel, Shield, Users } from 'lucide-react';
import { AnimatedTitle } from '@/components/animated-title';

export function JudgeHero() {
  return (
    <div className="relative flex flex-col gap-16 items-center py-20 px-4">
      <div className="absolute inset-0 bg-gradient-to-b from-gray-50/50 via-transparent to-transparent dark:from-gray-950/20 pointer-events-none" />

      <div className="relative flex flex-col gap-8 items-center text-center max-w-4xl">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
          <Gavel className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Professional Judging Platform
          </span>
        </div>

        <AnimatedTitle
          text="Judge Portal"
          className="text-5xl lg:text-7xl font-bold leading-tight pb-2"
        />

        <p className="text-xl lg:text-2xl text-gray-600 dark:text-gray-300 max-w-2xl mt-6">
          Streamline your judging process with our comprehensive platform for competitions,
          evaluations, and assessments.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <Button
            asChild
            size="lg"
            className="bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900"
          >
            <Link href="/auth/sign-up" className="flex items-center gap-2">
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-gray-300 dark:border-gray-700"
          >
            <Link href="/auth/login">Sign In</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl mt-8">
        <div className="feature-card p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="shimmer rounded-2xl" />
          <div className="feature-content relative">
            <div className="feature-icon w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Secure & Reliable</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Enterprise-grade security with role-based access control and audit trails.
            </p>
          </div>
        </div>

        <div className="feature-card p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="shimmer rounded-2xl" />
          <div className="feature-content relative">
            <div className="feature-icon w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Collaborative</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Real-time collaboration tools for judges and organizers.
            </p>
          </div>
        </div>

        <div className="feature-card p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="shimmer rounded-2xl" />
          <div className="feature-content relative">
            <div className="feature-icon w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <Gavel className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Fair Judging</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Structured scoring systems with bias prevention mechanisms.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
