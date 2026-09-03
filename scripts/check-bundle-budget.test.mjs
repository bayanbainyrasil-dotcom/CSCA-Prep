import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { BUDGET, checkBundleBudget, eagerAssets } from './check-bundle-budget.mjs';

const HTML = `<!doctype html><html><head>
<link rel="stylesheet" crossorigin href="/assets/app.css">
<link rel="modulepreload" crossorigin href="/assets/shared.js">
<link rel="prefetch" href="/assets/later.js">
<script type="module" crossorigin src="/assets/entry.js"></script>
</head><body></body></html>`;

async function fixture(files) {
  const outDir = await mkdtemp(join(tmpdir(), 'csca-budget-'));
  await mkdir(join(outDir, 'assets'), { recursive: true });
  await writeFile(join(outDir, 'index.html'), HTML, 'utf8');
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(outDir, 'assets', name), content, 'utf8');
  }
  return outDir;
}

const SMALL = { 'entry.js': 'export const a = 1;', 'shared.js': 'export const b = 2;', 'app.css': 'a{color:red}' };

test('counts the entry script, its preloads and the stylesheet, and nothing else', () => {
  const { javascript, css } = eagerAssets(HTML);
  assert.deepEqual(javascript, ['assets/shared.js', 'assets/entry.js']);
  assert.deepEqual(css, ['assets/app.css']);
  assert.ok(!javascript.includes('assets/later.js'), 'a prefetch is not part of the first load');
});

test('passes a small build', async () => {
  const outDir = await fixture(SMALL);
  try {
    const { failures, report } = checkBundleBudget(outDir);
    assert.deepEqual(failures, []);
    assert.ok(report.totals.javascript > 0);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test('fails when a heavy library becomes part of the first load', async () => {
  for (const [marker, library] of [['recharts', 'Recharts'], ['KaTeX', 'KaTeX'], ['@firebase', 'Firebase']]) {
    const outDir = await fixture({ ...SMALL, 'entry.js': `export const from = "${marker}/thing";` });
    try {
      const { failures } = checkBundleBudget(outDir);
      assert.equal(failures.length, 1, `${library} should be reported once`);
      assert.match(failures[0], /first load/);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  }
});

test('ignores the lowercase library names that appear in the lazy-chunk filename map', async () => {
  // The entry chunk lists every dynamic chunk by name, so "react-katex-x.js"
  // and "firebase-y.js" are there without a byte of either library.
  const outDir = await fixture({
    ...SMALL,
    'entry.js': 'const deps = ["assets/react-katex-a1.js", "assets/firebase-b2.js"]; export default deps;',
  });
  try {
    assert.deepEqual(checkBundleBudget(outDir).failures, []);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test('fails when the first load grows past its budget', async () => {
  // Base64 of random bytes, because gzip squeezes any pattern back under the
  // budget and the test would then pass for the wrong reason.
  const padding = randomBytes(BUDGET.javascript + 60_000).toString('base64');
  const outDir = await fixture({ ...SMALL, 'entry.js': `export const padding = "${padding}";` });
  try {
    const { failures } = checkBundleBudget(outDir);
    assert.equal(failures.length, 1);
    assert.match(failures[0], /over the \d+ budget/);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test('refuses to report on a directory with no build in it', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'csca-budget-empty-'));
  try {
    await writeFile(join(outDir, 'index.html'), '<!doctype html><html></html>', 'utf8');
    assert.throws(() => checkBundleBudget(outDir), /has the build run/);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
