import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
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

/** The app shell only renders for a signed-in learner, so seed the local session. */
async function seedLocalSession(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const key = 'csca-local-session-v2';
    if (localStorage.getItem(key)) return;
    const now = new Date();
    const target = new Date(now.getTime() + 84 * 86_400_000).toISOString().slice(0, 10);
    localStorage.setItem(key, JSON.stringify({
      uid: 'demo-local-user',
      name: 'Nurasyl',
      email: '',
      role: 'user',
      onboardingCompleted: true,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      targetDate: target,
      preferredLanguage: 'en-ru',
      profileVersion: 1,
      settings: {},
      createdAt: now.toISOString(),
      lastActiveAt: now.toISOString(),
    }));
  });
}

test('a keyboard user reaches main content with one keystroke', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Focus order is checked once.');
  await seedLocalSession(page);
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: /Skip to main content/i });
  await expect(skip).toBeFocused();
  // Hidden until focused, then visible: the link must not clutter the page.
  await expect(skip).toBeInViewport();

  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main-content$/);
  await expect(page.locator('main#main-content')).toBeVisible();
});
