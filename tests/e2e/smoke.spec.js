import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  bootstrapFixture,
  managerHistories,
  standingsFixture
} from '../fixtures/fpl.js';

async function mockStandings(page) {
  await page.route('**/api/standings', async (route) => {
    const managerMetrics = Object.fromEntries(
      standingsFixture.standings.results.map((manager) => {
        const history = managerHistories[manager.entry];
        const current = history.current.at(-1) ?? {};
        const squad = manager.entry === 101
          ? [
            { id: 11, name: 'Raya', team: 'ARS', position: 1, slot: 1, points: 6, multiplier: 1, captain: false, viceCaptain: true },
            { id: 33, name: 'Saka', team: 'ARS', position: 3, slot: 3, points: 16, multiplier: 2, captain: true, viceCaptain: false }
          ]
          : [
            { id: 11, name: 'Raya', team: 'ARS', position: 1, slot: 12, points: 0, multiplier: 0, captain: false, viceCaptain: false },
            { id: 44, name: 'Haaland', team: 'MCI', position: 4, slot: 9, points: 8, multiplier: 1, captain: true, viceCaptain: false }
          ];
        return [manager.entry, {
          month: current.points ?? 0,
          event: current.event ?? null,
          gameweek: current.points ?? null,
          gameweekGross: manager.entry === 101 ? (current.points ?? 0) + 4 : null,
          hitCost: manager.entry === 101 ? 4 : 0,
          chip: manager.entry === 101 ? 'wildcard' : null,
          captain: squad.find(player => player.captain) || null,
          vice: squad.find(player => player.viceCaptain) ? { id: 11, name: 'Raya' } : null,
          yetToPlay: manager.entry === 101 ? 2 : 0,
          picksKnown: true,
          season: current.total_points ?? null,
          seasons: history.past.length,
          careerBestPct: history.past[0]?.rank_percentage ? `${history.past[0].rank_percentage}%` : null,
          careerBestSeason: history.past[0]?.season_name ?? null,
          careerAvgPct: history.past[0]?.rank_percentage ? `${history.past[0].rank_percentage}%` : null,
          squad
        }];
      })
    );

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...standingsFixture,
        meta: {
          fetchedAt: '2025-08-20T12:00:00.000Z',
          leagueId: '113546',
          managerMetrics,
          nextDeadline: {
            event: bootstrapFixture.events[1].id,
            name: bootstrapFixture.events[1].name,
            deadlineTime: bootstrapFixture.events[1].deadline_time
          }
        }
      })
    });
  });
}

test.beforeEach(async ({ page }) => {
  await mockStandings(page);
  await page.goto('/');
});

test('homepage visual baseline matches', async ({ page }) => {
  await expect(page.locator('#live-widget-content .live-row')).toHaveCount(2);
  await expect(page).toHaveScreenshot('homepage.png', {
    fullPage: true,
    animations: 'disabled'
  });
});

test('homepage, historical filters, and deterministic live standings work', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: 'The Abusement Park' })).toBeVisible();
  await expect(page.locator('#history .history-card')).toHaveCount(18);
  await expect(page.locator('#live-widget-content .live-row')).toHaveCount(2);
  await expect(page.locator('#live-widget-content')).toContainText('Alpha FC');

  await page.getByRole('tab', { name: 'Last 5' }).click();
  await expect(page.getByRole('tab', { name: 'Last 5' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#stats-bar')).toContainText('5');

  await page.getByRole('tab', { name: 'Last 10' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('tab', { name: 'Last 10' })).toHaveAttribute('aria-selected', 'true');
});

test('archive dialog opens, handles missing image, closes with Escape, and restores focus', async ({ page }) => {
  const card = page.locator('#history .history-card').last();
  await card.focus();
  await page.keyboard.press('Enter');

  const dialog = page.locator('#lightbox');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#lightbox-error')).toBeVisible();
  await expect(page.locator('#lightbox-close')).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(card).toBeFocused();
});

test('page has no JavaScript exceptions or horizontal overflow', async ({ page }) => {
  const exceptions = [];
  page.on('pageerror', (error) => exceptions.push(error.message));
  await page.reload();
  await expect(page.locator('#live-widget-content .live-row')).toHaveCount(2);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  expect(exceptions).toEqual([]);
});

test('local Cloudflare Pages routing reaches the standings Function', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One route integration check is sufficient.');

  const response = await request.post('/api/standings');
  expect(response.status()).toBe(405);
  expect(response.headers().allow).toBe('GET');
  await expect(response.json()).resolves.toEqual({ error: 'Method not allowed.' });
});

test('GET /api/standings returns the stubbed upstream contract', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One route integration check is sufficient.');

  const response = await request.get('/api/standings');
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.standings.results.map((row) => row.entry)).toEqual([101, 202]);
  expect(body.meta).toMatchObject({
    leagueId: '113546',
    freshness: 'fresh',
    stale: false,
    degraded: false
  });
  expect(body.meta.managerMetrics['101'].season).toBe(100);
  expect(body.meta.managerMetrics['202'].season).toBe(90);
});

test('automated accessibility baseline has no critical or serious violations', async ({ page }, testInfo) => {
  const results = await new AxeBuilder({ page }).analyze();
  const severe = results.violations.filter((violation) =>
    ['critical', 'serious'].includes(violation.impact)
  );
  await testInfo.attach('axe-results', {
    body: JSON.stringify(results.violations, null, 2),
    contentType: 'application/json'
  });

  // Automated checks are a regression gate, not a claim of full WCAG conformance.
  expect(severe).toEqual([]);
});
