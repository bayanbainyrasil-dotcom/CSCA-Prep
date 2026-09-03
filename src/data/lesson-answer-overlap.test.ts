import { describe, expect, it } from 'vitest';
import { SLICE_LESSONS, SLICE_LESSON_CELL_IDS } from '@/data/teaching-slices';
import { DRAFT_QUESTION_SEED } from '@/data/draft-questions';

/**
 * A lesson must not hand over the answer to a question the learner is about to
 * be asked.
 *
 * `scripts/check-bundle-secrets.mjs` catches a verbatim copy of a solution
 * string in the built bundle. It cannot catch the subtler version: a worked
 * example that uses the same numbers as a practice item and reaches the same
 * answer in different words. Both slices originally did exactly that, which is
 * why this test exists.
 */

/** Every number in a piece of text, as a comparable set. */
function numbersIn(text: string): Set<string> {
  return new Set(
    (text.replace(/,/g, '.').match(/-?\d+(?:\.\d+)?/g) ?? [])
      .map((value) => String(Number(value)))
      .filter((value) => value !== '0' && value !== '1' && value !== '2'),
  );
}

function workedExamples(lesson: (typeof SLICE_LESSONS)[number]): string[] {
  return lesson.sections
    .filter((section) => section.kind === 'worked-example')
    .flatMap((section) => [section.body.en, section.body.ru].filter((value): value is string => typeof value === 'string'));
}

describe('a lesson never gives away a practice answer', () => {
  it('has a worked example in every slice, so there is something to check', () => {
    for (const lesson of SLICE_LESSONS) {
      expect(workedExamples(lesson).length, lesson.id).toBeGreaterThan(0);
    }
  });

  it('never repeats a practice item’s solution text verbatim', () => {
    for (const lesson of SLICE_LESSONS) {
      const cellId = SLICE_LESSON_CELL_IDS[lesson.id]!;
      const items = DRAFT_QUESTION_SEED.filter((question) => question.cellId === cellId);
      for (const example of workedExamples(lesson)) {
        for (const item of items) {
          expect(example, `${lesson.id} repeats ${item.id}`).not.toContain(item.shortSolution);
          expect(example, `${lesson.id} repeats ${item.id}`).not.toContain(item.solution);
        }
      }
    }
  });

  it('never works an example from the same numbers as a practice item', () => {
    for (const lesson of SLICE_LESSONS) {
      const cellId = SLICE_LESSON_CELL_IDS[lesson.id]!;
      const items = DRAFT_QUESTION_SEED.filter((question) => question.cellId === cellId);
      expect(items.length, cellId).toBeGreaterThan(0);

      for (const example of workedExamples(lesson)) {
        const exampleNumbers = numbersIn(example);
        for (const item of items) {
          const itemNumbers = numbersIn(item.question);
          const shared = [...itemNumbers].filter((value) => exampleNumbers.has(value));
          // Sharing one constant (a specific heat capacity, say) is expected;
          // sharing every quantity means it is the same problem.
          expect(
            shared.length,
            `${lesson.id} works the same numbers as ${item.id}: ${shared.join(', ')}`,
          ).toBeLessThan(itemNumbers.size);
        }
      }
    }
  });
});
