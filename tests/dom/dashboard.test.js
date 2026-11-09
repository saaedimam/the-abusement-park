import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadHistoricalApp } from '../helpers/load-historical-app.js';

const html = readFileSync(new URL('../../public/index.html', import.meta.url), 'utf8');

function setupDom(fetchImpl = vi.fn()) {
  const dom = new JSDOM(html, { url: 'https://example.test/' });
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  return { dom, app: loadHistoricalApp({ document: dom.window.document, fetch: fetchImpl }) };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('historical dashboard DOM behavior', () => {
  it('renders the podium, leaderboard, statistics, and archive cards', () => {
    const { app } = setupDom();
    app.updateView('all', document.querySelector('#tab-all'));
    app.buildHistory();

    expect(document.querySelectorAll('#podium .podium-card')).toHaveLength(3);
    expect(document.querySelectorAll('#standings .row')).toHaveLength(9);
    expect(document.querySelectorAll('#stats-bar .stat')).toHaveLength(6);
    expect(document.querySelectorAll('#history .history-card')).toHaveLength(18);
    expect(document.querySelector('#stats-bar').textContent).toContain('18');
    const mostTitles = document.querySelector('.stat-most-titles');
    expect(mostTitles.querySelector('.stat-val').textContent).toBe('5');
    expect(mostTitles.textContent).toContain('Mac Alvi');
    expect(mostTitles.textContent).toContain('Abrar Siddique');
    expect(document.querySelector('.stat-old-guards').textContent).toContain('The OGs');
    expect(document.querySelector('.stat-named .stat-val').textContent).toBe('Abrar Siddique');
    const anjishu = [...document.querySelectorAll('#history .history-card')]
      .find((card) => card.getAttribute('aria-label').includes('Anjishu Bhattacharjee'));
    expect(anjishu).toBeTruthy();
    expect(anjishu.querySelector('.history-winner').textContent).toBe('Anjishu');
    expect(document.querySelector('.history-card').getAttribute('aria-label'))
      .toContain('Abrar Siddique');
  });

  it('keeps selected season-filter state synchronized with the panel', () => {
    const { app } = setupDom();
    app.updateView('last5', document.querySelector('#tab-last5'));

    expect(document.querySelector('#tab-last5').getAttribute('aria-selected')).toBe('true');
    expect(document.querySelector('#tab-last5').classList.contains('active')).toBe(true);
    expect(document.querySelector('#tab-all').getAttribute('aria-selected')).toBe('false');
    expect(document.querySelector('#standings-panel').getAttribute('aria-labelledby')).toBe('tab-last5');
  });

  it('shows the known-missing screenshot fallback without requesting the file', () => {
    const { app } = setupDom();
    app.updateView('all', document.querySelector('#tab-all'));
    app.buildHistory();
    const card = document.querySelector('.history-card');

    app.openLightboxAt(0);
    const image = document.querySelector('#lightbox-img');

    expect(card.getAttribute('role')).toBe('button');
    expect(image.hasAttribute('src')).toBe(false);
    expect(image.hidden).toBe(true);
    expect(document.querySelector('#lightbox-error').hidden).toBe(false);
    expect(document.querySelector('#lightbox-error').textContent)
      .toContain('Screenshot not available');
  });

  it('uses the image error handler when an unlisted screenshot fails to load', () => {
    const { app } = setupDom();
    app.seasons[1].img = 'images/not-in-the-archive.png';
    app.openLightboxAt(1);
    const image = document.querySelector('#lightbox-img');
    expect(image.getAttribute('src')).toBe('images/not-in-the-archive.png');
    image.onerror();
    expect(image.hidden).toBe(true);
    expect(document.querySelector('#lightbox-error').hidden).toBe(false);
  });
});

describe('live standings DOM behavior', () => {
  it('renders profile links, metrics, and expand/collapse state', () => {
    const { app } = setupDom();
    const container = document.querySelector('#live-widget-content');
    const rows = Array.from({ length: 7 }, (_, index) => ({
      rank: index + 1,
      lastRank: index + 2,
      teamName: `Team ${index + 1}`,
      playerName: `Manager ${index + 1}`,
      entry: 100 + index,
      month: 10 + index,
      gameweek: 5 + index,
      season: 100 - index
    }));

    app.renderLiveStandings(container, rows);
    expect(container.querySelectorAll('.live-row')).toHaveLength(5);
    expect(container.querySelector('[data-live-toggle]').getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('a').href).toBe('https://fantasy.premierleague.com/entry/100/history');
    expect(container.querySelector('.live-identity')).not.toBeNull();
    expect(container.querySelector('.live-performance')).not.toBeNull();
    expect(container.querySelector('.live-actions')).not.toBeNull();
    expect(container.querySelector('.live-trend svg')).not.toBeNull();

    container.querySelector('[data-live-toggle]').click();
    expect(container.querySelectorAll('.live-row')).toHaveLength(7);
    expect(container.querySelector('[data-live-toggle]').getAttribute('aria-expanded')).toBe('true');
  });

  it('expands a manager row into a formation with player scores', () => {
    const { app } = setupDom();
    const container = document.createElement('div');
    const squad = [
      { id: 1, name: 'Keeper', team: 'ARS', position: 1, slot: 1, points: 6, multiplier: 1 },
      { id: 2, name: 'Defender', team: 'ARS', position: 2, slot: 2, points: 16, multiplier: 2, captain: true },
      { id: 3, name: 'Midfielder', team: 'MCI', position: 3, slot: 6, points: 4, multiplier: 1 },
      { id: 4, name: 'Forward', team: 'MCI', position: 4, slot: 9, points: 2, multiplier: 1 },
      { id: 5, name: 'Benched', team: 'CHE', position: 3, slot: 12, points: 0, multiplier: 0 }
    ];

    app.renderLiveStandings(container, [{
      entry: 100, playerName: 'Test Manager', teamName: 'Test FC', rank: 1, lastRank: 1,
      month: 20, gameweek: 20, season: 100, squad
    }]);

    const trigger = container.querySelector('[data-squad-toggle]');
    expect(trigger).not.toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('.live-squad')).toBeNull();

    trigger.click();
    expect(container.querySelector('[data-squad-toggle]').getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelectorAll('.live-player')).toHaveLength(5);
    expect(container.querySelector('.live-player-captain').textContent).toContain('16');
    expect(container.querySelector('.live-squad-bench').textContent).toContain('Benched');
  });

  it('labels projected outgoing and incoming players', () => {
    const { app } = setupDom();
    const container = document.createElement('div');
    const squad = [
      { id: 1, name: 'Missing', team: 'ARS', position: 2, slot: 2, points: 0, multiplier: 0, projectedOut: true },
      { id: 2, name: 'First Sub', team: 'MCI', position: 3, slot: 12, points: 5, multiplier: 1, projectedIn: true, replaces: 1 }
    ];

    app.renderLiveStandings(container, [{
      entry: 100, playerName: 'Test Manager', teamName: 'Test FC', rank: 1, lastRank: 1,
      month: 20, gameweek: 20, season: 100, squad
    }]);
    container.querySelector('[data-squad-toggle]').click();

    expect(container.querySelector('.live-player-sub-out').textContent).toContain('Missing');
    expect(container.querySelector('.live-player-sub-out').textContent).toContain('OUT');
    expect(container.querySelector('.live-player-sub-out').closest('.live-squad-bench')).not.toBeNull();
    expect(container.querySelector('.live-player-sub-in').textContent).toContain('First Sub');
    expect(container.querySelector('.live-player-sub-in').textContent).toContain('IN');
    expect(container.querySelector('.live-player-sub-in').closest('.live-squad-pitch')).not.toBeNull();
    expect(container.querySelector('.live-projected-note').textContent).toContain('Projected');
    expect(container.querySelector('[aria-label="Projected substitute in"] svg')).not.toBeNull();
  });

  it('labels stale standings instead of presenting them as live', async () => {
    const { app } = setupDom(vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        standings: { results: [] },
        new_entries: { results: [] },
        meta: {
          fetchedAt: '2025-08-20T12:00:00.000Z',
          freshness: 'stale',
          stale: true,
          ageSeconds: 600
        }
      })
    }));
    await app.loadLiveStandings();
    expect(document.querySelector('#live-widget-section .section-label').textContent)
      .toBe('Last known standings (not live)');
    expect(document.querySelector('#live-widget-content').textContent)
      .toContain('These are not live results.');
  });

  it('shows movement, chip, captain, players still to play, and the hit in the gameweek score', () => {
    const { app } = setupDom();
    const container = document.createElement('div');
    app.renderLiveStandings(container, [{
      entry: 100,
      playerName: 'Alex Test',
      teamName: 'Alpha FC',
      rank: 1,
      lastRank: 4,
      month: 20,
      gameweek: 73,
      gameweekGross: 77,
      hitCost: 4,
      chip: 'wildcard',
      captain: { id: 2, name: 'Saka' },
      vice: { id: 1, name: 'Raya' },
      yetToPlay: 2,
      picksKnown: true,
      season: 100,
      squad: []
    }]);

    const row = container.querySelector('.live-row');
    expect(row.querySelector('.trend-up').getAttribute('aria-label')).toBe('Rank improved by 3 places');
    expect(row.querySelector('.live-move').textContent).toBe('3');
    expect(row.querySelector('.live-chip').textContent).toBe('WC');
    expect(row.querySelector('.live-chip').getAttribute('aria-label')).toBe('Wildcard');
    expect(row.textContent).toContain('C Saka');
    expect(row.textContent).toContain('V Raya');
    expect(row.textContent).toContain('2 to play');
    expect(row.textContent).toContain('77 (−4) = 73');
  });

  it('explains career marks in words and skips a finished yet-to-play count', () => {
    const { app } = setupDom();
    const container = document.createElement('div');
    app.renderLiveStandings(container, [{
      entry: 570338,
      playerName: 'Mac Alvi',
      teamName: 'Stars',
      rank: 1,
      lastRank: 1,
      seasons: 16,
      careerBestPct: '0.3%',
      careerBestSeason: '2014/15',
      careerAvgPct: '14.9%',
      yetToPlay: 0,
      month: 1,
      gameweek: 1,
      season: 10,
      squad: []
    }]);

    const text = container.textContent;
    expect(text).toContain('16 seasons');
    expect(text).toContain('Best 0.3%');
    expect(text).toContain('Avg 14.9%');
    expect(text).not.toContain('CBF');
    expect(text).not.toContain('CAF');
    expect(text).not.toContain('0 to play');
    expect(container.querySelector('[title*="2014/15"]')).not.toBeNull();
  });

  it('renders league ownership and a two-manager archive rivalry', async () => {
    const payload = {
      standings: {
        results: [
          { entry: 570338, entry_name: 'Stars', player_name: 'MAC Alvi', rank: 2, last_rank: 2, total: 80 },
          { entry: 523129, entry_name: 'Theatre', player_name: 'Irfan Ahmed', rank: 4, last_rank: 1, total: 70 }
        ]
      },
      new_entries: { results: [] },
      meta: {
        fetchedAt: '2025-08-20T12:00:00.000Z',
        managerMetrics: {
          570338: {
            picksKnown: true,
            month: 10,
            gameweek: 40,
            season: 80,
            chip: 'bboost',
            captain: { id: 11, name: 'Saka' },
            vice: { id: 12, name: 'Raya' },
            yetToPlay: 1,
            squad: [
              { id: 11, name: 'Saka', multiplier: 2, slot: 3, points: 10, captain: true, viceCaptain: false },
              { id: 12, name: 'Raya', multiplier: 1, slot: 1, points: 6, captain: false, viceCaptain: true }
            ]
          },
          523129: {
            picksKnown: true,
            month: 8,
            gameweek: 30,
            season: 70,
            captain: { id: 13, name: 'Haaland' },
            vice: null,
            yetToPlay: 0,
            squad: [
              { id: 12, name: 'Raya', multiplier: 0, slot: 12, points: 2, captain: false, viceCaptain: false },
              { id: 13, name: 'Haaland', multiplier: 2, slot: 9, points: 12, captain: true, viceCaptain: false }
            ]
          }
        }
      }
    };
    const { app } = setupDom(vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload
    }));
    await app.loadLiveStandings();

    const ownership = document.querySelector('#live-ownership');
    expect(ownership.hidden).toBe(false);
    expect(ownership.textContent).toContain('League picks');
    expect(ownership.textContent).toContain('Saka');
    expect(ownership.textContent).toContain('Owned by one manager');
    expect(ownership.textContent).toContain('Haaland');

    const compare = document.querySelector('#live-compare');
    expect(compare.textContent).toContain('Shared');
    expect(compare.textContent).toContain('Raya');
    expect(compare.textContent).toContain('Archive rivalry');
    expect(compare.textContent).toContain('Mac Alvi');
    expect(compare.textContent).toContain('2022/23');
    expect(compare.textContent).toContain('not gameweek head-to-head');

    compare.querySelector('#compare-b').value = '570338';
    compare.querySelector('#compare-b').dispatchEvent(new window.Event('change'));
    expect(compare.textContent).toContain('Choose two different managers.');
  });

  it('retries once when the first standings payload is incomplete', async () => {
    const squad = (id, name) => [{ id, name, multiplier: 2, slot: 3, points: 8, captain: true, viceCaptain: false }];
    const row = (entry, name, total) => ({
      entry, entry_name: `${name} FC`, player_name: name, rank: entry, last_rank: entry, total
    });
    const metric = (playerId, playerName, points) => ({
      picksKnown: true,
      month: points,
      gameweek: points,
      season: points,
      captain: { id: playerId, name: playerName },
      vice: null,
      yetToPlay: 0,
      squad: squad(playerId, playerName)
    });
    const incomplete = {
      standings: { results: [row(101, 'Alex', 40)] },
      new_entries: { results: [] },
      meta: {
        fetchedAt: '2025-08-20T12:00:00.000Z',
        incomplete: true,
        degraded: true,
        managerMetrics: { 101: metric(11, 'Saka', 40) }
      }
    };
    const complete = {
      standings: { results: [row(101, 'Alex', 40), row(202, 'Blair', 30)] },
      new_entries: { results: [] },
      meta: {
        fetchedAt: '2025-08-20T12:00:01.000Z',
        degraded: false,
        managerMetrics: {
          101: metric(11, 'Saka', 40),
          202: metric(13, 'Haaland', 30)
        }
      }
    };
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => incomplete })
      .mockResolvedValueOnce({ ok: true, json: async () => complete });
    const { app } = setupDom(fetchImpl);
    await app.loadLiveStandings();

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const ownership = document.querySelector('#live-ownership');
    expect(ownership.hidden).toBe(false);
    expect(ownership.textContent).toContain('Saka');
    expect(ownership.textContent).toContain('Haaland');
    expect(ownership.textContent).not.toContain('unavailable');
  });

  it('renders the first payload when the incomplete retry fails', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          standings: { results: [{ entry: 101, entry_name: 'Alpha', player_name: 'Alex', rank: 1, last_rank: 1, total: 40 }] },
          new_entries: { results: [] },
          meta: {
            incomplete: true,
            degraded: true,
            managerMetrics: {
              101: { picksKnown: true, gameweek: 40, season: 40, captain: { id: 11, name: 'Saka' }, squad: [] }
            }
          }
        })
      })
      .mockRejectedValueOnce(new Error('offline'));
    const { app } = setupDom(fetchImpl);
    await app.loadLiveStandings();

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(document.querySelector('#live-widget-content').textContent).toContain('Alex');
    expect(document.querySelector('#live-widget-content').textContent).toContain('Saka');
  });

  it('renders the characterized unavailable state after API failure', async () => {
    const { app } = setupDom(vi.fn().mockRejectedValue(new Error('offline')));
    await app.loadLiveStandings();
    expect(document.querySelector('#live-widget-content').textContent)
      .toContain('Live standings are temporarily unavailable');
  });
});
