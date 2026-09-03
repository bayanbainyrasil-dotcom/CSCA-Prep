import { describe, expect, it } from 'vitest';
import { SLICE_FORMULAS, SLICE_LESSONS, SLICE_LESSON_CELL_IDS, SLICE_VOCABULARY } from '@/data/teaching-slices';
import { DEMO_LESSONS } from '@/data/seed';
import { BLUEPRINT_CELL_SEED } from '@/data/blueprint-cells';
import { DRAFT_QUESTION_SEED } from '@/data/draft-questions';
import { evaluateBlueprintCoverage } from '@/features/blueprint/blueprint';
import { isFallback, pickLocalized } from '@/features/i18n/localized-text';
import type { ExplanationLanguage, LocalizedText } from '@/domain';

/** The text a learner in this language actually sees. */
function shown(value: LocalizedText, language: ExplanationLanguage): string {
  return pickLocalized(value, language).text;
}

/**
 * The authored teaching slices: what they must contain to be a complete path,
 * and — the property that matters most — that authoring them approved nothing.
 */

const REQUIRED_SECTIONS = [
  'big-idea',
  'english',
  'vocabulary',
  'formula',
  'worked-example',
  'guided-practice',
  'independent-practice',
  'csca-style',
  'speed-round',
] as const;

describe('the slices are authored content, not demo content', () => {
  it('is marked draft, not demo, and never published by authoring', () => {
    for (const item of [...SLICE_LESSONS, ...SLICE_VOCABULARY, ...SLICE_FORMULAS]) {
      expect(item.status, item.id).toBe('draft');
      expect(item.demo, item.id).toBe(false);
      expect(item.createdBy, item.id).toBe('csca-prep-authored-slice');
    }
  });

  it('is distinct from the demo lessons, which stay demo', () => {
    const demoIds = new Set(DEMO_LESSONS.map((lesson) => lesson.id));
    for (const lesson of SLICE_LESSONS) expect(demoIds.has(lesson.id), lesson.id).toBe(false);
    for (const lesson of DEMO_LESSONS) expect(lesson.demo, lesson.id).toBe(true);
  });
});

describe('each lesson is a complete path', () => {
  it('covers one blueprint cell that actually exists', () => {
    const cellIds = new Set(BLUEPRINT_CELL_SEED.map((cell) => cell.id));
    for (const lesson of SLICE_LESSONS) {
      const cellId = SLICE_LESSON_CELL_IDS[lesson.id];
      expect(cellId, lesson.id).toBeDefined();
      expect(cellIds.has(cellId!), cellId).toBe(true);
      const cell = BLUEPRINT_CELL_SEED.find((entry) => entry.id === cellId)!;
      expect(lesson.subject, lesson.id).toBe(cell.subject);
      expect(lesson.topicId, lesson.id).toBe(cell.topicId);
    }
  });

  it('teaches toward a cell that has authored questions, so the path does not stop at the lesson', () => {
    for (const lesson of SLICE_LESSONS) {
      const cellId = SLICE_LESSON_CELL_IDS[lesson.id]!;
      const questions = DRAFT_QUESTION_SEED.filter((question) => question.cellId === cellId);
      expect(questions.length, `${lesson.id} has practice items`).toBeGreaterThanOrEqual(3);
    }
  });

  it('states prerequisites and objectives before teaching anything', () => {
    for (const lesson of SLICE_LESSONS) {
      const ids = lesson.sections.map((entry) => entry.id);
      expect(ids[0], lesson.id).toBe('prerequisites');
      expect(ids[1], lesson.id).toBe('objectives');
      expect(shown(lesson.sections[0]!.body, 'en').length, lesson.id).toBeGreaterThan(80);
    }
  });

  it('runs the whole sequence from idea to timed set', () => {
    for (const lesson of SLICE_LESSONS) {
      const kinds = new Set(lesson.sections.map((entry) => entry.kind));
      for (const kind of REQUIRED_SECTIONS) {
        expect(kinds.has(kind), `${lesson.id} is missing a ${kind} section`).toBe(true);
      }
      // Guided practice must come before independent practice, which must come
      // before the timed set: the order is the teaching, not decoration.
      const order = lesson.sections.map((entry) => entry.kind);
      expect(order.indexOf('worked-example'), lesson.id).toBeLessThan(order.indexOf('guided-practice'));
      expect(order.indexOf('guided-practice'), lesson.id).toBeLessThan(order.indexOf('independent-practice'));
      expect(order.indexOf('independent-practice'), lesson.id).toBeLessThan(order.indexOf('speed-round'));
    }
  });

  it('gives guided practice ordered hints rather than the answer', () => {
    for (const lesson of SLICE_LESSONS) {
      const guided = lesson.sections.find((entry) => entry.kind === 'guided-practice')!;
      const body = shown(guided.body, 'en');
      expect(body, lesson.id).toMatch(/First:.*Second:.*Third:/s);
    }
  });

  it('links every vocabulary and formula id it names', () => {
    const vocabularyIds = new Set(SLICE_VOCABULARY.map((entry) => entry.id));
    const formulaIds = new Set(SLICE_FORMULAS.map((entry) => entry.id));
    for (const lesson of SLICE_LESSONS) {
      expect(lesson.vocabularyIds.length, lesson.id).toBeGreaterThanOrEqual(3);
      expect(lesson.formulaIds.length, lesson.id).toBeGreaterThanOrEqual(1);
      for (const id of lesson.vocabularyIds) expect(vocabularyIds.has(id), id).toBe(true);
      for (const id of lesson.formulaIds) expect(formulaIds.has(id), id).toBe(true);
    }
  });
});

