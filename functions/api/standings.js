const LEAGUE_ID = '113546';
const DEFAULT_FPL_ORIGIN = 'https://fantasy.premierleague.com';
export const UPSTREAM_TIMEOUT_MS = 8000;
export const MANAGER_CONCURRENCY = 4;

const TTL = {
  aggregate: 120,
  standings: 120,
  bootstrap: 300,
  history: 600,
  picks: 120,
  live: 60,
  fixtures: 60,
  lastKnownGood: 24 * 60 * 60,
};

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

function json(body, init = {}) {
  const headers = new Headers(init.headers);
  Object.entries(JSON_HEADERS).forEach(([name, value]) => headers.set(name, value));
  return new Response(JSON.stringify(body), { ...init, headers });
}

function logEvent(event) {
  console.log(JSON.stringify({ source: 'api/standings', ...event }));
}

class StandingsError extends Error {
  constructor(publicMessage, code) {
    super(publicMessage);
    this.publicMessage = publicMessage;
    this.code = code;
    this.status = 502;
  }
}

function fplOrigin(env) {
  const configured = typeof env?.FPL_API_ORIGIN === 'string' ? env.FPL_API_ORIGIN.trim() : '';
  if (!configured) return DEFAULT_FPL_ORIGIN;
  try {
    const url = new URL(configured);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return DEFAULT_FPL_ORIGIN;
    return url.origin;
  } catch {
    return DEFAULT_FPL_ORIGIN;
  }
}

function fplUrl(env, path) {
  return `${fplOrigin(env)}${path}`;
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0 ? value : null;
}

function nonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function cacheRequest(key) {
  return new Request(`https://fpl-cache.internal/${key}`);
}

function aggregateRequest(requestUrl) {
  return new Request(new URL('/api/standings', requestUrl), { method: 'GET' });
}

function isExpired(response) {
  const expiresAt = Date.parse(response.headers.get('Expires') || '');
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

async function readAggregate(cache, request) {
  try {
    const cached = await cache.match(request);
    if (!cached || isExpired(cached)) return null;
    return cached;
  } catch {
    return null;
  }
}

async function readCachedJson(cache, key) {
  try {
    const cached = await cache.match(cacheRequest(key));
    if (!cached || isExpired(cached)) return null;
    return await cached.json();
  } catch {
    return null;
  }
}

function writeCachedJson(cache, key, value, ttlSeconds) {
  const response = json(value, {
    headers: {
      'Cache-Control': `public, max-age=${ttlSeconds}`,
      Expires: new Date(Date.now() + ttlSeconds * 1000).toUTCString(),
    },
  });
  return cache.put(cacheRequest(key), response);
}

function resolveTimeoutMs(env) {
  const override = Number(env?.FPL_UPSTREAM_TIMEOUT_MS);
  if (Number.isInteger(override) && override > 0 && override <= 30_000) return override;
  return UPSTREAM_TIMEOUT_MS;
}

async function fetchFplJson(url, stats) {
  stats.upstreamRequests += 1;
  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'The-Abusement-Park/1.0' },
      signal: AbortSignal.timeout(stats.timeoutMs),
    });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      const timeout = new Error('FPL request timed out');
      timeout.code = 'timeout';
      throw timeout;
    }
    throw error;
  }

  if (!response.ok) {
    const error = new Error(`FPL request failed with ${response.status}`);
    error.code = 'status';
    throw error;
  }

  try {
    return await response.json();
  } catch {
    const error = new Error('FPL returned an invalid response.');
    error.code = 'invalid-json';
    throw error;
  }
}

function unavailableMessage(error) {
  if (error?.code === 'invalid-json') return 'FPL returned an invalid response.';
  return 'FPL standings are temporarily unavailable.';
}

function currentMonthEventIds(events) {
  const now = new Date();
  return new Set((events || [])
    .filter(event => {
      const deadline = new Date(event.deadline_time);
      return deadline.getUTCFullYear() === now.getUTCFullYear()
        && deadline.getUTCMonth() === now.getUTCMonth();
    })
    .map(event => event.id));
}

