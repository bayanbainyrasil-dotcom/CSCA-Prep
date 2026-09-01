import { describe, expect, it } from 'vitest';
import { DEMO_LESSONS } from '@/data/seed';
import { resolveLesson } from './resolve-lesson';

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
