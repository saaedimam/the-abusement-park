import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MANAGER_CONCURRENCY } from '../../functions/api/standings.js';
import {
  bootstrapFixture,
  emptyStandingsFixture,
  jsonResponse,
  liveFixture,
  malformedManagerStandings,
  managerHistories,
  managerPicks,
  standingsFixture
} from '../fixtures/fpl.js';

const originalCaches = globalThis.caches;

function clone(value) {
  return structuredClone(value);
}

function createContext(url = 'https://example.test/api/standings', env) {
  const pending = [];
  return {
    request: new Request(url),
    env,
    waitUntil(promise) { pending.push(promise); },
    pending
  };
}

function installCache(cachedResponse = null) {
  const cache = {
    match: vi.fn().mockResolvedValue(cachedResponse),
    put: vi.fn().mockResolvedValue(undefined)
  };
  globalThis.caches = { default: cache };
  return cache;
}

function installMemoryCache() {
  const store = new Map();
  const cache = {
    async match(request) {
      const stored = store.get(request.url);
      return stored ? stored.clone() : null;
    },
    async put(request, response) {
      store.set(request.url, response.clone());
    }
  };
  globalThis.caches = { default: cache };
  return cache;
}

function installUpstream({
  standings = standingsFixture,
  bootstrap = bootstrapFixture,
  histories = managerHistories,
  picks = managerPicks,
  live = liveFixture,
  fixtures = [],
  standingsResponse,
  bootstrapResponse
} = {}) {
  globalThis.fetch = vi.fn(async (input) => {
    const url = String(input);
    if (url.includes('/leagues-classic/')) return standingsResponse ?? jsonResponse(clone(standings));
    if (url.includes('/bootstrap-static/')) return bootstrapResponse ?? jsonResponse(clone(bootstrap));
    if (url.includes('/event/') && url.endsWith('/live/')) return jsonResponse(clone(live));
    if (url.includes('/fixtures/')) return jsonResponse(clone(fixtures));
    const picksMatch = url.match(/\/entry\/(.+?)\/event\/(.+?)\/picks/);
    if (picksMatch) return jsonResponse(clone(picks[picksMatch[1]] ?? { picks: [] }));
    const entry = url.match(/\/entry\/(.+?)\/history/)?.[1];
    const history = histories[entry];
    if (history instanceof Error) throw history;
    if (history instanceof Response) return history;
    return jsonResponse(clone(history ?? { current: [], past: [] }));
  });
}

async function loadModule() {
  vi.resetModules();
  return import('../../functions/api/standings.js');
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-08-20T12:00:00Z'));
  installCache();
  installUpstream();
});

afterAll(() => {
  globalThis.caches = originalCaches;
  vi.useRealTimers();
});