function nextDeadline(events) {
  const now = Date.now();
  const nextEvent = (events || []).find(event => event.is_next)
    || (events || [])
      .filter(event => Date.parse(event.deadline_time) > now)
      .sort((a, b) => Date.parse(a.deadline_time) - Date.parse(b.deadline_time))[0];

  if (!nextEvent?.deadline_time) return null;
  return {
    event: nextEvent.id,
    name: nextEvent.name || `Gameweek ${nextEvent.id}`,
    deadlineTime: nextEvent.deadline_time,
  };
}

function formatPercentage(value) {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

function careerProfile(past) {
  const seasons = Array.isArray(past) ? past : [];
  const rankedSeasons = seasons
    .map(row => ({
      season: row.season_name,
      percentage: Number.parseFloat(row.rank_percentage),
    }))
    .filter(row => Number.isFinite(row.percentage) && row.season);
  const best = rankedSeasons.reduce(
    (lowest, row) => !lowest || row.percentage < lowest.percentage ? row : lowest,
    null,
  );
  const percentages = rankedSeasons.map(row => row.percentage);

  return {
    seasons: seasons.length || null,
    careerBestPct: best ? formatPercentage(best.percentage) : null,
    careerBestSeason: best?.season ?? null,
    careerAvgPct: percentages.length
      ? formatPercentage(percentages.reduce((sum, value) => sum + value, 0) / percentages.length)
      : null,
  };
}

function finishedTeams(fixtures) {
  const statusByTeam = new Map();
  for (const fixture of fixtures || []) {
    for (const teamId of [fixture.team_h, fixture.team_a]) {
      const statuses = statusByTeam.get(teamId) || [];
      statuses.push(fixture.finished === true);
      statusByTeam.set(teamId, statuses);
    }
  }
  return new Set([...statusByTeam]
    .filter(([, statuses]) => statuses.length > 0 && statuses.every(Boolean))
    .map(([teamId]) => teamId));
}

// FPL starting XI: exactly 1 GK, 3–5 DEF, 2–5 MID, 1–3 FWD, 11 players.
export function isLegalFormation(players) {
  if (!Array.isArray(players) || players.length !== 11) return false;
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const player of players) {
    const position = player?.position;
    if (position !== 1 && position !== 2 && position !== 3 && position !== 4) return false;
    counts[position] += 1;
  }
  return counts[1] === 1
    && counts[2] >= 3 && counts[2] <= 5
    && counts[3] >= 2 && counts[3] <= 5
    && counts[4] >= 1 && counts[4] <= 3;
}

function applyProjectedSubs(squad, finishedTeamIds) {
  if (!finishedTeamIds.size) return squad;
  const result = squad.map(player => ({ ...player }));
  const starters = result.filter(player => player.slot <= 11);
  const bench = result.filter(player => player.slot > 11).sort((a, b) => a.slot - b.slot);
  const unavailable = player => !player.appeared && finishedTeamIds.has(player.teamId);
  const activeStarters = new Map(starters.map(player => [player.id, player]));
  const usedBenchIds = new Set();

  for (const outgoing of starters.filter(unavailable)) {
    const candidates = outgoing.position === 1
      ? bench.filter(player => player.position === 1)
      : bench.filter(player => player.position !== 1);
    let incoming = null;
    for (const candidate of candidates) {
      if (usedBenchIds.has(candidate.id) || unavailable(candidate)) continue;
      const projectedStarters = [...activeStarters.values()]
        .filter(player => player.id !== outgoing.id)
        .concat(candidate);
      if (!isLegalFormation(projectedStarters)) continue;
      // Preserve bench priority while a higher eligible substitute is still to play.
      if (!candidate.appeared) break;
      incoming = candidate;
      break;
    }
    if (!incoming) continue;

    outgoing.multiplier = 0;
    outgoing.points = 0;
    outgoing.projectedOut = true;
    incoming.multiplier = 1;
    incoming.points = incoming.rawPoints;
    incoming.projectedIn = true;
    incoming.replaces = outgoing.id;
    activeStarters.delete(outgoing.id);
    activeStarters.set(incoming.id, incoming);
    usedBenchIds.add(incoming.id);
  }

  const captain = starters.find(player => player.captain);
  const viceCaptain = result.find(player => player.viceCaptain);
  if (captain && unavailable(captain) && viceCaptain?.appeared && activeStarters.has(viceCaptain.id)) {
    viceCaptain.multiplier = 2;
    viceCaptain.points = viceCaptain.rawPoints * 2;
  }

  return result;
}

