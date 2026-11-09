import { LEAGUE_ID } from './data.js';
import { currentPlayerByEntry, escapeHtml, fplProfileUrl } from './domain.js';

// --- FEATURE: Live FPL Standings ---
export function liveScore(value) {
  return value === null || value === undefined ? '—' : escapeHtml(value);
}

export function renderNextDeadline(nextDeadline) {
  const deadlineEl = document.getElementById('live-deadline');
  const deadline = nextDeadline?.deadlineTime ? new Date(nextDeadline.deadlineTime) : null;
  if (!deadline || Number.isNaN(deadline.getTime())) {
    deadlineEl.hidden = true;
    deadlineEl.textContent = '';
    return;
  }

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat(undefined, {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(deadline).map(part => [part.type, part.value])
  );
  const eventName = nextDeadline.name || `Gameweek ${nextDeadline.event}`;
  deadlineEl.textContent = `${eventName} • Deadline: ${parts.weekday} ${parts.day} ${parts.month}, ${parts.hour}:${parts.minute}`;
  deadlineEl.hidden = false;
}

export function renderLiveRow(team, squadExpanded = false) {
  // Lower rank number = better position. A missing previous rank is not a decline.
  const hasLastRank = Number.isInteger(team.lastRank) && team.lastRank > 0;
  const trend = hasLastRank && team.rank < team.lastRank
    ? '<span class="live-trend trend-up" role="img" aria-label="Rank improved"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 10 4-4 4 4"/></svg></span>'
    : hasLastRank && team.rank > team.lastRank
      ? '<span class="live-trend trend-down" role="img" aria-label="Rank declined"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></span>'
      : '<span class="live-trend trend-flat" role="img" aria-label="Rank unchanged"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 8h8"/></svg></span>';

  const hasSquad = Array.isArray(team.squad) && team.squad.length > 0;
  const hasProjectedSubs = hasSquad && team.squad.some(player => player.projectedIn || player.projectedOut);
  const toggle = hasSquad ? `
    <button class="live-squad-toggle" type="button" data-squad-toggle="${team.entry}"
      aria-expanded="${squadExpanded}" aria-controls="live-squad-${team.entry}">
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.5 9.5 8 5 12.5"/></svg>
      <span>${squadExpanded ? 'Hide players' : 'Player scores'}</span>
    </button>` : '';

  return `
    <div class="live-entry" data-live-entry="${team.entry}">
      <div class="live-row">
        <div class="live-rank"><span class="sr-only">Position </span>${team.rank}${trend}</div>
        <div class="live-identity">
          <div class="live-manager-line">
            <div class="live-manager"><a class="live-profile-link" href="${fplProfileUrl(team.entry)}" target="_blank" rel="noopener noreferrer">${escapeHtml(team.playerName)}</a></div>
            <span class="live-team">${escapeHtml(team.teamName)}</span>
          </div>
          <div class="live-team-line">
            ${team.seasons ? `<span class="live-meta" title="Seasons played" aria-label="${team.seasons} seasons">S ${team.seasons}</span>` : ''}
            ${team.careerBestPct ? `<span class="live-meta" title="Career Best Finish · ${escapeHtml(team.careerBestSeason)}" aria-label="Career Best Finish ${escapeHtml(team.careerBestPct)}, ${escapeHtml(team.careerBestSeason)}">CBF ${escapeHtml(team.careerBestPct)}</span>` : ''}
            ${team.careerAvgPct ? `<span class="live-meta live-meta-caf" title="Career Average Finish" aria-label="Career Average Finish ${escapeHtml(team.careerAvgPct)}">CAF ${escapeHtml(team.careerAvgPct)}</span>` : ''}
          </div>
        </div>
        <div class="live-performance" aria-label="Month ${liveScore(team.month)}, gameweek ${liveScore(team.gameweek)}, season ${liveScore(team.season)}">
          <span class="live-score"><small>Month</small>${liveScore(team.month)}</span>
          <span class="live-score"><small>GW</small>${liveScore(team.gameweek)}</span>
          <span class="live-score"><small>Total</small>${liveScore(team.season)}</span>
        </div>
        <div class="live-actions">
          ${hasProjectedSubs ? '<span class="live-projected-chip" title="Calculated from current fixture and appearance data">Projected changes</span>' : ''}
          ${toggle}
        </div>
      </div>
      ${squadExpanded ? renderSquad(team) : ''}
    </div>
  `;
}

function renderPlayer(player) {
  const role = ['GK', 'DEF', 'MID', 'FWD'][player.position - 1] || '';
  const badge = player.captain ? 'C' : player.viceCaptain ? 'V' : '';
  const subBadge = player.projectedIn
    ? '<em aria-label="Projected substitute in"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>IN</em>'
    : player.projectedOut
      ? '<em aria-label="Projected substitute out"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8H3m4-4L3 8l4 4"/></svg>OUT</em>'
      : '';
  const stateClass = player.projectedIn
    ? ' live-player-sub-in'
    : player.projectedOut
      ? ' live-player-benched live-player-sub-out'
      : player.multiplier === 0 ? ' live-player-benched' : '';
  return `
    <div class="live-player${stateClass}${player.captain ? ' live-player-captain' : ''}">
      <div class="live-player-shirt" aria-hidden="true"><span>${escapeHtml(player.team || role)}</span></div>
      <div class="live-player-name">${escapeHtml(player.name)}${badge ? `<b>${badge}</b>` : ''}${subBadge}</div>
      <div class="live-player-points">${liveScore(player.points)}</div>
    </div>`;
}

function renderSquad(team) {
  const starters = team.squad.filter(player => (player.slot <= 11 && !player.projectedOut) || player.projectedIn);
  const bench = team.squad.filter(player => !starters.includes(player));
  const lines = [1, 2, 3, 4]
    .map(position => starters.filter(player => player.position === position))
    .filter(line => line.length);
  const hasProjectedSubs = team.squad.some(player => player.projectedIn || player.projectedOut);
  return `
    <div class="live-squad" id="live-squad-${team.entry}" aria-label="${escapeHtml(team.playerName)} player scores">
      ${hasProjectedSubs ? '<p class="live-projected-note"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5h8l-2-2m4 8H5l2 2"/></svg><strong>Projected</strong> changes use current fixture and appearance data; official FPL processing may differ.</p>' : ''}
      <div class="live-squad-pitch">
        ${lines.map(line => `<div class="live-squad-line">${line.map(renderPlayer).join('')}</div>`).join('')}
      </div>
      ${bench.length ? `<div class="live-squad-bench"><span>Bench</span><div>${bench.map(renderPlayer).join('')}</div></div>` : ''}
    </div>`;
}

export function renderLiveRows(rows, expanded = false, expandedSquads = new Set()) {
  const visibleRows = expanded ? rows : rows.slice(0, 5);
  const hiddenCount = Math.max(rows.length - 5, 0);
  const currentMonth = new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date());
  return `
    <div class="live-table">
      <div class="live-table-head" aria-hidden="true">
        <span></span><span></span>
        <div class="live-score-head"><span>${currentMonth}</span><span>GW</span><span>Season</span></div>
      </div>
      ${visibleRows.map(team => renderLiveRow(team, expandedSquads.has(team.entry))).join('')}
      ${hiddenCount ? `<button type="button" class="live-toggle" aria-expanded="${expanded}" data-live-toggle>${expanded ? 'Show top 5' : `Show ${hiddenCount} more`}</button>` : ''}
    </div>
  `;
}

