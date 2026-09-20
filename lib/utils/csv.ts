/** A text cell starting with one of these opens as a formula in spreadsheet software. */
const FORMULA_LEADERS = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Quotes a CSV field when it contains a comma, a double quote or a line break,
 * doubling any embedded quotes (RFC 4180). Null and undefined become an empty
 * field. A string that starts like a formula is prefixed with a single quote
 * so a team name or comment cannot run as one; numbers are written as they are,
 * so pass numeric cells as numbers, not strings.
 */
export function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let str = String(value);
  if (typeof value === 'string' && FORMULA_LEADERS.some((leader) => str.startsWith(leader))) {
    str = `'${str}`;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Joins already-typed fields into one CSV line, escaping each. */
export function csvRow(fields: Array<string | number | null | undefined>): string {
  return fields.map(escapeCSV).join(',');
}

/**
 * Turns an event name into the part of a download filename: ASCII letters,
 * digits, dashes and underscores only, lower-cased; `event` when nothing is left.
 */
export function filenamePart(name: string): string {
  const part = name
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return part || 'event';
}

/** The `Content-Disposition` header value for a CSV download named after an event. */
export function csvAttachment(prefix: string, eventName: string, ...parts: string[]): string {
  const date = new Date().toISOString().split('T')[0];
  const name = [prefix, filenamePart(eventName), ...parts, date].join('-');
  return `attachment; filename="${name}.csv"`;
}
