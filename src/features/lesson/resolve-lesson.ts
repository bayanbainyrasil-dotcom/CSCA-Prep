import type { Lesson } from '@/domain';

export type BuiltInDemoLesson = 'quadratic' | 'newton';

export type LessonResolution =
  | { kind: 'published'; lesson: Lesson; builtIn: null }
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
  const builtIn = isDemo ? BUILT_IN_DEMO_LESSONS[lessonId] : undefined;
  return builtIn ? { kind: 'built-in', lesson: null, builtIn } : null;
}