describe('GET /api/standings contract', () => {
  it('returns stable standings, manager metrics, metadata, and MISS cache headers', async () => {
    const { onRequestGet } = await loadModule();
    const context = createContext();
    const response = await onRequestGet(context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=120');
    expect(response.headers.get('X-FPL-Cache')).toBe('MISS');
    expect(body.standings).toEqual(standingsFixture.standings);
    expect(body.new_entries).toEqual({ results: [] });
    expect(body.meta).toEqual({
      fetchedAt: '2025-08-20T12:00:00.000Z',
      leagueId: '113546',
      freshness: 'fresh',
      stale: false,
      degraded: false,
      managerMetrics: {
        101: {
          month: 100,
          event: 2,
          gameweek: 50,
          gameweekGross: null,
          hitCost: null,
          chip: null,
          captain: { id: 33, name: 'Saka' },
          vice: { id: 22, name: 'Saliba' },
          yetToPlay: 0,
          picksKnown: true,
          season: 100,
          seasons: 2,
          careerBestPct: '5%',
          careerBestSeason: '2024/25',
          careerAvgPct: '8.8%',
          squad: [
            { id: 11, name: 'Raya', team: 'ARS', position: 1, slot: 1, points: 9, multiplier: 1, captain: false, viceCaptain: false },
            { id: 22, name: 'Saliba', team: 'ARS', position: 2, slot: 2, points: 6, multiplier: 1, captain: false, viceCaptain: true },
            { id: 33, name: 'Saka', team: 'ARS', position: 3, slot: 3, points: 8, multiplier: 2, captain: true, viceCaptain: false },
            { id: 44, name: 'Haaland', team: 'MCI', position: 4, slot: 12, points: 0, multiplier: 0, captain: false, viceCaptain: false }
          ]
        },
        202: {
          month: 45,
          event: 2,
          gameweek: 45,
          gameweekGross: null,
          hitCost: null,
          chip: null,
          captain: null,
          vice: null,
          yetToPlay: 0,
          picksKnown: true,
          season: 90,
          seasons: 1,
          careerBestPct: '25%',
          careerBestSeason: '2024/25',
          careerAvgPct: '25%',
          squad: []
        }
      },
      nextDeadline: {
        event: 2,
        name: 'Gameweek 2',
        deadlineTime: '2025-08-22T17:30:00Z'
      }
    });
    expect(context.pending).toHaveLength(1);
    await Promise.all(context.pending);
    expect(caches.default.put.mock.calls.length).toBeGreaterThan(1);
    expect(globalThis.fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('returns cached responses as HIT without upstream requests', async () => {
    const cached = jsonResponse({ cached: true }, { headers: { 'Cache-Control': 'public, max-age=120' } });
    const cache = installCache(cached);
    globalThis.fetch = vi.fn();
    const { onRequestGet } = await loadModule();
    const response = await onRequestGet(createContext());

    expect(await response.json()).toEqual({ cached: true });
    expect(response.headers.get('X-FPL-Cache')).toBe('HIT');
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
  });

  it('returns valid empty standings', async () => {
    installUpstream({ standings: emptyStandingsFixture });
    const { onRequestGet } = await loadModule();
    const body = await (await onRequestGet(createContext())).json();
    expect(body.standings.results).toEqual([]);
    expect(body.meta.managerMetrics).toEqual({});
  });

  it('degrades missing bootstrap data to null deadline and zero month totals', async () => {
    installUpstream({ bootstrapResponse: jsonResponse({}, { status: 503 }) });
    const { onRequestGet } = await loadModule();
    const body = await (await onRequestGet(createContext())).json();
    expect(body.meta.nextDeadline).toBeNull();
    expect(body.meta.freshness).toBe('degraded');
    expect(body.meta.degraded).toBe(true);
    expect(body.meta.stale).toBe(false);
    expect(body.meta.managerMetrics['101'].month).toBe(0);
  });

  it('degrades partial manager-history failure to null metrics for that manager', async () => {
    installUpstream({ histories: { ...managerHistories, 202: new Error('network') } });
    const { onRequestGet } = await loadModule();
    const body = await (await onRequestGet(createContext())).json();
    expect(body.meta.managerMetrics['101'].season).toBe(100);
    expect(body.meta.managerMetrics['202']).toEqual({
      month: null,
      event: null,
      gameweek: null,
      season: null,
      seasons: null,
      careerBestPct: null,
      careerBestSeason: null,
      careerAvgPct: null
    });
  });

  it('drops invalid manager-history rows and nulls the optional fields that remain', async () => {
    installUpstream({ histories: {
      101: { current: null, past: null },
      202: { current: [{ event: 2, points: 0 }], past: [{ season_name: '', rank_percentage: 'invalid' }] }
    } });
    const { onRequestGet } = await loadModule();
    const body = await (await onRequestGet(createContext())).json();
    expect(body.meta.freshness).toBe('degraded');
    expect(body.meta.managerMetrics['101']).toMatchObject({ month: null, gameweek: null, season: null, seasons: null });
    expect(body.meta.managerMetrics['202']).toMatchObject({
      month: 0,
      gameweek: 0,
      season: null,
      seasons: null,
      careerBestPct: null,
      careerBestSeason: null,
      careerAvgPct: null
    });
  });

  it('rejects a standings payload whose mandatory entry ids and ranks are all invalid', async () => {
    installUpstream({ standings: malformedManagerStandings });
    const { onRequestGet } = await loadModule();
    const response = await onRequestGet(createContext());
    expect(response.status).toBe(502);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: 'FPL returned an unexpected response.' });
  });

  it('keeps valid standings rows, nulls invalid optional fields, and drops rows without an entry id or rank', async () => {
    installUpstream({ standings: {
      league: { id: 113546, name: 'Fixture League', private_note: 'drop me' },
      secret: 'drop me',
      standings: {
        results: [
          { ...standingsFixture.standings.results[0], token: 'drop me', entry_name: 12, total: '100' },
          { entry: null, rank: 3, entry_name: 'Missing', player_name: 'Missing' }
        ]
      },
      new_entries: { results: [{ entry: 'nope' }, { entry: 303, entry_name: 'Gamma', player_first_name: 1 }] }
    } });
    const { onRequestGet } = await loadModule();
    const response = await onRequestGet(createContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.secret).toBeUndefined();
    expect(body.league).toEqual({ id: 113546, name: 'Fixture League' });
    expect(body.standings.results).toEqual([{
      id: 1,
      entry: 101,
      entry_name: null,
      player_name: 'Alex Test',
      rank: 1,
      last_rank: 2,
      total: null
    }]);
    expect(body.new_entries.results).toEqual([{
      entry: 303,
      entry_name: 'Gamma',
      player_first_name: null,
      player_last_name: null
    }]);
    expect(body.meta.freshness).toBe('degraded');
    expect(body.meta.managerMetrics.null).toBeUndefined();
    expect(body.meta.managerMetrics['101'].season).toBe(100);
  });
});

describe('upstream failure contract', () => {
  it('returns 502/no-store when the standings request rejects', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));
    const { onRequestGet } = await loadModule();
    const response = await onRequestGet(createContext());
    expect(response.status).toBe(502);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: 'FPL standings are temporarily unavailable.' });
  });

  it('returns 502/no-store for a non-2xx standings response', async () => {
    installUpstream({ standingsResponse: jsonResponse({}, { status: 429 }) });
    const { onRequestGet } = await loadModule();
    const response = await onRequestGet(createContext());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'FPL standings are temporarily unavailable.' });
  });

  it('projects the first eligible bench player after a starter finishes without appearing', async () => {
    const elements = [
      { id: 1, web_name: 'Keeper', element_type: 1, team: 1 },
      { id: 2, web_name: 'Def One', element_type: 2, team: 1 },
      { id: 3, web_name: 'Def Two', element_type: 2, team: 1 },
      { id: 4, web_name: 'Def Three', element_type: 2, team: 1 },
      { id: 5, web_name: 'Def Missing', element_type: 2, team: 1 },
      { id: 6, web_name: 'Mid One', element_type: 3, team: 1 },
      { id: 7, web_name: 'Mid Two', element_type: 3, team: 1 },
      { id: 8, web_name: 'Mid Three', element_type: 3, team: 1 },
      { id: 9, web_name: 'Mid Four', element_type: 3, team: 1 },
      { id: 10, web_name: 'Forward One', element_type: 4, team: 1 },
      { id: 11, web_name: 'Forward Two', element_type: 4, team: 1 },
      { id: 12, web_name: 'Bench Keeper', element_type: 1, team: 1 },
      { id: 13, web_name: 'Bench Mid', element_type: 3, team: 1 },
      { id: 14, web_name: 'Bench Def', element_type: 2, team: 1 },
      { id: 15, web_name: 'Bench Forward', element_type: 4, team: 1 }
    ];
    const picks = elements.map((player, index) => ({
      element: player.id,
      position: index + 1,
      multiplier: index < 11 ? 1 : 0,
      is_captain: false,
      is_vice_captain: false
    }));
    const live = { elements: elements.map(player => ({
      id: player.id,
      stats: { total_points: player.id === 13 ? 5 : 2, minutes: player.id === 5 ? 0 : 90 }
    })) };
    installUpstream({
      bootstrap: { ...bootstrapFixture, elements, teams: [{ id: 1, short_name: 'TST' }] },
      picks: { 101: { picks }, 202: { picks: [] } },
      live,
      fixtures: [{ team_h: 1, team_a: 2, finished: true }]
    });

    const { onRequestGet } = await loadModule();
    const body = await (await onRequestGet(createContext())).json();
    const squad = body.meta.managerMetrics[101].squad;

    expect(squad.find(player => player.id === 5)).toMatchObject({ multiplier: 0, projectedOut: true, points: 0 });
    expect(squad.find(player => player.id === 13)).toMatchObject({ multiplier: 1, projectedIn: true, replaces: 5, points: 5 });
  });

  it('respects bench order while preserving a legal formation', async () => {
    const positions = [1, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 1, 4, 2, 3];
    const elements = positions.map((position, index) => ({
      id: index + 1, web_name: `Player ${index + 1}`, element_type: position, team: 1
    }));
    const picks = elements.map((player, index) => ({
      element: player.id, position: index + 1, multiplier: index < 11 ? 1 : 0,
      is_captain: false, is_vice_captain: false
    }));
    const live = { elements: elements.map(player => ({
      id: player.id,
      stats: { total_points: player.id === 13 ? 8 : player.id === 14 ? 6 : 2, minutes: player.id === 2 ? 0 : 90 }
    })) };
    installUpstream({
      bootstrap: { ...bootstrapFixture, elements, teams: [{ id: 1, short_name: 'TST' }] },
      picks: { 101: { picks }, 202: { picks: [] } },
      live,
      fixtures: [{ team_h: 1, team_a: 2, finished: true }]
    });

    const { onRequestGet } = await loadModule();
    const body = await (await onRequestGet(createContext())).json();
    const squad = body.meta.managerMetrics[101].squad;

    expect(squad.find(player => player.id === 13)).not.toHaveProperty('projectedIn');
    expect(squad.find(player => player.id === 14)).toMatchObject({ projectedIn: true, replaces: 2 });
  });

  it('does not skip a higher-priority substitute whose fixture is still pending', async () => {
    const positions = [1, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 1, 3, 2, 4];
    const teams = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 3];
    const elements = positions.map((position, index) => ({
      id: index + 1, web_name: `Player ${index + 1}`, element_type: position, team: teams[index]
    }));
    const picks = elements.map((player, index) => ({
      element: player.id, position: index + 1, multiplier: index < 11 ? 1 : 0,
      is_captain: false, is_vice_captain: false
    }));
    const live = { elements: elements.map(player => ({
      id: player.id,
      stats: {
        total_points: player.id === 13 ? 0 : player.id === 14 ? 6 : 2,
        minutes: player.id === 5 || player.id === 13 ? 0 : 90
      }
    })) };
    installUpstream({
      bootstrap: {
        ...bootstrapFixture,
        elements,
        teams: [{ id: 1, short_name: 'ONE' }, { id: 2, short_name: 'TWO' }, { id: 3, short_name: 'THR' }]
      },
      picks: { 101: { picks }, 202: { picks: [] } },
      live,
      fixtures: [
        { team_h: 1, team_a: 3, finished: true },
        { team_h: 2, team_a: 4, finished: false }
      ]
    });

    const { onRequestGet } = await loadModule();
    const body = await (await onRequestGet(createContext())).json();
    const squad = body.meta.managerMetrics[101].squad;

    expect(squad.find(player => player.id === 14)).not.toHaveProperty('projectedIn');
    expect(squad.some(player => player.projectedIn || player.projectedOut)).toBe(false);
  });

  it('promotes the vice-captain multiplier when the captain is confirmed absent', async () => {
    const positions = [1, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 1, 3, 2, 4];
    const elements = positions.map((position, index) => ({
      id: index + 1, web_name: `Player ${index + 1}`, element_type: position, team: 1
    }));
    const picks = elements.map((player, index) => ({
      element: player.id,
      position: index + 1,
      multiplier: index === 4 ? 2 : index < 11 ? 1 : 0,
      is_captain: index === 4,
      is_vice_captain: index === 5
    }));
    const live = { elements: elements.map(player => ({
      id: player.id,
      stats: { total_points: player.id === 6 ? 7 : player.id === 13 ? 5 : 2, minutes: player.id === 5 ? 0 : 90 }
    })) };
    installUpstream({
      bootstrap: { ...bootstrapFixture, elements, teams: [{ id: 1, short_name: 'TST' }] },
      picks: { 101: { picks, entry_history: { event_transfers_cost: 4 } }, 202: { picks: [] } },
      live,
      fixtures: [{ team_h: 1, team_a: 2, finished: true }]
    });

    const { onRequestGet } = await loadModule();
    const body = await (await onRequestGet(createContext())).json();
    const metric = body.meta.managerMetrics[101];

    expect(metric.squad.find(player => player.id === 5)).toMatchObject({ multiplier: 0, projectedOut: true });
    expect(metric.squad.find(player => player.id === 6)).toMatchObject({ multiplier: 2, points: 14, viceCaptain: true });
    expect(metric.squad.find(player => player.id === 13)).toMatchObject({ multiplier: 1, points: 5, projectedIn: true });
    expect(metric.gameweek).toBe(metric.squad.reduce((sum, player) => sum + player.points, 0) - 4);
  });

  it('uses only the substitute goalkeeper for a missing goalkeeper', async () => {
    const positions = [1, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 1, 4, 2, 3];
    const elements = positions.map((position, index) => ({
      id: index + 1, web_name: `Player ${index + 1}`, element_type: position, team: 1
    }));
    const picks = elements.map((player, index) => ({
      element: player.id, position: index + 1, multiplier: index < 11 ? 1 : 0,
      is_captain: false, is_vice_captain: false
    }));
    const live = { elements: elements.map(player => ({
      id: player.id, stats: { total_points: player.id === 12 ? 7 : 2, minutes: player.id === 1 ? 0 : 90 }
    })) };
    installUpstream({
      bootstrap: { ...bootstrapFixture, elements, teams: [{ id: 1, short_name: 'TST' }] },
      picks: { 101: { picks }, 202: { picks: [] } }, live,
      fixtures: [{ team_h: 1, team_a: 2, finished: true }]
    });

    const { onRequestGet } = await loadModule();
    const body = await (await onRequestGet(createContext())).json();
    const squad = body.meta.managerMetrics[101].squad;

    expect(squad.find(player => player.id === 12)).toMatchObject({ projectedIn: true, replaces: 1, points: 7 });
  });

  it('waits until every fixture in a double gameweek is finished', async () => {
    const bootstrap = {
      ...bootstrapFixture,
      elements: bootstrapFixture.elements.map(player => ({ ...player }))
    };
    installUpstream({
      bootstrap,
      live: { elements: liveFixture.elements.map(player => ({
        ...player,
        stats: { ...player.stats, minutes: player.id === 22 ? 0 : 90 }
      })) },
      fixtures: [
        { team_h: 1, team_a: 11, finished: true },
        { team_h: 2, team_a: 1, finished: false }
      ]
    });

    const { onRequestGet } = await loadModule();
    const body = await (await onRequestGet(createContext())).json();

    expect(body.meta.managerMetrics[101].squad.some(player => player.projectedIn || player.projectedOut)).toBe(false);
  });

  it('does not project a sub before the missing starter fixture has finished', async () => {
    const bootstrap = {
      ...bootstrapFixture,
      elements: bootstrapFixture.elements.map(player => ({ ...player }))
    };
    installUpstream({
      bootstrap,
      live: { elements: liveFixture.elements.map(player => ({
        ...player,
        stats: { ...player.stats, minutes: player.id === 22 ? 0 : 90 }
      })) },
      fixtures: [{ team_h: 1, team_a: 11, finished: false }]
    });

    const { onRequestGet } = await loadModule();
    const body = await (await onRequestGet(createContext())).json();

    expect(body.meta.managerMetrics[101].squad.some(player => player.projectedIn || player.projectedOut)).toBe(false);
  });

  it('returns 502/no-store for invalid upstream JSON', async () => {
    installUpstream({ standingsResponse: new Response('{bad', { status: 200 }) });
    const { onRequestGet } = await loadModule();
    const response = await onRequestGet(createContext());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'FPL returned an invalid response.' });
  });

  it.each([
    {},
    { standings: { results: [] } },
    { standings: { results: 'bad' }, new_entries: { results: [] } },
    { standings: { results: [] }, new_entries: { results: null } }
  ])('returns 502/no-store for invalid mandatory structure %#', async (payload) => {
    installUpstream({ standings: payload });
    const { onRequestGet } = await loadModule();
    const response = await onRequestGet(createContext());
    expect(response.status).toBe(502);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: 'FPL returned an unexpected response.' });
  });
});

