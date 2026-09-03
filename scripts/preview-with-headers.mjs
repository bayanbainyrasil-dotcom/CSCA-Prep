#!/usr/bin/env node
/**
 * Serves `dist/` locally with the headers and rewrites from `vercel.json`.
 *
 * Vercel applies that file at the edge, so `pnpm preview` does not show what a
 * browser will actually receive. This does, which makes it possible to check the
 * CSP against the real app before spending a deployment on finding out.
 *
 * It is also what `scripts/verify-deployment.mjs` is tested against, so the
 * verifier is known to work before it is pointed at a live domain.
 *
 *   node scripts/preview-with-headers.mjs [port]
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { argv } from 'node:process';

const port = Number(argv[2] ?? 4180);
const distDir = resolve(new URL('../dist', import.meta.url).pathname);
const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** Turns a Vercel `source` pattern into a matcher for the paths we serve. */
function matches(source, pathname) {
  const pattern = `^${source.replace(/\//g, '\\/').replace('(.*)', '.*')}$`;
  return new RegExp(pattern).test(pathname);
}

function headersFor(pathname) {
  const applied = {};
  for (const rule of config.headers ?? []) {
    if (!matches(rule.source, pathname)) continue;
    for (const { key, value } of rule.headers) applied[key] = value;
  }
  return applied;
}

createServer((request, response) => {
  const pathname = new URL(request.url, `http://localhost:${port}`).pathname;
  let filePath = join(distDir, pathname === '/' ? 'index.html' : pathname);

  // The single rewrite in vercel.json sends anything without a file to the shell.
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(distDir, 'index.html');
  }

  const body = readFileSync(filePath);
  const headers = { 'Content-Type': TYPES[extname(filePath)] ?? 'application/octet-stream', ...headersFor(pathname) };
  response.writeHead(200, headers);
  response.end(body);
}).listen(port, '127.0.0.1', () => {
  console.log(`Serving dist/ with vercel.json headers on http://127.0.0.1:${port}`);
});
