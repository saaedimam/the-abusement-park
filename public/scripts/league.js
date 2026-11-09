import { seasons } from './data.js';
import { currentPlayerByEntry, normalizeName } from './domain.js';

const CHIP_LABELS = {
  wildcard: ['WC', 'Wildcard'],
  bboost: ['BB', 'Bench Boost'],
  freehit: ['FH', 'Free Hit'],
  '3xc': ['TC', 'Triple Captain'],
};

export function chipBadge(chip) {
  if (typeof chip !== 'string' || !chip.trim()) return null;
  const known = CHIP_LABELS[chip];
  if (known) return { code: known[0], label: known[1] };
  return { code: chip.trim().slice(0, 4).toUpperCase(), label: chip.trim() };
}

export function rankMovement(rank, lastRank) {
  if (!Number.isInteger(rank) || !Number.isInteger(lastRank) || lastRank <= 0) return null;
  const delta = lastRank - rank;
  if (delta > 0) return { direction: 'up', places: delta };
  if (delta < 0) return { direction: 'down', places: -delta };
  return { direction: 'flat', places: 0 };
}

export function formatHitScore(gross, hitCost, net) {
  if (!Number.isFinite(hitCost) || hitCost <= 0 || !Number.isFinite(gross) || !Number.isFinite(net)) return null;
  return `${gross} (−${hitCost}) = ${net}`;
}

function isBenched(player) {
  if (player.projectedIn) return false;
  if (player.projectedOut) return true;
  return player.multiplier === 0 || player.slot > 11;
}

export function leagueOwnership(managers) {
  const counted = (managers || []).filter(manager => manager.picksKnown && Array.isArray(manager.squad));
  const unavailable = (managers || []).length - counted.length;
  const byPlayer = new Map();

  for (const manager of counted) {
    for (const player of manager.squad) {
      if (!Number.isInteger(player.id)) continue;
      const record = byPlayer.get(player.id) || {
        id: player.id,
        name: player.name || `Player ${player.id}`,
        team: player.team || '',
        owners: [],
        captains: [],
        vices: [],
      };
      const benched = isBenched(player);
      record.owners.push({
        entry: manager.entry,
        managerName: manager.playerName,
        benched,
      });
      if (player.captain) record.captains.push({ entry: manager.entry, managerName: manager.playerName });
      if (player.viceCaptain) record.vices.push({ entry: manager.entry, managerName: manager.playerName });
      byPlayer.set(player.id, record);
    }
  }

  const players = [...byPlayer.values()]
    .map(player => ({
      ...player,
      starting: player.owners.filter(owner => !owner.benched).length,
      benched: player.owners.filter(owner => owner.benched).length,
      differential: player.owners.length === 1,
    }))
    .sort((a, b) => b.owners.length - a.owners.length || a.name.localeCompare(b.name));

  return {
    managersCounted: counted.length,
    squadsUnavailable: unavailable,
    players,
    differentials: players.filter(player => player.differential),
    captaincy: players.filter(player => player.captains.length > 0),
  };
}

const archiveSpellings = new Map();
for (const season of seasons) {
  for (const name of [season.winner, season.runnerUp]) {
    if (!name) continue;
    const key = normalizeName(name);
    if (!archiveSpellings.has(key)) archiveSpellings.set(key, name);
  }
}

export function archiveIdentity(entry) {
  const player = currentPlayerByEntry.get(Number(entry));
  if (!player) return null;
  const candidates = [player.name, ...(player.aliases || [])];
  for (const name of candidates) {
    const spelling = archiveSpellings.get(normalizeName(name));
    if (spelling) return spelling;
  }
  return null;
}

function sameName(left, right) {
  return normalizeName(left) === normalizeName(right);
}

export function rivalryRecord(entryA, entryB) {
  const leftName = archiveIdentity(entryA);
  const rightName = archiveIdentity(entryB);
  if (!leftName || !rightName || sameName(leftName, rightName)) {
    return {
      available: false,
      leftName,
      rightName,
      note: 'Season titles are only matched when a manager has a reviewed archive name. Gameweek head-to-head results are not in the archive.',
    };
  }

  const meetings = seasons.filter(season => (
    (sameName(season.winner, leftName) && sameName(season.runnerUp, rightName))
    || (sameName(season.winner, rightName) && sameName(season.runnerUp, leftName))
  )).map(season => ({
    year: season.year,
    winner: season.winner,
    runnerUp: season.runnerUp,
  }));

  const titles = name => seasons.filter(season => sameName(season.winner, name)).length;
  const titlesOver = (winner, runnerUp) => meetings.filter(season => (
    sameName(season.winner, winner) && sameName(season.runnerUp, runnerUp)
  )).length;

  return {
    available: true,
    leftName,
    rightName,
    leftTitles: titles(leftName),
    rightTitles: titles(rightName),
    leftTitlesOverRight: titlesOver(leftName, rightName),
    rightTitlesOverLeft: titlesOver(rightName, leftName),
    meetings,
    note: 'The archive records the season winner and runner-up only. These are not gameweek head-to-head wins.',
  };
}