describe('FPL request bounds, cache, and stale fallback', () => {
  it('keeps manager history and picks at the concurrency ceiling', async () => {
    vi.useRealTimers();
    const standings = {
      league: { id: 113546, name: 'Fixture League' },
      standings: {
        results: Array.from({ length: 6 }, (_, index) => ({
          id: index + 1,
          entry: index + 1,
          entry_name: `Team ${index + 1}`,
          player_name: `Player ${index + 1}`,
          rank: index + 1,
          last_rank: index + 1,
          total: 10
        }))
      },
      new_entries: { results: [] }
    };
    let inFlight = 0;
    let maxInFlight = 0;
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      if (url.includes('/entry/')) {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await gate;
        inFlight -= 1;
        if (url.includes('/history/')) return jsonResponse({ current: [], past: [] });
        return jsonResponse({ picks: [] });
      }
      if (url.includes('/leagues-classic/')) return jsonResponse(standings);
      if (url.includes('/bootstrap-static/')) return jsonResponse(bootstrapFixture);
      if (url.includes('/live/')) return jsonResponse({ elements: [] });
      if (url.includes('/fixtures/')) return jsonResponse([]);
      throw new Error(`Unexpected upstream URL ${url}`);
    });

    const { onRequestGet } = await loadModule();
    const pending = onRequestGet(createContext());
    const deadline = Date.now() + 2000;
    while (maxInFlight < MANAGER_CONCURRENCY && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(maxInFlight).toBe(MANAGER_CONCURRENCY);
    expect(inFlight).toBe(MANAGER_CONCURRENCY);
    release();
    const response = await pending;
    expect(response.status).toBe(200);
    expect(maxInFlight).toBe(MANAGER_CONCURRENCY);
  });

  it('aborts a stalled standings request at the upstream timeout', async () => {
    vi.useRealTimers();
    globalThis.fetch = vi.fn((_input, init) => new Promise((_resolve, reject) => {
      const abort = () => reject(init.signal.reason);
      if (init.signal.aborted) abort();
      else init.signal.addEventListener('abort', abort, { once: true });
    }));
    const { onRequestGet } = await loadModule();
    const response = await onRequestGet(createContext('https://example.test/api/standings', {
      FPL_UPSTREAM_TIMEOUT_MS: 50
    }));
    expect(response.status).toBe(502);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: 'FPL standings are temporarily unavailable.' });
    expect(globalThis.fetch.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it('degrades one timed-out manager history without failing the standings', async () => {
    vi.useRealTimers();
    globalThis.fetch = vi.fn((input, init) => {
      const url = String(input);
      if (url.includes('/entry/202/history')) {
        return new Promise((_resolve, reject) => {
          const abort = () => reject(init.signal.reason);
          if (init.signal.aborted) abort();
          else init.signal.addEventListener('abort', abort, { once: true });
        });
      }
      if (url.includes('/leagues-classic/')) return jsonResponse(clone(standingsFixture));
      if (url.includes('/bootstrap-static/')) return jsonResponse(clone(bootstrapFixture));
      if (url.includes('/live/')) return jsonResponse(clone(liveFixture));
      if (url.includes('/fixtures/')) return jsonResponse([]);
      if (url.includes('/picks')) return jsonResponse({ picks: [] });
      if (url.includes('/history')) return jsonResponse(clone(managerHistories[101]));
      throw new Error(`Unexpected upstream URL ${url}`);
    });
    const { onRequestGet } = await loadModule();
    const response = await onRequestGet(createContext('https://example.test/api/standings', {
      FPL_UPSTREAM_TIMEOUT_MS: 50
    }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.meta.freshness).toBe('degraded');
    expect(body.meta.managerMetrics['101'].season).toBe(100);
    expect(body.meta.managerMetrics['202'].season).toBeNull();
  });

  it('serves last-known-good standings with explicit stale metadata when upstream fails', async () => {
    const cache = installMemoryCache();
    const put = vi.spyOn(cache, 'put');
    const { onRequestGet } = await loadModule();
    const firstContext = createContext();
    const first = await onRequestGet(firstContext);
    expect((await first.json()).meta.freshness).toBe('fresh');
    await Promise.all(firstContext.pending);
    put.mockClear();

    vi.advanceTimersByTime(121_000);
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));
    const response = await onRequestGet(createContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('X-FPL-Cache')).toBe('STALE');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(body.standings.results.map((row) => row.entry)).toEqual([101, 202]);
    expect(body.meta).toMatchObject({
      freshness: 'stale',
      stale: true,
      fetchedAt: '2025-08-20T12:00:00.000Z',
      ageSeconds: 121,
      staleReason: 'unavailable'
    });
    expect(put).not.toHaveBeenCalled();
  });

  it('does not serve an expired last-known-good record', async () => {
    installMemoryCache();
    const { onRequestGet } = await loadModule();
    const firstContext = createContext();
    await onRequestGet(firstContext);
    await Promise.all(firstContext.pending);

    vi.advanceTimersByTime((24 * 60 * 60 * 1000) + 1000);
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));
    const response = await onRequestGet(createContext());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'FPL standings are temporarily unavailable.' });
  });

  it('refetches expired standings while reusing the longer-lived bootstrap and history caches', async () => {
    installMemoryCache();
    const { onRequestGet } = await loadModule();
    const firstContext = createContext();
    await onRequestGet(firstContext);
    await Promise.all(firstContext.pending);

    vi.advanceTimersByTime(121_000);
    globalThis.fetch.mockClear();
    const body = await (await onRequestGet(createContext())).json();
    const urls = globalThis.fetch.mock.calls.map((call) => String(call[0]));

    expect(body.meta.freshness).toBe('fresh');
    expect(urls.some((url) => url.includes('/leagues-classic/'))).toBe(true);
    expect(urls.some((url) => url.includes('/bootstrap-static/'))).toBe(false);
    expect(urls.some((url) => url.includes('/history/'))).toBe(false);
    expect(urls.some((url) => url.includes('/picks'))).toBe(true);
  });

  it('uses a configured http(s) origin and ignores an invalid one', async () => {
    const { onRequestGet } = await loadModule();
    await onRequestGet(createContext('https://example.test/api/standings', { FPL_API_ORIGIN: 'http://127.0.0.1:8799/ignored' }));
    expect(String(globalThis.fetch.mock.calls[0][0])).toBe('http://127.0.0.1:8799/api/leagues-classic/113546/standings/');

    globalThis.fetch.mockClear();
    await onRequestGet(createContext('https://example.test/api/standings', { FPL_API_ORIGIN: 'javascript:alert(1)' }));
    expect(String(globalThis.fetch.mock.calls[0][0])).toContain('https://fantasy.premierleague.com/');
  });

  it('reports the chip, hit, captain, and players still to play from the picks already fetched', async () => {
    installUpstream({
      picks: {
        101: {
          active_chip: 'wildcard',
          entry_history: { event: 2, event_transfers_cost: 4, points: 46 },
          picks: managerPicks[101].picks
        },
        202: { picks: [], active_chip: '3xc' }
      },
      live: {
        elements: liveFixture.elements.map(player => ({
          ...player,
          stats: { ...player.stats, minutes: 0 }
        }))
      },
      fixtures: [{ team_h: 1, team_a: 11, finished: false }]
    });
    const { onRequestGet } = await loadModule();
    const body = await (await onRequestGet(createContext())).json();
    const metric = body.meta.managerMetrics['101'];

    expect(metric.chip).toBe('wildcard');
    expect(metric.hitCost).toBe(4);
    expect(metric.gameweek).toBe(50);
    expect(metric.gameweekGross).toBe(54);
    expect(metric.captain).toEqual({ id: 33, name: 'Saka' });
    expect(metric.vice).toEqual({ id: 22, name: 'Saliba' });
    expect(metric.yetToPlay).toBe(3);
    expect(metric.squad.filter(player => player.toPlay).map(player => player.id)).toEqual([11, 22, 33]);
    expect(body.meta.managerMetrics['202'].chip).toBe('3xc');
    expect(body.meta.managerMetrics['202'].yetToPlay).toBe(0);
  });

  it('rejects a substitute that would exceed the midfield maximum', async () => {
    const positions = [1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 1, 3, 2, 4];
    const elements = positions.map((position, index) => ({
      id: index + 1, web_name: `Player ${index + 1}`, element_type: position, team: 1
    }));
    const picks = elements.map((player, index) => ({
      element: player.id, position: index + 1, multiplier: index < 11 ? 1 : 0,
      is_captain: false, is_vice_captain: false
    }));
    const live = { elements: elements.map((player) => ({
      id: player.id,
      stats: { total_points: player.id === 13 ? 9 : player.id === 14 ? 4 : 2, minutes: player.id === 2 ? 0 : 90 }
    })) };
    installUpstream({
      bootstrap: { ...bootstrapFixture, elements, teams: [{ id: 1, short_name: 'TST' }] },
      picks: { 101: { picks }, 202: { picks: [] } },
      live,
      fixtures: [{ team_h: 1, team_a: 2, finished: true }]
    });

    const { onRequestGet } = await loadModule();
    const body = await (await onRequestGet(createContext())).json();
    const squad = body.meta.managerMetrics[101].squad;

    expect(squad.find((player) => player.id === 13)).not.toHaveProperty('projectedIn');
    expect(squad.find((player) => player.id === 14)).toMatchObject({ projectedIn: true, replaces: 2 });
  });
});

describe('method contract', () => {
  it('rejects non-GET routing with 405 and Allow: GET', async () => {
    const { onRequest } = await loadModule();
    const response = onRequest();
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: 'Method not allowed.' });
  });
});
