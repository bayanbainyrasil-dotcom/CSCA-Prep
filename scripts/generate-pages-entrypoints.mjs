import { copyFile, mkdir } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export const pagesEntrypoints = [
  'login',
  'onboarding',
  'today',
  'roadmap',
  'learn',
  'mathematics',
  'physics',
  'lesson/newtons-laws',
  'lesson/quadratic',
  'lesson/lesson-physics-constant-speed-demo',
  // The authored teaching slices. Their cell ids are fixed, so a fresh deep link
  // resolves through a real page file instead of the 404 fallback. Adding a
  // slice means adding its route here; the test below checks every one.
  'slice/math-foundation-estimate-magnitude',
  'slice/math-foundation-fraction-decimal-percent',
  'slice/math-foundation-integer-operations',
  'slice/math-linear-isolate-unknown',
  'slice/math-linear-multi-step-linear',
  'slice/math-linear-linear-word-problem',
  'slice/phys-thermodynamics-heat-transfer',
  'practice',
  'practice/session',
  'diagnostic',
  'mock',
  'mock/mathematics/active',
  'mock/mathematics/results',
  'mock/physics/active',
  'mock/physics/results',
  'vocabulary',
  'formulas',
  'mental-math',
  'mistakes',
  'progress',
  'bookmarks',
  'settings',
  'admin',
  'more',
  'offline',
];

export async function generatePagesEntrypoints(outDir = resolve('dist')) {
  const indexPath = resolve(outDir, 'index.html');
  await copyFile(indexPath, resolve(outDir, '404.html'));

  for (const route of pagesEntrypoints) {
    const routeDir = resolve(outDir, route);
    if (!routeDir.startsWith(`${resolve(outDir)}${sep}`)) {
      throw new Error(`Unsafe Pages route: ${route}`);
    }
    await mkdir(routeDir, { recursive: true });
    await copyFile(indexPath, resolve(routeDir, 'index.html'));
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  await generatePagesEntrypoints();
}