describe('both languages are written out', () => {
  it('gives every lesson section a real Russian rendering, not the English copied', () => {
    for (const lesson of SLICE_LESSONS) {
      for (const entry of lesson.sections) {
        const en = shown(entry.body, 'en');
        const ru = shown(entry.body, 'ru');
        expect(ru, `${lesson.id}/${entry.id}`).toMatch(/[А-Яа-я]/);
        // A vocabulary list is intentionally the same bilingual glossary line.
        if (entry.kind !== 'vocabulary') expect(ru, `${lesson.id}/${entry.id}`).not.toBe(en);
      }
      expect(shown(lesson.title, 'ru')).toMatch(/[А-Яа-я]/);
      expect(shown(lesson.summary, 'ru')).toMatch(/[А-Яа-я]/);
    }
  });

  it('falls back to English when a translation is absent, and says that it did', () => {
    expect(shown({ en: 'Only English' }, 'ru')).toBe('Only English');
    expect(isFallback({ en: 'Only English' }, 'ru')).toBe(true);
    expect(shown({ en: 'Only English' }, 'zh')).toBe('Only English');
    // The slices carry Russian, so nothing in them falls back.
    for (const lesson of SLICE_LESSONS) {
      for (const entry of lesson.sections) {
        expect(isFallback(entry.body, 'ru'), `${lesson.id}/${entry.id}`).toBe(false);
      }
    }
  });
});

/** Every single-letter symbol the rendered relation actually uses. */
function symbolsIn(katex: string): string[] {
  // Drop LaTeX commands first, or `\frac` would contribute f, r, a and c.
  const bare = katex.replace(/\\[a-zA-Z]+/g, ' ');
  return [...new Set(bare.match(/[a-zA-Z]/g) ?? [])];
}

describe('formulas explain themselves', () => {
  it('gives every variable a meaning in both languages and an SI unit where one exists', () => {
    for (const formula of SLICE_FORMULAS) {
      // Not a count: what matters is that the learner can look up every symbol
      // they can see. A two-symbol identity is a relation like any other.
      expect(formula.variables.length, formula.id).toBeGreaterThan(0);
      for (const symbol of symbolsIn(formula.katex)) {
        expect(
          formula.variables.some((variable) => variable.symbol.includes(symbol)),
          `${formula.id} renders ${symbol} without explaining it`,
        ).toBe(true);
      }
      for (const variable of formula.variables) {
        expect(shown(variable.meaning, 'ru'), `${formula.id}/${variable.symbol}`).toMatch(/[А-Яа-я]/);
      }
    }
    // The physics relation is dimensional, so every variable carries a unit.
    const heat = SLICE_FORMULAS.find((formula) => formula.id === 'formula-heat-transfer')!;
    for (const variable of heat.variables) expect(variable.siUnit, variable.symbol).not.toBeNull();
  });

  it('states where each relation stops applying', () => {
    for (const formula of SLICE_FORMULAS) {
      expect(shown(formula.limitations, 'en').length, formula.id).toBeGreaterThan(60);
    }
    const heat = SLICE_FORMULAS.find((formula) => formula.id === 'formula-heat-transfer')!;
    expect(shown(heat.limitations, 'en')).toMatch(/melting|boiling/i);
  });
});

describe('authoring the slices approved nothing', () => {
  it('leaves blueprint coverage at zero', () => {
    const report = evaluateBlueprintCoverage(BLUEPRINT_CELL_SEED, []);
    expect(report.verifiedCells).toBe(0);
    expect(report.totals.empty).toBe(BLUEPRINT_CELL_SEED.length);
  });

  it('names no reviewer anywhere in the authored content', () => {
    const serialised = JSON.stringify([...SLICE_LESSONS, ...SLICE_VOCABULARY, ...SLICE_FORMULAS]);
    expect(serialised).not.toContain('reviewer');
    expect(serialised).not.toContain('reviewedAt');
    expect(serialised).not.toContain('verified');
  });

  it('claims nothing official', () => {
    const serialised = JSON.stringify([...SLICE_LESSONS, ...SLICE_VOCABULARY, ...SLICE_FORMULAS]).toLowerCase();
    expect(serialised).not.toContain('official');
    expect(serialised).not.toContain('past paper');
  });
});
