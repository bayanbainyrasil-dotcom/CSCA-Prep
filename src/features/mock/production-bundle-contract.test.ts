import { describe, expect, it } from 'vitest';
import mockServiceSource from './mock-service.ts?raw';
import runnerSource from './server-mock-runner.tsx?raw';
import resultsSource from './server-mock-results.tsx?raw';

/**
 * The production mock path must not reach the built-in question generator: that
 * module carries `correctAnswer` for every generated item. Importing it from the
 * server flow would pull an answer key into the same chunk as the exam UI, which
 * is exactly the property the server-authoritative design exists to remove.
 */
const PRODUCTION_MOCK_SOURCES = {
  'mock-service.ts': mockServiceSource,
  'server-mock-runner.tsx': runnerSource,
  'server-mock-results.tsx': resultsSource,
};

const FORBIDDEN_IMPORTS = [
  'mock/mock-data',
  './mock-data',
  'data/questionTemplates',
  'questionTemplates',
  'buildMockQuestions',
  'generateQuestion',
];

describe('production mock source contract', () => {
  for (const [name, source] of Object.entries(PRODUCTION_MOCK_SOURCES)) {
    it(`${name} does not import the browser question generator`, () => {
      for (const forbidden of FORBIDDEN_IMPORTS) {
        expect(source).not.toContain(forbidden);
      }
    });

    it(`${name} never decides correctness in the browser`, () => {
      // The review screen displays `correctAnswer` and `isCorrect` exactly as the
      // server reported them; no source on this path may compare them itself.
      expect(source).not.toContain('correctAnswer ===');
      expect(source).not.toContain('=== correctAnswer');
      expect(source).not.toContain('correctAnswer ==');
      expect(source).not.toMatch(/correctAnswer\s*[!=]==/);
      expect(source).not.toMatch(/selectedAnswer\s*===\s*\w*[Cc]orrect/);
    });
  }

  it('only the review payload names an answer key', () => {
    expect(runnerSource).not.toContain('correctAnswer');
    expect(mockServiceSource.split('MockReviewSchema')[0]).not.toContain('correctAnswer');
  });

  it('the runner keeps only an attempt id on the device', () => {
    const storageWrites = [...runnerSource.matchAll(/localStorage\.setItem\(([^)]*)\)/g)].map(
      (match) => match[1] ?? '',
    );
    expect(storageWrites).toHaveLength(1);
    expect(storageWrites[0]).toContain('pointerKey');
    expect(storageWrites[0]).toContain('attemptId');
  });
});
