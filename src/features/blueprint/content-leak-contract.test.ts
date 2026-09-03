import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import importPanelSource from './import-panel.tsx?raw';
import blueprintServiceSource from './blueprint-service.ts?raw';
import reviewQueueSource from './review-queue.tsx?raw';
import viteConfigSource from '../../../vite.config.ts?raw';

/**
 * Where an answer key could leak, and the checks that say it does not:
 * the shipped bundle, the service worker cache, browser storage, and logs.
 *
 * `scripts/check-bundle-secrets.mjs` scans the built `dist/` for the same
 * strings; this file catches the import that would put them there in the first
 * place, which is the failure a reviewer can actually act on.
 */

const SEED_MODULES = ['public-question-seed', 'blueprint-seed'];

/**
 * The only two files allowed to name a seed. They re-export the server's copy so
 * the tests have a stable path, and nothing the browser loads may import them —
 * which is the assertion below, and the reason the seed cannot reach a bundle.
 */
const SEED_REEXPORTS = ['src/data/blueprint-cells.ts', 'src/data/draft-questions.ts'];

/** Comments describe the rules; only executable code can break them. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

function sourceFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      found.push(...sourceFiles(path));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue;
    if (/\.(test|spec)\.tsx?$/.test(entry)) continue;
    if (path.includes(`${join('src', 'test')}`)) continue;
    found.push(path);
  }
  return found;
}

const SHIPPED_SOURCES = sourceFiles('src');

describe('the shipped application', () => {
  it('has sources to check', () => {
    expect(SHIPPED_SOURCES.length).toBeGreaterThan(50);
  });

  it('names a question seed in exactly two re-export files and nowhere else', () => {
    const offenders: string[] = [];
    for (const path of SHIPPED_SOURCES) {
      if (SEED_REEXPORTS.includes(path.split('\\').join('/'))) continue;
      const source = readFileSync(path, 'utf8');
      for (const match of source.matchAll(/(?:import|from)\s+['"]([^'"]+)['"]/g)) {
        const specifier = match[1] ?? '';
        if (SEED_MODULES.some((seed) => specifier.includes(seed))) offenders.push(`${path} -> ${specifier}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('loads neither re-export from anything the browser runs, so no answer key can reach the bundle', () => {
    const offenders: string[] = [];
    for (const path of SHIPPED_SOURCES) {
      const normalised = path.split('\\').join('/');
      if (SEED_REEXPORTS.includes(normalised)) continue;
      const source = readFileSync(path, 'utf8');
      for (const match of source.matchAll(/(?:import|from)\s+['"]([^'"]+)['"]/g)) {
        const specifier = match[1] ?? '';
        if (/(?:^|\/)(?:blueprint-cells|draft-questions)$/.test(specifier)) offenders.push(`${normalised} -> ${specifier}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  /**
   * `blueprint-summary` is on the allow-list above because it is a count and
   * nothing else. That is only true while it stays that way, so it is checked
   * rather than trusted: any question text, option, answer or lesson body added
   * to it would show up as a long string literal here.
   */
  it('keeps the browser-importable blueprint summary free of content', () => {
    const source = withoutComments(readFileSync('functions/src/blueprint-summary.ts', 'utf8'));
    const literals = [...source.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)].map((match) => match[2] ?? '');
    expect(literals.filter((literal) => literal.length > 40)).toEqual([]);
    for (const forbidden of ['correctAnswer', 'solution', 'explanation', 'question:', 'options']) {
      expect(source, forbidden).not.toContain(forbidden);
    }
  });

  it('never imports anything from the trusted backend except its shared contracts', () => {
    const allowed = /functions\/src\/(schemas|blueprint-engine|mock-engine|import-engine|seed-versions|blueprint-summary)/;
    const offenders: string[] = [];
    for (const path of SHIPPED_SOURCES) {
      if (SEED_REEXPORTS.includes(path.split('\\').join('/'))) continue;
      const source = readFileSync(path, 'utf8');
      for (const match of source.matchAll(/(?:import|from)\s+['"]([^'"]*functions\/src\/[^'"]+)['"]/g)) {
        const specifier = match[1] ?? '';
        if (!allowed.test(specifier)) offenders.push(`${path} -> ${specifier}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('the admin import surface', () => {
  const sources = {
    'import-panel.tsx': withoutComments(importPanelSource),
    'blueprint-service.ts': withoutComments(blueprintServiceSource),
    'review-queue.tsx': withoutComments(reviewQueueSource),
  };

  for (const [name, source] of Object.entries(sources)) {
    it(`${name} writes nothing to browser storage or a cache`, () => {
      for (const api of ['localStorage', 'sessionStorage', 'indexedDB', 'caches.', 'document.cookie', 'navigator.storage']) {
        expect(source, `${name} uses ${api}`).not.toContain(api);
      }
    });

    it(`${name} logs nothing`, () => {
      // A key in a console line is as leaked as one in a bundle, and browser
      // consoles are collected by error reporters.
      for (const call of ['console.log', 'console.info', 'console.debug', 'console.warn', 'console.error', 'console.table']) {
        expect(source, `${name} calls ${call}`).not.toContain(call);
      }
    });

    it(`${name} sends nothing to analytics`, () => {
      for (const sink of ['track(', 'analytics', 'gtag', 'dataLayer', 'captureException', 'Sentry']) {
        expect(source, `${name} references ${sink}`).not.toContain(sink);
      }
    });
  }

  it('holds the chosen file in a ref that is cleared once it is applied', () => {
    expect(importPanelSource).toContain('filePayloadRef');
    expect(importPanelSource).toContain('filePayloadRef.current = null');
    // The parsed file is never put into React state, which a dev-tools export would capture.
    expect(importPanelSource).not.toMatch(/useState[^\n]*payload/i);
  });
});

describe('the service worker', () => {
  it('precaches only the shell, never a script or a data response', () => {
    expect(viteConfigSource).toContain("globPatterns: ['**/*.{css,html,ico,png,svg}']");
    expect(viteConfigSource).not.toContain('**/*.{js');
    expect(viteConfigSource).not.toContain('json');
  });

  it('caches at runtime only by request destination, so a callable response is never stored', () => {
    // Every runtime rule is keyed on `request.destination`; a `fetch()` to a
    // callable has an empty destination and matches none of them.
    expect(viteConfigSource).toContain("['script', 'style', 'font'].includes(request.destination)");
    expect(viteConfigSource).toContain("request.destination === 'image'");
    expect(viteConfigSource).toContain("handler: 'NetworkOnly'");
  });
});
