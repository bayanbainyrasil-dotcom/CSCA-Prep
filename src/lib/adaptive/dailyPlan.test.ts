import { describe, expect, it } from 'vitest';
import { DEMO_TOPICS } from '@/data/seed';
import {
  TopicMasterySchema,
  createInitialTopicMastery,
  type Subject,
  type TopicMastery,
} from '@/domain';
import { buildAdaptiveDailyPlan } from './dailyPlan';

const NOW = new Date('2026-05-12T10:00:00.000Z');

function mastery(
  topicId: string,
  subject: Subject,
  overrides: Partial<TopicMastery> = {},
): TopicMastery {
  const initial = createInitialTopicMastery({
    userId: 'learner-1',
    topicId,
    subject,
    now: new Date('2026-05-01T10:00:00.000Z'),
  });
  return TopicMasterySchema.parse({ ...initial, ...overrides });
}

function sequentialIds() {
  let value = 0;
  return () => `block-${value += 1}`;
}

describe('adaptive daily plan', () => {
  it('allocates the complete time budget across concrete adaptive blocks', () => {
    const plan = buildAdaptiveDailyPlan({
      userId: 'learner-1',
      date: '2026-05-12',
      timezone: 'Asia/Almaty',
      targetMinutes: 60,
      topics: [...DEMO_TOPICS],
      masteries: [mastery('physics-units-si', 'physics', {
        score: 42,
        attemptCount: 4,
        correctAttemptCount: 2,
        nextReviewAt: '2026-05-10T10:00:00.000Z',
      })],
      dueEnglishReviewCount: 7,
      now: NOW,
      idFactory: sequentialIds(),
    });

    expect(plan.blocks.reduce((total, block) => total + block.targetMinutes, 0)).toBe(60);
    expect(new Set(plan.blocks.map((block) => block.id)).size).toBe(plan.blocks.length);
    expect(plan.blocks.map((block) => block.kind)).toEqual(
      expect.arrayContaining(['mental-math', 'new-math', 'english', 'weak-topic', 'review']),
    );
    expect(plan.blocks.find((block) => block.kind === 'weak-topic')?.topicIds)
      .toContain('physics-units-si');
    expect(plan.adaptiveReasons).toHaveLength(plan.blocks.length);
  });

  it('unlocks the next physics topic only after its prerequisite is ready', () => {
    const locked = buildAdaptiveDailyPlan({
      userId: 'learner-1',
      date: '2026-05-12',
      timezone: 'UTC',
      targetMinutes: 45,
      topics: [...DEMO_TOPICS],
      masteries: [mastery('physics-units-si', 'physics', {
        score: 59,
        attemptCount: 8,
        correctAttemptCount: 6,
        nextReviewAt: '2026-05-20T10:00:00.000Z',
      })],
      now: NOW,
      idFactory: sequentialIds(),
    });
    const unlocked = buildAdaptiveDailyPlan({
      userId: 'learner-1',
      date: '2026-05-12',
      timezone: 'UTC',
      targetMinutes: 45,
      topics: [...DEMO_TOPICS],
      masteries: [mastery('physics-units-si', 'physics', {
        score: 60,
        attemptCount: 8,
        correctAttemptCount: 6,
        nextReviewAt: '2026-05-20T10:00:00.000Z',
      })],
      now: NOW,
      idFactory: sequentialIds(),
    });

    expect(locked.blocks.some((block) => block.kind === 'new-physics')).toBe(false);
    expect(unlocked.blocks.find((block) => block.kind === 'new-physics')?.topicIds)
      .toEqual(['physics-kinematics']);
  });

  it('clamps undersized plans to ten minutes without creating one-minute fragments', () => {
    const plan = buildAdaptiveDailyPlan({
      userId: 'learner-1',
      date: '2026-05-12',
      timezone: 'UTC',
      targetMinutes: 3,
      topics: [...DEMO_TOPICS],
      masteries: [],
      now: NOW,
      idFactory: sequentialIds(),
    });

    expect(plan.targetMinutes).toBe(10);
    expect(plan.blocks).toHaveLength(2);
    expect(plan.blocks.map((block) => block.targetMinutes)).toEqual([5, 5]);
  });

  it('prioritizes the most overdue review and the weakest topic', () => {
    const plan = buildAdaptiveDailyPlan({
      userId: 'learner-1',
      date: '2026-05-12',
      timezone: 'UTC',
      targetMinutes: 75,
      topics: [...DEMO_TOPICS],
      masteries: [
        mastery('math-foundation', 'mathematics', {
          score: 52,
          attemptCount: 5,
          correctAttemptCount: 3,
          nextReviewAt: '2026-05-11T10:00:00.000Z',
        }),
        mastery('physics-units-si', 'physics', {
          score: 21,
          attemptCount: 5,
          correctAttemptCount: 1,
          nextReviewAt: '2026-05-01T10:00:00.000Z',
        }),
      ],
      now: NOW,
      idFactory: sequentialIds(),
    });

    expect(plan.blocks.find((block) => block.kind === 'weak-topic')?.topicIds[0])
      .toBe('physics-units-si');
    expect(plan.blocks.find((block) => block.kind === 'review')?.topicIds[0])
      .toBe('physics-units-si');
  });
});
