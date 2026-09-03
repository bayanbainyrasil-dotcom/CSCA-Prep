import type { Lesson } from '@/domain';

export type BuiltInDemoLesson = 'quadratic' | 'newton';

export type LessonResolution =
  | { kind: 'published'; lesson: Lesson; builtIn: null }
  /**
   * Authored for the real product and waiting for a human to read it. It is
   * shown, because hiding work in progress from the only person who can review
   * it helps nobody, but the caller is told, so the screen must label it. It is
   * deliberately a separate kind from `published` rather than a flag on it: a
   * caller that forgets to handle this case fails to compile.
   */
  | { kind: 'pending-review'; lesson: Lesson; builtIn: null }
  | { kind: 'built-in'; lesson: null; builtIn: BuiltInDemoLesson };

const BUILT_IN_DEMO_LESSONS: Readonly<Record<string, BuiltInDemoLesson>> = {
  'quadratic': 'quadratic',
  'quadratic-functions': 'quadratic',
  'newtons-laws': 'newton',
  'newtons-second-law': 'newton',
};

export function resolveLesson(
  lessonId: string,
  lessons: readonly Lesson[],
  isDemo: boolean,
): LessonResolution | null {
  const published = lessons.find((lesson) => (
    lesson.id === lessonId
      && lesson.status === 'published'
      && (isDemo || !lesson.demo)
  ));

  if (published) return { kind: 'published', lesson: published, builtIn: null };

  // Authored content that no human has approved. Never returned as published.
  const authored = lessons.find((lesson) => (
    lesson.id === lessonId
      && lesson.status === 'draft'
      && !lesson.demo
  ));
  if (authored) return { kind: 'pending-review', lesson: authored, builtIn: null };

  const builtIn = isDemo ? BUILT_IN_DEMO_LESSONS[lessonId] : undefined;
  return builtIn ? { kind: 'built-in', lesson: null, builtIn } : null;
}
