import { expect, test } from '@playwright/test';
import { DRAFT_QUESTION_SEED } from '../functions/src/public-question-seed';

/**
 * The end-to-end version of the answer-key promise: whatever the build produced
 * and whatever the browser actually downloaded, no correct answer and no worked
 * solution is in it. This runs against the real preview server, so it catches a
 * leak that only appears after bundling.
 */

const SECRETS = DRAFT_QUESTION_SEED.flatMap((item) => [item.solution, item.shortSolution]).filter(
  (text) => text.trim().length > 20,
);

test('nothing the browser downloads carries a seed answer or solution', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser is enough to inspect what the build ships.');
  expect(SECRETS.length).toBeGreaterThan(10);

  const downloaded: { url: string; body: string }[] = [];
  page.on('response', (response) => {
    const url = response.url();
    if (!/\.(js|css|json|html)(\?|$)/.test(url) && !url.endsWith('/')) return;
    void response
      .text()
      .then((body) => downloaded.push({ url, body }))
      .catch(() => undefined);
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.goto('/practice');
  await page.waitForLoadState('networkidle');

  expect(downloaded.length).toBeGreaterThan(3);
  const offenders: string[] = [];
  for (const asset of downloaded) {
    for (const secret of SECRETS) {
      if (asset.body.includes(secret)) offenders.push(`${asset.url}: ${secret.slice(0, 40)}…`);
    }
  }
  expect(offenders).toEqual([]);
});

test('the service worker stores no answer key after a warm load', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The cache contract is checked once.');
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.reload();
  await page.waitForLoadState('networkidle');

  const cached = await page.evaluate(async () => {
    if (!('caches' in window)) return [] as string[];
    const bodies: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        const response = await cache.match(request);
        if (response) bodies.push(await response.text());
      }
    }
    return bodies;
  });

  for (const body of cached) {
    for (const secret of SECRETS) {
      expect(body, secret.slice(0, 40)).not.toContain(secret);
    }
  }
  await context.close();
});

test('the administrator import panel is unreachable without a trusted deployment', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Authorization is covered once on desktop.');
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('heading', { name: 'Import in one step' })).toHaveCount(0);
  await expect(page.getByLabel(/Question file \(JSON/)).toHaveCount(0);
});
