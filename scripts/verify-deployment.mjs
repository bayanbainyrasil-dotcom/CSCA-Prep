#!/usr/bin/env node
/**
 * Post-deployment verification.
 *
 * Reads `vercel.json` as the source of truth and checks that the deployed origin
 * actually serves what it promises. The point is that a header present in the
 * config proves nothing: a rewrite rule, a proxy or a platform default can drop
 * it, and the only way to know is to ask the running site.
 *
 * Usage:
 *   node scripts/verify-deployment.mjs https://your-domain.example
 *   node scripts/verify-deployment.mjs https://your-domain.example \
 *     --callable https://asia-east1-<project>.cloudfunctions.net/startMockExam
 *
 * Exits non-zero if any check fails, so it can gate a release.
 */
import { readFileSync } from 'node:fs';
import { argv, exit } from 'node:process';

const args = argv.slice(2);
const baseUrl = args.find((value) => value.startsWith('http'));
const callableIndex = args.indexOf('--callable');
const callableUrl = callableIndex === -1 ? null : args[callableIndex + 1];

if (!baseUrl) {
  console.error('Usage: node scripts/verify-deployment.mjs <https://origin> [--callable <url>]');
  exit(2);
}

const origin = baseUrl.replace(/\/$/, '');
const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
}

async function head(path) {
  const response = await fetch(`${origin}${path}`, { redirect: 'follow' });
  // Some CDNs omit headers on HEAD, so a GET is used and the body discarded.
  await response.arrayBuffer().catch(() => undefined);
  return response;
}

/** Every header rule in vercel.json, checked against what is actually served. */
async function checkHeaderRules() {
  for (const rule of config.headers ?? []) {
    // "/(.*)" applies to every path; a literal source is fetched directly.
    const path = rule.source === '/(.*)' ? '/' : rule.source.replace('/(.*)', '/');
    let response;
    try {
      response = await head(path);
    } catch (cause) {
      record(`headers ${rule.source}`, false, `request failed: ${String(cause)}`);
      continue;
    }
    for (const { key, value } of rule.headers) {
      const served = response.headers.get(key);
      if (served === null) {
        record(`${key} on ${rule.source}`, false, 'header absent');
        continue;
      }
      const normalise = (text) => text.replace(/\s+/g, ' ').trim();
      const match = normalise(served) === normalise(value);
      record(`${key} on ${rule.source}`, match, match ? 'exact match' : `served: ${served.slice(0, 90)}…`);
    }
  }
}

/** A deep route must return the app shell, not a 404. */
async function checkSpaRewrite() {
  for (const path of ['/', '/today', '/practice', '/mathematics', '/settings']) {
    try {
      const response = await head(path);
      const type = response.headers.get('content-type') ?? '';
      record(`route ${path}`, response.status === 200 && type.includes('text/html'), `${response.status} ${type}`);
    } catch (cause) {
      record(`route ${path}`, false, String(cause));
    }
  }
}

async function checkPwaAssets() {
  for (const path of ['/manifest.webmanifest', '/sw.js']) {
    try {
      const response = await head(path);
      record(`asset ${path}`, response.status === 200, String(response.status));
    } catch (cause) {
      record(`asset ${path}`, false, String(cause));
    }
  }
}

/**
 * An unattested callable must be refused. A 200 here means App Check is not
 * enforcing, which is the single most consequential misconfiguration possible:
 * it would let anyone call the grading and mock endpoints directly.
 */
async function checkAppCheckEnforcement() {
  if (!callableUrl) {
    record('App Check enforcement', false, 'not checked — pass --callable <url>');
    return;
  }
  try {
    const response = await fetch(callableUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: {} }),
    });
    const body = await response.text();
    const refused = response.status === 401 || response.status === 403;
    record('App Check enforcement', refused, `${response.status} ${body.slice(0, 120)}`);
  } catch (cause) {
    record('App Check enforcement', false, String(cause));
  }
}

/**
 * No answer key may appear in anything the browser downloads.
 *
 * The check looks for the seed's actual solution text, not for the property
 * names `correctAnswer` or `shortSolution`: those appear legitimately in the
 * labelled local-demo grading path, and matching on them would report a leak
 * that is not one. This mirrors `scripts/check-bundle-secrets.mjs`, which runs
 * the same comparison over `dist/` in CI.
 */
function seedSolutionStrings() {
  const source = readFileSync(new URL('../functions/src/public-question-seed.ts', import.meta.url), 'utf8');
  const found = [];
  for (const field of ['solution', 'shortSolution']) {
    const pattern = new RegExp(`\\b${field}:\\s*(?:'((?:[^'\\\\]|\\\\.)*)'|"((?:[^"\\\\]|\\\\.)*)")`, 'g');
    for (const match of source.matchAll(pattern)) {
      const text = (match[1] ?? match[2] ?? '').replace(/\\'/g, "'").replace(/\\"/g, '"');
      if (text.length >= 25) found.push(text);
    }
  }
  return [...new Set(found)];
}

async function checkNoAnswerKeysServed() {
  const secrets = seedSolutionStrings();
  if (secrets.length === 0) {
    record('no answer keys in served JS', false, 'could not read the seed to compare against');
    return;
  }
  try {
    const index = await (await fetch(origin)).text();
    const scripts = [...index.matchAll(/src="([^"]+\.js)"/g)].map((match) => match[1]);
    let scanned = 0;
    for (const src of scripts.slice(0, 20)) {
      const url = src.startsWith('http') ? src : `${origin}${src.startsWith('/') ? '' : '/'}${src}`;
      const body = await (await fetch(url)).text();
      scanned += 1;
      const leaked = secrets.find((secret) => body.includes(secret));
      if (leaked) {
        record('no answer keys in served JS', false, `${src} contains: ${leaked.slice(0, 50)}…`);
        return;
      }
    }
    record('no answer keys in served JS', scanned > 0, `${scanned} entry scripts scanned, ${secrets.length} solution strings absent`);
  } catch (cause) {
    record('no answer keys in served JS', false, String(cause));
  }
}

await checkHeaderRules();
await checkSpaRewrite();
await checkPwaAssets();
await checkNoAnswerKeysServed();
await checkAppCheckEnforcement();

const failed = results.filter((result) => !result.ok);
for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? ` — ${result.detail}` : ''}`);
}
console.log(`\n${results.length - failed.length}/${results.length} checks passed against ${origin}`);
exit(failed.length === 0 ? 0 : 1);
