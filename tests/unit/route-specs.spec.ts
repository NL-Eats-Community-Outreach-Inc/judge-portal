import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Every route handler has a spec at the mirrored path under tests/unit/api,
 * with `[param]` directory names written in kebab-case (`[eventId]` → `event-id`).
 */
const ROOT = process.cwd();

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return routeFiles(full);
    return entry === 'route.ts' ? [full] : [];
  });
}

export function specPathFor(routeFile: string): string {
  const rel = relative(join(ROOT, 'app', 'api'), routeFile);
  const mirrored = rel
    .replace(/\[([A-Za-z]+)\]/g, (_m, name: string) =>
      name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
    )
    .replace(/route\.ts$/, 'route.spec.ts');
  return join(ROOT, 'tests', 'unit', 'api', mirrored);
}

describe('route handler coverage', () => {
  const routes = routeFiles(join(ROOT, 'app', 'api'));

  it('finds the API routes', () => {
    expect(routes.length).toBeGreaterThan(40);
  });

  it.each(routes.map((r) => [relative(ROOT, r)]))('%s has a spec', (route) => {
    const spec = specPathFor(join(ROOT, route));
    expect(existsSync(spec), `expected ${relative(ROOT, spec)}`).toBe(true);
  });
});
