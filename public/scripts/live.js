import { LEAGUE_ID } from './data.js';
import { currentPlayerByEntry, escapeHtml, fplProfileUrl } from './domain.js';
import { archiveIdentity, chipBadge, formatHitScore, leagueOwnership, rankMovement, rivalryRecord } from './league.js';

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

function movementMarkup(team) {
  const movement = rankMovement(team.rank, team.lastRank);
  if (!movement || movement.direction === 'flat') {
    return '<span class="live-trend trend-flat" role="img" aria-label="Rank unchanged"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 8h8"/></svg></span>';
  }
  const up = movement.direction === 'up';
  const placeWord = movement.places === 1 ? 'place' : 'places';
  const label = up
    ? `Rank improved by ${movement.places} ${placeWord}`
    : `Rank declined by ${movement.places} ${placeWord}`;
  return `<span class="live-trend ${up ? 'trend-up' : 'trend-down'}" role="img" aria-label="${label}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="${up ? 'm4 10 4-4 4 4' : 'm4 6 4 4 4-4'}"/></svg><span class="live-move">${movement.places}</span></span>`;
}

function gameweekMarkup(team) {
  const equation = formatHitScore(team.gameweekGross, team.hitCost, team.gameweek);
  if (!equation) return `<span class="live-score"><small>GW</small>${liveScore(team.gameweek)}</span>`;
  return `<span class="live-score"><small>GW</small><span class="live-gw-net">${escapeHtml(team.gameweek)}</span><span class="live-gw-hit">${escapeHtml(equation)}</span></span>`;
}

function managerLabel(entry, fplName) {
  const safeFplName = fplName || 'Unknown manager';
  const archiveName = archiveIdentity(entry);
  return {
    playerName: archiveName || safeFplName,
    fplName: archiveName && archiveName !== safeFplName ? safeFplName : '',
  };
}

function careerMarkup(team) {
  const bits = [];
  if (team.seasons) {
    bits.push(`<span class="live-meta" title="Seasons recorded for this manager">${team.seasons} seasons</span>`);
  }
  if (team.careerBestPct) {
    const season = team.careerBestSeason ? `, ${escapeHtml(team.careerBestSeason)}` : '';
    bits.push(`<span class="live-meta" title="Career best finish ${escapeHtml(team.careerBestPct)}${season}">Best ${escapeHtml(team.careerBestPct)}</span>`);
  }
  if (team.careerAvgPct) {
    bits.push(`<span class="live-meta" title="Career average finish">Avg ${escapeHtml(team.careerAvgPct)}</span>`);
  }
  return bits.length ? `<div class="live-team-line">${bits.join('')}</div>` : '';
}

function flagsMarkup(team) {
  const chip = chipBadge(team.chip);
  const chipHtml = chip
    ? `<span class="live-chip" title="${escapeHtml(chip.label)}" aria-label="${escapeHtml(chip.label)}">${escapeHtml(chip.code)}</span>`
    : '';
  const captain = team.captain?.name
    ? `<span class="live-role" aria-label="Captain ${escapeHtml(team.captain.name)}">C ${escapeHtml(team.captain.name)}</span>`
    : '';
  const vice = team.vice?.name
    ? `<span class="live-role" aria-label="Vice-captain ${escapeHtml(team.vice.name)}">V ${escapeHtml(team.vice.name)}</span>`
    : '';
  const toPlay = Number.isInteger(team.yetToPlay) && team.yetToPlay > 0
    ? `<span class="live-meta" aria-label="${team.yetToPlay} ${team.yetToPlay === 1 ? 'player' : 'players'} yet to play">${team.yetToPlay} to play</span>`
    : '';
  if (!chipHtml && !captain && !vice && !toPlay) return '';
  return `<div class="live-flags">${chipHtml}${captain}${vice}${toPlay}</div>`;
}

