import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * What a learner downloads before the first screen appears, and what must never
 * be part of it.
 *
 * Two different failures are caught here. The first is drift: the initial
 * payload creeping up a few kilobytes per feature until a phone on a slow
 * connection gives up. The second is worse and quieter — a chart, a maths
 * typesetter or the whole Firebase SDK becoming a static import of the shell,
 * so every learner pays for a library that three routes use. That one does not
 * announce itself; the build succeeds and the bundle simply doubles.
 *
 * "Eager" means what `index.html` itself asks for: the entry script, the
 * modules it preloads, and the stylesheet. Anything reached through a dynamic
 * import is not counted, because it is not downloaded until a route needs it.
 */

/** Budgets are gzipped bytes, the unit a browser actually transfers. */
export const BUDGET = {
  javascript: 210_000,
  css: 24_000,
};

/**
 * Markers chosen to be case-sensitive and unambiguous, because the entry chunk
 * contains a map of every lazy chunk's *filename*: lowercase "katex" and
 * "firebase" appear there without a byte of either library being present.
 * `KaTeX` and `@firebase` appear only inside the libraries themselves.
 */
export const FORBIDDEN_IN_FIRST_LOAD = [
  { marker: 'recharts', library: 'Recharts' },
  { marker: 'KaTeX', library: 'KaTeX' },
  { marker: '@firebase', library: 'the Firebase SDK' },
];

/** The assets `index.html` asks for directly, in document order. */
export function eagerAssets(html) {
  const javascript = [];
  const css = [];
  for (const tag of html.match(/<(?:script|link)\b[^>]*>/g) ?? []) {
    const href = /(?:src|href)="([^"]+)"/.exec(tag)?.[1];
    if (!href || !href.includes('/assets/')) continue;
    const path = href.replace(/^.*\/assets\//, 'assets/');
    if (path.endsWith('.js') && (tag.startsWith('<script') || /modulepreload/.test(tag))) {
      if (!javascript.includes(path)) javascript.push(path);
    }
    if (path.endsWith('.css') && /stylesheet/.test(tag) && !css.includes(path)) css.push(path);
  }
  return { javascript, css };
}

function gzippedSize(bytes) {
  return gzipSync(bytes, { level: 9 }).byteLength;
}

export function checkBundleBudget(outDir = resolve('dist')) {
  const root = resolve(outDir);
  const html = readFileSync(resolve(root, 'index.html'), 'utf8');
  const { javascript, css } = eagerAssets(html);
  if (javascript.length === 0) throw new Error('No eager JavaScript found: has the build run?');

  const failures = [];
  const report = { javascript: [], css: [], totals: { javascript: 0, css: 0 } };

  for (const [kind, files] of [['javascript', javascript], ['css', css]]) {
    for (const file of files) {
      const path = resolve(root, file);
      if (!path.startsWith(`${root}${sep}`)) throw new Error(`Unsafe asset path: ${file}`);
      const bytes = readFileSync(path);
      const size = gzippedSize(bytes);
      report[kind].push({ file, size });
      report.totals[kind] += size;

      if (kind !== 'javascript') continue;
      const source = bytes.toString('utf8');
      for (const { marker, library } of FORBIDDEN_IN_FIRST_LOAD) {
        if (source.includes(marker)) {
          failures.push(`${library} is in the first load (${file} contains "${marker}").`);
        }
      }
    }
    if (report.totals[kind] > BUDGET[kind]) {
      failures.push(
        `Eager ${kind} is ${report.totals[kind]} gzipped bytes, over the ${BUDGET[kind]} budget.`,
      );
    }
  }

  return { report, failures };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const { report, failures } = checkBundleBudget();
  for (const kind of ['javascript', 'css']) {
    for (const { file, size } of report[kind]) {
      process.stdout.write(`${String(size).padStart(8)} gz  ${file}\n`);
    }
  }
  process.stdout.write(
    `\nFirst load: ${report.totals.javascript} gz JavaScript (budget ${BUDGET.javascript}), ` +
      `${report.totals.css} gz CSS (budget ${BUDGET.css}).\n`,
  );
  if (failures.length > 0) {
    for (const failure of failures) process.stderr.write(`FAIL: ${failure}\n`);
    process.exit(1);
  }
  process.stdout.write('Bundle budget passed.\n');
}
