/**
 * Converts a title or custom slug into a URL-friendly slug.
 */
export function createSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function createUniqueSlug(baseSlug: string, existingSlugs: Set<string> | string[]): string {
  const slugs = new Set(existingSlugs);

  let slug = baseSlug;
  let suffix = 2;

  while (slugs.has(slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }

  return slug;
}
