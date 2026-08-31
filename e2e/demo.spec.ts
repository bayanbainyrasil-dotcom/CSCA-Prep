import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const key = 'csca-local-session-v2';
    if (window.location.search.includes('fresh=1')) {
      localStorage.removeItem(key);
      return;
    }
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
});

test('dashboard loads with real zero-state metrics and the current day', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening), Nurasyl/i })).toBeVisible();
  await expect(page.getByText(/Day 1 \/ 84/i)).toBeVisible();
  await expect(page.getByText(/Demo progress/i)).toHaveCount(0);
  await expect(page.getByLabel('Internal CSCA readiness score 0 percent')).toBeVisible();
  await expect(page.getByRole('link', { name: /Start today’s session/i })).toHaveAttribute(
    'href',
    '/today',
  );
});

test('lazy search opens and routes to a matching study topic', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Search interaction is covered once on desktop.');
  await page.goto('/');

  await page.getByRole('button', { name: 'Search Ctrl K' }).click();
  const search = page.getByPlaceholder('Try “Newton” or “magnitude”');
  await expect(search).toBeVisible();
  await search.fill('Newton');
  await page.getByRole('option', { name: 'Newton’s laws' }).click();

  await expect(page).toHaveURL(/\/physics\?topic=newton-laws$/);
  await expect(page.getByRole('link', { name: /Newton['’]s Laws/i })).toBeVisible();
});

test('practice preserves the understand-answer-confidence-feedback sequence', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Interaction flow is covered once on desktop.');
  await page.goto('/practice/session?mode=practice');
  await page.waitForLoadState('networkidle');

  const unlock = page.getByRole('button', { name: /Unlock answer choices/i });
  await expect(unlock).toBeDisabled();

  for (const legend of [
    'What is given?',
    'What are you asked to find?',
    'Which topic is this?',
    'Which relationship could help?',
  ]) {
    await page.getByRole('group', { name: legend }).getByRole('button').first().click();
  }

  await expect(unlock).toBeEnabled();
  await unlock.click();
  await page.locator('main button').filter({ hasText: /^[A-D]\./ }).first().click();
  await expect(page.getByText('How sure were you?')).toBeVisible();
  await page.getByRole('button', { name: 'Sure', exact: true }).click();

  await expect(page.getByRole('heading', { name: /Correct reasoning|lost point/i })).toBeVisible();
  await expect(page.getByText(/Short solution:/i)).toBeVisible();
  if (await page.getByRole('button', { name: 'Careless mistake' }).isVisible()) {
    await page.getByRole('button', { name: 'Careless mistake' }).click();
  }
  await expect(page.getByRole('button', { name: /Next question/i })).toBeEnabled();
});

test('an active mock restores its answer and flag after a reload', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Recovery is covered once on desktop.');
  await page.goto('/mock/physics/active');
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: /Start exam/i }).click();
  await expect(page.getByText('Question 1 of 48')).toBeVisible();
  await page.locator('main button').filter({ hasText: /^[A-D]\./ }).first().click();
  await page.getByRole('button', { name: 'Flag', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Flagged', exact: true })).toBeVisible();

  await page.reload();
  await page.waitForLoadState('networkidle');

  await expect(page.getByText('Question 1 of 48')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Flagged', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Question 1, answered, flagged' })).toBeVisible();
});

test('on-device mode does not expose administrator controls', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Authorization route is covered once on desktop.');
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('heading', { name: 'Cloud administration is unavailable' }))
    .toBeVisible();
  await expect(page.getByText('No client-side password or administrator bypass is available.'))
    .toBeVisible();
  await expect(page.getByLabel('Initial setup code')).toHaveCount(0);
});

test('first run asks for the real exam date and keeps it after reload', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone', 'The first-run phone flow is covered once on iPhone.');
  await page.goto('/onboarding?fresh=1');
  const dateInput = page.getByLabel('Target CSCA date');
  await expect(dateInput).toHaveValue('');
  const target = await page.evaluate(() => {
    const date = new Date();
    date.setDate(date.getDate() + 45);
    return date.toISOString().slice(0, 10);
  });
  await dateInput.fill(target);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Take diagnostic test' }).click();
  await expect(page).toHaveURL(/\/diagnostic$/);

  await page.goto('/settings');
  await expect(page.getByLabel('Target CSCA date')).toHaveValue(target);
  await page.reload();
  await expect(page.getByLabel('Target CSCA date')).toHaveValue(target);
  const updatedTarget = await page.evaluate(() => {
    const date = new Date();
    date.setDate(date.getDate() + 60);
    return date.toISOString().slice(0, 10);
  });
  await page.getByLabel('Target CSCA date').fill(updatedTarget);
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByText('Settings saved')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Target CSCA date')).toHaveValue(updatedTarget);
});

test('mobile primary navigation reaches practice without opening a menu', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone', 'This scenario targets the phone navigation.');
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const navigation = page.getByRole('navigation', { name: 'Mobile navigation' });
  await expect(navigation).toBeVisible();
  await navigation.getByRole('link', { name: 'Start practice' }).click();

  await expect(page).toHaveURL(/\/practice$/);
  await expect(page.getByRole('heading', { name: 'Train the exact failure point.' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Start recommended/i })).toBeVisible();
});

test('light and dark appearance choices apply immediately and survive reload', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Theme persistence is covered once on desktop.');
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);

  await page.getByRole('button', { name: 'Light', exact: true }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});

test('foundation diagnostic opens a deterministic 32-question baseline', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Diagnostic generation is covered once on desktop.');
  await page.goto('/diagnostic');
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: 'Start diagnostic', exact: true }).first().click();
  await expect(page.getByText('Question 1 / 32')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Question 32' })).toBeVisible();
});

test('core study routes never create horizontal page overflow', async ({ page }) => {
  for (const path of ['/', '/today', '/roadmap', '/physics', '/practice', '/progress', '/settings']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} overflowed the viewport`).toBeLessThanOrEqual(1);
  }
});

test('iPad landscape switches to the wide learning layout without clipping', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'ipad', 'This scenario targets iPad landscape.');
  await page.setViewportSize({ width: 1194, height: 834 });
  await page.goto('/lesson/lesson-physics-constant-speed-demo');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await expect(page.getByText('My notes')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('installed app shell reopens while offline after one warm load', async ({
  context,
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'PWA offline recovery is covered once on desktop.');
  await page.goto('/today');
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForLoadState('networkidle');

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /One session|Building your next session/i })).toBeVisible();
  await context.setOffline(false);
});

test('slow responses keep a clear loading-to-ready path', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Slow-network behavior is covered once on desktop.');
  await page.route('**/*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 120));
    await route.continue();
  });
  await page.goto('/practice');
  await expect(page.getByRole('heading', { name: 'Train the exact failure point.' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('link', { name: /Start recommended/i })).toBeEnabled();
});
