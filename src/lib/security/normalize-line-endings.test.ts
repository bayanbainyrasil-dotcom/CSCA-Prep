import { describe, expect, it } from 'vitest';
import { normalizeLineEndings } from './normalize-line-endings';

describe('normalizeLineEndings', () => {
  it('leaves an LF source unchanged', () => {
    expect(normalizeLineEndings('a\nb\nc')).toBe('a\nb\nc');
  });

  it('converts CRLF to LF', () => {
    expect(normalizeLineEndings('a\r\nb\r\nc')).toBe('a\nb\nc');
  });

  it('converts lone CR to LF', () => {
    expect(normalizeLineEndings('a\rb\rc')).toBe('a\nb\nc');
  });

  it('is idempotent', () => {
    const once = normalizeLineEndings('a\r\nb\rc\nd');
    expect(normalizeLineEndings(once)).toBe(once);
  });
});
