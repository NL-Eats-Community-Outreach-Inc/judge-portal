import { describe, it, expect } from 'vitest';
import { escapeCSV, csvRow, filenamePart, csvAttachment } from '@/lib/utils/csv';

describe('escapeCSV', () => {
  it('leaves plain values untouched', () => {
    expect(escapeCSV('Team Alpha')).toBe('Team Alpha');
    expect(escapeCSV(42)).toBe('42');
    expect(escapeCSV(3.5)).toBe('3.5');
  });

  it('returns an empty field for null and undefined', () => {
    expect(escapeCSV(null)).toBe('');
    expect(escapeCSV(undefined)).toBe('');
  });

  it('quotes values containing commas', () => {
    expect(escapeCSV('Alpha, Beta')).toBe('"Alpha, Beta"');
  });

  it('quotes and doubles embedded double quotes', () => {
    expect(escapeCSV('The "Best" Team')).toBe('"The ""Best"" Team"');
  });

  it('quotes values containing line breaks', () => {
    expect(escapeCSV('line one\nline two')).toBe('"line one\nline two"');
    expect(escapeCSV('line one\r\nline two')).toBe('"line one\r\nline two"');
  });

  it('prefixes a text cell that would open as a formula with a single quote', () => {
    expect(escapeCSV('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(escapeCSV('=QA-Formula')).toBe("'=QA-Formula");
    expect(escapeCSV('+1 for the demo')).toBe("'+1 for the demo");
    expect(escapeCSV('-QA-Minus')).toBe("'-QA-Minus");
    expect(escapeCSV('@judge')).toBe("'@judge");
    expect(escapeCSV('\tindented')).toBe("'\tindented");
    expect(escapeCSV('\rreturn')).toBe('"\'\rreturn"');
  });

  it('leaves numbers, empty strings and ordinary text alone', () => {
    expect(escapeCSV(-5)).toBe('-5');
    expect(escapeCSV(0)).toBe('0');
    expect(escapeCSV('')).toBe('');
    expect(escapeCSV('QA-Gamma "Quoted", Team')).toBe('"QA-Gamma ""Quoted"", Team"');
    expect(escapeCSV('Score = 5')).toBe('Score = 5');
  });
});

describe('csvRow', () => {
  it('joins escaped fields with commas', () => {
    expect(csvRow([1, 'Team "A", Inc', 'Technical', null, 87.5])).toBe(
      '1,"Team ""A"", Inc",Technical,,87.5'
    );
  });

  it('guards text cells but not numeric ones in the same row', () => {
    expect(csvRow([-1, '-1', '=SUM(A1)', 'yes'])).toBe("-1,'-1,'=SUM(A1),yes");
  });
});

describe('filenamePart / csvAttachment', () => {
  it('keeps letters, digits, dashes and underscores, lower-cased, and collapses the rest', () => {
    expect(filenamePart('QA-Preflight')).toBe('qa-preflight');
    expect(filenamePart('QA-Gamma "Quoted", Team')).toBe('qa-gamma-quoted-team');
    expect(filenamePart('   ')).toBe('event');
    expect(filenamePart('Hack_2026')).toBe('hack_2026');
  });

  it('builds the dated attachment header the exports share', () => {
    expect(csvAttachment('judging-results', 'QA-Preflight', 'total')).toMatch(
      /^attachment; filename="judging-results-qa-preflight-total-\d{4}-\d{2}-\d{2}\.csv"$/
    );
    expect(csvAttachment('judge-scores-matrix', 'Final / Round')).toMatch(
      /^attachment; filename="judge-scores-matrix-final-round-\d{4}-\d{2}-\d{2}\.csv"$/
    );
  });
});