export function renderLiveStandings(container, rows, expanded = false, expandedSquads = new Set()) {
  container.innerHTML = renderLiveRows(rows, expanded, expandedSquads);
  const toggle = container.querySelector('[data-live-toggle]');
  if (toggle) {
    toggle.addEventListener('click', () => {
      renderLiveStandings(container, rows, !expanded, expandedSquads);
    });
  }
  container.querySelectorAll('[data-squad-toggle]').forEach(button => {
    button.addEventListener('click', () => {
      const entry = Number(button.dataset.squadToggle);
      const nextExpanded = new Set(expandedSquads);
      if (nextExpanded.has(entry)) nextExpanded.delete(entry);
      else nextExpanded.add(entry);
      renderLiveStandings(container, rows, expanded, nextExpanded);
      const nextButton = container.querySelector(`[data-squad-toggle="${entry}"]`);
      nextButton?.focus();
    });
  });
}

export async function loadLiveStandings() {
  const container = document.getElementById('live-widget-content');
  if (!LEAGUE_ID) {
    container.innerHTML = '<div class="empty-note">Set LEAGUE_ID at the top of the script to see live standings.</div>';
    return;
  }

  try {
    const response = await fetch('./api/standings', {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('Network response was not ok');

    const data = await response.json();
    renderNextDeadline(data.meta?.nextDeadline);
    const managerMetrics = data.meta?.managerMetrics || {};
    const standingsRows = data.standings.results.map(team => {
      const career = currentPlayerByEntry.get(team.entry);
      const metrics = managerMetrics[String(team.entry)] || {};
      return {
        entry: team.entry,
        playerName: team.player_name || 'Unknown manager',
        teamName: team.entry_name || 'Unknown team',
        careerBestPct: career?.careerBestPct ?? metrics.careerBestPct,
        careerBestSeason: career?.careerBestSeason ?? metrics.careerBestSeason,
        careerAvgPct: career?.careerAvgPct ?? metrics.careerAvgPct,
        seasons: career?.seasons ?? metrics.seasons,
        rank: team.rank,
        lastRank: team.last_rank,
        month: metrics.month,
        gameweek: metrics.gameweek,
        season: metrics.season ?? team.total,
        squad: metrics.squad || [],
      };
    });
    const newEntryRows = data.new_entries.results.map((team, index) => {
      const career = currentPlayerByEntry.get(team.entry);
      const metrics = managerMetrics[String(team.entry)] || {};
      return {
        entry: team.entry,
        playerName: [team.player_first_name, team.player_last_name].filter(Boolean).join(' ') || 'Unknown manager',
        teamName: team.entry_name || 'Unknown team',
        careerBestPct: career?.careerBestPct ?? metrics.careerBestPct,
        careerBestSeason: career?.careerBestSeason ?? metrics.careerBestSeason,
        careerAvgPct: career?.careerAvgPct ?? metrics.careerAvgPct,
        seasons: career?.seasons ?? metrics.seasons,
        rank: index + 1,
        lastRank: 0,
        month: metrics.month,
        gameweek: metrics.gameweek,
        season: metrics.season ?? 'New',
        squad: metrics.squad || [],
      };
    });
    const rows = standingsRows.length ? standingsRows : newEntryRows;
    renderLiveStandings(container, rows);
    const stale = data.meta?.stale === true || data.meta?.freshness === 'stale';
    const degraded = !stale && (data.meta?.degraded === true || data.meta?.freshness === 'degraded');
    const heading = document.querySelector('#live-widget-section .section-label');
    if (heading && stale) heading.textContent = 'Last known standings (not live)';
    if (data.meta?.fetchedAt) {
      const updated = new Date(data.meta.fetchedAt);
      const time = updated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const status = document.createElement('div');
      status.className = 'empty-note';
      if (stale) status.textContent = `Stale standings from ${time}. These are not live results.`;
      else if (degraded) status.textContent = `Last updated ${time}. Some live details are unavailable.`;
      else status.textContent = `Last updated ${time}`;
      container.appendChild(status);
    }
  } catch (error) {
    console.error("Error fetching live FPL data:", error);
    renderNextDeadline(null);
    container.innerHTML = '<div class="empty-note">Live standings are temporarily unavailable. Please try again shortly.</div>';
  }
}