function publicSquadPlayer(player) {
  const projected = {};
  if (player.projectedOut) projected.projectedOut = true;
  if (player.projectedIn) {
    projected.projectedIn = true;
    projected.replaces = player.replaces;
  }
  return {
    id: player.id,
    name: player.name,
    team: player.team,
    position: player.position,
    slot: player.slot,
    points: player.points,
    multiplier: player.multiplier,
    captain: player.captain,
    viceCaptain: player.viceCaptain,
    ...projected,
  };
}

function unavailableMetrics() {
  return {
    month: null,
    gameweek: null,
    season: null,
    event: null,
    seasons: null,
    careerBestPct: null,
    careerBestSeason: null,
    careerAvgPct: null,
  };
}

function normalizeLeague(league) {
  if (!league || typeof league !== 'object' || Array.isArray(league)) return null;
  return {
    id: Number.isInteger(league.id) ? league.id : null,
    name: typeof league.name === 'string' ? league.name : null,
  };
}

function invalidPresent(value, valid) {
  return value != null && !valid;
}

function normalizeStandingRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const entry = positiveInteger(row.entry);
  const rank = positiveInteger(row.rank);
  if (entry == null || rank == null) return null;
  const optionalInvalid = invalidPresent(row.id, positiveInteger(row.id) != null)
    || invalidPresent(row.last_rank, nonNegativeInteger(row.last_rank) != null)
    || invalidPresent(row.entry_name, typeof row.entry_name === 'string')
    || invalidPresent(row.player_name, typeof row.player_name === 'string')
    || invalidPresent(row.total, Number.isFinite(row.total));
  return {
    optionalInvalid,
    row: {
      id: positiveInteger(row.id),
      entry,
      rank,
      last_rank: nonNegativeInteger(row.last_rank),
      entry_name: typeof row.entry_name === 'string' ? row.entry_name : null,
      player_name: typeof row.player_name === 'string' ? row.player_name : null,
      total: Number.isFinite(row.total) ? row.total : null,
    },
  };
}

function normalizeNewEntry(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const entry = positiveInteger(row.entry);
  if (entry == null) return null;
  const optionalInvalid = invalidPresent(row.entry_name, typeof row.entry_name === 'string')
    || invalidPresent(row.player_first_name, typeof row.player_first_name === 'string')
    || invalidPresent(row.player_last_name, typeof row.player_last_name === 'string');
  return {
    optionalInvalid,
    row: {
      entry,
      entry_name: typeof row.entry_name === 'string' ? row.entry_name : null,
      player_first_name: typeof row.player_first_name === 'string' ? row.player_first_name : null,
      player_last_name: typeof row.player_last_name === 'string' ? row.player_last_name : null,
    },
  };
}

function normalizeStandingsPayload(data) {
  if (!Array.isArray(data?.standings?.results) || !Array.isArray(data?.new_entries?.results)) {
    throw new StandingsError('FPL returned an unexpected response.', 'unexpected');
  }

  let dropped = 0;
  let optionalInvalid = false;
  const results = [];
  for (const row of data.standings.results) {
    const normalized = normalizeStandingRow(row);
    if (!normalized) {
      dropped += 1;
      continue;
    }
    optionalInvalid = optionalInvalid || normalized.optionalInvalid;
    results.push(normalized.row);
  }
  if (data.standings.results.length > 0 && results.length === 0) {
    throw new StandingsError('FPL returned an unexpected response.', 'unexpected');
  }

  const newResults = [];
  for (const row of data.new_entries.results) {
    const normalized = normalizeNewEntry(row);
    if (!normalized) {
      dropped += 1;
      continue;
    }
    optionalInvalid = optionalInvalid || normalized.optionalInvalid;
    newResults.push(normalized.row);
  }

  return {
    league: normalizeLeague(data.league),
    standings: { results },
    new_entries: { results: newResults },
    dropped,
    optionalInvalid,
  };
}

