#!/usr/bin/env node
/**
 * Fails if the built bundle contains an answer key or a worked solution.
 *
 * The seeds live in `functions/src/` precisely so they cannot be reached from
 * application code, but an accidental import would be silent — the app would
 * still build and still work, while shipping every answer to every learner.
 * This turns that mistake into a failed check.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = process.argv[2] ?? 'dist';

function readAll(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) files.push(...readAll(path));
    else if (/\.(js|css|html|json|map)$/.test(entry)) files.push(path);
  }
  return files;
}

let seed;
try {
  const module = await import('../functions/src/public-question-seed.ts');
  seed = module.DRAFT_QUESTION_SEED;
} catch {
  // Running against plain Node without a TypeScript loader: fall back to a
  // textual extraction of the solution strings.
  const source = readFileSync('functions/src/public-question-seed.ts', 'utf8');
  seed = [...source.matchAll(/shortSolution:\s*'([^']{10,})'/g)].map((match) => ({
    id: 'unknown',
    shortSolution: match[1],
    solution: match[1],
  }));
}

const needles = seed.flatMap((question) => [question.solution, question.shortSolution]).filter(Boolean);

const files = readAll(DIST);
const leaks = [];
for (const file of files) {
  const contents = readFileSync(file, 'utf8');
  for (const needle of needles) {
    if (contents.includes(needle)) leaks.push({ file, needle: needle.slice(0, 60) });
  }
}

if (leaks.length > 0) {
  console.error(`Answer keys or solutions found in the bundle (${leaks.length}):`);
  for (const leak of leaks.slice(0, 20)) console.error(`  ${leak.file}: ${leak.needle}…`);
  process.exit(1);
}

console.log(`Bundle check passed: ${files.length} files scanned, ${needles.length} solution strings absent.`);
