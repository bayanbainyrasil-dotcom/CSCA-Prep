import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { generatePagesEntrypoints, pagesEntrypoints } from './generate-pages-entrypoints.mjs';

test('generates a 200-capable Pages entrypoint for every static application route', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'csca-pages-'));
  const marker = '<!doctype html><title>CSCA Prep</title>';

  try {
    await writeFile(join(outDir, 'index.html'), marker, 'utf8');
    await generatePagesEntrypoints(outDir);

    assert.equal(await readFile(join(outDir, '404.html'), 'utf8'), marker);
    assert.ok(pagesEntrypoints.includes('onboarding'));
    assert.ok(pagesEntrypoints.includes('lesson/lesson-physics-constant-speed-demo'));
    assert.ok(pagesEntrypoints.includes('practice/session'));
    assert.ok(pagesEntrypoints.includes('mock/physics/results'));

    for (const route of pagesEntrypoints) {
      assert.equal(await readFile(join(outDir, route, 'index.html'), 'utf8'), marker);
    }
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
