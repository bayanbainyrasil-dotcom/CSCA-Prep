import { describe, expect, it } from 'vitest';
import { DEMO_LESSONS } from '@/data/seed';
import { SLICE_LESSONS } from '@/data/teaching-slices';
import type { Lesson } from '@/domain';
import { resolveLesson } from './resolve-lesson';

/** A published, non-demo lesson, for the cases that need one. */
const published: Lesson = { ...DEMO_LESSONS[0]!, id: 'lesson-published', demo: false, status: 'published' };

describe('lesson resolution', () => {
  it('uses the matching published seed lesson in demo mode', () => {
    const result = resolveLesson('lesson-physics-constant-speed-demo', DEMO_LESSONS, true);

    expect(result?.kind).toBe('published');
    expect(result?.lesson?.title.en).toBe('Distance at Constant Speed');
    expect(result?.lesson?.topicId).toBe('physics-kinematics');
  });

  it('allows only explicit legacy built-in lesson ids in demo mode', () => {
    expect(resolveLesson('newtons-laws', [], true)).toMatchObject({
      kind: 'built-in',
      builtIn: 'newton',
    });
    expect(resolveLesson('quadratic-functions', [], true)).toMatchObject({
      kind: 'built-in',
      builtIn: 'quadratic',
    });
  });

  it('never substitutes unrelated content for an unknown lesson id', () => {
    expect(resolveLesson('lesson-that-does-not-exist', DEMO_LESSONS, true)).toBeNull();
    expect(resolveLesson('some-quadratic-looking-unknown-id', DEMO_LESSONS, true)).toBeNull();
  });

  it('does not expose demo or built-in lessons in production mode', () => {
    expect(resolveLesson('lesson-physics-constant-speed-demo', DEMO_LESSONS, false)).toBeNull();
    expect(resolveLesson('newtons-laws', [], false)).toBeNull();
  });
});

describe('authored content that no human has approved', () => {
  // The real authored slice, not a fixture: it must resolve the way it is written.
  const authored = SLICE_LESSONS[0]!;

  it('resolves, but never as published', () => {
    const resolution = resolveLesson(authored.id, [authored], false);
    expect(resolution?.kind).toBe('pending-review');
    expect(resolution?.lesson?.id).toBe(authored.id);
  });

  it('resolves the same way in the demo, so the label cannot differ by host', () => {
    expect(resolveLesson(authored.id, [authored], true)?.kind).toBe('pending-review');
  });

  it('still prefers a published lesson when both exist', () => {
    const both = [{ ...authored, id: 'shared' }, { ...published, id: 'shared' }];
    expect(resolveLesson('shared', both, false)?.kind).toBe('published');
  });

  it('does not resolve an archived lesson at all', () => {
    expect(resolveLesson(authored.id, [{ ...authored, status: 'archived' }], false)).toBeNull();
  });
});