function normalizeCurrent(current) {
  if (!Array.isArray(current)) return { rows: [], degraded: current != null };
  let degraded = false;
  const rows = [];
  for (const row of current) {
    const event = positiveInteger(row?.event);
    if (event == null || !Number.isFinite(row?.points)) {
      degraded = true;
      continue;
    }
    if (invalidPresent(row.total_points, Number.isFinite(row.total_points))) degraded = true;
    rows.push({
      event,
      points: row.points,
      total_points: Number.isFinite(row.total_points) ? row.total_points : null,
    });
  }
  return { rows, degraded };
}

function normalizePast(past) {
  if (!Array.isArray(past)) return { rows: [], degraded: past != null };
  let degraded = false;
  const rows = [];
  for (const row of past) {
    const season = typeof row?.season_name === 'string' ? row.season_name.trim() : '';
    if (!season) {
      degraded = true;
      continue;
    }
    const percentage = Number.parseFloat(row.rank_percentage);
    if (!Number.isFinite(percentage)) {
      degraded = true;
      rows.push({ season_name: season, rank_percentage: null });
      continue;
    }
    rows.push({ season_name: season, rank_percentage: String(row.rank_percentage) });
  }
  return { rows, degraded };
}

function normalizeHistory(history) {
  if (!history || typeof history !== 'object' || Array.isArray(history)) return null;
  const current = normalizeCurrent(history.current);
  const past = normalizePast(history.past);
  return {
    current: current.rows,
    past: past.rows,
    degraded: current.degraded || past.degraded,
  };
}

