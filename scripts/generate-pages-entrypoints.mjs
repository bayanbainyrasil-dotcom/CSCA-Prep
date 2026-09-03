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
