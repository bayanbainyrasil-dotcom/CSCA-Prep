import { describe, expect, it } from 'vitest';
import {
  DISTANCE_AT_CONSTANT_SPEED_TEMPLATE,
  LINEAR_EQUATION_TEMPLATE,
  NEWTON_SECOND_LAW_TEMPLATE,
  SPEED_CONVERSION_TEMPLATE,
} from '@/data/questionTemplates';
import type {
  ParameterizedQuestionTemplate,
  TemplateParameters,
} from './questionGenerator';
import {
  createSeededRandom,
  generateQuestion,
  validateQuestionTemplate,
} from './questionGenerator';

const FIXED_TIME = new Date('2026-01-15T08:00:00.000Z');

function registerVerifiedTemplateTests<P extends TemplateParameters>(
  template: ParameterizedQuestionTemplate<P>,
) {
  it(`validates 125 independent samples from ${template.id}`, () => {
    const report = validateQuestionTemplate(template, 125);

    expect(report).toEqual({
      templateId: template.id,
      valid: true,
      samplesChecked: 125,
      issues: [],
    });
  });

  it(`stores the solver result as the marked option for ${template.id}`, () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const question = generateQuestion(template, { seed, now: FIXED_TIME });
      const correctOption = question.options.find(
        (option) => option.id === question.correctAnswer,
      );
      if (!question.templateParameters) throw new Error('Generated parameters are missing.');
      const parameters = question.templateParameters as P;

      expect(correctOption?.text).toBe(
        template.formatAnswer(template.solve(parameters), parameters),
      );
      expect(question.options.map((option) => option.id)).toEqual(
        expect.arrayContaining(['A', 'B', 'C', 'D']),
      );
    }
  });
}

describe('question generator', () => {
  it('is deterministic for a fixed seed and timestamp', () => {
    const first = generateQuestion(DISTANCE_AT_CONSTANT_SPEED_TEMPLATE, {
      seed: 'same-seed',
      now: FIXED_TIME,
    });
    const second = generateQuestion(DISTANCE_AT_CONSTANT_SPEED_TEMPLATE, {
      seed: 'same-seed',
      now: FIXED_TIME,
    });

    expect(second).toEqual(first);
    expect(first.options).toHaveLength(4);
    expect(new Set(first.options.map((option) => option.text)).size).toBe(4);
  });

  registerVerifiedTemplateTests(DISTANCE_AT_CONSTANT_SPEED_TEMPLATE);
  registerVerifiedTemplateTests(NEWTON_SECOND_LAW_TEMPLATE);
  registerVerifiedTemplateTests(LINEAR_EQUATION_TEMPLATE);
  registerVerifiedTemplateTests(SPEED_CONVERSION_TEMPLATE);

  it('reports invalid templates without throwing away the full validation report', () => {
    const invalidTemplate = {
      ...DISTANCE_AT_CONSTANT_SPEED_TEMPLATE,
      id: 'invalid-duplicate-distractors',
      distractors: () => ['1 m', '1 m', '1 m'],
    };

    const report = validateQuestionTemplate(invalidTemplate, 3);

    expect(report.valid).toBe(false);
    expect(report.samplesChecked).toBe(3);
    expect(report.issues).toHaveLength(3);
    expect(report.issues[0]?.message).toContain('three unique distractors');
  });

  it('returns a reproducible pseudo-random stream bounded to [0, 1)', () => {
    const first = createSeededRandom('stream');
    const second = createSeededRandom('stream');
    const firstValues = Array.from({ length: 50 }, () => first());
    const secondValues = Array.from({ length: 50 }, () => second());

    expect(firstValues).toEqual(secondValues);
    expect(firstValues.every((value) => value >= 0 && value < 1)).toBe(true);
    expect(new Set(firstValues).size).toBeGreaterThan(45);
  });
});