function liveStatsFrom(live) {
  return new Map((live?.elements || []).map(player => [player.id, {
    points: player.stats?.total_points ?? 0,
    appeared: (player.stats?.minutes ?? 0) > 0
      || (player.stats?.yellow_cards ?? 0) > 0
      || (player.stats?.red_cards ?? 0) > 0,
  }]));
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

function squadFromPicks(picks, playersById, teamsById, liveStats, finishedTeamIds) {
  const squad = applyProjectedSubs((picks.picks || []).map(pick => {
    const player = playersById.get(pick.element) || {};
    const multiplier = pick.multiplier ?? 0;
    const stats = liveStats.get(pick.element) || { points: 0, appeared: false };
    return {
      id: pick.element,
      name: player.web_name || `Player ${pick.element}`,
      team: teamsById.get(player.team) || '',
      teamId: player.team ?? null,
      position: player.element_type || null,
      slot: pick.position,
      points: stats.points * multiplier,
      rawPoints: stats.points,
      appeared: stats.appeared,
      multiplier,
      captain: Boolean(pick.is_captain),
      viceCaptain: Boolean(pick.is_vice_captain),
    };
  }), finishedTeamIds).map(publicSquadPlayer);
  const projectedGameweek = squad.some(player => player.projectedIn || player.projectedOut)
    ? squad.reduce((sum, player) => sum + player.points, 0) - (picks.entry_history?.event_transfers_cost ?? 0)
    : null;
  return { squad, projectedGameweek };
}

async function loadJsonResource(cache, stats, remember, key, ttl, load) {
  const cached = await readCachedJson(cache, key);
  if (cached) {
    stats.cacheHits += 1;
    return cached;
  }
  const value = await load();
  remember(key, value, ttl);
  return value;
}

async function buildManagerMetrics(env, data, bootstrap, cache, stats, remember) {
  const entryIds = [...new Set([
    ...data.standings.results.map(team => team.entry),
    ...data.new_entries.results.map(team => team.entry),
  ])];
  const events = Array.isArray(bootstrap.events) ? bootstrap.events : [];
  const monthEventIds = currentMonthEventIds(events);
  const currentEvent = events.find(event => event.is_current)?.id
    ?? events.filter(event => event.finished).at(-1)?.id
    ?? null;
  const playersById = new Map((bootstrap.elements || []).map(player => [player.id, player]));
  const teamsById = new Map((bootstrap.teams || []).map(team => [team.id, team.short_name]));
  let liveStats = new Map();
  let finishedTeamIds = new Set();

  if (currentEvent) {
    try {
      const live = await loadJsonResource(
        cache, stats, remember, `live-${currentEvent}`, TTL.live,
        () => fetchFplJson(fplUrl(env, `/api/event/${currentEvent}/live/`), stats),
      );
      liveStats = liveStatsFrom(live);
    } catch {
      stats.partialFailures.push('live');
    }

    try {
      const fixtures = await loadJsonResource(
        cache, stats, remember, `fixtures-${currentEvent}`, TTL.fixtures,
        () => fetchFplJson(fplUrl(env, `/api/fixtures/?event=${currentEvent}`), stats),
      );
      finishedTeamIds = finishedTeams(fixtures);
    } catch {
      stats.partialFailures.push('fixtures');
    }
  }

  const metrics = await mapWithConcurrency(entryIds, MANAGER_CONCURRENCY, async (entry) => {
    const historyKey = `history-${entry}`;
    let history = await readCachedJson(cache, historyKey);
    if (history && Array.isArray(history.current) && Array.isArray(history.past)) {
      stats.cacheHits += 1;
    } else {
      try {
        history = normalizeHistory(await fetchFplJson(
          fplUrl(env, `/api/entry/${entry}/history/`),
          stats,
        ));
        if (!history) throw new Error('invalid history');
        remember(historyKey, history, TTL.history);
      } catch {
        stats.partialFailures.push(`history-${entry}`);
        return [String(entry), unavailableMetrics()];
      }
    }
    if (history.degraded) stats.partialFailures.push(`history-${entry}`);

    const current = history.current;
    const latest = current.at(-1);
    let squad = [];
    let projectedGameweek = null;
    if (currentEvent) {
      try {
        const picks = await loadJsonResource(
          cache, stats, remember, `picks-${entry}-${currentEvent}`, TTL.picks,
          async () => {
            const payload = await fetchFplJson(
              fplUrl(env, `/api/entry/${entry}/event/${currentEvent}/picks/`),
              stats,
            );
            if (!payload || typeof payload !== 'object' || !Array.isArray(payload.picks)) {
              const error = new Error('invalid picks');
              error.code = 'invalid-picks';
              throw error;
            }
            return {
              picks: payload.picks,
              entry_history: payload.entry_history ?? null,
            };
          },
        );
        ({ squad, projectedGameweek } = squadFromPicks(
          picks, playersById, teamsById, liveStats, finishedTeamIds,
        ));
      } catch {
        stats.partialFailures.push(`picks-${entry}`);
      }
    }

    const month = current.length
      ? current.filter(row => monthEventIds.has(row.event)).reduce((sum, row) => sum + row.points, 0)
      : null;
    return [String(entry), {
      month,
      gameweek: projectedGameweek ?? latest?.points ?? null,
      season: latest?.total_points ?? null,
      event: latest?.event ?? null,
      squad,
      ...careerProfile(history.past),
    }];
  });

  return Object.fromEntries(metrics);
}

async function loadStandings(env, cache, stats, remember) {
  const cached = await readCachedJson(cache, 'standings');
  if (cached?.standings?.results && cached?.new_entries?.results) {
    stats.cacheHits += 1;
    return cached;
  }

  let raw;
  try {
    raw = await fetchFplJson(fplUrl(env, `/api/leagues-classic/${LEAGUE_ID}/standings/`), stats);
  } catch (error) {
    throw new StandingsError(unavailableMessage(error), error?.code || 'unavailable');
  }

  let normalized;
  try {
    normalized = normalizeStandingsPayload(raw);
  } catch (error) {
    if (error instanceof StandingsError) throw error;
    throw new StandingsError('FPL returned an unexpected response.', 'unexpected');
  }
  remember('standings', normalized, TTL.standings);
  return normalized;
}

async function buildPayload(context, cache, stats, writes) {
  const env = context.env;
  const remember = (key, value, ttl) => {
    writes.push(writeCachedJson(cache, key, value, ttl));
  };
  const standings = await loadStandings(env, cache, stats, remember);
  if (standings.dropped > 0) stats.partialFailures.push('standings-rows');
  if (standings.optionalInvalid) stats.partialFailures.push('standings-fields');

  let bootstrap = {};
  try {
    bootstrap = await loadJsonResource(
      cache, stats, remember, 'bootstrap', TTL.bootstrap,
      async () => {
        const payload = await fetchFplJson(fplUrl(env, '/api/bootstrap-static/'), stats);
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          throw new Error('invalid bootstrap');
        }
        return payload;
      },
    );
  } catch {
    stats.partialFailures.push('bootstrap');
    bootstrap = {};
  }

  const events = Array.isArray(bootstrap.events) ? bootstrap.events : [];
  const managerMetrics = await buildManagerMetrics(env, standings, bootstrap, cache, stats, remember);
  const degraded = stats.partialFailures.length > 0;

  return {
    league: standings.league ?? null,
    standings: { results: standings.standings.results },
    new_entries: { results: standings.new_entries.results },
    meta: {
      fetchedAt: new Date().toISOString(),
      leagueId: LEAGUE_ID,
      freshness: degraded ? 'degraded' : 'fresh',
      stale: false,
      degraded,
      managerMetrics,
      nextDeadline: nextDeadline(events),
    },
  };
}