export function renderLiveRow(team, squadExpanded = false) {
  const trend = movementMarkup(team);

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
            <div class="live-manager"><a class="live-profile-link" href="${fplProfileUrl(team.entry)}" target="_blank" rel="noopener noreferrer"${team.fplName ? ` title="FPL profile · ${escapeHtml(team.fplName)}"` : ''}>${escapeHtml(team.playerName)}</a></div>
            <span class="live-team">${escapeHtml(team.teamName)}</span>
          </div>
          ${flagsMarkup(team)}
          ${careerMarkup(team)}
        </div>
        <div class="live-performance" aria-label="Month ${liveScore(team.month)}, gameweek ${formatHitScore(team.gameweekGross, team.hitCost, team.gameweek) || liveScore(team.gameweek)}, season ${liveScore(team.season)}">
          <span class="live-score"><small>Month</small>${liveScore(team.month)}</span>
          ${gameweekMarkup(team)}
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
        <span></span>
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

function ownerPhrase(owner) {
  return `${escapeHtml(owner.managerName)}${owner.benched ? ' (bench)' : ''}`;
}

function ownershipNote(ownership) {
  const loaded = `${ownership.managersCounted} squad${ownership.managersCounted === 1 ? '' : 's'} loaded`;
  if (!ownership.squadsUnavailable) return `This mini-league only. ${loaded}.`;
  const missing = `${ownership.squadsUnavailable} could not be loaded`;
  return `This mini-league only. ${loaded}. ${missing}. Refresh the page to try again.`;
}

function renderOwnership(managers) {
  const ownership = leagueOwnership(managers);
  if (!ownership.managersCounted) {
    return `<section class="live-panel" aria-labelledby="live-ownership-title">
      <h3 id="live-ownership-title" class="live-panel-title">League picks</h3>
      <p class="empty-note">Squads are not available for this gameweek.</p>
    </section>`;
  }
  const captains = ownership.captaincy.map(player => `
    <li><span class="live-pick-name">${escapeHtml(player.name)}</span>
      <span>${player.captains.map(owner => escapeHtml(owner.managerName)).join(', ')}</span></li>`).join('');
  const differentials = ownership.differentials.map(player => `
    <li><span class="live-pick-name">${escapeHtml(player.name)}</span>
      <span>${ownerPhrase(player.owners[0])}</span></li>`).join('');
  const everyone = ownership.players.map(player => `
    <li><span class="live-pick-name">${escapeHtml(player.name)}</span>
      <span>${player.owners.length} own, ${player.benched} bench${player.captains.length ? `, C ${player.captains.map(owner => escapeHtml(owner.managerName)).join(', ')}` : ''}</span></li>`).join('');
  const gap = ownership.squadsUnavailable
    ? `<p class="live-gap" role="status">${ownership.squadsUnavailable} squad${ownership.squadsUnavailable === 1 ? '' : 's'} missing from this view.</p>`
    : '';
  return `<section class="live-panel" aria-labelledby="live-ownership-title">
    <h3 id="live-ownership-title" class="live-panel-title">League picks</h3>
    <p class="live-panel-note">${ownershipNote(ownership)}</p>
    ${gap}
    <h4 class="live-panel-label">Captains</h4>
    ${captains ? `<ul class="live-pick-list">${captains}</ul>` : '<p class="empty-note">No captain is marked.</p>'}
    <details class="live-pick-details">
      <summary>Owned by one manager (${ownership.differentials.length})</summary>
      ${differentials ? `<ul class="live-pick-list">${differentials}</ul>` : '<p class="empty-note">No single-manager picks.</p>'}
    </details>
    <details class="live-pick-details">
      <summary>Every pick in the league (${ownership.players.length})</summary>
      <ul class="live-pick-list">${everyone}</ul>
    </details>
  </section>`;
}

function squadList(manager) {
  const squad = manager.squad || [];
  const starting = squad.filter(player => !((player.multiplier === 0 || player.slot > 11) && !player.projectedIn) && !player.projectedOut);
  const bench = squad.filter(player => !starting.includes(player));
  const item = player => `<li><span class="live-pick-name">${escapeHtml(player.name)}</span> <span>${player.captain ? 'C ' : ''}${player.viceCaptain ? 'V ' : ''}${liveScore(player.points)}</span></li>`;
  return `<article class="live-compare-side">
    <h4 class="live-compare-name">${escapeHtml(manager.playerName)}</h4>
    ${squad.length ? `<h5 class="live-compare-kicker">Playing</h5><ul class="live-pick-list">${starting.map(item).join('')}</ul>
      ${bench.length ? `<h5 class="live-compare-kicker">Bench</h5><ul class="live-pick-list">${bench.map(item).join('')}</ul>` : ''}` : '<p class="empty-note">Squad unavailable.</p>'}
  </article>`;
}

function nameList(players) {
  if (!players.length) return '<p class="empty-note">None</p>';
  return `<ul class="live-name-list">${players.map(player => `<li>${escapeHtml(player.name)}</li>`).join('')}</ul>`;
}

function renderComparison(left, right) {
  if (!left || !right) return '<p class="empty-note">Choose two managers.</p>';
  const leftIds = new Set((left.squad || []).map(player => player.id));
  const rightIds = new Set((right.squad || []).map(player => player.id));
  const shared = (left.squad || []).filter(player => rightIds.has(player.id));
  const onlyLeft = (left.squad || []).filter(player => !rightIds.has(player.id));
  const onlyRight = (right.squad || []).filter(player => !leftIds.has(player.id));
  const rivalry = rivalryRecord(left.entry, right.entry);
  const rivalryHtml = rivalry.available
    ? `<section class="live-rivalry" aria-label="Archive rivalry">
        <h4 class="live-panel-label">Archive rivalry</h4>
        <p>${escapeHtml(rivalry.leftName)} ${rivalry.leftTitles} title${rivalry.leftTitles === 1 ? '' : 's'} · ${escapeHtml(rivalry.rightName)} ${rivalry.rightTitles} title${rivalry.rightTitles === 1 ? '' : 's'}.</p>
        <p>${escapeHtml(rivalry.leftName)} won ${rivalry.leftTitlesOverRight} season${rivalry.leftTitlesOverRight === 1 ? '' : 's'} with ${escapeHtml(rivalry.rightName)} runner-up. ${escapeHtml(rivalry.rightName)} won ${rivalry.rightTitlesOverLeft} with ${escapeHtml(rivalry.leftName)} runner-up.</p>
        ${rivalry.meetings.length ? `<ul class="live-pick-list">${rivalry.meetings.map(season => `<li>${escapeHtml(season.year)} · ${escapeHtml(season.winner)} beat ${escapeHtml(season.runnerUp)}</li>`).join('')}</ul>` : ''}
        <p class="live-panel-note">${escapeHtml(rivalry.note)}</p>
      </section>`
    : `<section class="live-rivalry" aria-label="Archive rivalry"><h4 class="live-panel-label">Archive rivalry</h4><p class="live-panel-note">${escapeHtml(rivalry.note)}</p></section>`;
  return `<div class="live-compare-squads">${squadList(left)}${squadList(right)}</div>
    <h4 class="live-panel-label">Shared (${shared.length})</h4>
    ${nameList(shared)}
    <h4 class="live-panel-label">Only ${escapeHtml(left.playerName)} (${onlyLeft.length})</h4>
    ${nameList(onlyLeft)}
    <h4 class="live-panel-label">Only ${escapeHtml(right.playerName)} (${onlyRight.length})</h4>
    ${nameList(onlyRight)}
    ${rivalryHtml}`;
}

function renderCompareControls(rows) {
  const options = rows.map(team => `<option value="${team.entry}">${escapeHtml(team.playerName)}</option>`).join('');
  return `<section class="live-panel" aria-labelledby="live-compare-title">
    <h3 id="live-compare-title" class="live-panel-title">Compare managers</h3>
    <div class="live-compare-picks">
      <label for="compare-a">First manager <select id="compare-a">${options}</select></label>
      <label for="compare-b">Second manager <select id="compare-b">${options}</select></label>
    </div>
    <div id="live-compare-result" aria-live="polite"></div>
  </section>`;
}

function bindComparison(rows) {
  const root = document.getElementById('live-compare');
  if (!root) return;
  root.hidden = rows.length < 2;
  if (rows.length < 2) {
    root.innerHTML = '';
    return;
  }
  root.innerHTML = renderCompareControls(rows);
  const first = root.querySelector('#compare-a');
  const second = root.querySelector('#compare-b');
  const result = root.querySelector('#live-compare-result');
  if (rows[1]) second.value = String(rows[1].entry);
  const draw = () => {
    const left = rows.find(team => String(team.entry) === first.value);
    const right = rows.find(team => String(team.entry) === second.value);
    if (left && right && left.entry === right.entry) {
      result.innerHTML = '<p class="empty-note">Choose two different managers.</p>';
      return;
    }
    result.innerHTML = renderComparison(left, right);
  };
  first.addEventListener('change', draw);
  second.addEventListener('change', draw);
  draw();
}

function setLiveJump(rows) {
  const jump = document.getElementById('live-jump');
  if (!jump) return;
  jump.hidden = !rows;
  const compareLink = document.getElementById('live-jump-compare');
  if (compareLink) compareLink.hidden = !rows || rows.length < 2;
}

function showLivePanels(rows) {
  const ownership = document.getElementById('live-ownership');
  if (ownership) {
    ownership.hidden = false;
    ownership.innerHTML = renderOwnership(rows);
  }
  setLiveJump(rows);
  bindComparison(rows);
}

function hideLivePanels() {
  setLiveJump(null);
  for (const id of ['live-ownership', 'live-compare']) {
    const panel = document.getElementById(id);
    if (!panel) continue;
    panel.hidden = true;
    panel.innerHTML = '';
  }
}

function hasStandings(data) {
  return Array.isArray(data?.standings?.results) && Array.isArray(data?.new_entries?.results);
}

async function fetchStandingsPayload() {
  const response = await fetch('./api/standings', {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('Network response was not ok');
  const data = await response.json();
  if (!hasStandings(data)) throw new Error('Standings payload was incomplete');
  return data;
}

export async function loadLiveStandings() {
  const container = document.getElementById('live-widget-content');
  if (!LEAGUE_ID) {
    container.innerHTML = '<div class="empty-note">Set LEAGUE_ID at the top of the script to see live standings.</div>';
    hideLivePanels();
    return;
  }

  try {
    let data = await fetchStandingsPayload();
    // A cold function can run out of subrequests before every history is stored.
    // The picks bundle is saved first, so one retry finishes the league.
    if (data.meta?.incomplete === true) {
      try {
        const retry = await fetchStandingsPayload();
        if (hasStandings(retry)) data = retry;
      } catch {
        // Render the first payload. Its status line explains any remaining gap.
      }
    }
    renderNextDeadline(data.meta?.nextDeadline);
    const managerMetrics = data.meta?.managerMetrics || {};
    const standingsRows = data.standings.results.map(team => {
      const career = currentPlayerByEntry.get(team.entry);
      const metrics = managerMetrics[String(team.entry)] || {};
      const label = managerLabel(team.entry, team.player_name);
      return {
        entry: team.entry,
        playerName: label.playerName,
        fplName: label.fplName,
        teamName: team.entry_name || 'Unknown team',
        careerBestPct: career?.careerBestPct ?? metrics.careerBestPct,
        careerBestSeason: career?.careerBestSeason ?? metrics.careerBestSeason,
        careerAvgPct: career?.careerAvgPct ?? metrics.careerAvgPct,
        seasons: career?.seasons ?? metrics.seasons,
        rank: team.rank,
        lastRank: team.last_rank,
        month: metrics.month,
        gameweek: metrics.gameweek,
        gameweekGross: metrics.gameweekGross ?? null,
        hitCost: metrics.hitCost ?? null,
        chip: metrics.chip ?? null,
        captain: metrics.captain ?? null,
        vice: metrics.vice ?? null,
        yetToPlay: Number.isInteger(metrics.yetToPlay) ? metrics.yetToPlay : null,
        picksKnown: metrics.picksKnown === true,
        season: metrics.season ?? team.total,
        squad: metrics.squad || [],
      };
    });
    const newEntryRows = data.new_entries.results.map((team, index) => {
      const career = currentPlayerByEntry.get(team.entry);
      const metrics = managerMetrics[String(team.entry)] || {};
      const fplName = [team.player_first_name, team.player_last_name].filter(Boolean).join(' ');
      const label = managerLabel(team.entry, fplName);
      return {
        entry: team.entry,
        playerName: label.playerName,
        fplName: label.fplName,
        teamName: team.entry_name || 'Unknown team',
        careerBestPct: career?.careerBestPct ?? metrics.careerBestPct,
        careerBestSeason: career?.careerBestSeason ?? metrics.careerBestSeason,
        careerAvgPct: career?.careerAvgPct ?? metrics.careerAvgPct,
        seasons: career?.seasons ?? metrics.seasons,
        rank: index + 1,
        lastRank: 0,
        month: metrics.month,
        gameweek: metrics.gameweek,
        gameweekGross: metrics.gameweekGross ?? null,
        hitCost: metrics.hitCost ?? null,
        chip: metrics.chip ?? null,
        captain: metrics.captain ?? null,
        vice: metrics.vice ?? null,
        yetToPlay: Number.isInteger(metrics.yetToPlay) ? metrics.yetToPlay : null,
        picksKnown: metrics.picksKnown === true,
        season: metrics.season ?? 'New',
        squad: metrics.squad || [],
      };
    });
    const rows = standingsRows.length ? standingsRows : newEntryRows;
    renderLiveStandings(container, rows);
    showLivePanels(rows);
    const stale = data.meta?.stale === true || data.meta?.freshness === 'stale';
    const degraded = !stale && (data.meta?.degraded === true || data.meta?.freshness === 'degraded');
    const heading = document.querySelector('#live-widget-section .section-label');
    if (heading && stale) heading.textContent = 'Last known standings (not live)';
    if (data.meta?.fetchedAt) {
      const updated = new Date(data.meta.fetchedAt);
      const time = updated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const status = document.createElement('p');
      status.className = 'live-status';
      status.setAttribute('role', 'status');
      if (stale) status.textContent = `Stale standings from ${time}. These are not live results.`;
      else if (degraded) status.textContent = `Last updated ${time}. Some live details are unavailable.`;
      else status.textContent = `Last updated ${time}`;
      container.appendChild(status);
    }
  } catch (error) {
    console.error("Error fetching live FPL data:", error);
    renderNextDeadline(null);
    hideLivePanels();
    container.innerHTML = '<div class="empty-note">Live standings are temporarily unavailable. Please try again shortly.</div>';
  }
}