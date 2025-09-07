import { EnvVarWarning } from '@/components/env-var-warning';
import { AuthButton } from '@/components/auth-button';
import { JudgeHero } from '@/components/judge-hero';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { hasEnvVars } from '@/lib/utils';
import Link from 'next/link';
import { Gavel } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <div className="flex-1 w-full flex flex-col">
        <nav className="w-full flex justify-center border-b border-b-gray-200 dark:border-b-gray-800 h-16 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm sticky top-0 z-50">
          <div className="w-full max-w-7xl flex justify-between items-center p-3 px-5">
            <div className="flex gap-2 items-center">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                <Gavel className="w-5 h-5 text-white" />
              </div>
              <Link href={'/'} className="font-semibold text-lg">
                Judge Portal
              </Link>
            </div>
            <div className="flex items-center gap-4">
              {!hasEnvVars ? <EnvVarWarning /> : <AuthButton />}
              <ThemeSwitcher />
            </div>
          </div>
        </nav>

        <div className="flex-1 flex flex-col items-center">
          <JudgeHero />
        </div>

        <footer className="w-full flex items-center justify-center border-t border-gray-200 dark:border-gray-800 text-center text-xs gap-8 py-8 bg-gray-50 dark:bg-gray-900">
          <p className="text-gray-600 dark:text-gray-400">
            © 2025 Judge Portal. All rights reserved.
          </p>
        </footer>
      </div>
    </main>
  );
}