function ageSeconds(fetchedAt) {
  const then = Date.parse(fetchedAt || '');
  if (!Number.isFinite(then)) return null;
  return Math.max(0, Math.round((Date.now() - then) / 1000));
}

async function serveStale(cache, reason) {
  const saved = await readCachedJson(cache, 'last-known-good');
  if (!saved?.payload?.standings?.results || !saved.payload.meta) return null;
  const fetchedAt = saved.fetchedAt || saved.payload.meta.fetchedAt || null;
  return json({
    ...saved.payload,
    meta: {
      ...saved.payload.meta,
      freshness: 'stale',
      stale: true,
      fetchedAt,
      ageSeconds: ageSeconds(fetchedAt),
      staleReason: reason,
    },
  }, {
    headers: {
      'Cache-Control': 'no-store',
      'X-FPL-Cache': 'STALE',
    },
  });
}

export async function onRequestGet(context) {
  const started = Date.now();
  const cache = caches.default;
  const stats = {
    upstreamRequests: 0,
    cacheHits: 0,
    partialFailures: [],
    timeoutMs: resolveTimeoutMs(context.env),
  };
  const log = (event) => logEvent({
    durationMs: Date.now() - started,
    upstreamRequests: stats.upstreamRequests,
    cacheHits: stats.cacheHits,
    partialFailures: stats.partialFailures,
    ...event,
  });

  try {
    const aggregateKey = aggregateRequest(context.request.url);
    const cached = await readAggregate(cache, aggregateKey);
    if (cached) {
      const response = new Response(cached.body, cached);
      response.headers.set('X-FPL-Cache', 'HIT');
      log({ outcome: 'hit' });
      return response;
    }

    const writes = [];
    const payload = await buildPayload(context, cache, stats, writes);
    const response = json(payload, {
      headers: {
        'Cache-Control': `public, max-age=${TTL.aggregate}`,
        Expires: new Date(Date.now() + TTL.aggregate * 1000).toUTCString(),
        'X-FPL-Cache': 'MISS',
      },
    });
    writes.push(cache.put(aggregateKey, response.clone()));
    writes.push(writeCachedJson(cache, 'last-known-good', {
      payload,
      fetchedAt: payload.meta.fetchedAt,
    }, TTL.lastKnownGood));
    context.waitUntil?.(Promise.all(writes));
    log({ outcome: payload.meta.freshness });
    return response;
  } catch (error) {
    const reason = error?.code || 'unavailable';
    try {
      const stale = await serveStale(cache, reason);
      if (stale) {
        log({ outcome: 'stale', staleReason: reason });
        return stale;
      }
    } catch {
      // A broken last-known-good record still produces an explicit error below.
    }
    log({ outcome: 'error', code: reason });
    return json({ error: error?.publicMessage || 'FPL standings are temporarily unavailable.' }, {
      status: error?.status || 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}

export function onRequest() {
  return json({ error: 'Method not allowed.' }, {
    status: 405,
    headers: { Allow: 'GET', 'Cache-Control': 'no-store' },
  });
}
