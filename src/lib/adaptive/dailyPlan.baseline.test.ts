import { describe, expect, it } from 'vitest';
import { createInitialTopicMastery, TopicSchema, type Topic, type TopicMastery } from '../../domain';
import { BASELINE_EVIDENCE_THRESHOLD, baselinePriorStrength, buildAdaptiveDailyPlan } from './dailyPlan';

const NOW = new Date('2026-09-10T08:00:00.000Z');

function topic(id: string, subject: 'mathematics' | 'physics', order: number): Topic {
  return TopicSchema.parse({
    id,
    subject,
    parentId: null,
    slug: id,
    title: { en: `${subject} ${order}` },
    description: { en: 'Description' },
    order,
    prerequisiteTopicIds: [],
    estimatedMinutes: 30,
    status: 'published',
    demo: false,
    version: 1,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    createdBy: 'admin',
  });
}

const TOPICS = [topic('math-1', 'mathematics', 1), topic('phys-1', 'physics', 1)];

function plan(overrides: Partial<Parameters<typeof buildAdaptiveDailyPlan>[0]> = {}) {
  return buildAdaptiveDailyPlan({
    userId: 'user-1',
    date: '2026-09-10',
    timezone: 'UTC',
    targetMinutes: 120,
    topics: TOPICS,
    masteries: [],
    now: NOW,
    idFactory: (() => {
      let counter = 0;
      return () => `block-${(counter += 1)}`;
    })(),
    ...overrides,
  });
}

function minutesFor(kind: string, generated: ReturnType<typeof plan>): number {
  return generated.blocks.find((block) => block.kind === kind)?.targetMinutes ?? 0;
}

describe('baseline prior strength', () => {
  it('is full with no evidence and gone once there is enough', () => {
    expect(baselinePriorStrength(0)).toBe(1);
    expect(baselinePriorStrength(BASELINE_EVIDENCE_THRESHOLD / 2)).toBeCloseTo(0.5);
    expect(baselinePriorStrength(BASELINE_EVIDENCE_THRESHOLD)).toBe(0);
    expect(baselinePriorStrength(BASELINE_EVIDENCE_THRESHOLD * 10)).toBe(0);
  });
});

describe('onboarding levels shape the first plan', () => {
  it('gives a learner new to physics more physics foundation time', () => {
    const newToPhysics = plan({
      baseline: { mathLevel: 'intermediate', physicsLevel: 'new' },
      evidenceCount: 0,
    });
    const confident = plan({
      baseline: { mathLevel: 'foundation', physicsLevel: 'intermediate' },
      evidenceCount: 0,
    });

    expect(minutesFor('new-physics', newToPhysics)).toBeGreaterThan(minutesFor('new-physics', confident));
    expect(minutesFor('new-math', confident)).toBeGreaterThan(minutesFor('new-math', newToPhysics));
  });

  it('says the estimate came from the stated level and will be replaced', () => {
    const generated = plan({ baseline: { mathLevel: 'foundation', physicsLevel: 'new' }, evidenceCount: 0 });
    expect(generated.adaptiveReasons.some((reason) => /starting level you chose/i.test(reason))).toBe(true);
    expect(generated.adaptiveReasons.some((reason) => /diagnostic replaces this estimate/i.test(reason))).toBe(true);
  });

  it('produces the same plan as no baseline once real evidence exists', () => {
    const withBaseline = plan({
      baseline: { mathLevel: 'foundation', physicsLevel: 'new' },
      evidenceCount: BASELINE_EVIDENCE_THRESHOLD,
    });
    const withoutBaseline = plan({ evidenceCount: BASELINE_EVIDENCE_THRESHOLD });

    expect(minutesFor('new-math', withBaseline)).toBe(minutesFor('new-math', withoutBaseline));
    expect(minutesFor('new-physics', withBaseline)).toBe(minutesFor('new-physics', withoutBaseline));
    expect(withBaseline.adaptiveReasons.some((reason) => /starting level you chose/i.test(reason))).toBe(false);
  });

  it('lets diagnostic evidence pull time away from a level the learner over-rated', () => {
    // The learner said "intermediate" physics but is scoring badly on it.
    const weakPhysics: TopicMastery = {
      ...createInitialTopicMastery({ userId: 'user-1', topicId: 'phys-1', subject: 'physics', now: NOW }),
      attemptCount: 12,
      correctAttemptCount: 2,
      score: 18,
    };
    const evidenceDriven = plan({
      baseline: { mathLevel: 'foundation', physicsLevel: 'intermediate' },
      evidenceCount: BASELINE_EVIDENCE_THRESHOLD,
      masteries: [weakPhysics],
    });

    expect(evidenceDriven.blocks.some((block) => block.kind === 'weak-topic')).toBe(true);
    expect(evidenceDriven.adaptiveReasons.some((reason) => /Lowest mastery is 18%/.test(reason))).toBe(true);
  });
});

describe('the learner’s stated daily minutes bound the plan', () => {
  it('never allocates more than the stated budget', () => {
    for (const targetMinutes of [15, 45, 120, 240]) {
      const generated = plan({ targetMinutes, baseline: { mathLevel: 'foundation', physicsLevel: 'new' } });
      const allocated = generated.blocks.reduce((total, block) => total + block.targetMinutes, 0);
      expect(generated.targetMinutes).toBe(targetMinutes);
      expect(allocated).toBeLessThanOrEqual(targetMinutes);
    }
  });

  it('keeps a very short day to a handful of blocks', () => {
    const generated = plan({ targetMinutes: 10 });
    expect(generated.blocks.length).toBeLessThanOrEqual(2);
  });
});

describe('exam proximity shifts the mix, not the budget', () => {
  // The weak topic is the physics one, so the mathematics topic stays unseen and
  // a `new-math` block exists in both plans to compare.
  const weakMastery: TopicMastery = {
    ...createInitialTopicMastery({ userId: 'user-1', topicId: 'phys-1', subject: 'physics', now: NOW }),
    attemptCount: 8,
    correctAttemptCount: 2,
    score: 25,
  };

  it('spends less on new material when the exam is close', () => {
    const far = plan({ masteries: [weakMastery], daysUntilExam: 60 });
    const near = plan({ masteries: [weakMastery], daysUntilExam: 5 });

    expect(minutesFor('new-math', near)).toBeLessThan(minutesFor('new-math', far));
    expect(minutesFor('weak-topic', near)).toBeGreaterThan(minutesFor('weak-topic', far));
    expect(near.targetMinutes).toBe(far.targetMinutes);
  });

  it('says why, rather than changing the plan silently', () => {
    const near = plan({ masteries: [weakMastery], daysUntilExam: 5 });
    expect(near.adaptiveReasons.some((reason) => /exam is 5 days away/i.test(reason))).toBe(true);
  });
});

describe('due counts come from data', () => {
  it('reports the real number of due vocabulary reviews', () => {
    const withDue = plan({ dueEnglishReviewCount: 7 });
    expect(withDue.adaptiveReasons.some((reason) => /7 vocabulary reviews are due/.test(reason))).toBe(true);
  });
});
