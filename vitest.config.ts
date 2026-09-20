import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.spec.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts', 'app/api/**/route.ts'],
      exclude: ['lib/db/schema.ts', 'lib/types.ts', 'lib/theme.ts', 'lib/hooks/**', 'lib/api/**'],
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
