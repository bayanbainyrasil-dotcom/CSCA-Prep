import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  FORBIDDEN_READINESS_CLAIMS,
  READINESS_CAVEAT,
  READINESS_EYEBROW,
  READINESS_HISTORY_CAVEAT,
} from './readiness-language';

/**
 * Readiness is a weighted blend of mastery, accuracy and speed against content
 * that has never been calibrated against a real exam outcome. It is useful for
 * choosing what to study next and useless as a prediction.
 *
 * These tests hold the line between those two things: every screen that shows
 * the number must say what it is, and nothing anywhere may describe it in the
 * vocabulary of prediction.
 */

function sourceFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      found.push(...sourceFiles(path));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) found.push(path);
  }
  return found;
}

const SHIPPED = sourceFiles('src');

describe('the caveat says what the number is', () => {
  it('calls it a planning signal and denies it is an official score', () => {
    expect(READINESS_CAVEAT).toMatch(/planning signal/i);
    expect(READINESS_CAVEAT).toMatch(/not an official CSCA score/i);
    expect(READINESS_EYEBROW).toBe('Internal metric');
  });

  it('says of a trend that it is not a predicted result', () => {
    expect(READINESS_HISTORY_CAVEAT).toMatch(/not a predicted result/i);
    expect(READINESS_HISTORY_CAVEAT).toMatch(/not been calibrated/i);
    expect(READINESS_HISTORY_CAVEAT).toMatch(/not what you would score/i);
  });
});

describe('every screen that shows readiness carries it', () => {
  /** A file that renders the number, rather than merely computing it. */
  const screens = SHIPPED.filter((path) => {
    if (!path.endsWith('.tsx')) return false;
    const source = readFileSync(path, 'utf8');
    return /readinessScore|dataKey="readiness"/.test(source);
  });

  it('finds the screens that show it', () => {
    expect(screens.length).toBeGreaterThanOrEqual(2);
  });

  it('imports the shared wording rather than writing its own', () => {
    for (const path of screens) {
      const source = readFileSync(path, 'utf8');
      expect(source, path).toContain('readiness-language');
      expect(/READINESS_CAVEAT|READINESS_HISTORY_CAVEAT/.test(source), path).toBe(true);
    }
  });

  it('does not leave a hand-written copy of the caveat to drift', () => {
    for (const path of screens) {
      const source = readFileSync(path, 'utf8');
      // The literal text may appear only in the module that defines it.
      expect(source, path).not.toContain('A planning signal from mastery');
    }
  });
});

describe('nothing describes readiness as a prediction', () => {
  it('uses none of the forbidden claims anywhere in the shipped app', () => {
    const offenders: string[] = [];
    for (const path of SHIPPED) {
      if (path.includes(join('features', 'dashboard', 'readiness-language'))) continue;
      const source = readFileSync(path, 'utf8');
      for (const claim of FORBIDDEN_READINESS_CLAIMS) {
        if (claim.test(source)) offenders.push(`${path} matched ${String(claim)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('names the claims worth refusing, so the list is not empty by accident', () => {
    expect(FORBIDDEN_READINESS_CLAIMS.length).toBeGreaterThanOrEqual(8);
    for (const sentence of [
      'Your predicted score is 78%.',
      'This is your pass probability.',
      'You are likely to pass.',
      'Your chance of passing is high.',
      'We guarantee a result.',
      'Your expected score is 610.',
    ]) {
      expect(
        FORBIDDEN_READINESS_CLAIMS.some((claim) => claim.test(sentence)),
        sentence,
      ).toBe(true);
    }
  });

  it('still allows the honest descriptions', () => {
    for (const sentence of [READINESS_CAVEAT, READINESS_HISTORY_CAVEAT, 'A planning signal, not a score.']) {
      for (const claim of FORBIDDEN_READINESS_CLAIMS) {
        expect(claim.test(sentence), `${sentence} matched ${String(claim)}`).toBe(false);
      }
    }
  });
});
